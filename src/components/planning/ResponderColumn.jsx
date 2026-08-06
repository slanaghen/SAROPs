import React from 'react';

const ResponderColumn = ({
  responders,
  filter,
  onFilterChange,
  onNew,
  onEdit,
  onCheckOut,
  isResponderHighlighted,
  draggedItem,
  dndHandlers,
}) => {
  return (
    <div className="section responders-section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Staged Responders ({responders.length})</h2>
        <div>
          <button className="btn btn-primary" onClick={onNew} style={{ fontSize: '14px' }}>
            New Responder
          </button>
        </div>
      </div>

      <div className="responder-filters" style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Search name, ID, agency or skills..."
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

      {responders.length === 0 ? (
        <div className="empty-state">
          <p>No available responders in staging</p>
        </div>
      ) : (
        <div className="responder-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {responders.map(responder => (
            <div
              key={responder.responder_id}
              className={`responder-card ${isResponderHighlighted(responder.responder_id) ? 'selected' : ''} ${draggedItem?.id === responder.responder_id ? 'dragging' : ''}`}
              draggable="true"
              onClick={() => onEdit(responder)}
              onDragStart={(e) => dndHandlers.handleDragStart(e, responder.responder_id, 'responder')}
              onDragEnd={dndHandlers.handleDragEnd}
              onDragOver={(e) => dndHandlers.handleDragOver(e, 'responder')}
              onDragEnter={(e) => dndHandlers.handleDragEnter(e, responder.responder_id, 'responder')}
              onDragLeave={dndHandlers.handleDragLeave}
              onDrop={(e) => dndHandlers.handleDrop(e, responder.responder_id, 'responder')}
              role="option"
              tabIndex={0}
            >
              <div className="responder-header">
                <div className="responder-name clickable-name">{responder.name}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                  <div className="responder-id-badge">{responder.identifier}</div>
                  <span className={`status-indicator ${responder.status?.toLowerCase() || ''}`}>
                    {responder.status}
                  </span>
                </div>
              </div>
              <div className="responder-agency-meta">{responder.agency}</div>
              {responder.special_skills && (
                <div className="responder-skills-badge">{responder.special_skills}</div>
              )}

              <div className="team-actions" style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => { e.stopPropagation(); onCheckOut(responder); }}
                  disabled={responder.status?.toLowerCase() !== 'staged'}
                  style={{ color: '#dc2626' }}
                >
                  Check Out
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResponderColumn;