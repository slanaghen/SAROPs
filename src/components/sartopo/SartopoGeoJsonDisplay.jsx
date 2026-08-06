import React from 'react';

const SartopoGeoJsonDisplay = ({
  title,
  data,
  isExpanded,
  onToggleExpand,
  showGeometry,
  headerActions,
}) => {
  return (
    <div className="section-card" style={{ flex: '1 1 0', minWidth: 0, margin: 0 }}>
      <div
        onClick={onToggleExpand}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '16px' }}
      >
        <h2 style={{ margin: 0, fontSize: '18px' }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {headerActions}
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
            {isExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
          </span>
        </div>
      </div>
      {isExpanded && (
        <div className="operations-table-wrapper">
          <pre style={{
            maxHeight: '600px',
            overflow: 'auto',
            fontSize: '12px',
            padding: 'var(--space-md)',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            margin: 0
          }}>
            {data ? JSON.stringify(data, (key, value) => {
              if (!showGeometry && key === 'geometry') return undefined;
              return value;
            }, 2) : '// No data available.'}
          </pre>
        </div>
      )}
    </div>
  );
};

export default SartopoGeoJsonDisplay;