import React from 'react';

const AdminTeamsTable = ({
  allTeams,
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
            style={{ padding: '4px 12px', fontSize: '12px' }}
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
                  const incident = team.operational_periods?.incidents;
                  const opNum = team.operational_periods?.op_number;
                  const isDisbanded = team.status === 'Disbanded';

                  return (
                    <tr key={team.team_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{team.team_name_number}</div>
                      </td>
                      <td>{team.type}</td>
                      <td>{incident?.name || '—'}</td>
                      <td>
                        {opNum ? `OP #${opNum}` : '—'}
                      </td>
                      <td>
                        <span className={`status-indicator ${team.status.toLowerCase()}`}>
                          {team.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleEditTeam(team)} className="btn btn-secondary btn-sm">Edit</button>
                          {team.status !== 'Disbanded' && ( // Only show if not already disbanded
                            <button onClick={() => handleDisbandTeam(team.team_id, team.team_name_number, team.type)} className="btn btn-secondary btn-sm" style={{ color: '#f59e0b' }}>Disband</button>
                          )}
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