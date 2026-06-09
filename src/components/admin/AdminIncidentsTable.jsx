import React, { useState, useMemo } from 'react';

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
  const [sortConfig, setSortConfig] = useState({ key: 'start_datetime', direction: 'desc' });

  const sortedIncidents = useMemo(() => {
    let items = [...allIncidents];
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal, bVal;
        
        if (sortConfig.key === 'latest_op') {
          aVal = a.operational_periods?.[0]?.op_number || 0;
          bVal = b.operational_periods?.[0]?.op_number || 0;
        } else if (sortConfig.key === 'status') {
          aVal = a.end_datetime ? 1 : 0;
          bVal = b.end_datetime ? 1 : 0;
        } else {
          aVal = (a[sortConfig.key] || '').toString().toLowerCase();
          bVal = (b[sortConfig.key] || '').toString().toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [allIncidents, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="section-card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isIncidentsExpanded ? '16px' : 0 }}
        onClick={() => setIsIncidentsExpanded(!isIncidentsExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Incident Management ({allIncidents.length})</h2>
          <button 
            className="action-btn action-btn-primary action-btn-header" 
            onClick={(e) => { e.stopPropagation(); handleNewIncident(); }}
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
                <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>
                  Incident {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('number')} style={{ cursor: 'pointer' }}>
                  Incident {sortConfig.key === 'number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('start_datetime')} style={{ cursor: 'pointer' }}>
                  Started {sortConfig.key === 'start_datetime' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('latest_op')} style={{ cursor: 'pointer' }}>
                  Latest OP # {sortConfig.key === 'latest_op' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ cursor: 'default' }}>OP Start</th>
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>
                  Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allIncidents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-row">No incidents found in database.</td>
                </tr>
              ) : (
                sortedIncidents.map(inc => {
                  const isActive = !inc.end_datetime;
                  const isCurrentlyActiveInSession = inc.incident_id === currentIncidentId;
                  // Leverage pre-sorted operational_periods from the useAdminData join
                  const latestOpObj = inc.operational_periods?.[0];
                  const latestOpNumber = latestOpObj?.op_number || '—';
                  const latestOpStart = latestOpObj?.start_datetime ? new Date(latestOpObj.start_datetime).toLocaleString() : '';

                  return (
                    <tr key={inc.incident_id} style={isCurrentlyActiveInSession ? { backgroundColor: '#f0f9ff', borderLeft: '4px solid #0ea5e9' } : {}}>
                      <td style={{ color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>
                        <div style={{ fontWeight: 600 }}>{inc.name}</div>
                      </td>
                      <td style={{ color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>#{inc.number}</td>
                      <td style={{ color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>{new Date(inc.start_datetime).toLocaleDateString()}</td>
                      <td style={{ color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>{latestOpNumber}</td>
                      <td style={{ color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>
                        {latestOpStart && <div>{latestOpStart}</div>}
                      </td>
                      <td style={{ color: isCurrentlyActiveInSession ? '#0369a1' : '#000' }}>
                        <span className={`status-chip status-chip-${isActive ? 'active' : 'ended'}`}>
                          {isActive ? 'Active' : 'Ended'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {isCurrentlyActiveInSession && (
                            <span className="status-chip status-chip-assigned" style={{ margin: 0, fontWeight: 800, border: '1px solid rgba(255,255,255,0.3)' }}>
                              Active Session
                            </span>
                          )}
                          {isActive && (
                            <button
                              onClick={() => handleEndIncident(inc.incident_id)}
                              className="action-btn action-btn-warning"
                            >
                              End Incident
                            </button>
                          )}
                          <button onClick={() => handleEditIncident(inc)} className="action-btn action-btn-secondary">Edit</button>
                          <button
                            onClick={() => handleDeleteIncident(inc.incident_id, inc.name)}
                            className="action-btn action-btn-danger"
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