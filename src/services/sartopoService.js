import { signSartopoRequest } from '../utils/sartopoAuth';
import { mapSartopoToAssignment } from '../utils/gisUtils';

/**
 * Robust SARTopo configuration parser.
 * Extracts the Map ID and query parameters from a URL or raw ID.
 * Proactively strips static security keys (k, readCode).
 */
export const getSartopoConfig = (sartopoId) => {
  let mapId = sartopoId?.trim();
  if (!mapId) return { id: null, params: new URLSearchParams(), query: '' };

  let params = new URLSearchParams();
  if (mapId.includes('?')) {
    const parts = mapId.split('?');
    mapId = parts[0];
    params = new URLSearchParams(parts[1]);
  }

  if (mapId.includes('/')) {
    mapId = mapId.split('/').pop() || mapId.split('/').slice(-2, -1)[0];
  }

  // Clean up trailing slashes or question marks
  if (mapId.endsWith('/')) mapId = mapId.slice(0, -1);

  // Requirement: Static key parameters are not used. 
  params.delete('k');
  params.delete('readCode');

  const query = params.toString() ? '?' + params.toString() : '';
  return { id: mapId, params, query };
};

/**
 * Shared helper for building signed SARTopo URLs.
 */
export const buildSecureSartopoUrl = async (method, path, sartopoConfig, payload = null) => {
  const credId = import.meta.env.VITE_SARTOPO_API_CREDENTIAL_ID || (typeof process !== 'undefined' ? process.env.VITE_SARTOPO_API_CREDENTIAL_ID : undefined);
  const secret = import.meta.env.VITE_SARTOPO_API_CREDENTIAL_SECRET || (typeof process !== 'undefined' ? process.env.VITE_SARTOPO_API_CREDENTIAL_SECRET : undefined);
  const authParams = new URLSearchParams();

  if (!credId || !secret) {
    throw new Error('SARTopo credentials not configured.');
  }

  const expires = Date.now() + (2 * 60 * 1000); // 2 minute window
  console.log(`[SARTopo] Signed API request generated. Secret: ${secret}, Expires: ${expires}`);
  const signature = await signSartopoRequest(method, path, expires, payload, secret);

  authParams.set('id', credId);
  authParams.set('expires', String(expires));
  authParams.set('signature', signature);

  // For GET requests, parameters go in the query string.
  // For POST requests, parameters go in the form-encoded body (returned as authParams).
  const useQuery = method.toUpperCase() !== 'POST';
  const queryBase = new URLSearchParams(sartopoConfig.params);
  if (useQuery) {
    authParams.forEach((v, k) => queryBase.set(k, v));
  }

  const queryString = queryBase.toString() ? '?' + queryBase.toString() : '';
  return { 
    url: `/sartopo-api${path}${queryString}`,
    authParams,
    credId,
    secret
  };
};

/**
 * Downloads map data from SARTopo and synchronizes assignments with SAROps.
 * Consolidates logic for fetching, raw data persistence, and assignment reconciliation.
 */
export const downloadAndSyncSartopoData = async ({ 
  supabase, 
  incidentId, 
  opPeriodId, 
  sartopoConfig, 
  lastFetchTime = 0,
  userName = 'SARTopo Sync'
}) => {
  if (!sartopoConfig.id || !opPeriodId || !incidentId) return null;

  const path = `/api/v1/map/${sartopoConfig.id}/since/${lastFetchTime}`;
  const { url, credId, secret } = await buildSecureSartopoUrl('GET', path, sartopoConfig);
  
  const response = await fetch(url);
  if (credId && secret) {
    console.log(`[SARTopo] Signed GET request ${path} completed. Status: ${response.status}`);
  }

  if (!response.ok) {
    const text = await response.text();
    // If the response is HTML, SARTopo is likely returning an error page (404/403)
    if (text.includes('<!DOCTYPE html>')) {
      throw new Error(`SARTopo returned an error page (HTTP ${response.status}). Verify the Map ID is correct and ensure "API Access" or "Offline Access" is enabled in map settings.`);
    }
    throw new Error(`SARTopo returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const fetchedAt = Date.now();
  const fetchedFeatures = data?.result?.state?.features || data?.features || [];

  // 1. Reconciliation Baseline - Merge new data with existing persisted state
  let mergedSartopoMapData = data;
  let baselineMirror = null;
  const { data: incRes } = await supabase.from('incidents').select('sartopo_map_data').eq('incident_id', incidentId).maybeSingle();
  if (incRes?.sartopo_map_data) {
    baselineMirror = incRes.sartopo_map_data;
    const baseFeatures = baselineMirror?.result?.state?.features || baselineMirror?.features || [];
    const featMap = new Map(baseFeatures.map(f => [f.id, f]));
    fetchedFeatures.forEach(f => { if (f.id) featMap.set(f.id, f); });
    mergedSartopoMapData = { type: "FeatureCollection", features: Array.from(featMap.values()) };
  }

  // 2. Persist raw map data to database
  await supabase.from('incidents').update({ sartopo_map_data: mergedSartopoMapData }).eq('incident_id', incidentId);

  // 3. Reconcile assignments
  let syncedTitles = [];
  if (fetchedFeatures.length > 0) {
    const { data: existingAsns } = await supabase.from('assignments').select('*').eq('op_period_id', opPeriodId);
    const existingMap = new Map(existingAsns?.map(a => [a.sartopo_id, a]) || []);
    const existingTitleMap = new Map(existingAsns?.filter(a => a.title).map(a => [a.title.trim().toLowerCase(), a]) || []);
    const baselineMap = new Map((baselineMirror?.result?.state?.features || baselineMirror?.features || []).map(f => [f.id, f]));

    const payloads = fetchedFeatures
      .filter(f => f.id && f.properties?.class === 'Assignment' && (f.properties.title || f.properties.name))
      .map(f => {
        const title = (f.properties.title || f.properties.name)?.trim().toLowerCase();
        const existing = existingMap.get(f.id) || (title ? existingTitleMap.get(title) : null);
        if (existing?.origin === 'SAROps' && !existing.sartopo_id) return null;
        return mapSartopoToAssignment(f, opPeriodId, existing, baselineMap.get(f.id));
      }).filter(Boolean);

    if (payloads.length > 0) {
      await supabase.from('assignments').upsert(payloads, { onConflict: 'op_period_id,sartopo_id' });
      syncedTitles = payloads.map(p => p.title);
      await supabase.from('action_logs').insert({ 
        incident_id: incidentId, 
        action: `Synced ${payloads.length} assignments from SARTopo: ${syncedTitles.join(', ')}`, 
        user_name: userName 
      });
    }
  }

  return { 
    data, 
    mergedMapData: mergedSartopoMapData, 
    fetchedAt, 
    baselineMirror, 
    fetchedFeatures, 
    syncedTitles,
    syncCount: syncedTitles.length
  };
};