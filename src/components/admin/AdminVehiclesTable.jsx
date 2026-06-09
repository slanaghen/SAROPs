import React, { useState, useMemo } from 'react';

const AdminVehiclesTable = ({ 
  allVehicles = [], allIncidents = [], allTeams = [], fetching = false, isVehiclesExpanded, setIsVehiclesExpanded, 
  handleCheckOutVehicle, handleDeleteVehicle, handleEditVehicle, handleNewVehicle 
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'designation', direction: 'asc' });

  const sortedVehicles = useMemo(() => {
    let items = [...allVehicles];
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key === 'team_name') {
          aVal = (allTeams.find(t => t.team_id === a.team_id)?.team_name_number || '').toLowerCase();
          bVal = (allTeams.find(t => t.team_id === b.team_id)?.team_name_number || '').toLowerCase();
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
  }, [allVehicles, allTeams, sortConfig]);

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
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isVehiclesExpanded ? '16px' : 0 }}
        onClick={() => setIsVehiclesExpanded(!isVehiclesExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Vehicle Management ({allVehicles?.length || 0})</h2>
          <button className="action-btn action-btn-primary action-btn-header" onClick={(e) => { e.stopPropagation(); handleNewVehicle(); }}>+ New</button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
          {isVehiclesExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>
      
      {isVehiclesExpanded && (
        <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th onClick={() => requestSort('designation')} style={{ cursor: 'pointer' }}>
                  Designation {sortConfig.key === 'designation' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('type')} style={{ cursor: 'pointer' }}>
                  Type {sortConfig.key === 'type' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>Incident</th>
                <th onClick={() => requestSort('team_name')} style={{ cursor: 'pointer' }}>
                  Team {sortConfig.key === 'team_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>
                  Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr><td colSpan="6" className="empty-row">Loading vehicles...</td></tr>
              ) : sortedVehicles.length === 0 ? (
                <tr><td colSpan="6" className="empty-row">No vehicles found in database.</td></tr>
              ) : (
                sortedVehicles.map(v => (
                  <tr key={v.vehicle_id}>
                    <td style={{ fontWeight: 600 }}>{v.designation}</td>
                    <td>{v.type || '—'}</td>
                    <td style={{ fontSize: '12px' }}>
                      {allIncidents.find(inc => inc.incident_id === v.incident_id)?.name || v.incident_id}
                    </td>
                    <td>
                      {allTeams.find(t => t.team_id === v.team_id)?.team_name_number || '—'}
                    </td>
                    <td>
                      <span className={`status-chip status-chip-${v.status?.toLowerCase()}`}>{v.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {v.status !== 'CheckedOut' && (
                          <button className="action-btn action-btn-warning" onClick={() => handleCheckOutVehicle(v.vehicle_id)}>Check Out</button>
                        )}
                        <button className="action-btn action-btn-secondary" onClick={() => handleEditVehicle(v)}>Edit</button>
                        <button className="action-btn action-btn-danger" onClick={() => handleDeleteVehicle(v.vehicle_id, v.designation)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminVehiclesTable;