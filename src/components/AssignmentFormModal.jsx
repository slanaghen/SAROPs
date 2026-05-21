import React, { useState, useEffect } from 'react';

/**
 * Shared Modal for creating and editing Assignments.
 */
const AssignmentFormModal = ({
  isOpen,
  onClose,
  onSave,
  initialData = {},
  loading = false,
  error = null
}) => {
  const [assignmentForm, setAssignmentForm] = useState(initialData);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{assignmentForm.assignment_id ? 'Edit Assignment' : 'New Assignment'}</h3>
        
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-row">
          <label htmlFor="asn_name">Assignment Title</label>
          <input
            id="asn_name"
            type="text"
            value={assignmentForm.title || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
            placeholder="e.g., AA, AB, Sector 1"
          />
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-start' }}>
          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_division">Division / Segment</label>
            <input
              id="asn_division"
              type="text"
              value={assignmentForm.segment || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, segment: e.target.value })}
              placeholder="Division or Segment"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_size">Size / Team Size</label>
            <input
              id="asn_size"
              type="number"
              value={assignmentForm.team_size || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, team_size: e.target.value })}
              placeholder="Size"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_type">Assignment Type / Resource Type</label>
            <input
              id="asn_type"
              type="text"
              value={assignmentForm.resource_type || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, resource_type: e.target.value })}
              placeholder="Type"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_tac">TAC Channel / Frequency Primary</label>
            <input
              id="asn_tac"
              type="text"
              value={assignmentForm.frequency_primary || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, frequency_primary: e.target.value })}
              placeholder="TAC"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="asn_narrative">Description</label>
          <textarea
            id="asn_narrative"
            value={assignmentForm.description || assignmentForm.description_narrative || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value.slice(0, 500), description_narrative: e.target.value.slice(0, 500) })}
            placeholder="Assignment narrative"
            style={{ minHeight: '80px' }}
          />
          <small className="form-hint" style={{ textAlign: 'right' }}>{(assignmentForm.description_narrative || assignmentForm.description || '').length}/500</small>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="form-row" style={{ flex: 1 }}>
            <label htmlFor="asn_pod">POD (%) / Probability</label>
            <input
              id="asn_pod"
              type="number"
              min="0"
              max="100"
              value={assignmentForm.probabilityOfDetection || assignmentForm.pod || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, probabilityOfDetection: e.target.value, pod: e.target.value })}
              placeholder="0-100"
              style={{ width: '80px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="asn_debrief">Debrief Narrative</label>
          <textarea
            id="asn_debrief"
            value={assignmentForm.debrief_narrative || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, debrief_narrative: e.target.value.slice(0, 1000) })}
            placeholder="Search results and findings..."
            style={{ minHeight: '80px' }}
          />
          <small className="form-hint" style={{ textAlign: 'right' }}>{(assignmentForm.debrief_narrative || '').length}/1000</small>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-row">
            <label htmlFor="asn_team_name">Team Name</label>
            <input id="asn_team_name" type="text" value={assignmentForm.team_name || ''} onChange={e => setAssignmentForm({ ...assignmentForm, team_name: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_priority">Priority</label>
            <input id="asn_priority" type="text" value={assignmentForm.priority || ''} onChange={e => setAssignmentForm({ ...assignmentForm, priority: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_transport">Transportation</label>
            <input id="asn_transport" type="text" value={assignmentForm.transportation || ''} onChange={e => setAssignmentForm({ ...assignmentForm, transportation: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_time_alloc">Time Allocated</label>
            <input id="asn_time_alloc" type="text" value={assignmentForm.time_allocated || ''} onChange={e => setAssignmentForm({ ...assignmentForm, time_allocated: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_segment_area">Segment Area</label>
            <input id="asn_segment_area" type="text" value={assignmentForm.segment_area || assignmentForm.segmentArea || ''} onChange={e => setAssignmentForm({ ...assignmentForm, segment_area: e.target.value, segmentArea: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_hazards">Hazards</label>
            <input id="asn_hazards" type="text" value={assignmentForm.hazards || ''} onChange={e => setAssignmentForm({ ...assignmentForm, hazards: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_prepared_by">Prepared By</label>
            <input id="asn_prepared_by" type="text" value={assignmentForm.preparedBy || ''} onChange={e => setAssignmentForm({ ...assignmentForm, preparedBy: e.target.value, prepared_by: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_folder">Folder ID</label>
            <input id="asn_folder" type="text" value={assignmentForm.folder_id || ''} onChange={e => setAssignmentForm({ ...assignmentForm, folder_id: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_color">Color</label>
            <input id="asn_color" type="text" value={assignmentForm.color || ''} onChange={e => setAssignmentForm({ ...assignmentForm, color: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_stroke">Stroke</label>
            <input id="asn_stroke" type="text" value={assignmentForm.stroke || ''} onChange={e => setAssignmentForm({ ...assignmentForm, stroke: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_fill">Fill</label>
            <input id="asn_fill" type="text" value={assignmentForm.fill || ''} onChange={e => setAssignmentForm({ ...assignmentForm, fill: e.target.value })} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onSave(assignmentForm)} disabled={loading}>
            {loading ? 'Saving...' : 'Save Assignment'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentFormModal;