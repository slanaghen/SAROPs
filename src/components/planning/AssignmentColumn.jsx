import React from 'react';

const AssignmentColumn = ({
  assignments,
  filter,
  onFilterChange,
  onNew,
  onEdit,
  onDelete,
  isAssignmentHighlighted,
  dndHandlers,
}) => {
  return (
    <div className="section assignments-section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Assignments ({assignments.length})</h2>
        <div>
          <button className="btn btn-primary" onClick={onNew} style={{ fontSize: '14px' }}>New Assignment</button>
        </div>
      </div>

      <div className="responder-filters" style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Search assignment..."
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

      {assignments.length === 0 ? (
        <div className="empty-state">
          <p>No assignments matching criteria</p>
        </div>
      ) : (
        <div className="assignment-list">
          {assignments.map(assignment => (
            <div
              key={assignment.assignment_id}
              className={`assignment-card ${isAssignmentHighlighted(assignment.assignment_id) ? 'selected' : ''}`}
              onClick={() => onEdit(assignment.assignment_id)}
              draggable="true"
              onDragStart={(e) => dndHandlers.handleDragStart(e, assignment.assignment_id, 'assignment')}
              onDragEnd={dndHandlers.handleDragEnd}
              onDragOver={(e) => dndHandlers.handleDragOver(e, 'assignment')}
              onDragEnter={(e) => dndHandlers.handleDragEnter(e, assignment.assignment_id, 'assignment')}
              onDragLeave={dndHandlers.handleDragLeave}
              onDrop={(e) => dndHandlers.handleDrop(e, assignment.assignment_id, 'assignment')}
              role="option"
              tabIndex={0}
            >
              <div className="assignment-header" style={{ gap: '8px', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="assignment-name clickable-name" style={{ marginRight: '4px' }}>{assignment.title}</div>
                {assignment.resource_type && <div className="team-type" style={{ background: '#f1f5f9', color: '#475569' }}>{assignment.resource_type}</div>}
                <span style={{ fontSize: '11px', color: '#64748b' }}>Size: {assignment.team_size}</span>
                <div className={`assignment-status ${assignment.status.toLowerCase()}`} style={{ marginLeft: 'auto' }}>
                  {assignment.status}
                </div>
              </div>

              {assignment.description && (
                <div className="assignment-details" style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
                    {assignment.description}
                  </div>
                </div>
              )}

              <div className="team-actions" style={{ marginTop: '6px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => { e.stopPropagation(); onDelete(assignment); }}
                  style={{ color: '#dc2626' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignmentColumn;