import React, { useState, useMemo } from 'react';

const AdminAssignmentsTable = ({
  allAssignments = [],
  allIncidents = [],
  allTeams = [],
  isAssignmentsExpanded,
  setIsAssignmentsExpanded,
  handleEditAssignment,
  handleNewAssignment,
  handleDeleteAssignment,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });

  const sortedAssignments = useMemo(() => {
    let items = [...allAssignments];
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal, bVal;
        const opA = Array.isArray(a.operational_periods) ? a.operational_periods[0] : a.operational_periods;
        const opB = Array.isArray(b.operational_periods) ? b.operational_periods[0] : b.operational_periods;

        if (sortConfig.key === 'incident_name') {
          aVal = (allIncidents.find(i => i.incident_id === (opA?.incident_id || a.incident_id))?.name || '').toString().toLowerCase();
          bVal = (allIncidents.find(i => i.incident_id === (opB?.incident_id || b.incident_id))?.name || '').toString().toLowerCase();
        } else if (sortConfig.key === 'team_name') {
          const getTeamName = (assignment) => {
            const isCompleted = assignment.status === 'Completed' || assignment.status === 'Incomplete';
            if (isCompleted) {
              return assignment.completed_team_snapshot?.team_name_number || '';
            }
            return assignment.team_name || (assignment.team_id ? allTeams.find(t => t.team_id === assignment.team_id)?.team_name_number : '') || '';
          };
          aVal = getTeamName(a).toString().toLowerCase();
          bVal = getTeamName(b).toString().toLowerCase();
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
  }, [allAssignments, allIncidents, allTeams, sortConfig]);

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
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isAssignmentsExpanded ? '16px' : 0 }}
        onClick={() => setIsAssignmentsExpanded(!isAssignmentsExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Assignment Management ({allAssignments.length})</h2>
          <button 
            className="action-btn action-btn-primary action-btn-header" 
            onClick={(e) => { e.stopPropagation(); handleNewAssignment(); }}
          >
            + New
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
          {isAssignmentsExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>

      {isAssignmentsExpanded && (
        <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th onClick={() => requestSort('title')} style={{ cursor: 'pointer' }}>
                  Assignment {sortConfig.key === 'title' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('resource_type')} style={{ cursor: 'pointer' }}>
                  Type {sortConfig.key === 'resource_type' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('incident_name')} style={{ cursor: 'pointer' }}>
                  Incident {sortConfig.key === 'incident_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
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
              {allAssignments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">No assignments found in database.</td>
                </tr>
              ) : (
                sortedAssignments.map((asn, index) => {
                  const opPeriod = Array.isArray(asn.operational_periods) ? asn.operational_periods[0] : asn.operational_periods;
                  const recordIncidentId = opPeriod?.incident_id || asn.incident_id;
                  const incident = allIncidents.find(inc => inc.incident_id === recordIncidentId);

                  const isCompleted = asn.status === 'Completed' || asn.status === 'Incomplete';
                  
                  const teamName = isCompleted
                    ? asn.completed_team_snapshot?.team_name_number
                    : (asn.team_name || (asn.team_id ? allTeams.find(t => t.team_id === asn.team_id)?.team_name_number : null));

                  const getTooltipText = () => {
                    if (!isCompleted || !asn.completed_team_snapshot) return '';
                    const snapshot = asn.completed_team_snapshot;
                    let tooltip = `Historical Team: ${snapshot.team_name_number || 'N/A'}\n`;
                    tooltip += `Type: ${snapshot.type || 'N/A'}\n`;
                    tooltip += `Status: ${snapshot.status || 'N/A'}\n`;
                    tooltip += `Leader: ${snapshot.leader_name || 'Unassigned'}\n`;
                    if (snapshot.current_responders && snapshot.current_responders.length > 0) {
                      tooltip += `Members: ${snapshot.current_responders.map(r => r.name).join(', ')}\n`;
                    }
                    if (snapshot.current_vehicles && snapshot.current_vehicles.length > 0) {
                      tooltip += `Vehicles: ${snapshot.current_vehicles.map(v => v.designation).join(', ')}\n`;
                    }
                    return tooltip.trim();
                  };

                  return (
                    <tr key={asn.assignment_id || `asn-${index}`}>
                      <td style={{ color: '#000' }}>
                        <div style={{ fontWeight: 600 }}>{asn.title}</div>
                      </td>
                      <td style={{ color: '#000' }}>{asn.resource_type || '—'}</td>
                      <td style={{ color: '#000' }}>
                        {incident ? (
                          <div style={{ fontSize: '12px' }}>{incident.name} <span style={{ color: '#64748b' }}>(#{incident.number})</span></div>
                        ) : '—'}
                      </td>
                      <td style={{ color: '#000' }} title={getTooltipText()}>
                        {teamName || '—'} {isCompleted && '(Historical)'}
                      </td>
                      <td style={{ color: '#000' }}>
                        <span className={`status-chip status-chip-${asn.status.toLowerCase()}`}>
                          {asn.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleEditAssignment(asn)} className="action-btn action-btn-secondary">Edit</button>
                          <button
                            onClick={() => handleDeleteAssignment(asn.assignment_id, asn.title, asn.resource_type)}
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

export default AdminAssignmentsTable;