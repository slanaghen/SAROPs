import React from 'react';

const TeamSection = ({ 
  team, parRequired, timeSinceLastPar, parInterval, 
  leaderById, handleParResponse, handleLeaveTeam, 
  isLeavingTeam, accessLevel, icsRole, isExpanded, onToggle,
  assignmentStatus 
}) => {
  if (!team) return null;

  return (
    <div className={`dashboard-section ${parRequired ? 'overdue' : ''}`}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => onToggle('team')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0 }}>Your Team: {team.team_name_number}</h2>
          {parRequired && (
            <span className="status-indicator incomplete" style={{ fontSize: '10px' }}>
              Check-in Required!
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <span className={`status-indicator ${team.status.toLowerCase()}`}>
            {team.status}
          </span>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
            {isExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr)) auto', gap: '16px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Team Type</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{team.type}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Team Leader</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{leaderById[team.leader_responder_id] || 'Unknown'}</div>
            </div>
            {parInterval > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Last PAR Check</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: parRequired ? '#dc2626' : 'inherit' }}>{timeSinceLastPar}</span>
                  {parRequired && (
                    <button 
                      className="btn btn-sm btn-primary" 
                      onClick={(e) => { e.stopPropagation(); handleParResponse('OK'); }}
                      style={{ padding: '2px 8px', fontSize: '10px' }}
                    >
                      PAR OK
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={(e) => { e.stopPropagation(); handleLeaveTeam(); }} 
              disabled={isLeavingTeam || (team.status === 'Deployed' || assignmentStatus === 'Deployed')}
              title={(team.status === 'Deployed' || assignmentStatus === 'Deployed') ? 'As Leader, you cannot leave your team while deployed' : ''}
            >
              {isLeavingTeam ? 'Leaving...' : 'Leave Team'}
            </button>
            {icsRole && (
              <span className="status-indicator attached" style={{ textTransform: 'none' }}>
                Role: {icsRole}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamSection;