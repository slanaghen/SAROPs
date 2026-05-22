import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles.css';
import { normalizeResourceTypeName } from '../utils/dataNormalization';

const SARTopoDataPage = () => {
  const { incidentId, isActive, incidentData } = useIncident();
  const [sartopoId, setSartopoId] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [sartopoAssignmentDisplayList, setSartopoAssignmentDisplayList] = useState([]);
  const [syncedAssignmentNames, setSyncedAssignmentNames] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const fetchUrl = useMemo(() => {
    let mapId = sartopoId?.trim();
    if (!mapId) return null;

    if (mapId.includes('/')) {
      mapId = mapId.split('/').pop() || mapId.split('/').slice(-2, -1)[0];
    }
    return `/sartopo-api/api/v1/map/${mapId}/since/${lastFetchTime}`;
  }, [sartopoId, lastFetchTime]);

  const assignmentFeatures = useMemo(() => {
    if (!features?.features) return [];
    return features.features.filter(f => f.properties?.class === 'Assignment');
  }, [features]);

  useEffect(() => {
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

    if (isActive) {
      fetchSartopoId();
    }
  }, [incidentId, isActive]);

  const handleFetchFeatures = async () => {
    if (!fetchUrl) {
      setError('No SARTopo Map ID found for this incident.');
      return;
    }

    setLoading(true);
    setError(null);
    setFeatures(null);

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

      // Fetch existing SAROps assignments to determine 'New'/'Updated' status for display
      const { data: existingSaropsAsns, error: fetchSaropsError } = await supabase
        .from('assignments')
        .select('assignment_id, sartopo_id')
        .eq('op_period_id', incidentData.opPeriodId);

      if (fetchSaropsError) throw fetchSaropsError;

      const existingSaropsMap = new Map(
        existingSaropsAsns?.map(a => [a.sartopo_id, a.assignment_id]) || []
      );

      // Prepare display list for SARTopo Assignments div
      const fetchedFeatures = data?.result?.state?.features || data?.features || [];
      const displayList = fetchedFeatures
        .filter(f => f.properties?.class === 'Assignment')
        .map(f => ({ ...f, syncStatus: existingSaropsMap.has(f.id) ? 'Updated' : 'New' }));
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
  };

  /**
   * Reconciles SARTopo features with SAROps assignments.
   * If a SARTopo assignment is not present in SAROps (based on sartopo_id),
   * a new SAROps assignment is created.
   */
  const syncSartopoAssignments = async (providedFeatures = null) => {
    const featuresToSync = providedFeatures || features?.features;
    if (!featuresToSync?.length || !incidentData?.opPeriodId) return;

    setSyncing(true);
    try {
      // 1. Fetch existing assignments for this OP to identify which to update vs create
      const { data: existingAsns, error: fetchError } = await supabase
        .from('assignments')
        .select('assignment_id, sartopo_id, status')
        .eq('op_period_id', incidentData.opPeriodId);

      if (fetchError) throw fetchError;
      
      const existingMap = new Map(
        existingAsns?.map(a => [a.sartopo_id, { id: a.assignment_id, status: a.status }]) || []
      );

      // 2. Prepare payloads for both new and existing assignments, focusing on SARTopo 'Assignment' objects
      const syncPayloads = featuresToSync
        .filter(f => f.id)
        .filter(f => f.properties?.class === 'Assignment') // Ensure we only sync valid SARTopo assignment objects
        .filter(f => f.properties?.title || f.properties?.name)
        .map(f => {
          const existing = existingMap.get(f.id);
          return {
            op_period_id: incidentData.opPeriodId,
            sartopo_id: f.id,
            title: f.properties.title || f.properties.name, // Favor 'title' from SARTopo as the source of truth
            resource_type: normalizeResourceTypeName(f.properties.resource_type),
            frequency_primary: f.properties.frequency || f.properties.primary_frequency || '',
            transportation: f.properties.transportation || null,
            team_size: f.properties.team_size ? parseInt(f.properties.team_size, 10) : null,
            priority: f.properties.priority || 'Medium',
            probability_of_detection: f.properties.priority ? parseInt(f.properties.priority, 10) : null,
            description: f.properties.description || f.properties.comments || '',
            hazards: f.properties.hazards || '',
            color: f.properties.color || null,
            status: existing?.status || 'Planned',
            is_orphaned: false,
            updated_at: f.properties.updated ? new Date(f.properties.updated).toISOString() : undefined
          };
        });

      if (syncPayloads.length === 0) {
        if (!providedFeatures) alert('No assignments found to sync.');
        return;
      }

      // 3. Upsert assignments in Supabase (Update existing, Insert new).
      // We use the composite unique constraint (op_period_id, sartopo_id) to identify records.
      // This allows us to omit the UUID PK from the payload, avoiding NULL padding issues in bulk batches.
      const { error: syncError } = await supabase
        .from('assignments')
        .upsert(syncPayloads, { onConflict: 'op_period_id, sartopo_id' });

      if (syncError) throw syncError;
      
      const createdCount = syncPayloads.filter(p => !existingMap.has(p.sartopo_id)).length;
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
  };

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
            {fetchUrl && (
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12px' }}>
                Fetch URL: <code style={{ color: '#0369a1' }}>{fetchUrl}</code>
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleFetchFeatures}
              disabled={loading || !sartopoId}
            >
              {loading ? 'Fetching...' : 'Fetch Live Features'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={syncSartopoAssignments}
              disabled={syncing || !features?.features?.length || !incidentData?.opPeriodId}
            >
              {syncing ? 'Syncing...' : 'Sync Assignment Features'}
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

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '16px' }}>SARTopo Assignments</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}> {/* Changed to column for pre blocks */}
          {!features ? (
            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Fetch live features to scan for assignments.</span>
          ) : sartopoAssignmentDisplayList.length > 0 ? (
            sartopoAssignmentDisplayList.map((f, index) => (
              <pre key={f.id || index} style={{ 
                fontSize: '11px', 
                padding: '12px', 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px', 
                margin: 0,
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                <div style={{ marginBottom: '8px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{f.properties?.title || 'Untitled Assignment'}</span>
                  <span className={`status-indicator ${f.syncStatus === 'New' ? 'planned' : 'assigned'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                    {f.syncStatus}
                  </span>
                </div>
                {JSON.stringify(f, (key, value) => key === 'geometry' ? undefined : value, 2)}
              </pre>
            ))
          ) : (
            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No features with class "Assignment" found in the fetched data.</span>
          )}
        </div>
      </div>

      {features && (
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Map Features ({features.features?.length || 0})</h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>GeoJSON Source Data</span>
          </div>
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
              {JSON.stringify(features, (key, value) => {
                if (key === 'geometry') return undefined;
                return value;
              }, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default SARTopoDataPage;