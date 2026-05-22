import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles.css';

const SARTopoDataPage = () => {
  const { incidentId, isActive, incidentData } = useIncident();
  const [sartopoId, setSartopoId] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const fetchUrl = useMemo(() => {
    let mapId = sartopoId?.trim();
    if (!mapId) return null;

    if (mapId.includes('/')) {
      mapId = mapId.split('/').pop() || mapId.split('/').slice(-2, -1)[0];
    }
    return `/sartopo-api/api/v1/map/${mapId}/since/0`;
  }, [sartopoId]);

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
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Error fetching SARTopo data.');
    } finally {
      setLoading(false);
    }
  };

  // Preservation of sync function (currently disabled per operational requirements)
  const syncSartopoAssignments = async () => {
    return;
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
              // synchronization functionality is currently disabled per operational requirements
              disabled={true}
              title="Assignment synchronization is currently disabled."
            >
              {syncing ? 'Syncing...' : 'Sync Assignment Features'}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '20px' }}>
            {error}
          </div>
        )}
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
              {JSON.stringify(features, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default SARTopoDataPage;