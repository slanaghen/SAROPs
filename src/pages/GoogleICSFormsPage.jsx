import React, { useState } from 'react';
import '../styles.css';

/**
 * GoogleICSFormsPage
 * 
 * Allows users to input a Google Sheets URL and retrieve all defined named ranges.
 * This facilitates mapping SAROps operational data to custom ICS spreadsheet templates.
 */
const GoogleICSFormsPage = () => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [namedRanges, setNamedRanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      // NOTE: This requires VITE_GOOGLE_SHEETS_API_KEY to be set in your .env file
      const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
      
      if (!apiKey) {
        throw new Error('Google API Key is not configured. Please add VITE_GOOGLE_SHEETS_API_KEY to your environment variables.');
      }

      // Fetch spreadsheet metadata specifically for named ranges
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=namedRanges&key=${apiKey}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || `Google API error: ${response.status}`);
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
      setError(err.message);
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

      <div className="section-card">
        <h2 style={{ fontSize: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
          Detected Named Ranges {namedRanges.length > 0 && `(${namedRanges.length})`}
        </h2>

        {namedRanges.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
            {namedRanges.map((name, idx) => (
              <div key={idx} style={{ 
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
                gap: '8px'
              }}>
                <span style={{ color: '#38bdf8' }}>🏷️</span> {name}
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
    </div>
  );
};

export default GoogleICSFormsPage;