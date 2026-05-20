import React from 'react';

const OperationsToolbar = ({ 
  viewMode, 
  setViewMode, 
  layoutMode, 
  setLayoutMode, 
  onBroadcastClick, 
  teamsCount 
}) => {
  return (
    <header className="operations-header">
      <div>
        <h1>Operations Dashboard</h1>
        <p>Summary of assignments and teams in the current operational period.</p>
      </div>
      <div className="view-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="view-mode-select" style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>View:</label>
        <select 
          id="view-mode-select"
          className="status-update-select" 
          style={{ width: 'auto', minWidth: '140px', height: '32px' }}
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
        >
          <option value="All">Incident (All)</option>
          <option value="Operations">Operations (Active)</option>
          <option value="Planning">Planning (Staged)</option>
        </select>
        <div style={{ display: 'flex', gap: '4px', marginLeft: '12px', borderLeft: '1px solid #e2e8f0', paddingLeft: '12px' }}>
          <button 
            className={`btn btn-sm ${layoutMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLayoutMode('table')}
          >
            Table
          </button>
          <button 
            className={`btn btn-sm ${layoutMode === 'split' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLayoutMode('split')}
          >
            Split
          </button>
          <button 
            className={`btn btn-sm ${layoutMode === 'map' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLayoutMode('map')}
          >
            Map
          </button>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ height: '32px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px' }}
          onClick={onBroadcastClick}
          title={`Send message to all ${teamsCount} teams`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          Broadcast
        </button>
      </div>
    </header>
  );
};

export default OperationsToolbar;