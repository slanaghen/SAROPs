import React, { useState, useMemo } from 'react';

const AdminTeamsTable = ({
  allTeams = [],
  allIncidents = [],
  allAssignments = [],
  isTeamsExpanded,
  setIsTeamsExpanded,
  handleDisbandTeam,
  handleEditTeam,
  handleNewTeam,
  handleDeleteTeam,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'team_name_number', direction: 'asc' });

  const sortedTeams = useMemo(() => {
    let items = [...allTeams];
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal, bVal;
        const opA = Array.isArray(a.operational_periods) ? a.operational_periods[0] : a.operational_periods;
        const opB = Array.isArray(b.operational_periods) ? b.operational_periods[0] : b.operational_periods;

        if (sortConfig.key === 'incident_number') {
          aVal = (a.incident_number || allIncidents.find(i => i.incident_id === (opA?.incident_id || a.incident_id))?.number || '').toString().toLowerCase();
          bVal = (b.incident_number || allIncidents.find(i => i.incident_id === (opB?.incident_id || b.incident_id))?.number || '').toString().toLowerCase();
        } else if (sortConfig.key === 'assignment_title') {
          aVal = (allAssignments.find(asn => asn.team_id === a.team_id)?.title || '').toLowerCase();
          bVal = (allAssignments.find(asn => asn.team_id === b.team_id)?.title || '').toLowerCase();
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
  }, [allTeams, allIncidents, allAssignments, sortConfig]);

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
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isTeamsExpanded ? '16px' : 0 }}
        onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Team Management ({allTeams.length})</h2>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={(e) => { e.stopPropagation(); handleNewTeam(); }}
            style={{ padding: '4px 12px', fontSize: '16px' }}
          >
            + New
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
          {isTeamsExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>

      {isTeamsExpanded && (
        <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th onClick={() => requestSort('team_name_number')} style={{ cursor: 'pointer' }}>
                  Team Name {sortConfig.key === 'team_name_number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('type')} style={{ cursor: 'pointer' }}>
                  Type {sortConfig.key === 'type' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('incident_number')} style={{ cursor: 'pointer' }}>
                  Inc # {sortConfig.key === 'incident_number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('assignment_title')} style={{ cursor: 'pointer' }}>
                  Assignment {sortConfig.key === 'assignment_title' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>
                  Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allTeams.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">No teams found in database.</td>
                </tr>
              ) : (
                sortedTeams.map(team => {
                  const opPeriod = Array.isArray(team.operational_periods) ? team.operational_periods[0] : team.operational_periods;
                  const recordIncidentId = opPeriod?.incident_id || team.incident_id;
                  const incidentNumber = team.incident_number || (recordIncidentId 
                    ? allIncidents.find(inc => inc.incident_id === recordIncidentId)?.number 
                    : null);
                  
                  const assignment = allAssignments.find(asn => asn.team_id === team.team_id);

                  return (
                    <tr key={team.team_id}>
                      <td style={{ color: '#000' }}>
                        <div style={{ fontWeight: 600 }}>{team.team_name_number}</div>
                      </td>
                      <td style={{ color: '#000' }}>{team.type}</td>
                      <td style={{ color: '#000' }}>{incidentNumber ? `#${incidentNumber}` : '—'}</td>
                      <td style={{ color: '#000' }}>{assignment?.title || '—'}</td>
                      <td style={{ color: '#000' }}>
                        <span className={`status-indicator ${team.status.toLowerCase()}`}>
                          {team.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {team.status !== 'Disbanded' && (
                            <button 
                              onClick={() => handleDisbandTeam(team.team_id, team.team_name_number, team.type)} 
                              className="btn btn-secondary btn-sm" 
                              disabled={team.status === 'Deployed'}
                              style={{ color: '#f59e0b' }}
                              title={team.status === 'Deployed' ? "Cannot disband while deployed" : ""}
                            >
                              Disband
                            </button>
                          )}
                          <button onClick={() => handleEditTeam(team)} className="btn btn-secondary btn-sm">Edit</button>
                          <button onClick={() => handleDeleteTeam(team.team_id, team.team_name_number, team.type)} className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}>Delete</button>
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

export default AdminTeamsTable;