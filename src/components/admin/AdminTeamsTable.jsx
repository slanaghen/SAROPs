import React from 'react';

const AdminTeamsTable = ({
  allTeams = [],
  allIncidents = [],
  isTeamsExpanded,
  setIsTeamsExpanded,
  handleDisbandTeam,
  handleEditTeam,
  handleNewTeam,
  handleDeleteTeam,
}) => {
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
                <th>Team Name</th>
                <th>Type</th>
                <th>Incident</th>
                <th>OP #</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allTeams.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">No teams found in database.</td>
                </tr>
              ) : (
                allTeams.map(team => {
                  const opPeriod = Array.isArray(team.operational_periods) ? team.operational_periods[0] : team.operational_periods;
                  const targetIncId = opPeriod?.incident_id || team.incident_id;
                  const incident = targetIncId 
                    ? allIncidents.find(inc => inc.incident_id === targetIncId)
                    : null;
                  const opNum = opPeriod?.op_number;
                  const isDisbanded = team.status === 'Disbanded';

                  return (
                    <tr key={team.team_id}>
                      <td style={{ fontSize: '16px', color: '#000' }}>
                        <div style={{ fontWeight: 600 }}>{team.team_name_number}</div>
                      </td>
                      <td style={{ fontSize: '16px', color: '#000' }}>{team.type}</td>
                      <td style={{ fontSize: '16px', color: '#000' }}>{incident?.name || '—'}</td>
                      <td style={{ fontSize: '16px', color: '#000' }}>
                        {opNum ? `OP #${opNum}` : '—'}
                      </td>
                      <td style={{ fontSize: '16px', color: '#000' }}>
                        <span className={`status-indicator ${team.status.toLowerCase()}`}>
                          {team.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleEditTeam(team)} className="btn btn-secondary btn-sm" style={{ fontSize: '16px' }}>Edit</button>
                          {team.status !== 'Disbanded' && (
                            <button 
                              onClick={() => handleDisbandTeam(team.team_id, team.team_name_number, team.type)} 
                              className="btn btn-secondary btn-sm" 
                              disabled={team.status === 'Deployed'}
                              style={{ color: '#f59e0b', fontSize: '16px' }}
                              title={team.status === 'Deployed' ? "Cannot disband while deployed" : ""}
                            >
                              Disband
                            </button>
                          )}
                          <button onClick={() => handleDeleteTeam(team.team_id, team.team_name_number, team.type)} className="btn btn-secondary btn-sm" style={{ color: '#dc2626', fontSize: '16px' }}>Delete</button>
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