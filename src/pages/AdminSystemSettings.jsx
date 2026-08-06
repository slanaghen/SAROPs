import React from 'react';

const AdminSystemSettings = ({
  opRefresh,
  setOpRefresh,
  resRefresh,
  setResRefresh,
  sartopoRefresh,
  setSartopoRefresh,
  isSettingsDirty,
  handleApplySettings,
}) => {
  return (
    <div className="section-card" style={{ marginBottom: '24px' }}>
      <h2>System Settings</h2>
      <p className="subtitle" style={{ fontSize: '13px', margin: '0 0 16px' }}>Configure global refresh and polling intervals (in seconds).</p>
      <div className="form-grid" style={{ gap: 'var(--space-md)', alignItems: 'flex-end' }}>
        <div className="form-field" style={{ minWidth: '150px' }}>
          <label className="form-label" htmlFor="ops-refresh-input">Operations Refresh</label>
          <input
            id="ops-refresh-input"
            type="number"
            className="form-input"
            value={opRefresh}
            onChange={(e) => setOpRefresh(parseInt(e.target.value, 10) || 0)}
            min="5"
          />
        </div>
        <div className="form-field" style={{ minWidth: '150px' }}>
          <label className="form-label" htmlFor="res-refresh-input">Responder Refresh</label>
          <input
            id="res-refresh-input"
            type="number"
            className="form-input"
            value={resRefresh}
            onChange={(e) => setResRefresh(parseInt(e.target.value, 10) || 0)}
            min="5"
          />
        </div>
        <div className="form-field" style={{ minWidth: '150px' }}>
          <label className="form-label" htmlFor="topo-refresh-input">SARTopo Refresh</label>
          <input
            id="topo-refresh-input"
            type="number"
            className="form-input"
            value={sartopoRefresh}
            onChange={(e) => setSartopoRefresh(parseInt(e.target.value, 10) || 0)}
            min="5"
          />
        </div>
        <button className="action-btn action-btn-primary" onClick={handleApplySettings} disabled={!isSettingsDirty}>
          Apply
        </button>
      </div>
    </div>
  );
};

export default AdminSystemSettings;