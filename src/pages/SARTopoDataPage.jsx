import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles.css';

const SARTopoDataPage = () => {
  const { incidentId, isActive } = useIncident();
  const [sartopoId, setSartopoId] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    if (!sartopoId) {
      setError('No SARTopo Map ID found for this incident.');
      return;
    }

    setLoading(true);
    setError(null);
    setFeatures(null);

    try {
      // Using the Vite proxy configured in vite.config.js to bypass CORS
      const response = await fetch(`/sartopo-api/api/v1/map/${sartopoId}/features`);
      
      if (!response.ok) {
        throw new Error(`SARTopo API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setFeatures(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Error fetching SARTopo data. This map may be private or protected by CORS.');
    } finally {
      setLoading(false);
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
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleFetchFeatures}
            disabled={loading || !sartopoId}
          >
            {loading ? 'Fetching...' : 'Fetch Live Features'}
          </button>
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