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
 * Invokes the Supabase Edge Function to securely proxy a request to the SARTopo API.
 * The Edge Function handles the signing, protecting the API secret.
 */
const invokeSartopoProxy = async (supabase, method, path, sartopoConfig, payload = null) => {
  // The URLSearchParams object in sartopoConfig is not directly serializable to JSON.
  // We must convert it to a string before sending it to the edge function.
  const serializableConfig = {
    ...sartopoConfig,
    params: sartopoConfig?.params?.toString() || '',
  };

  const { data, error } = await supabase.functions.invoke('sartopo-proxy', {
    body: {
      method,
      path,
      sartopoConfig: serializableConfig, // Pass the serializable version
      payload,       // Pass payload for POST requests
    },
  });

  if (error) {
    throw new Error(`Edge Function Error: ${error.message}`);
  }

  // The edge function returns the JSON response from SARTopo directly.
  // If the SARTopo API itself returned an error, it will be in the `data` payload.
  if (data.error) {
    throw new Error(`SARTopo API Error: ${data.error}`);
  }

  return data;
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
  userName = 'SARTopo Sync'
}) => {
  if (!sartopoConfig.id || !opPeriodId || !incidentId) return null;

  // Map data is intentionally not cached. Fetch a complete, current map state
  // for every synchronization.
  const path = `/api/v1/map/${sartopoConfig.id}/since/0`;
  const data = await invokeSartopoProxy(supabase, 'GET', path, sartopoConfig);

  const fetchedAt = Date.now();
  const fetchedFeatures = data?.result?.state?.features || data?.features || [];

  // Reconcile assignments against the current complete map response.
  let syncedTitles = [];
  if (fetchedFeatures.length > 0) {
    const { data: existingAsns } = await supabase.from('assignments').select('*').eq('op_period_id', opPeriodId);
    const existingMap = new Map(existingAsns?.map(a => [a.sartopo_id, a]) || []);
    const existingTitleMap = new Map(existingAsns?.filter(a => a.title).map(a => [a.title.trim().toLowerCase(), a]) || []);
    const payloads = fetchedFeatures
      .filter(f => f.id && f.properties?.class === 'Assignment' && (f.properties.title || f.properties.name))
      .map(f => {
        const title = (f.properties.title || f.properties.name)?.trim().toLowerCase();
        const existing = existingMap.get(f.id) || (title ? existingTitleMap.get(title) : null);
        if (existing?.origin === 'SAROps' && !existing.sartopo_id) return null;
        return mapSartopoToAssignment(f, opPeriodId, existing);
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
    mergedMapData: data,
    fetchedAt, 
    fetchedFeatures, 
    syncedTitles,
    syncCount: syncedTitles.length
  };
};

/**
 * Creates a new SARTopo map via the secure proxy.
 */
export const createSartopoMap = async (supabase, mapTitle, sartopoConfig) => {
  // The client no longer needs to know the account ID. The proxy will handle it.
  // We send a generic path that the proxy will resolve.
  const path = `/api/v1/acct/collaborative-map`;
  const payload = {
    title: mapTitle,
    mode: "sar",
    state: {
      zoom: "13",
      center: [-105.2705, 40.0150],
      layers: ["mbt"]
    },
    sharing: "URL"
  };

  const data = await invokeSartopoProxy(supabase, 'POST', path, sartopoConfig, JSON.stringify(payload));
  return data;
};

/**
 * Uploads a GeoJSON feature to SARTopo via the secure proxy.
 */
export const uploadToSartopo = async (supabase, mapId, featureId, featurePayload, sartopoConfig) => {
  const path = `/api/v1/map/${mapId}/Assignment/${featureId}`;
  const data = await invokeSartopoProxy(supabase, 'POST', path, sartopoConfig, JSON.stringify(featurePayload));
  return data;
};
