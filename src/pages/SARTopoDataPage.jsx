import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles.css';
import { mapSartopoToAssignment, mapAssignmentToSartopo } from '../utils/gisUtils';
import { normalizeResourceTypeName } from '../utils/dataNormalization';
import { SARTOPO_REFRESH_INTERVAL } from '../components/operationalConstants';

const SARTopoDataPage = () => {
  const { incidentId, isActive, incidentData } = useIncident();
  const [sartopoId, setSartopoId] = useState('CVJP9L4');
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [sartopoAssignmentDisplayList, setSartopoAssignmentDisplayList] = useState([]);
  const [syncedAssignmentNames, setSyncedAssignmentNames] = useState([]);
  const [syncing, setSyncing] = useState(false);
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
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('sarops_sartopo_sync_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const sartopoConfig = useMemo(() => {
    let mapId = sartopoId?.trim();
    if (!mapId) return { id: null, query: '' };

    let query = '';
    if (mapId.includes('?')) {
      const parts = mapId.split('?');
      mapId = parts[0];
      query = '?' + parts[1];
    }

    if (mapId.includes('/')) {
      mapId = mapId.split('/').pop() || mapId.split('/').slice(-2, -1)[0];
    }

    // Clean up trailing slashes or question marks before merging
    if (mapId.endsWith('/')) mapId = mapId.slice(0, -1);
    if (query === '?') query = '';

    // Inject Sync Key from environment variable if configured and not already present in the Map ID
    // Note: Variable must be prefixed with VITE_ to be exposed to the client
    const apiKey = import.meta.env.VITE_SARTOPO_API_KEY?.trim();
    if (apiKey && !query.includes('k=')) {
      query = query ? `${query}&k=${apiKey}` : `?k=${apiKey}`;
    }

    return { id: mapId, query };
  }, [sartopoId]);

  const fetchUrl = useMemo(() => {
    if (!sartopoConfig.id) return null;
    return `/sartopo-api/api/v1/map/${sartopoConfig.id}/since/${lastFetchTime}${sartopoConfig.query}`;
  }, [sartopoConfig, lastFetchTime]);

  const uploadUrl = useMemo(() => {
    if (!sartopoConfig.id) return null;
    return `/sartopo-api/api/v1/map/${sartopoConfig.id}/features${sartopoConfig.query}`;
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
        .select('sartopo_id')
        .eq('incident_id', incidentId)
        .maybeSingle();

      if (!fetchError && data) {
        setSartopoId(data.sartopo_id);
      }
    };
    if (isActive) { // Only fetch if incident is active
      fetchSartopoId(); 
    }
  }, [incidentId, isActive]);

  useEffect(() => {
    fetchSartopoMapId();
  }, [fetchSartopoMapId]);

  /**
   * Reconciles SARTopo features with SAROps assignments.
   * If a SARTopo assignment is not present in SAROps (based on sartopo_id),
   * a new SAROps assignment is created.
   */
  const syncSartopoAssignments = useCallback(async (providedFeatures = null) => {
    const featuresToSync = providedFeatures || features?.result?.state?.features || features?.features;
    if (!featuresToSync?.length || !incidentData?.opPeriodId) return;

    setSyncing(true);
    try {
      // 1. Fetch existing assignments for this OP to identify which to update vs create
      const { data: existingAsns, error: fetchError } = await supabase
        .from('assignments')
        .select('*') // Retrieve all columns to allow complete reconciliation during mapping
        .eq('op_period_id', incidentData.opPeriodId);

      if (fetchError) throw fetchError;
      
      const existingMapById = new Map();
      const existingMapByTitle = new Map();
      
      existingAsns?.forEach(a => {
        if (a.sartopo_id) {
          existingMapById.set(a.sartopo_id, a);
        }
        if (a.title) {
          existingMapByTitle.set(a.title.trim().toLowerCase(), a);
        }
      });

      // 2. Prepare payloads for both new and existing assignments, focusing on SARTopo 'Assignment' objects
      const syncPayloads = featuresToSync
        .filter(f => f.id)
        .filter(f => f.properties?.class === 'Assignment') // Ensure we only sync valid SARTopo assignment objects
        .filter(f => f.properties?.title || f.properties?.name)
        .map(f => {
          const title = f.properties.title || f.properties.name;
          const normalizedTitle = title?.trim().toLowerCase();
          // Prevent duplicates by checking SARTopo ID first, then fallback to matching by title for SAROps-originated records
          const existing = existingMapById.get(f.id) || (normalizedTitle ? existingMapByTitle.get(normalizedTitle) : null);

          // Requirement: If an assignment is linked (has a sartopo_id), allow SARTopo to update its metadata.
          // Only skip if the assignment originated in SAROps AND has no SARTopo ID yet (unlinked).
          if (existing?.origin === 'SAROps' && !existing.sartopo_id) {
            return null;
          }

          // mapSartopoToAssignment handles id mapping internally if existing is provided
          return mapSartopoToAssignment(f, incidentData.opPeriodId, existing);
        })
        .filter(Boolean); // Filter out items excluded due to SAROps origin

      if (syncPayloads.length === 0) {
        if (!providedFeatures) alert('No assignments found to sync.');
        return;
      }

      // 3. Upsert assignments in Supabase.
      // Use the natural composite unique key (op_period_id + sartopo_id) to resolve conflicts.
      // This ensures new features get auto-generated assignment_ids from the DB.
      const { error: syncError } = await supabase
        .from('assignments')
        .upsert(syncPayloads, { onConflict: 'op_period_id,sartopo_id' });

      if (syncError) throw syncError;
      
      const createdCount = syncPayloads.filter(p => !p.assignment_id).length;
      const updatedCount = syncPayloads.length - createdCount;
      
      if (!providedFeatures) {
        alert(`Sync complete: ${createdCount} created, ${updatedCount} updated.`);
      }
      setSyncedAssignmentNames(syncPayloads.map(p => p.title));
    } catch (err) {
      console.error('SARTopo Sync Error:', err);
      setError(err.message || 'Error syncing assignments.');
    } finally {
      setSyncing(false);
    }
  }, [features?.features, incidentData?.opPeriodId, setError, setSyncing, setSyncedAssignmentNames]);

  const handleFetchFeatures = useCallback(async () => {
    if (!fetchUrl) {
      setError('No SARTopo Map ID found for this incident.');
      return;
    }

    // Background fetching: only clear features if this is the first load
    const isInitialFetch = lastFetchTime === 0;

    setLoading(true);
    setError(null);
    if (isInitialFetch) setFeatures(null);

    try {
      // Using the Vite proxy configured in vite.config.js to bypass CORS
      const response = await fetch(fetchUrl);
      
      if (!response.ok) {
        const text = await response.text();
        // If the response is HTML, SARTopo is likely returning an error page (404/403)
        if (text.includes('<!DOCTYPE html>')) {
          throw new Error(`SARTopo returned an error page (HTTP ${response.status}). Verify the Map ID is correct and ensure "API Access" or "Offline Access" is enabled in map settings.`);
        }
        throw new Error(`SARTopo returned ${response.status}: ${response.statusText}`);
      }

      // Check content type to prevent JSON parsing errors if we received HTML
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        const text = await response.text();
        if (text.includes('<!DOCTYPE html>')) {
          throw new Error('SARTopo returned an HTML page instead of GeoJSON data. This often happens if the Map ID is invalid.');
        }
      }

      const data = await response.json();
      setFeatures(data);
      setLastFetchTime(Date.now());

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
      const existingSaropsTitleMap = new Map(
        existingSaropsAsns?.filter(a => a.title).map(a => [a.title.trim().toLowerCase(), { id: a.assignment_id, origin: a.origin }]) || []
      );

      // Prepare display list for SARTopo Assignments div
      const fetchedFeatures = data?.result?.state?.features || data?.features || [];
      const displayList = fetchedFeatures
        .filter(f => f.properties?.class === 'Assignment')
        .map(f => {
          const title = (f.properties?.title || f.properties?.name)?.trim().toLowerCase();
          const match = existingSaropsMap.get(f.id) || (title && existingSaropsTitleMap.has(title) ? existingSaropsTitleMap.get(title) : null);
          
          // Only include objects which were originally created in SARTopo for the download preview
          if (match?.origin === 'SAROps') return null;
          
          return { ...f, syncStatus: match ? 'Updated' : 'New' };
        })
        .filter(Boolean);
      setSartopoAssignmentDisplayList(displayList);

      // Requirement: Automatically sync new assignments when features are fetched
      if (incidentData?.opPeriodId && fetchedFeatures.length > 0) {
        await syncSartopoAssignments(fetchedFeatures);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Error fetching SARTopo data.');
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, incidentData?.opPeriodId, lastFetchTime, syncSartopoAssignments]);

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

      // Requirement: Reconciliation requires the base SARTopo JSON state.
      if (!features && assignmentsToExport.length > 0) {
        alert('Local map state is empty. Please click "Download from SARTopo" first to load the base metadata for your assignments.');
        return;
      }

      const fetchedFeatures = features?.result?.state?.features || features?.features || [];
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
        alert('No SARTopo assignments have been updated since the last export.');
      }

      return geojson;
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Error generating upload data.');
    } finally {
      setIsGeneratingUpload(false);
    }
  }, [incidentData?.opPeriodId, lastUploadTime, setSyncedAssignmentNames, features]);
  
  // Ref to hold the latest fetcher to avoid dependency loops with the refresh function
  const fetcherRef = useRef(handleFetchFeatures);
  useEffect(() => {
    fetcherRef.current = handleFetchFeatures;
  }, [handleFetchFeatures]);

  // Automate fetching: trigger when ID is set, then every 60s
  useEffect(() => {
    if (!sartopoId || !fetchUrl || !isAutoRefreshEnabled) return;

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
  }, [sartopoId, !!fetchUrl, SARTOPO_REFRESH_INTERVAL, lastFetchTime === 0, isAutoRefreshEnabled]);

  useEffect(() => {
    localStorage.setItem('sarops_sartopo_sync_enabled', JSON.stringify(isAutoRefreshEnabled));
  }, [isAutoRefreshEnabled]);

  const handleUploadToSARTopo = useCallback(async () => {
    if (!sartopoId || !incidentData?.opPeriodId) {
      setError('SARTopo Map ID or Operational Period not configured.');
      return;
    }

    setIsUploading(true);
    setError(null);
    let successCount = 0;
    let failCount = 0;
    const failedAssignments = [];
    
    try {
      const { id: mapId } = sartopoConfig;
      const apiKey = import.meta.env.VITE_SARTOPO_API_KEY?.trim() || '';

      // Step 1: GET Map State - Pull the entire current state to prevent destructive overwrites
      // Use /since/0 for consistency with the download logic and to avoid 404s on the features endpoint
      const currentMapRes = await fetch(`/sartopo-api/api/v1/map/${mapId}/since/0${sartopoConfig.query}`);
      if (!currentMapRes.ok) throw new Error('Failed to fetch current SARTopo map state for safe reconciliation.');
      
      const currentMapData = await currentMapRes.json();
      const fetchedFeatures = currentMapData?.result?.state?.features || currentMapData?.features || [];
      const sartopoFeatureLookup = new Map(fetchedFeatures.map(f => [f.id, f]));

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

        // Step 3: POST Payload
        const uploadEndpoint = `/sartopo-api/api/v1/map/${mapId}/features?readCode=${apiKey}`;
        
        try {
          const response = await fetch(uploadEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
              const hasEnvKey = !!import.meta.env.VITE_SARTOPO_API_KEY;
              const msg = `401 Unauthorized: SARTopo requires a Sync Key to authorize writes. ${!hasEnvKey ? 'VITE_SARTOPO_API_KEY is not configured in your .env file. ' : ''}Ensure your Map ID includes a "?k=" parameter or configure the global API key.`;
              throw new Error(msg);
            }
            throw new Error(`SARTopo API returned ${response.status}: ${errorText}`);
          }
          successCount++;
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
        setSyncedAssignmentNames(assignmentsToSync.map(a => a.title));
      }

      if (failCount === 0) {
        alert(`Successfully uploaded ${successCount} assignments to SARTopo.`);
      } else {
        setError(`Uploaded ${successCount} assignments. Failed to upload ${failCount} assignments: ${failedAssignments.join(', ')}`);
      }
    } catch (err) {
      console.error('Overall upload process failed:', err);
      setError(err.message || 'Error during SARTopo upload process.');
    } finally {
      setIsUploading(false);
    }
  }, [sartopoId, sartopoConfig, incidentData?.opPeriodId, generateUploadGeoJSON]);

  if (!isActive) {
    return (
      <div className="app-shell" style={{ padding: '40px', textAlign: 'center' }}>
        <p>Please start or join an active incident to view SARTopo data.</p>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ padding: '24px' }}>
      <div className="page-header">
        <h1>SARTopo Data</h1>
        <p className="subtitle">Retrieve live map feature data from SARTopo integration.</p>
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
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
              className={`btn ${isAutoRefreshEnabled ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
              disabled={!sartopoId}
            >
              {isAutoRefreshEnabled ? 'Pause' : 'Sync'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setLastFetchTime(0);
                setLastUploadTime(0);
                setUploadGeoJSON(null);
              }}
              disabled={!sartopoId}
              title="Reset fetch and upload timestamps to 0"
            >
              Reset
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleFetchFeatures}
              disabled={loading || !sartopoId}
            >
              {loading ? 'Downloading...' : 'Download from SARTopo'}
            </button>
            <button 
              className="btn btn-primary"
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

        {error && (
          <div className="alert alert-error" style={{ marginTop: '20px' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div className="section-card" style={{ flex: 1, margin: 0 }}>
          <div 
            onClick={() => setIsMapUploadExpanded(prev => !prev)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '16px' }}
          >
            <h2 style={{ margin: 0 }}>Map Upload to SARTopo ({uploadGeoJSON?.features?.length || 0})</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {lastUploadTime > 0 && (
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                  Since: {new Date(lastUploadTime).toLocaleTimeString()}
                </span>
              )}
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={(e) => { e.stopPropagation(); setLastUploadTime(0); setUploadGeoJSON(null); }}
                disabled={!incidentData?.opPeriodId}
                style={{ padding: '2px 8px', fontSize: '11px', minHeight: 'auto', width: 'auto' }}
                title="Reset upload timestamp to include all assignments"
              >
                Reset
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={(e) => { e.stopPropagation(); setShowUploadGeometry(!showUploadGeometry); }}
                style={{ padding: '2px 8px', fontSize: '11px', minHeight: 'auto', width: 'auto' }}
                title={showUploadGeometry ? "Hide coordinates data" : "Show coordinates data"}
              >
                {showUploadGeometry ? 'Hide Geometry' : 'Show Geometry'}
              </button>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={(e) => { e.stopPropagation(); generateUploadGeoJSON(); }}
                disabled={isGeneratingUpload || !incidentData?.opPeriodId}
                style={{ padding: '2px 8px', fontSize: '11px', minHeight: 'auto', width: 'auto' }}
              >
                {isGeneratingUpload ? 'Generating...' : 'Generate JSON'}
              </button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>GeoJSON Upload Source</span>
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
                padding: '16px', 
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

      
        <div className="section-card" style={{ flex: 1, margin: 0 }}>
          <div 
            onClick={() => setIsMapDownloadExpanded(prev => !prev)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '16px' }}
          >
            <h2 style={{ margin: 0 }}>Map Download from SARTopo ({filteredDownloadFeatures.length || 0})</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={(e) => { e.stopPropagation(); setShowAllDownloadObjects(!showAllDownloadObjects); }}
                style={{ padding: '2px 8px', fontSize: '11px', minHeight: 'auto', width: 'auto' }}
                title={showAllDownloadObjects ? "Show only Assignments" : "Show All Objects"}
              >
                {showAllDownloadObjects ? 'Show Assignments Only' : 'Show All Objects'}
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={(e) => { e.stopPropagation(); setShowDownloadGeometry(!showDownloadGeometry); }}
                style={{ padding: '2px 8px', fontSize: '11px', minHeight: 'auto', width: 'auto' }}
                title={showDownloadGeometry ? "Hide coordinates data" : "Show coordinates data"}
              >
                {showDownloadGeometry ? 'Hide Geometry' : 'Show Geometry'}
              </button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>GeoJSON Download Source</span>
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
                padding: '16px', 
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