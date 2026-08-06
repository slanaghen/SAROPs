import React from 'react';

const SartopoSyncedAssignments = ({ syncedAssignmentNames }) => {
  return (
    <div className="section-card" style={{ marginBottom: 'var(--space-lg)' }}>
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
  );
};

export default SartopoSyncedAssignments;