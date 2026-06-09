import React, { useState, useMemo } from 'react';
import { formatTimeSince } from '../../utils/operationalUtils';

const AdminTeamsTable = ({
  allTeams = [],
  allIncidents = [],
  allAssignments = [],
  currentTime,
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

        if (sortConfig.key === 'incident_name') {
          aVal = (allIncidents.find(i => i.incident_id === (opA?.incident_id || a.incident_id))?.name || '').toString().toLowerCase();
          bVal = (allIncidents.find(i => i.incident_id === (opB?.incident_id || b.incident_id))?.name || '').toString().toLowerCase();
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
            className="action-btn action-btn-primary action-btn-header" 
            onClick={(e) => { e.stopPropagation(); handleNewTeam(); }}
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
                <th onClick={() => requestSort('incident_name')} style={{ cursor: 'pointer' }}>
                  Incident {sortConfig.key === 'incident_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('assignment_title')} style={{ cursor: 'pointer' }}>
                  Assignment {sortConfig.key === 'assignment_title' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ textAlign: 'left' }}>
                  Last PAR Check
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
                  <td colSpan="7" className="empty-row">No teams found in database.</td>
                </tr>
              ) : (
                sortedTeams.map(team => {
                  const opPeriod = Array.isArray(team.operational_periods) ? team.operational_periods[0] : team.operational_periods;
                  const recordIncidentId = opPeriod?.incident_id || team.incident_id;
                  const incident = allIncidents.find(inc => inc.incident_id === recordIncidentId);
                  
                  const assignment = allAssignments.find(asn => asn.team_id === team.team_id);

                  return (
                    <tr key={team.team_id}>
                      <td style={{ color: '#000' }}>
                        <div style={{ fontWeight: 600 }}>{team.team_name_number}</div>
                      </td>
                      <td style={{ color: '#000' }}>{team.type}</td>
                      <td style={{ color: '#000' }}>
                        {incident ? (
                          <div style={{ fontSize: '12px' }}>{incident.name} <span style={{ color: '#64748b' }}>(#{incident.number})</span></div>
                        ) : '—'}
                      </td>
                      <td style={{ color: '#000' }}>{assignment?.title || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>
                        {team.last_par_check || team.created_at ? formatTimeSince(team.last_par_check || team.created_at, currentTime) : '—'}
                      </td>
                      <td style={{ color: '#000' }}>
                        <span className={`status-chip status-chip-${team.status.toLowerCase()}`}>
                          {team.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {team.status !== 'Disbanded' && (
                            <button 
                              onClick={() => handleDisbandTeam(team.team_id, team.team_name_number, team.type)} 
                              className="action-btn action-btn-warning" 
                              disabled={team.status === 'Deployed'}
                              title={team.status === 'Deployed' ? "Cannot disband while deployed" : ""}
                            >
                              Disband
                            </button>
                          )}
                          <button onClick={() => handleEditTeam(team)} className="action-btn action-btn-secondary">Edit</button>
                          <button onClick={() => handleDeleteTeam(team.team_id, team.team_name_number, team.type)} className="action-btn action-btn-danger">Delete</button>
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