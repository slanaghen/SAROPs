import React from 'react';

const OperationsStatsFooter = ({ stats, rows, currentTime }) => {
  const overdueCount = (rows || []).filter(r => r.isParOverdue).length;
  const hasOverdue = overdueCount > 0;

  return (
    <div className="operations-stats-footer" style={{ 
      marginTop: '24px',
      display: 'flex',
      gap: '32px',
      flexWrap: 'wrap',
      padding: '8px 20px',
      background: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Teams</strong>
        <div style={{ fontSize: '12px', color: '#475569' }}>
          Staged: {stats?.teams.staged || 0}, Assigned: {stats?.teams.assigned || 0}, Deployed: {stats?.teams.deployed || 0}, 
          Overdue: <span style={{ color: hasOverdue ? '#dc2626' : 'inherit', fontWeight: hasOverdue ? 700 : 'inherit' }}>{overdueCount}</span>, 
          Total: {stats?.teams.total || 0}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Assignments</strong>
        <div style={{ fontSize: '12px', color: '#475569' }}>
          Planned: {stats?.assignments.planned || 0}, Assigned: {stats?.assignments.assigned || 0}, Deployed: {stats?.assignments.deployed || 0}, 
          Complete: {stats?.assignments.complete || 0}, Incomplete: {stats?.assignments.incomplete || 0}, Total: {stats?.assignments.total || 0}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Responders</strong>
        <div style={{ fontSize: '12px', color: '#475569' }}>
          Staged: {stats?.responders.staged || 0}, Attached: {stats?.responders.attached || 0}, Assigned: {stats?.responders.assigned || 0}, 
          Deployed: {stats?.responders.deployed || 0}, Total: {stats?.responders.total || 0}
        </div>
      </div>

      <div style={{ fontSize: '13px', marginLeft: 'auto', fontWeight: 700, color: '#1e293b' }}>
        {new Date(currentTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')}
      </div>
    </div>
  );
};

export default OperationsStatsFooter;