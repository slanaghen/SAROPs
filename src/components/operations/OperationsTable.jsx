import React from 'react';

const OperationsTable = ({ 
  rows, 
  sortConfig, 
  requestSort, 
  assignmentFilter,
  onAssignmentFilterChange,
  teamFilter,
  onTeamFilterChange,
  parInterval,
  onStatusUpdate,
  onResetPar,
  onUnassignTeam,
  onDisbandTeam,
  onDeleteAssignment,
  onEditTeam,
  onEditAssignment,
  openNewTeamForm,
  openNewAssignmentForm,
  onNewTeam,
  onNewAssignment,
  onAssignResource,
  draggedItem,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop
}) => {
  return (
    <div className="operations-table-wrapper" style={{ width: '100%' }}>
      <table className="operations-table" style={{ width: '100%', tableLayout: 'auto' }}>
        <thead>
          <tr className="group-header-row">
            <th colSpan="5" style={{ textAlign: 'center', padding: '8px 12px', background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                Assignment
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={assignmentFilter}
                  onChange={(e) => onAssignmentFilterChange(e.target.value)}
                  data-lpignore="true"
                  style={{ height: '24px', padding: '0 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100px', textTransform: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button className="btn btn-primary btn-sm" onClick={openNewAssignmentForm} style={{ height: '24px', fontSize: '10px', padding: '0 8px', minWidth: '0', width: 'auto', flex: 'none' }}>
                  New
                </button>
              </div>
            </th>
            <th colSpan={parInterval > 0 ? 7 : 6} style={{ textAlign: 'center', padding: '8px 12px', background: '#f8fafc', borderLeft: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                Team
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={teamFilter}
                  onChange={(e) => onTeamFilterChange(e.target.value)}
                  data-lpignore="true"
                  style={{ height: '24px', padding: '0 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100px', textTransform: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button className="btn btn-primary btn-sm" onClick={openNewTeamForm} style={{ height: '24px', fontSize: '10px', padding: '0 8px', minWidth: '0', width: 'auto', flex: 'none' }}>
                  New
                </button>
              </div>
            </th>
            <th style={{ background: '#f8fafc' }}></th>
          </tr>
          <tr>
            <th onClick={() => requestSort('assignmentName')} style={{ cursor: 'pointer', width: '16%' }}>
              Name {sortConfig.key === 'assignmentName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('assignmentType')} style={{ cursor: 'pointer', width: '10%' }}>
              Type {sortConfig.key === 'assignmentType' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('assignmentPriority')} style={{ cursor: 'pointer', width: '8%' }}>
              Priority {sortConfig.key === 'assignmentPriority' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('tacChannel')} style={{ cursor: 'pointer', width: '7%' }}>
              TAC {sortConfig.key === 'tacChannel' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('assignmentStatus')} style={{ cursor: 'pointer', width: '11%' }}>
              Status {sortConfig.key === 'assignmentStatus' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('teamName')} style={{ cursor: 'pointer', width: '11%', borderLeft: '1px solid #e2e8f0' }}>
              Name {sortConfig.key === 'teamName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('teamType')} style={{ cursor: 'pointer', width: '10%' }}>
              Type {sortConfig.key === 'teamType' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('teamLeader')} style={{ cursor: 'pointer', width: '12%' }}>
              Leader {sortConfig.key === 'teamLeader' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('leaderIdentifier')} style={{ cursor: 'pointer', width: '7%' }}>
              ID {sortConfig.key === 'leaderIdentifier' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('teamSize')} style={{ cursor: 'pointer', width: '8%' }}>
              Size {sortConfig.key === 'teamSize' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('teamStatus')} style={{ cursor: 'pointer', width: '10%' }}>
              Status {sortConfig.key === 'teamStatus' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            {parInterval > 0 && (
              <th onClick={() => requestSort('timeSincePar')} style={{ cursor: 'pointer', width: '10%' }}>
                Last PAR Check {sortConfig.key === 'timeSincePar' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
            )}
            <th style={{ width: '90px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={parInterval > 0 ? 12 : 11} className="empty-row">No matching records found.</td></tr>
          ) : rows.map(row => {
            // A team is a valid target for an incoming assignment chip whether it
            // already has assignments or not; dragging a team onto another row
            // that already has a team is rejected upstream by the DnD hook's
            // type-mismatch check (same tag => same type => no-op), so no extra
            // per-row gating is needed here anymore.
            const targetType = row.teamId ? 'team' : 'assignment';
            const isHighPriorityPending = row.assignments.some(a => a.priority === 'High' && a.status === 'Assigned');

            const rowClass = [
              (row.assignmentStatus === 'Deployed' && row.teamId) ? 'row-deployed' : '',
              (row.assignmentStatus === 'Assigned' && row.teamId) ? 'row-assigned' : '',
              (row.assignmentStatus === 'Completed' && row.teamId) ? 'row-completed' : '',
              (!row.isParOverdue && isHighPriorityPending) ? 'row-glow-priority' : '',
              (dropTarget?.id === row.id) ? 'row-drop-target' : ''
            ].filter(Boolean).join(' ');

            return (
              <tr key={row.id} className={rowClass}
                onDragOver={(e) => onDragOver(e, row.id, targetType)}
                onDragEnter={(e) => onDragEnter(e, row.id, targetType)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, row.id, targetType)}
              >
              <td style={{ textAlign: 'center' }}>
                {row.assignments.length > 0 ? (
                  <div className="chip-stack">
                    {row.assignments.map(asn => (
                      <div
                        key={asn.assignment_id}
                        className={`chip assignment-chip ${draggedItem?.id === row.id && draggedItem?.type === 'assignment' ? 'dragging' : ''} ${dropTarget?.id === row.id && dropTarget?.type === 'assignment' ? 'drop-target' : ''} ${row.teamId ? 'locked' : ''} ${asn.title === 'Command Staff' ? 'staff-chip' : ''} ${asn.origin === 'SARTopo' ? 'sartopo-chip' : ''}`}
                        draggable={!row.teamId}
                        onDragStart={!row.teamId ? (e) => onDragStart(e, row.id, 'assignment') : undefined}
                        onDragEnd={onDragEnd}
                        onClick={() => onEditAssignment(asn.assignment_id)}
                      >
                        {asn.title}
                      </div>
                    ))}
                  </div>
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>
                {row.assignments.length > 0 ? (
                  <div className="chip-stack">
                    {row.assignments.map(asn => <div key={asn.assignment_id}>{asn.resource_type || '—'}</div>)}
                  </div>
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>
                {row.assignments.length > 0 ? (
                  <div className="chip-stack">
                    {row.assignments.map(asn => <div key={asn.assignment_id}>{asn.priority || '—'}</div>)}
                  </div>
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>
                {row.assignments.length > 0 ? (
                  <div className="chip-stack">
                    {row.assignments.map(asn => <div key={asn.assignment_id}>{asn.frequency_primary || '—'}</div>)}
                  </div>
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>
                {row.assignments.length > 0 ? (
                  <div className="chip-stack">
                    {row.assignments.map(asn => {
                      // A team may only have one Deployed assignment at a time
                      // (enforced by a DB partial unique index) -- proactively
                      // disable the option rather than let the save fail.
                      const teamHasOtherDeployed = row.assignments.some(
                        other => other.assignment_id !== asn.assignment_id && other.status === 'Deployed'
                      );
                      return row.teamId ? (
                        <select
                          key={asn.assignment_id}
                          value={asn.status}
                          onChange={(e) => onStatusUpdate(asn.assignment_id, row.teamId, e.target.value)}
                          className={`status-indicator ${(asn.status || '').toLowerCase()} status-select-inline`}
                        >
                          <option value="Planned">Planned</option>
                          <option value="Assigned">Assigned</option>
                          <option value="Deployed" disabled={teamHasOtherDeployed}>Deployed</option>
                          <option value="Completed">Completed</option>
                          <option value="Incomplete">Incomplete</option>
                        </select>
                      ) : (
                        <span key={asn.assignment_id} className={`status-indicator ${asn.status?.toLowerCase() || ''}`}>{asn.status || '—'}</span>
                      );
                    })}
                  </div>
                ) : null}
              </td>
              <td 
                style={{ textAlign: 'center' }}
              >
                {row.teamName ? (
                  <div
                    className={`chip team-chip ${draggedItem?.id === row.id && draggedItem?.type === 'team' ? 'dragging' : ''} ${dropTarget?.id === row.id && dropTarget?.type === 'team' ? 'drop-target' : ''} ${row.teamType === 'Staff' ? 'staff-chip' : ''}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, row.id, 'team')}
                    onDragEnd={onDragEnd}
                    onClick={() => row.teamId && onEditTeam(row.teamId)}
                  >
                    {row.teamName}
                  </div>
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>{row.teamType || '—'}</td>
              <td style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 500 }}>{row.teamLeader || '—'}</div>
              </td>
              <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '12px' }}>{row.leaderIdentifier || '—'}</td>
              <td style={{ textAlign: 'center' }}>{row.teamSize ?? '—'}</td>
              <td style={{ textAlign: 'center' }}>
                {row.teamId ? (
                  <span className={`status-indicator ${row.teamStatus?.toLowerCase() || ''}`}>{row.teamStatus || '—'}</span>
                ) : null}
              </td>
              {parInterval > 0 && (
                <td style={{ textAlign: 'center' }}>
                  {row.teamId && (row.isParOverdue ? (
                    <span 
                      className="status-indicator incomplete chip-overdue-gradient" 
                      onClick={() => onResetPar(row.teamId, row.teamName)}
                      title="Click to reset PAR"
                      style={{ 
                        gap: '4px',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer'
                      }}
                    >
                      {row.timeSincePar}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </span>
                  ) : <span style={{ fontSize: '12px', color: '#64748b' }}>{row.timeSincePar}</span>)}
                </td>
              )}
              <td style={{ textAlign: 'center' }}>
                {/* Edit/Delete/Unassign only have an unambiguous single target when
                    there's exactly one assignment on the row; once a team is carrying
                    several, use each chip's own onClick to edit a specific one instead. */}
                <select className="status-update-select" value="" onChange={(e) => {
                  const act = e.target.value;
                  const soleAssignment = row.assignments.length === 1 ? row.assignments[0] : null;
                  if (act === 'edit-team' && row.teamId) {
                    console.log(`[OperationsTable] Edit action triggered for teamId: ${row.teamId}`);
                    onEditTeam(row.teamId);
                  }
                  else if (act === 'edit-assignment' && soleAssignment) onEditAssignment(soleAssignment.assignment_id);
                  else if (act === 'reset-par') onResetPar(row.teamId, row.teamName);
                  else if (act === 'unassign' && soleAssignment) onUnassignTeam(soleAssignment.assignment_id, row.teamId, soleAssignment.title, row.teamName);
                  else if (act === 'assign-resource') onAssignResource(row);
                  else if (act === 'edit') row.teamId ? onEditTeam(row.teamId) : (soleAssignment && onEditAssignment(soleAssignment.assignment_id));
                  else if (act === 'new-team' && soleAssignment) onNewTeam(soleAssignment.assignment_id);
                  else if (act === 'new-assignment') onNewAssignment(row.teamId);
                  else if (act === 'detach') onDisbandTeam(row.teamId, row.teamName);
                  else if (act === 'delete' && soleAssignment) onDeleteAssignment(soleAssignment.assignment_id, soleAssignment.title);
                }}>
                  <option value="" disabled>Actions...</option>
                  {row.teamId ? (
                    <>
                      <option value="edit-team">Edit Team</option>
                      {row.assignments.length === 1 && <option value="edit-assignment">Edit Assignment</option>}
                      <option value="assign-resource">Assign Assignment</option>
                      {row.assignments.length === 1 && <option value="unassign">Unassign Team</option>}
                      <option value="new-assignment">New Assignment</option>
                      {parInterval > 0 && <option value="reset-par">Reset PAR</option>}
                      <option value="detach" disabled={row.teamStatus === 'Deployed'}>Disband Team</option>
                    </>
                  ) : (
                    <>
                      <option value="edit">Edit</option>
                      <option value="assign-resource">Assign Team</option>
                      <option value="new-team">New Team</option>
                      <option value="delete">Delete Assignment</option>
                    </>
                  )}
                </select>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default OperationsTable;