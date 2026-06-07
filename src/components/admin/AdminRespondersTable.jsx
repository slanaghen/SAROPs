import React, { useState, useMemo } from 'react';

const AdminRespondersTable = ({
  allResponders = [],
  allIncidents = [],
  allTeams = [],
  isRespondersExpanded,
  setIsRespondersExpanded,
  handleCheckOutResponder,
  handleEditResponder,
  handleNewResponder,
  handleDeleteResponder,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const sortedResponders = useMemo(() => {
    let items = [...allResponders];
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal, bVal;
        
        if (sortConfig.key === 'incident_number') {
          aVal = (allIncidents.find(i => i.incident_id === a.incident_id)?.number || '').toLowerCase();
          bVal = (allIncidents.find(i => i.incident_id === b.incident_id)?.number || '').toLowerCase();
        } else if (sortConfig.key === 'team_name') {
          aVal = (allTeams.find(t => t.current_responders?.some(r => r.responder_id === a.responder_id))?.team_name_number || '').toLowerCase();
          bVal = (allTeams.find(t => t.current_responders?.some(r => r.responder_id === b.responder_id))?.team_name_number || '').toLowerCase();
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
  }, [allResponders, allIncidents, allTeams, sortConfig]);

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
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isRespondersExpanded ? '16px' : 0 }}
        onClick={() => setIsRespondersExpanded(!isRespondersExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Responder Management ({allResponders.length})</h2>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={(e) => { e.stopPropagation(); handleNewResponder(); }}
            style={{ padding: '4px 12px', fontSize: '16px' }}
          >
            + New
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
          {isRespondersExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>

      {isRespondersExpanded && (
        <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>
                  Name {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('agency')} style={{ cursor: 'pointer' }}>
                  Agency {sortConfig.key === 'agency' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('identifier')} style={{ cursor: 'pointer' }}>
                  Identifier {sortConfig.key === 'identifier' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('incident_number')} style={{ cursor: 'pointer' }}>
                  Inc # {sortConfig.key === 'incident_number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('team_name')} style={{ cursor: 'pointer' }}>
                  Team {sortConfig.key === 'team_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('checkin_datetime')} style={{ cursor: 'pointer' }}>
                  Check-In Time {sortConfig.key === 'checkin_datetime' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>
                  Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allResponders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-row">No responders found in database.</td>
                </tr>
              ) : (
                sortedResponders.map(res => {
                  const isCheckedOut = !!res.checkout_datetime;
                  const incident = allIncidents.find(i => i.incident_id === res.incident_id);
                  const team = allTeams.find(t => 
                    t.current_responders?.some(r => r.responder_id === res.responder_id)
                  );
                  return (
                    <tr key={res.responder_id}>
                      <td style={{ color: '#000' }}>
                        <div style={{ fontWeight: 600 }}>{res.name}</div>
                      </td>
                      <td style={{ color: '#000' }}>{res.agency || '—'}</td>
                      <td style={{ color: '#000' }}>{res.identifier || '—'}</td>
                      <td style={{ color: '#000' }}>#{incident?.number || '—'}</td>
                      <td style={{ color: '#000' }}>{team?.team_name_number || '—'}</td>
                      <td style={{ color: '#000' }}>{new Date(res.checkin_datetime).toLocaleString()}</td>
                      <td style={{ color: '#000' }}>
                        <span className={`status-indicator ${(res.status || 'unknown').toLowerCase()}`}>
                          {res.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {!isCheckedOut && (
                            <button
                              onClick={() => handleCheckOutResponder(res.responder_id)}
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#f59e0b' }}
                            >
                              Check Out
                            </button>
                          )}
                          <button onClick={() => handleEditResponder(res)} className="btn btn-secondary btn-sm">Edit</button>
                          <button
                            onClick={() => handleDeleteResponder(res.responder_id, res.name, res.agency)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#dc2626' }}
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

export default AdminRespondersTable;