import React from 'react';
import { normalizeEquipmentList } from '../../utils/dataNormalization';

const TeamColumn = ({
  teams,
  filter,
  onFilterChange,
  onNew,
  onEdit,
  onDisband,
  isTeamHighlighted,
  getResponderName,
  getTeamMemberCount,
  getTeamVehicleCount,
  dndHandlers,
}) => {
  return (
    <div className="section teams-section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Teams ({teams.length})</h2>
        <div>
          <button className="btn btn-primary" onClick={onNew} style={{ fontSize: '14px' }}>New Team</button>
        </div>
      </div>

      <div className="responder-filters" style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Search team or leader..."
          value={filter}
          data-lpignore="true"
          onChange={(e) => onFilterChange(e.target.value)}
          style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
        />
        {filter && (
          <button className="btn btn-secondary btn-sm" onClick={() => onFilterChange('')} style={{ fontSize: '10px' }}>
            Clear
          </button>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="empty-state">
          <p>No teams matching criteria</p>
        </div>
      ) : (
        <div className="team-list">
          {teams.map(team => {
            const equipmentList = normalizeEquipmentList(team.equipment);
            return (
            <div
              key={team.team_id}
              className={`team-card ${isTeamHighlighted(team.team_id) ? 'selected' : ''}`}
              onClick={() => onEdit(team.team_id)}
              draggable="true"
              onDragStart={(e) => dndHandlers.handleDragStart(e, team.team_id, 'team')}
              onDragEnd={dndHandlers.handleDragEnd}
              onDragOver={(e) => dndHandlers.handleDragOver(e, 'team')}
              onDragEnter={(e) => dndHandlers.handleDragEnter(e, team.team_id, 'team')}
              onDragLeave={dndHandlers.handleDragLeave}
              onDrop={(e) => dndHandlers.handleDrop(e, team.team_id, 'team')}
              role="option"
              tabIndex={0}
            >
              <div className="team-header" style={{ gap: '8px', justifyContent: 'flex-start', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="team-name clickable-name" style={{ marginRight: '4px' }}>{team.team_name_number}</div>
                <div className={`team-type ${team.type.replace(/\s+/g, '-').toLowerCase()}`}>
                  {team.type}
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Size: {getTeamMemberCount(team)}</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Veh: {getTeamVehicleCount(team)}</span>
                <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>
                  {team.type === 'Staff' ? 'IC' : 'Ldr'}: {getResponderName(team.leader_responder_id)}
                </span>
                <span className={`status-indicator ${team.status?.toLowerCase() || ''}`} style={{ marginLeft: 'auto' }}>
                  {team.status}
                </span>
              </div>

              {equipmentList.length > 0 && (
                <div className="team-details" style={{ marginTop: '4px' }}>
                  <div className="detail-row">
                    <span className="detail-label">Equipment:</span>
                    <span className="detail-value">{equipmentList.join(', ')}</span>
                  </div>
                </div>
              )}

              <div className="team-actions" style={{ marginTop: '4px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => { e.stopPropagation(); onDisband(team); }}
                  disabled={team.status === 'Deployed'}
                  style={{ color: '#dc2626' }}
                  title={team.status === 'Deployed' ? "Cannot disband team while deployed" : "Release team members to staging"}
                >
                  Disband
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamColumn;