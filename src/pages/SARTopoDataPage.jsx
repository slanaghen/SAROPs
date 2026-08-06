import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/styles.css';
import { mapSartopoToAssignment, mapAssignmentToSartopo } from '../utils/gisUtils';
import { SARTOPO_REFRESH_INTERVAL } from '../constants/operationalConstants';
import { 
  getSartopoConfig, 
  downloadAndSyncSartopoData,
  uploadToSartopo
} from '../services/sartopoService';
import { useToast } from '../context/ToastContext';
import '../styles/ActionButtons.css';
import SartopoHeader from '../components/sartopo/SartopoHeader';
import SartopoSyncedAssignments from '../components/sartopo/SartopoSyncedAssignments';
import SartopoGeoJsonDisplay from '../components/sartopo/SartopoGeoJsonDisplay';

const getSartopoMapUrl = (id) => {
  if (!id) return null;
  // The ID might be a full URL already
  if (id.startsWith('http')) return id;
  // Or just the map ID, clean of any query params
  return `https://sartopo.com/m/${id.split('?')[0]}`;
};

const SARTopoDataPage = () => {
  const { incidentId, isActive, incidentData, responderName, user } = useIncident();
  const [sartopoId, setSartopoId] = useState('');
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

  const [displayDensity, setDisplayDensity] = useState('compact');

  const sartopoUrl = getSartopoMapUrl(sartopoId);
  const sartopoCredsOk = import.meta.env.VITE_SARTOPO_ENABLED === 'true';

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
      const result = await downloadAndSyncSartopoData({
        supabase,
        incidentId,
        opPeriodId: incidentData.opPeriodId,
        sartopoConfig,
        userName: responderName || 'SARTopo Sync'
      });

      if (!result) return;
      const { mergedMapData: updates, fetchedAt, syncCount, syncedTitles } = result;

      setFeatures(updates);
      setLastFetchTime(fetchedAt);
      setSyncedAssignmentNames(syncedTitles);

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
      const displayFeatures = updates?.result?.state?.features || updates?.features || [];
      const displayList = displayFeatures
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
  }, [sartopoConfig, lastFetchTime, incidentData?.opPeriodId, incidentId, responderName, addToast, supabase]);

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

      let baseData = features;
      let fetchedFeatures = baseData?.result?.state?.features || baseData?.features || [];

      // If the current page state is incomplete, request a fresh map state.
      const isStateIncomplete = !baseData || 
                                fetchedFeatures.length === 0 || 
                                assignmentsToExport.some(asn => !fetchedFeatures.some(f => f.id === asn.sartopo_id));

      if (isStateIncomplete && assignmentsToExport.length > 0 && incidentId) {
        console.info('[SARTopo] Page state incomplete for reconciliation. Fetching current map data...');
        const syncResult = await downloadAndSyncSartopoData({
          supabase,
          incidentId,
          opPeriodId: incidentData.opPeriodId,
          sartopoConfig,
        });
        const retrievedData = syncResult?.data;

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
  }, [incidentData?.opPeriodId, lastUploadTime, setSyncedAssignmentNames, incidentId, sartopoConfig.id, features, addToast, sartopoId, supabase]);
  
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
    let successCount = 0;
    const successfulAssignments = [];
    let failCount = 0;
    const failedAssignments = [];
    
    try {
      const { id: mapId } = sartopoConfig;

      // Step 1: Incremental Baseline Reconciliation using the secure proxy
      const diffMapData = await downloadAndSyncSartopoData({
        supabase, incidentId, opPeriodId: incidentData.opPeriodId, sartopoConfig
      });
      const currentMapData = diffMapData?.mergedMapData || diffMapData?.data || diffMapData;
      const fetchedFeatures = currentMapData?.result?.state?.features || currentMapData?.features || [];

      if (fetchedFeatures.length === 0) {
        throw new Error('Reconciliation baseline is missing from the database. Please click "Download from SARTopo" first.');
      }

      // Update local state to keep UI in sync with the baseline we are using
      setFeatures(currentMapData);

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

        try {
          // Use the new service function to handle the upload
          const response = await uploadToSartopo(supabase, mapId, asn.sartopo_id, payload, sartopoConfig);
          console.log(`[SARTopo] Upload response for "${asn.title}":`, response);

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

      if (successCount > 0) {
        const finalMergedData = currentMapData.result 
          ? { ...currentMapData, result: { ...currentMapData.result, state: { ...currentMapData.result.state, features: updatedSartopoFeatures } } }
          : { ...currentMapData, features: updatedSartopoFeatures };
        
        setFeatures(finalMergedData);
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
  }, [sartopoId, sartopoConfig, incidentData?.opPeriodId, incidentId, lastFetchTime, features, addToast, lastUploadTime, setLastUploadTime, setSyncedAssignmentNames, setFeatures, supabase]);

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
              {sartopoId && (
              <a
                href={`https://sartopo.com/m/${sartopoConfig.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn action-btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                Open Map
              </a>
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
        <SartopoGeoJsonDisplay
          title={`GeoJSON Upload to SARTopo (${uploadGeoJSON?.features?.length || 0})`}
          data={uploadGeoJSON}
          isExpanded={isMapUploadExpanded}
          onToggleExpand={() => setIsMapUploadExpanded(prev => !prev)}
          showGeometry={showUploadGeometry}
          headerActions={
            <>
              {lastUploadTime > 0 && <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Since: {new Date(lastUploadTime).toLocaleTimeString()}</span>}
              <button className="action-btn action-btn-secondary action-btn-header" onClick={(e) => { e.stopPropagation(); setLastUploadTime(0); setUploadGeoJSON(null); }} disabled={!incidentData?.opPeriodId} title="Reset upload timestamp to include all assignments">Reset</button>
              <button className="action-btn action-btn-secondary action-btn-header" onClick={(e) => { e.stopPropagation(); setShowUploadGeometry(!showUploadGeometry); }} title={showUploadGeometry ? "Hide coordinates data" : "Show coordinates data"}>{showUploadGeometry ? 'Hide Geometry' : 'Show Geometry'}</button>
              <button className="action-btn action-btn-primary action-btn-header" onClick={(e) => { e.stopPropagation(); generateUploadGeoJSON(); }} disabled={isGeneratingUpload || !incidentData?.opPeriodId}>{isGeneratingUpload ? 'Generating...' : 'Generate JSON'}</button>
            </>
          }
        />
        <SartopoGeoJsonDisplay
          title={`GeoJSON Download from SARTopo (${filteredDownloadFeatures.length || 0})`}
          data={features ? { type: 'FeatureCollection', features: filteredDownloadFeatures } : null}
          isExpanded={isMapDownloadExpanded}
          onToggleExpand={() => setIsMapDownloadExpanded(prev => !prev)}
          showGeometry={showDownloadGeometry}
          headerActions={
            <>
              <button className="action-btn action-btn-secondary action-btn-header" onClick={(e) => { e.stopPropagation(); setShowAllDownloadObjects(!showAllDownloadObjects); }} title={showAllDownloadObjects ? "Show only Assignments" : "Show All Objects"}>{showAllDownloadObjects ? 'Assignments Only' : 'All Objects'}</button>
              <button className="action-btn action-btn-secondary action-btn-header" onClick={(e) => { e.stopPropagation(); setShowDownloadGeometry(!showDownloadGeometry); }} title={showDownloadGeometry ? "Hide coordinates data" : "Show coordinates data"}>{showDownloadGeometry ? 'Hide Geometry' : 'Show Geometry'}</button>
            </>
          }
        />
      </div>
    </div>
  );
};

export default SARTopoDataPage;
