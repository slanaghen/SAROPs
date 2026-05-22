import React, { useState, useEffect } from 'react';
import { RESOURCE_TYPES } from '../constants/operationalConstants';
import { normalizeResourceTypeName } from '../utils/dataNormalization';

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
  const [assignmentForm, setAssignmentForm] = useState({
    ...initialData,
    resource_type: normalizeResourceTypeName(initialData.resource_type)
  });

  useEffect(() => {
    setAssignmentForm({
      ...initialData,
      resource_type: normalizeResourceTypeName(initialData.resource_type)
    });
  }, [initialData]);

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
            <label htmlFor="asn_division">Segment</label>
            <input
              id="asn_division"
              type="text"
              value={assignmentForm.segment || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, segment: e.target.value })}
              placeholder="e.g., A, B, C"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_size">Team Size</label>
            <input
              id="asn_size"
              type="number"
              value={assignmentForm.team_size || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, team_size: e.target.value })}
              placeholder="e.g., 2"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_type">Resource Type</label>
            <select
              id="asn_type"
              value={assignmentForm.resource_type || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, resource_type: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="">— Select Type —</option>
              {RESOURCE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_tac">TAC Channel</label>
            <input
              id="asn_tac"
              type="text"
              value={assignmentForm.frequency_primary || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, frequency_primary: e.target.value })}
              placeholder="e.g., TAC 1, 155.450"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div className="form-row">
            <label htmlFor="asn_priority">Priority</label>
            <select
              id="asn_priority"
              value={assignmentForm.priority || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, priority: e.target.value })}
            >
              <option value="">— Select Priority —</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="asn_hazards">Hazards</label>
            <input id="asn_hazards" type="text" value={assignmentForm.hazards || ''} onChange={e => setAssignmentForm({ ...assignmentForm, hazards: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="asn_pod">POD (%) / Probability</label>
            <input
              id="asn_pod"
              type="number"
              min="0"
              max="100"
              value={assignmentForm.probability_of_detection || ''}
              onChange={e => setAssignmentForm({ ...assignmentForm, probability_of_detection: e.target.value })}
              placeholder="0-100"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="asn_narrative">Description</label>
          <textarea
            id="asn_narrative"
            value={assignmentForm.description || ''}
            onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value.slice(0, 500) })}
            placeholder="Assignment narrative"
            style={{ minHeight: '80px' }}
          />
          <small className="form-hint" style={{ textAlign: 'right' }}>{(assignmentForm.description || '').length}/500</small>
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