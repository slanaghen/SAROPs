import React from 'react';

const SartopoHeader = ({
  sartopoId,
  sartopoUrl,
  lastFetchTime,
  lastUploadTime,
  isAutoRefreshEnabled,
  toggleAutoRefresh,
  onReset,
  onFetch,
  onUpload,
  loading,
  isUploading,
  incidentId,
}) => {
  return (
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
        <div style={{ flex: 1, textAlign: 'center' }}>
          {sartopoUrl && (
            <a
              href={sartopoUrl}
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
            onClick={onReset}
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
            onClick={onFetch}
            disabled={loading || !sartopoId}
          >
            {loading ? 'Downloading...' : 'Download from SARTopo'}
          </button>
          <button
            className="action-btn action-btn-primary"
            onClick={onUpload}
            disabled={isUploading || !incidentId || !sartopoId}
          >
            {isUploading ? 'Uploading...' : 'Upload to SARTopo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SartopoHeader;