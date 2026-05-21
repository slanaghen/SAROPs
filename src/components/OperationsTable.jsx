import React from 'react';

const OperationsTable = ({ 
  rows, 
  sortConfig, 
  requestSort, 
  filters, 
  onFilterChange, 
  parInterval,
  onStatusUpdate,
  onResetPar,
  onUnassignTeam,
  onReleaseTeam,
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
  onDragEnter,
  onDragLeave,
  onDrop
}) => {
  return (
    <div className="operations-table-wrapper" style={{ width: '100%' }}>
      <table className="operations-table" style={{ width: '100%', tableLayout: 'auto' }}>
        <thead>
          <tr className="group-header-row">
            <th colSpan="4" style={{ textAlign: 'center', padding: '8px 12px', background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Assignment
                <button className="btn btn-primary btn-sm" onClick={openNewAssignmentForm} style={{ height: '24px', fontSize: '10px', padding: '0 8px', minWidth: '0', width: 'auto', flex: 'none' }}>
                  New
                </button>
              </div>
            </th>
            <th colSpan={parInterval > 0 ? 7 : 6} style={{ textAlign: 'center', padding: '8px 12px', background: '#f8fafc', borderLeft: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Team
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
          <tr className="filter-row">
            {['assignmentName', 'assignmentType', 'tacChannel', 'assignmentStatus', 'teamName', 'teamType', 'teamLeader', 'leaderIdentifier'].map(key => (
              <td key={key} style={{ textAlign: 'center' }}>
                <input
                  type="text"
                  placeholder="Filter..."
                  value={filters[key] || ''}
                  onChange={(e) => onFilterChange(key, e.target.value)}
                  className="column-filter-input"
                  style={{ width: '100%', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </td>
            ))}
            <td style={{ textAlign: 'center' }}></td>
            <td style={{ textAlign: 'center' }}></td>
            {parInterval > 0 && <td style={{ textAlign: 'center' }}></td>}
            <td style={{ textAlign: 'center' }}></td>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={parInterval > 0 ? 12 : 11} className="empty-row">No matching records found.</td></tr>
          ) : rows.map(row => (
            <tr key={row.id} className={
              (row.assignmentStatus === 'Deployed' && row.hasBoth) ? 'row-deployed' :
              (row.assignmentStatus === 'Assigned' && row.hasBoth) ? 'row-assigned' :
              (row.assignmentStatus === 'Completed' && row.hasBoth) ? 'row-complete' : ''
            } style={row.isParOverdue ? { backgroundColor: '#fff7ed', borderLeft: '4px solid #f97316' } : {}}>
              <td style={{ textAlign: 'center' }}>
                {row.assignmentName ? (
                  <div 
                    className={`chip assignment-chip ${draggedItem?.id === row.id && draggedItem?.type === 'assignment' ? 'dragging' : ''} ${dropTarget?.id === row.id && dropTarget?.type === 'assignment' ? 'drop-target' : ''} ${row.hasBoth ? 'locked' : ''}`}
                    draggable={!row.hasBoth}
                    onDragStart={!row.hasBoth ? (e) => onDragStart(e, row.id, 'assignment') : undefined}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => { if (!row.hasBoth) e.preventDefault(); }}
                    onDragEnter={(e) => onDragEnter(e, row.id, 'assignment')}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, row.id, 'assignment')}
                    onClick={() => onEditAssignment(row.assignmentId)}
                  >
                    {row.assignmentName}
                  </div>
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>{row.assignmentType || '—'}</td>
              <td style={{ textAlign: 'center' }}>{row.tacChannel || '—'}</td>
              <td style={{ textAlign: 'center' }}>
                {row.assignmentId ? (
                  row.hasBoth ? (
                    <select 
                      value={row.assignmentStatus} 
                      onChange={(e) => onStatusUpdate(row.assignmentId, row.teamId, e.target.value)}
                      className={`status-indicator ${row.assignmentStatus.toLowerCase()} status-select-inline`}
                    >
                      <option value="Planned">Planned</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Deployed">Deployed</option>
                      <option value="Completed">Completed</option>
                      <option value="Incomplete">Incomplete</option>
                    </select>
                  ) : <span className={`status-indicator ${row.assignmentStatus?.toLowerCase() || ''}`}>{row.assignmentStatus || '—'}</span>
                ) : null}
              </td>
              <td style={{ textAlign: 'center' }}>
                {row.teamName ? (
                  <div 
                    className={`chip team-chip ${draggedItem?.id === row.teamId && draggedItem?.type === 'team' ? 'dragging' : ''} ${dropTarget?.id === row.teamId && dropTarget?.type === 'team' ? 'drop-target' : ''} ${row.hasBoth ? 'locked' : ''}`}
                    draggable={!row.hasBoth}
                    onDragStart={!row.hasBoth ? (e) => onDragStart(e, row.teamId, 'team') : undefined}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => { if (!row.hasBoth) e.preventDefault(); }}
                    onDragEnter={(e) => onDragEnter(e, row.teamId, 'team')}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, row.teamId, 'team')}
                    onClick={() => onEditTeam(row.teamId)}
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
              <td style={{ textAlign: 'center' }}>{row.teamSize || '—'}</td>
              <td style={{ textAlign: 'center' }}>
                {row.teamId ? (
                  <span className={`status-indicator ${row.teamStatus?.toLowerCase() || ''}`}>{row.teamStatus || '—'}</span>
                ) : null}
              </td>
              {parInterval > 0 && (
                <td style={{ textAlign: 'center' }}>
                  {row.teamId && (row.isParOverdue ? (
                    <span 
                      className="status-indicator incomplete" 
                      onClick={() => onResetPar(row.teamId, row.teamName)}
                      title="Click to reset PAR"
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        backgroundColor: '#dc2626', 
                        color: 'white', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px',
                        fontWeight: 700,
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
                <select className="status-update-select" value="" onChange={(e) => {
                  const act = e.target.value;
                  if (act === 'edit-team') onEditTeam(row.teamId);
                  else if (act === 'edit-assignment') onEditAssignment(row.assignmentId);
                  else if (act === 'reset-par') onResetPar(row.teamId, row.teamName);
                  else if (act === 'unassign') onUnassignTeam(row.assignmentId, row.teamId, row.assignmentName, row.teamName);
                  else if (act === 'assign-resource') onAssignResource(row);
                  else if (act === 'edit') row.teamId ? onEditTeam(row.teamId) : onEditAssignment(row.assignmentId);
                  else if (act === 'new-team') onNewTeam(row.assignmentId);
                  else if (act === 'new-assignment') onNewAssignment(row.teamId);
                  else if (act === 'detach') onReleaseTeam(row.teamId, row.teamName);
                  else if (act === 'delete') onDeleteAssignment(row.assignmentId, row.assignmentName);
                }}>
                  <option value="" disabled>Actions...</option>
                  {row.hasBoth ? (
                    <>
                      <option value="edit-team">Edit Team</option>
                      <option value="edit-assignment">Edit Assignment</option>
                      <option value="unassign">Unassign Team</option>
                      {parInterval > 0 && <option value="reset-par">Reset PAR</option>}
                    </>
                  ) : (
                    <>
                      <option value="edit">Edit</option>
                      <option value="assign-resource">{row.assignmentId ? 'Assign Team' : 'Assign Assignment'}</option>
                      {row.teamId ? (
                        <>
                          <option value="new-assignment">New Assignment</option>
                          {parInterval > 0 && <option value="reset-par">Reset PAR</option>}
                          <option value="detach">Disband Team</option>
                        </>
                      ) : (
                        <>
                          <option value="new-team">New Team</option>
                          <option value="delete">Delete Assignment</option>
                        </>
                      )}
                    </>
                  )}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OperationsTable;