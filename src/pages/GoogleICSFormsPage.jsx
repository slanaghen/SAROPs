import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import '../styles.css';

/**
 * GoogleICSFormsPage
 * 
 * Allows users to input a Google Sheets URL and retrieve all defined named ranges.
 * This facilitates mapping SAROps operational data to custom ICS spreadsheet templates.
 */
const contextFields = [
  {
    category: 'Incident Context',
    icon: '🏔️',
    fields: [
      { name: 'incident_name', desc: 'The official name of the incident' },
      { name: 'incident_number', desc: 'The operational/agency tracking number' },
      { name: 'incident_location', desc: 'Coordinates/location of Incident Command Post' },
      { name: 'incident_type', desc: 'Type of incident (e.g. Lost Person)' }
    ]
  },
  {
    category: 'Operational Period',
    icon: '⏱️',
    fields: [
      { name: 'op_period_number', desc: 'Current operational period number' },
      { name: 'op_period_start', desc: 'Start date & time of current period' },
      { name: 'op_period_end', desc: 'End date & time of current period' }
    ]
  },
  {
    category: 'Staff Team',
    icon: '👥',
    fields: [
      { name: 'commander_name', desc: 'Incident Commander (IC) name' },
      { name: 'operations_chief', desc: 'Operations Section Chief (OSC) name' },
      { name: 'planning_chief', desc: 'Planning Section Chief (PSC) name' },
      { name: 'logistics_chief', desc: 'Logistics Section Chief (LSC) name' }
    ]
  },
  {
    category: 'Action Log',
    icon: '📝',
    fields: [
      { name: 'action_log_entries', desc: 'Serialized array of all incident log events' },
      { name: 'last_action_timestamp', desc: 'Timestamp of the most recent logged activity' }
    ]
  }
];

const GoogleICSFormsPage = () => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [namedRanges, setNamedRanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [associations, setAssociations] = useState({});

  // Helper to extract spreadsheet ID from typical Google Sheets URL
  const extractSpreadsheetId = (url) => {
    const matches = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
  };

  const handleLoad = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Invalid URL. Please provide a full Google Sheets URL (e.g., https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit)');
      setNamedRanges([]);
      return;
    }

    setLoading(true);
    setError(null);
    setNamedRanges([]);

    try {
      // Use the Vite proxy (defined in vite.config.js) for development
      // or the environment-specific proxy URL for production.
      const PROXY_BASE = import.meta.env.VITE_PROXY_URL || '';

      const response = await fetch(`${PROXY_BASE}/api/sheets/named-ranges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId })
      });

      if (!response.ok) {
        let errDetails = `Server returned ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error?.message) {
            errDetails = errData.error.message;
          } else if (errData?.message) {
            errDetails = errData.message;
          }
        } catch (_) {}
        throw new Error(errDetails);
      }
      const data = await response.json();

      const ranges = data.namedRanges || [];
      
      if (ranges.length === 0) {
        setError('No named ranges found in this spreadsheet. Check the "Data -> Named ranges" menu in your Google Sheet.');
      } else {
        const names = ranges.map(r => r.name).sort((a, b) => a.localeCompare(b));
        setNamedRanges(names);
      }
    } catch (err) {
      console.error('Error loading named ranges:', err);
      if (err.message === 'Failed to fetch') {
        setError('Could not connect to the proxy server. Please ensure the backend service is running on port 3001.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ padding: '24px' }}>
      <div className="page-header">
        <div>
          <h1>Google ICS Forms</h1>
          <p className="subtitle">Inspect and import field definitions from Google Sheets templates.</p>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label htmlFor="sheet-url" style={{ fontWeight: 600 }}>Google Sheet URL:</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              id="sheet-url"
              type="text"
              className="status-update-select" 
              style={{ flex: 1, height: '40px', padding: '0 12px' }}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
            <button 
              className="btn btn-primary"
              style={{ height: '40px', padding: '0 24px', whiteSpace: 'nowrap' }}
              onClick={handleLoad}
              disabled={loading || !sheetUrl.trim()}
            >
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '24px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Left Side: Named Ranges */}
        <div className="section-card" style={{ flex: '2 1 600px', margin: 0 }}>
          <h2 style={{ fontSize: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
            Detected Named Ranges {namedRanges.length > 0 && `(${namedRanges.length})`}
          </h2>

          {namedRanges.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {namedRanges.map((name, idx) => (
                <div 
                  key={idx} 
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#f8fafc';
                    const fieldName = e.dataTransfer.getData('text/plain');
                    if (fieldName) {
                      setAssociations(prev => ({
                        ...prev,
                        [name]: fieldName
                      }));
                    }
                  }}
                  style={{ 
                    padding: '12px', 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    minHeight: '46px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: '#38bdf8', flexShrink: 0 }}>🏷️</span> 
                    <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                      <span style={{ wordBreak: 'break-all' }}>{name}</span>
                      {associations[name] && (
                        <span style={{ 
                          color: '#2563eb', 
                          fontWeight: 700, 
                          fontFamily: 'sans-serif', 
                          fontSize: '11px', 
                          background: '#dbeafe', 
                          padding: '2px 6px', 
                          borderRadius: '4px' 
                        }}>
                          ({associations[name]})
                        </span>
                      )}
                    </span>
                  </div>
                  {associations[name] && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssociations(prev => {
                          const updated = { ...prev };
                          delete updated[name];
                          return updated;
                        });
                      }}
                      title="Remove association"
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '0 4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : !loading && (
            <div style={{ 
              height: '200px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#94a3b8',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
              <p>No named ranges loaded.</p>
              <p style={{ fontSize: '13px' }}>Provide a valid Google Sheet URL and click "Load" to view the available data points.</p>
            </div>
          )}
        </div>

        {/* Right Side: Context Fields */}
        <div className="section-card" style={{ flex: '1 1 300px', margin: 0 }}>
          <h2 style={{ fontSize: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
            Context Fields
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
            Drag fields from here and drop them onto a named range on the left to associate them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {contextFields.map((cat, idx) => (
              <div key={idx}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span>{cat.icon}</span> {cat.category}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cat.fields.map((f, fIdx) => (
                    <div 
                      key={fIdx} 
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', f.name);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      style={{ 
                        padding: '10px', 
                        background: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'grab',
                        userSelect: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.background = '#f1f5f9';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                    >
                      <div style={{ 
                        fontFamily: 'monospace', 
                        fontWeight: 600, 
                        color: '#2563eb', 
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>{f.name}</span>
                        <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>Field</span>
                      </div>
                      <div style={{ color: '#475569', lineHeight: '1.4' }}>{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleICSFormsPage;