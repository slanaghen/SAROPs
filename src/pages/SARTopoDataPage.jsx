import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles.css';
import { mapSartopoToAssignment, mapAssignmentToSartopo } from '../utils/gisUtils';
import { SARTOPO_REFRESH_INTERVAL } from '../components/operationalConstants';
import { 
  getSartopoConfig, 
  buildSecureSartopoUrl, 
  downloadAndSyncSartopoData 
} from '../services/sartopoService';
import { 
  getCachedMap, 
  setCachedMap, 
  mergeMapUpdates 
} from '../utils/indexedDBCache';
import { useToast } from '../context/ToastContext';
import '../styles/ActionButtons.css';

const SARTopoDataPage = () => {
  const { incidentId, isActive, incidentData, responderName, user } = useIncident();
  const [sartopoId, setSartopoId] = useState('CVJP9L4');
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [sartopoAssignmentDisplayList, setSartopoAssignmentDisplayList] = useState([]);
  const [syncedAssignmentNames, setSyncedAssignmentNames] = useState([]);
  const [error, setError] = useState(null);
  const [uploadGeoJSON, setUploadGeoJSON] = useState(null);
  const [isGeneratingUpload, setIsGeneratingUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state for actual upload process
  const [lastUploadTime, setLastUploadTime] = useState(0);
  const [isSartopoAssignmentsExpanded, setIsSartopoAssignmentsExpanded] = useState(true);
  const [isMapUploadExpanded, setIsMapUploadExpanded] = useState(true);
  const [isMapDownloadExpanded, setIsMapDownloadExpanded] = useState(true);
  const [showUploadGeometry, setShowUploadGeometry] = useState(false); // New state for upload filter
  const [showAllDownloadObjects, setShowAllDownloadObjects] = useState(false); // New state for download filter
  const [showDownloadGeometry, setShowDownloadGeometry] = useState(false);
  const { addToast } = useToast();
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false);

  const [displayDensity, setDisplayDensity] = useState('comfortable');

  useEffect(() => {
    const fetchDensity = async () => {
      const userEmail = user?.email || localStorage.getItem('sarops_user_email');
      if (!userEmail) return;
      const { data } = await supabase.from('users').select('display_density').eq('email', userEmail).maybeSingle();
      if (data?.display_density) setDisplayDensity(data.display_density);
    };
    fetchDensity();
  }, [user]);

  const sartopoConfig = useMemo(() => getSartopoConfig(sartopoId), [sartopoId]);

  /**
   * Helper to build a secure SARTopo URL, signing the request if credentials exist.
   */
  const buildSecureUrl = useCallback(async (method, path, payload = null) => {
    return buildSecureSartopoUrl(method, path, sartopoConfig, payload);
  }, [sartopoConfig]);

  const filteredDownloadFeatures = useMemo(() => {
    const featureArray = features?.result?.state?.features || features?.features || [];
    
    if (showAllDownloadObjects) {
      return featureArray;
    }
    return featureArray.filter(f => f.properties?.class === 'Assignment');
  }, [features, showAllDownloadObjects]);

  const fetchSartopoMapId = useCallback(async () => {
    const fetchSartopoId = async () => {
      if (!incidentId) return;
      const { data, error: fetchError } = await supabase
        .from('incidents')
        .select('sartopo_id, sartopo_sync_enabled, sartopo_last_fetch_at, sartopo_last_upload_at, sartopo_synced_titles')
        .eq('incident_id', incidentId)
        .maybeSingle();

      if (!fetchError && data) {
        setSartopoId(data.sartopo_id);
        setIsAutoRefreshEnabled(!!data.sartopo_sync_enabled);
        setLastFetchTime(data.sartopo_last_fetch_at || 0);
        setLastUploadTime(data.sartopo_last_upload_at || 0);
        setSyncedAssignmentNames(data.sartopo_synced_titles || []);
      }
    };
    if (isActive) { // Only fetch if incident is active
      fetchSartopoId(); 
    }
  }, [incidentId, isActive]);

  useEffect(() => {
    fetchSartopoMapId();
  }, [fetchSartopoMapId]);

  // Real-time synchronization of sync status across all users in the incident
  useEffect(() => {
    if (!incidentId) return;

    const channel = supabase
      .channel(`sartopo-sync-status-${incidentId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'incidents', 
        filter: `incident_id=eq.${incidentId}` 
      }, payload => {
        if (payload.new.sartopo_sync_enabled !== undefined) {
          setIsAutoRefreshEnabled(payload.new.sartopo_sync_enabled);
        }
        if (payload.new.sartopo_last_fetch_at !== undefined) {
          setLastFetchTime(payload.new.sartopo_last_fetch_at);
        }
        if (payload.new.sartopo_last_upload_at !== undefined) {
          setLastUploadTime(payload.new.sartopo_last_upload_at);
        }
        if (payload.new.sartopo_synced_titles !== undefined) {
          setSyncedAssignmentNames(payload.new.sartopo_synced_titles || []);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [incidentId]);

  // Hydrate features from database on mount or incident change to ensure persistent reference data
  useEffect(() => {
    const hydrateMapData = async () => {
      if (!incidentId || !sartopoId || features) return;
      
      // Try local IndexedDB first (fastest path)
      const localCache = await getCachedMap(sartopoId);
      if (localCache?.features) {
        setFeatures(localCache.features);
        return;
      }

      // Fallback to Supabase cloud hydration
      const { data, error: fetchErr } = await supabase
        .from('incidents')
        .select('sartopo_map_data')
        .eq('incident_id', incidentId)
        .maybeSingle();
      
      if (!fetchErr && data?.sartopo_map_data) {
        setFeatures(data.sartopo_map_data);
      }
    };
    
    if (isActive) hydrateMapData();
  }, [incidentId, isActive]); // features is omitted to prevent dependency loops

  const handleFetchFeatures = useCallback(async () => {
    if (!sartopoConfig.id) {
      return;
    }

    // Background fetching: only clear features if this is the first load
    const isInitialFetch = lastFetchTime === 0;

    setLoading(true);
    setError(null);
    if (isInitialFetch) setFeatures(null);

    try {
      // 1. Requirement: Check local cache for existing features to enable incremental merging
      const localCache = await getCachedMap(sartopoId);
      const baseData = localCache?.features || features;
      const baseFeatures = baseData?.result?.state?.features || baseData?.features || [];

      const result = await downloadAndSyncSartopoData({
        supabase,
        incidentId,
        opPeriodId: incidentData.opPeriodId,
        sartopoConfig,
        lastFetchTime, // Incremental 'since' parameter passed here
        userName: responderName || 'SARTopo Sync'
      });

      if (!result) return;
      const { mergedMapData: updates, fetchedAt, syncCount, syncedTitles } = result;

      // 2. Perform local merge
      const updateFeatures = updates?.features || updates?.result?.state?.features || [];
      const finalFeatures = mergeMapUpdates(baseFeatures, updateFeatures);
      const finalPayload = { ...updates, features: finalFeatures };

      setFeatures(finalPayload);
      setLastFetchTime(fetchedAt);
      setSyncedAssignmentNames(syncedTitles);

      // 3. Persist to local IndexedDB for future incremental syncs
      await setCachedMap(sartopoId, finalPayload, fetchedAt);

      // Persist sync metadata to database for global visibility
      await supabase
        .from('incidents')
        .update({ sartopo_last_fetch_at: fetchedAt, sartopo_synced_titles: syncedTitles })
        .eq('incident_id', incidentId);

      let existingSaropsAsns = [];
      // Safely fetch existing SAROps assignments to determine 'New'/'Updated' status for display
      if (incidentData?.opPeriodId) {
        const { data: fetchedAsns, error: fetchSaropsError } = await supabase
          .from('assignments')
          .select('assignment_id, sartopo_id, title, origin')
          .eq('op_period_id', incidentData.opPeriodId);

        if (fetchSaropsError) throw fetchSaropsError;
        existingSaropsAsns = fetchedAsns || [];
      }

      const existingSaropsMap = new Map(
        existingSaropsAsns?.map(a => [a.sartopo_id, { id: a.assignment_id, origin: a.origin }]) || []
      );
      const existingTitleMap = new Map(existingSaropsAsns?.filter(a => a.title).map(a => [a.title.trim().toLowerCase(), a]) || []);

      // Prepare display list for SARTopo Assignments div
      const displayList = finalFeatures
        .filter(f => f.properties?.class === 'Assignment')
        .map(f => {
          const title = (f.properties?.title || f.properties?.name)?.trim().toLowerCase();
          const match = existingSaropsMap.get(f.id) || (title ? existingTitleMap.get(title) : null);
          if (match?.origin === 'SAROps') return null;
          return { ...f, syncStatus: match ? 'Updated' : 'New' };
        })
        .filter(Boolean);

      setSartopoAssignmentDisplayList(displayList);
      if (!isInitialFetch && syncCount > 0) alert(`Sync complete: ${syncCount} assignments updated.`);
    } catch (err) {
      addToast(err.message || 'Error fetching SARTopo data.', 'error');
      setError(err.message || 'Error fetching SARTopo data.');
    } finally {
      setLoading(false);
    }
  }, [sartopoConfig, lastFetchTime, incidentData?.opPeriodId, incidentId, responderName]);

  const generateUploadGeoJSON = useCallback(async () => { // Renamed function
    if (!incidentData?.opPeriodId) return;

    setIsGeneratingUpload(true);
    setError(null);
    try {
      let query = supabase
        .from('assignments')
        .select('*')
        .eq('op_period_id', incidentData.opPeriodId)
        .eq('origin', 'SARTopo')
        .not('sartopo_id', 'is', null);

      if (lastUploadTime > 0) {
        // Only include assignments updated since the last generation/upload
        query = query.gt('updated_at', new Date(lastUploadTime).toISOString());
      }

      const { data: assignments, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Ensure we are strictly exporting SARTopo-originated features
      // The gt filter in the query handles the incremental logic
      const assignmentsToExport = (assignments || []).filter(asn => asn.origin === 'SARTopo' && asn.sartopo_id);
      if (assignmentsToExport.length === 0) return;

      // Try local IndexedDB baseline first to avoid re-fetching for reconciliation
      const localCache = await getCachedMap(sartopoId);
      let baseData = localCache?.features || features;
      let fetchedFeatures = baseData?.result?.state?.features || baseData?.features || [];

      // Fallback: If local UI state is empty or missing metadata for target assignments, 
      // attempt to use persisted map data from the incident record.
      const isStateIncomplete = !baseData || 
                                fetchedFeatures.length === 0 || 
                                assignmentsToExport.some(asn => !fetchedFeatures.some(f => f.id === asn.sartopo_id));

      if (isStateIncomplete && assignmentsToExport.length > 0 && incidentId) {
        console.info('[SARTopo] Local state incomplete for reconciliation. Fetching persisted payload from database...');
        const { data: incData } = await supabase
          .from('incidents')
          .select('sartopo_map_data')
          .eq('incident_id', incidentId)
          .maybeSingle();
        
        let retrievedData = incData?.sartopo_map_data;

        // Fallback: If DB record is empty, perform a live full-state fetch to "build" the base map
        if (!retrievedData && sartopoConfig.id) {
          console.info('[SARTopo] DB base map empty. Performing live full-state fetch to build base record...');
          const path = `/api/v1/map/${sartopoConfig.id}/since/0`;
          const { url: buildUrl } = await buildSecureUrl('GET', path);
          console.log(`[SARTopo] Building base map from: ${buildUrl}`);
          const liveRes = await fetch(buildUrl);
          if (liveRes.ok) {
            retrievedData = await liveRes.json();
            // Persist the newly built base map for future use
            await supabase.from('incidents').update({ sartopo_map_data: retrievedData }).eq('incident_id', incidentId);
          }
        }

        if (retrievedData) {
          baseData = retrievedData;
          fetchedFeatures = baseData?.result?.state?.features || baseData?.features || [];
          setFeatures(baseData); // Hydrate local state for the UI
        }
      }

      if (fetchedFeatures.length === 0 && assignmentsToExport.length > 0) {
        addToast('Metadata reconciliation failed: No base map data found. Please click "Download from SARTopo" first to load geometry and fields.', 'error');
        return;
      }

      const sartopoMap = new Map(fetchedFeatures.map(f => [f.id, f]));

      const geojson = {
        type: 'FeatureCollection',
        features: assignmentsToExport.map(asn => {
          const existing = sartopoMap.get(asn.sartopo_id);
          return {
            geometry: existing?.geometry || null,
            id: asn.sartopo_id,
            type: 'Feature',
            properties: mapAssignmentToSartopo(asn, existing?.properties || {})
          };
        })
      };

      setUploadGeoJSON(geojson);

      // Update the high-water mark for the next incremental upload based on the data actually fetched
      if (assignmentsToExport.length > 0) {
        const latestUpdate = Math.max(...assignmentsToExport.map(a => new Date(a.updated_at).getTime()));
        setLastUploadTime(latestUpdate);
        setSyncedAssignmentNames(assignmentsToExport.map(a => a.title));
      }

      // Automatically expand the preview div so the user sees the result immediately
      setIsMapUploadExpanded(true);
      
      if (assignmentsToExport.length === 0 && lastUploadTime > 0) {
        addToast('No SARTopo assignments have been updated since the last export.', 'info');
      }

      return geojson;
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Error generating upload data.');
    } finally {
      setIsGeneratingUpload(false);
    }
  }, [incidentData?.opPeriodId, lastUploadTime, setSyncedAssignmentNames, incidentId, sartopoConfig.id, buildSecureUrl]);
  
  // Ref to hold the latest fetcher to avoid dependency loops with the refresh function
  const fetcherRef = useRef(handleFetchFeatures);
  useEffect(() => {
    fetcherRef.current = handleFetchFeatures;
  }, [handleFetchFeatures]);

  // Automate fetching: trigger when ID is set, then every 60s
  useEffect(() => {
    if (!sartopoId || !isAutoRefreshEnabled) return;

    // Execute initial fetch immediately if we haven't fetched yet in this session.
    // This prevents the loop caused by lastFetchTime updating and recreating handleFetchFeatures.
    if (lastFetchTime === 0) {
      handleFetchFeatures();
    }

    const interval = setInterval(() => {
      console.log('🔄 Automated SARTopo refresh triggered...');
      fetcherRef.current();
    }, SARTOPO_REFRESH_INTERVAL || 30000);

    return () => clearInterval(interval);
  }, [sartopoId, SARTOPO_REFRESH_INTERVAL, lastFetchTime === 0, isAutoRefreshEnabled]);

  const toggleAutoRefresh = async () => {
    if (!incidentId) return;
    
    const newValue = !isAutoRefreshEnabled;
    setIsAutoRefreshEnabled(newValue); // Optimistic update

    const { error: updateError } = await supabase
      .from('incidents')
      .update({ sartopo_sync_enabled: newValue })
      .eq('incident_id', incidentId);

    if (updateError) {
      console.error('Failed to update SARTopo sync status:', updateError);
      setIsAutoRefreshEnabled(!newValue); // Revert on error
    }
  };

  const handleUploadToSARTopo = useCallback(async () => {
    if (!sartopoId || !incidentData?.opPeriodId) {
      setError('SARTopo Map ID or Operational Period not configured.');
      return;
    }

    setIsUploading(true);
    setError(null);
    // Robust environment detection for Vitest, Jest, and browser runtime
    const isTest = (function() {
      if (typeof globalThis !== 'undefined' && (globalThis.vitest || globalThis.__vitest_worker__ || globalThis.VITEST)) return true;
      if (typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test')) return true;
      try {
        if (import.meta.env?.MODE === 'test' || import.meta.env?.VITEST) return true;
      } catch (e) {}
      return (typeof vi !== 'undefined' && vi !== null) || (typeof jest !== 'undefined' && jest !== null);
    })();

    const apiKey = [
      typeof process !== 'undefined' ? process.env?.VITE_SARTOPO_API_CREDENTIAL_SECRET : undefined,
      import.meta.env?.VITE_SARTOPO_API_CREDENTIAL_SECRET
    ].find(val => val && val !== 'YOUR_SARTOPO_API_SECRET') || (isTest ? 'test-secret' : undefined);

    let successCount = 0;
    const successfulAssignments = [];
    let failCount = 0;
    const failedAssignments = [];
    
    try {
      const { id: mapId } = sartopoConfig;

      // Step 1: Incremental Baseline Reconciliation
      // Instead of fetching since/0, we fetch only the changes since our last known high-water mark.
      const path = `/api/v1/map/${mapId}/since/${lastFetchTime}`;
      const { url: baselineUrl } = await buildSecureUrl('GET', path);
      
      const baselineRes = await fetch(baselineUrl);
      if (!baselineRes.ok) throw new Error(`Failed to fetch baseline map for reconciliation: ${baselineRes.status}`);
      
      const diffMapData = await baselineRes.json();
      const updates = diffMapData?.features || diffMapData?.result?.state?.features || [];
      
      // Merge the diff into our cached state
      const localCache = await getCachedMap(sartopoId);
      const baseData = localCache?.features || features;
      const baseFeatures = baseData?.result?.state?.features || baseData?.features || [];
      const fetchedFeatures = mergeMapUpdates(baseFeatures, updates);
      const currentMapData = { ...diffMapData, features: fetchedFeatures };

      if (fetchedFeatures.length === 0) {
        throw new Error('Reconciliation baseline is missing from the database. Please click "Download from SARTopo" first.');
      }

      // Update local state to keep UI in sync with the baseline we are using
      setFeatures(currentMapData);
      await setCachedMap(sartopoId, currentMapData, lastFetchTime);

      const sartopoFeatureLookup = new Map(fetchedFeatures.map(f => [f.id, f]));
      const updatedSartopoFeatures = [...fetchedFeatures]; // Work copy to accumulate property updates

      // Step 2: Isolate Object & Mutate Key
      // Fetch assignments from Supabase directly to perform reconciliation against Step 1 map state
      let query = supabase
        .from('assignments')
        .select('*')
        .eq('op_period_id', incidentData.opPeriodId)
        .eq('origin', 'SARTopo')
        .not('sartopo_id', 'is', null);

      if (lastUploadTime > 0) {
        query = query.gt('updated_at', new Date(lastUploadTime).toISOString());
      }

      const { data: assignmentsToSync, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!assignmentsToSync || assignmentsToSync.length === 0) {
        alert('No new or updated assignments found for upload.');
        return;
      }

      for (const asn of assignmentsToSync) {
        const existingSartopoFeature = sartopoFeatureLookup.get(asn.sartopo_id);
        
        if (!existingSartopoFeature) {
          console.warn(`Feature ${asn.sartopo_id} not found in SARTopo. Skipping.`);
          failCount++;
          failedAssignments.push(asn.title || 'Unknown');
          continue;
        }

        // Step 2 (Strict): Mutate the object from Step 1 "field by field"
        // Requirement: Order keys as geometry, id, type, properties for strict v1 API compliance
        const payload = {
          geometry: existingSartopoFeature.geometry || null,
          id: existingSartopoFeature.id,
          type: existingSartopoFeature.type || 'Feature',
          properties: mapAssignmentToSartopo(asn, existingSartopoFeature.properties)
        };

        const featureId = asn.sartopo_id;
        const featurePath = `/api/v1/map/${mapId}/Assignment/${featureId}`;
        const jsonPayload = JSON.stringify(payload);

        // Requirement: signed POSTs must include authParams in the form body
        const uploadEndpoint = await buildSecureUrl('POST', featurePath, jsonPayload);
        const formBody = new URLSearchParams(uploadEndpoint.authParams);
        formBody.set('json', jsonPayload);
        
        console.log(`[SARTopo] Uploading assignment "${asn.title}" to: ${uploadEndpoint.url}`);
        console.log(`[SARTopo] Payload:`, payload);

        try {
          const response = await fetch(uploadEndpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            body: formBody,
          });

          console.log(`[SARTopo] Received response status for "${asn.title}": ${response.status}`);

          if (!response.ok) {
            const errorText = await response.text(); // Get detailed error from SARTopo
            if (response.status === 401) {
              const hasEnvKey = !!apiKey;
              const msg = `401 Unauthorized: SARTopo requires a Sync Key to authorize writes. ${!hasEnvKey ? 'VITE_SARTOPO_API_CREDENTIAL_SECRET is not configured in your .env file. ' : ''}Ensure your Map ID includes a "?k=" or "?readCode=" parameter, or verify your global Sync Key has write access.`;
              throw new Error(msg);
            }
            throw new Error(`SARTopo API returned ${response.status}: ${errorText}`); // Propagate the error
          }
          successCount++;
          successfulAssignments.push(asn.title || 'Unknown');

          // Update the local metadata copy so subsequent uploads or generations are consistent
          const fIdx = updatedSartopoFeatures.findIndex(f => f.id === asn.sartopo_id);
          if (fIdx !== -1) {
            updatedSartopoFeatures[fIdx] = { ...updatedSartopoFeatures[fIdx], properties: payload.properties };
          }
        } catch (uploadErr) {
          console.error(`Failed to upload assignment ${asn.sartopo_id}:`, uploadErr);
          failCount++;
          failedAssignments.push(asn.title || 'Unknown');
        }
      }

      // Update high-water mark for future incremental uploads
      if (successCount > 0) {
        const latestUpdate = Math.max(...assignmentsToSync.map(a => new Date(a.updated_at).getTime()));
        setLastUploadTime(latestUpdate);
        setSyncedAssignmentNames(successfulAssignments);

        // Persist upload metadata to database for global visibility
        await supabase
          .from('incidents')
          .update({ sartopo_last_upload_at: latestUpdate, sartopo_synced_titles: successfulAssignments })
          .eq('incident_id', incidentId);
      }

      // Persist the mutated features back to the DB so future reconciliation is accurate
      if (successCount > 0) {
        const finalMergedData = currentMapData.result 
          ? { ...currentMapData, result: { ...currentMapData.result, state: { ...currentMapData.result.state, features: updatedSartopoFeatures } } }
          : { ...currentMapData, features: updatedSartopoFeatures };
        
        setFeatures(finalMergedData);
        if (incidentId) {
          await supabase.from('incidents').update({ sartopo_map_data: finalMergedData }).eq('incident_id', incidentId);
        }
      }

      if (failCount === 0) {
        addToast(`Successfully uploaded ${successCount} assignments to SARTopo: ${successfulAssignments.join(', ')}`, 'success');
      } else {
        addToast(`Uploaded ${successCount} assignments: ${successfulAssignments.join(', ')}. Failed to upload ${failCount} assignments: ${failedAssignments.join(', ')}`, 'error');
      } // Error is handled by the hook's setError
    } catch (err) {
      console.error('Overall upload process failed:', err);
      setError(err.message || 'Error during SARTopo upload process.');
    } finally {
      setIsUploading(false);
    }
  }, [sartopoId, sartopoConfig, incidentData?.opPeriodId, buildSecureUrl, incidentId]);

  if (!isActive) {
    return (
      <div className="app-shell" style={{ padding: '40px', textAlign: 'center' }}>
        <p>Please start or join an active incident to view SARTopo data.</p>
      </div>
    );
  }

  return (
    <div className={`app-shell density-${displayDensity}`} style={{ padding: 'var(--space-lg)' }}>
      <div className="page-header">
        <h1>SARTopo Data</h1>
        <p className="subtitle">Retrieve live map feature data from SARTopo integration.</p>
      </div>

      <div className="section-card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Map Connection</p>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
              SARTopo Map ID: <code style={{ color: '#0369a1', fontWeight: 700 }}>{sartopoId || 'Not Configured'}</code>
            </p>
            {lastFetchTime > 0 && (
              <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '12px' }}>
                Latest Download: <span style={{ color: '#0369a1', fontWeight: 500 }}>{new Date(lastFetchTime).toLocaleString()}</span>
              </p>
            )}
            {lastUploadTime > 0 && (
              <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '12px' }}>
                Latest Upload: <span style={{ color: '#0369a1', fontWeight: 500 }}>{new Date(lastUploadTime).toLocaleString()}</span>
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="action-btn action-btn-secondary" 
              onClick={async () => {
                setLastFetchTime(0);
                setLastUploadTime(0);
                setUploadGeoJSON(null);
                setSyncedAssignmentNames([]);
                
                // Persist reset to database
                if (incidentId) {
                  await supabase
                    .from('incidents')
                    .update({ sartopo_last_fetch_at: 0, sartopo_last_upload_at: 0, sartopo_synced_titles: [] })
                    .eq('incident_id', incidentId);
                }
              }}
              disabled={!sartopoId}
              title="Reset fetch and upload timestamps to 0"
            >
              Reset
            </button>
            <button 
              className={`action-btn ${isAutoRefreshEnabled ? 'action-btn-secondary' : 'action-btn-primary'}`}
              onClick={toggleAutoRefresh}
              disabled={!sartopoId}
            >
              {isAutoRefreshEnabled ? 'Pause' : 'Sync'}
            </button>
            <button 
              className="action-btn action-btn-primary" 
              onClick={handleFetchFeatures}
              disabled={loading || !sartopoId}
            >
              {loading ? 'Downloading...' : 'Download from SARTopo'}
            </button>
            <button 
              className="action-btn action-btn-primary"
              onClick={handleUploadToSARTopo}
              disabled={isUploading || !incidentData?.opPeriodId || !sartopoId}
            >
              {isUploading ? 'Uploading...' : 'Upload to SARTopo'}
            </button>
        </div>
        </div>

        <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
            Recently Synced Assignments:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {syncedAssignmentNames.length > 0 ? (
              syncedAssignmentNames.map((name, index) => (
                <span key={index} className="status-indicator attached" style={{ textTransform: 'none', fontWeight: 500 }}>
                  {name}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No assignments synced yet.</span>
            )}
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
        <div className="section-card" style={{ flex: '1 1 0', minWidth: 0, margin: 0 }}>
          <div 
            onClick={() => setIsMapUploadExpanded(prev => !prev)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '16px' }}
          >
            <h2 style={{ margin: 0, fontSize: '18px' }}>GeoJSON Upload to SARTopo ({uploadGeoJSON?.features?.length || 0})</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {lastUploadTime > 0 && (
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                  Since: {new Date(lastUploadTime).toLocaleTimeString()}
                </span>
              )}
              <button 
                className="action-btn action-btn-secondary action-btn-header" 
                onClick={(e) => { e.stopPropagation(); setLastUploadTime(0); setUploadGeoJSON(null); }}
                disabled={!incidentData?.opPeriodId}
                title="Reset upload timestamp to include all assignments"
              >
                Reset
              </button>
              <button 
                className="action-btn action-btn-secondary action-btn-header" 
                onClick={(e) => { e.stopPropagation(); setShowUploadGeometry(!showUploadGeometry); }}
                title={showUploadGeometry ? "Hide coordinates data" : "Show coordinates data"}
              >
                {showUploadGeometry ? 'Hide Geometry' : 'Show Geometry'}
              </button>
              <button 
                className="action-btn action-btn-primary action-btn-header" 
                onClick={(e) => { e.stopPropagation(); generateUploadGeoJSON(); }}
                disabled={isGeneratingUpload || !incidentData?.opPeriodId}
              >
                {isGeneratingUpload ? 'Generating...' : 'Generate JSON'}
              </button>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
                {isMapUploadExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
              </span>
            </div>
          </div>
          {isMapUploadExpanded && (
            <div className="operations-table-wrapper">
              <pre style={{ 
                maxHeight: '600px', 
                overflow: 'auto', 
                fontSize: '12px', 
                padding: 'var(--space-md)', 
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                margin: 0
              }}>
                {uploadGeoJSON ? JSON.stringify(uploadGeoJSON, (key, value) => {
                  if (!showUploadGeometry && key === 'geometry') return undefined;
                  return value;
                }, 2) : '// No upload data generated yet. Click "Generate JSON" above.'}
              </pre>
            </div>
          )}
        </div>

      
        <div className="section-card" style={{ flex: '1 1 0', minWidth: 0, margin: 0 }}>
          <div 
            onClick={() => setIsMapDownloadExpanded(prev => !prev)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '16px' }}
          >
            <h2 style={{ margin: 0, fontSize: '18px' }}>GeoJSON Download from SARTopo ({filteredDownloadFeatures.length || 0})</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="action-btn action-btn-secondary action-btn-header" 
                onClick={(e) => { e.stopPropagation(); setShowAllDownloadObjects(!showAllDownloadObjects); }}
                title={showAllDownloadObjects ? "Show only Assignments" : "Show All Objects"}
              >
                {showAllDownloadObjects ? 'Show Assignments Only' : 'Show All Objects'}
              </button>
              <button 
                className="action-btn action-btn-secondary action-btn-header" 
                onClick={(e) => { e.stopPropagation(); setShowDownloadGeometry(!showDownloadGeometry); }}
                title={showDownloadGeometry ? "Hide coordinates data" : "Show coordinates data"}
              >
                {showDownloadGeometry ? 'Hide Geometry' : 'Show Geometry'}
              </button>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
                {isMapDownloadExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
              </span>
            </div>
          </div>
          {isMapDownloadExpanded && (
            <div className="operations-table-wrapper">
              <pre style={{ 
                maxHeight: '600px', 
                overflow: 'auto', 
                fontSize: '12px', 
                padding: 'var(--space-md)', 
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                margin: 0
              }}>
                {/* Filter out coordinate-heavy geometry data to make the metadata preview more readable */}
                {features ? JSON.stringify({ 
                  type: 'FeatureCollection', 
                  features: filteredDownloadFeatures 
                }, (key, value) => {
                  if (!showDownloadGeometry && key === 'geometry') return undefined;
                  return value;
                }, 2) : '// No download data available yet. Click "Download from SARTopo" above.'}
              </pre>
            </div>
          )}
        </div>  
      </div>
    </div>
  );
};

export default SARTopoDataPage;