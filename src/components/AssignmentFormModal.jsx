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
          <label htmlFor="asn_division">Division</label>
          <input
            id="asn_division"
            type="text"
            value={assignmentForm.division || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, division: e.target.value })}
            placeholder="Assignment division"
          />
        </div>

        <div className="form-row">
          <label htmlFor="asn_name">Assignment Name</label>
          <input
            id="asn_name"
            type="text"
            value={assignmentForm.name || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, name: e.target.value })}
            placeholder="Auto-generated as Division+Suffix if blank"
          />
        </div>

        <div className="form-row">
          <label htmlFor="asn_type">Assignment Type</label>
          <input
            id="asn_type"
            type="text"
            value={assignmentForm.assignment_type || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, assignment_type: e.target.value })}
            placeholder="Assignment type"
          />
        </div>

        <div className="form-row">
          <label htmlFor="asn_size">Assignment Size</label>
          <input
            id="asn_size"
            type="text"
            value={assignmentForm.assignment_size || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, assignment_size: e.target.value })}
            placeholder="Assignment size"
          />
        </div>

        <div className="form-row">
          <label htmlFor="asn_tac">TAC Channel</label>
          <input
            id="asn_tac"
            type="text"
            value={assignmentForm.tac_channel || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, tac_channel: e.target.value })}
            placeholder="TAC channel"
          />
        </div>

        <div className="form-row">
          <label htmlFor="asn_narrative">Description Narrative</label>
          <textarea
            id="asn_narrative"
            value={assignmentForm.description_narrative || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, description_narrative: e.target.value.slice(0, 500) })}
            placeholder="Assignment narrative"
            style={{ minHeight: '80px' }}
          />
          <small className="form-hint" style={{ textAlign: 'right' }}>{(assignmentForm.description_narrative || '').length}/500</small>
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