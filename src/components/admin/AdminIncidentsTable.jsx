import React from 'react';

const AdminIncidentsTable = ({
  allIncidents = [],
  isIncidentsExpanded,
  setIsIncidentsExpanded,
  handleEndIncident,
  handleEditIncident, // Added for consistency, though incidents are edited via IncidentEditPage
  handleNewIncident,
  handleDeleteIncident,
  currentIncidentId
}) => {
  return (
    <div className="section-card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isIncidentsExpanded ? '16px' : 0 }}
        onClick={() => setIsIncidentsExpanded(!isIncidentsExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Incident Management ({allIncidents.length})</h2>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={(e) => { e.stopPropagation(); handleNewIncident(); }}
            style={{ padding: '4px 12px', fontSize: '16px' }}
          >
            + New
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
          {isIncidentsExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>
      {isIncidentsExpanded && (
        <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th>Incident</th>
                <th>Inc #</th>
                <th>Started</th>
                <th>Latest OP #</th>
                <th>OP Start</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allIncidents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-row">No incidents found in database.</td>
                </tr>
              ) : (
                allIncidents.map(inc => {
                  const isActive = !inc.end_datetime;
                  const isCurrentlyActiveInSession = inc.incident_id === currentIncidentId;
                  // Leverage pre-sorted operational_periods from the useAdminData join
                  const latestOpObj = inc.operational_periods?.[0];
                  const latestOpNumber = latestOpObj?.op_number || '—';
                  const latestOpStart = latestOpObj?.start_datetime ? new Date(latestOpObj.start_datetime).toLocaleString() : '';

                  return (
                    <tr key={inc.incident_id} style={isCurrentlyActiveInSession ? { backgroundColor: '#f0f9ff', borderLeft: '4px solid #0ea5e9' } : {}}>
                      <td style={{ fontSize: '16px', color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>
                        <div style={{ fontWeight: 600 }}>{inc.name}</div>
                      </td>
                      <td style={{ fontSize: '16px', color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>#{inc.number}</td>
                      <td style={{ fontSize: '16px', color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>{new Date(inc.start_datetime).toLocaleDateString()}</td>
                      <td style={{ fontSize: '16px', color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>{latestOpNumber}</td>
                      <td style={{ fontSize: '16px', color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>
                        {latestOpStart && <div>{latestOpStart}</div>}
                      </td>
                      <td style={{ fontSize: '16px', color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>
                        <span className={`status-indicator ${isActive ? 'active' : 'ended'}`}>
                          {isActive ? 'Active' : 'Ended'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {isCurrentlyActiveInSession && (
                            <span className="status-indicator assigned" style={{ margin: 0, fontWeight: 800, border: '1px solid rgba(255,255,255,0.3)' }}>
                              Active Session
                            </span>
                          )}
                          <button onClick={() => handleEditIncident(inc)} className="btn btn-secondary btn-sm" style={{ fontSize: '16px' }}>Edit</button>
                          {isActive && (
                            <button
                              onClick={() => handleEndIncident(inc.incident_id)}
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#f59e0b', fontSize: '16px' }}
                            >
                              End Incident
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteIncident(inc.incident_id, inc.name)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#dc2626', fontSize: '16px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminIncidentsTable;