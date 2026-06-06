import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
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
  const [formData, setFormData] = useState(initialData || {});

  useEffect(() => {
    setFormData({
      ...initialData,
      status: initialData.assignment_id ? (initialData.status || 'Planned') : 'Planned',
      resource_type: normalizeResourceTypeName(initialData?.resource_type)
    });
  }, [initialData, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={formData.assignment_id ? 'Edit Assignment' : 'New Assignment'}
      loading={loading}
      actions={
        <>
          {!formData.assignment_id && (
            <button className="btn btn-secondary" onClick={() => onSave(formData, true)} disabled={loading}>
              {loading ? 'Saving...' : 'Save & Add Another'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => onSave(formData, false)} disabled={loading}>
            {loading ? 'Saving...' : (formData.assignment_id ? 'Save Changes' : 'Save & Exit')}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <div className="modal-scroll-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px' }}>
        <div className="form-row">
          <label htmlFor="asn_name">Assignment Title</label>
          <input
            id="asn_name"
            name="title"
            type="text"
            value={formData.title || ''}
            onChange={handleInputChange}
           placeholder="e.g., AA, AB, Sector 1"
           required
          />
        </div>

        <div className="form-row">
          <label htmlFor="asn_status">Status</label>
          <select 
            id="asn_status" 
            name="status" 
            value={formData.status || 'Planned'} 
            onChange={handleInputChange}
            disabled={!formData.assignment_id}
            required
          >
            <option value="Planned">Planned</option>
            <option value="Assigned">Assigned</option>
            <option value="Deployed">Deployed</option>
            <option value="Completed">Completed</option>
            <option value="Incomplete">Incomplete</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-start' }}>
          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_division">Segment</label>
            <input
              id="asn_division"
              name="segment"
              type="text"
              value={formData.segment || ''}
              onChange={handleInputChange}
              placeholder="e.g., A, B, C"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_size">Team Size</label>
            <input
              id="asn_size"
              name="team_size"
              type="number"
              value={formData.team_size || ''}
              onChange={handleInputChange}
              placeholder="e.g., 2"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="asn_type">Resource Type</label>
            <select
              id="asn_type"
              name="resource_type"
              value={formData.resource_type || ''}
              onChange={handleInputChange}
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
              name="frequency_primary"
              type="text"
              value={formData.frequency_primary || ''}
              onChange={handleInputChange}
              placeholder="e.g., TAC 1, 155.450"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0 12px' }}>
          <div className="form-row">
            <label htmlFor="asn_priority">Priority</label>
            <select
              id="asn_priority"
              name="priority"
              value={formData.priority || ''}
              onChange={handleInputChange}
            >
              <option value="">— Select Priority —</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="asn_pod">POD (%) / Probability</label>
            <input
              id="asn_pod"
              name="probability_of_detection"
              type="number"
              min="0"
              max="100"
              value={formData.probability_of_detection || ''}
              onChange={handleInputChange}
              placeholder="0-100"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-row">
            <label htmlFor="asn_time">Time Allocated</label>
            <input 
              id="asn_time" 
              name="time_allocated"
              type="text" 
              value={formData.time_allocated || ''} 
              onChange={handleInputChange} 
              placeholder="e.g. 4 hours"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-row">
            <label htmlFor="asn_transport">Transportation</label>
            <input 
              id="asn_transport" 
              name="transportation"
              type="text" 
              value={formData.transportation || ''} 
              onChange={handleInputChange} 
              placeholder="e.g. Foot, ATV, Heli"
            />
          </div>
          <div className="form-row">
            <label htmlFor="asn_prepared">Prepared By</label>
            <input 
              id="asn_prepared" 
              name="prepared_by"
              type="text" 
              value={formData.prepared_by || ''} 
              onChange={handleInputChange} 
            />
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="asn_hazards">Hazards</label>
          <input 
            id="asn_hazards" 
            name="hazards"
            type="text" 
            value={formData.hazards || ''} 
            onChange={handleInputChange} 
          />
        </div>

        <div className="form-row">
          <label htmlFor="asn_narrative">Description</label>
          <textarea
            id="asn_narrative"
            name="description"
            value={formData.description || ''}
            onChange={e => handleInputChange({ target: { name: 'description', value: e.target.value.slice(0, 500) }})}
            placeholder="Assignment narrative"
            style={{ minHeight: '80px' }}
          />
          <small className="form-hint" style={{ textAlign: 'right' }}>{(formData.description || '').length}/500</small>
        </div>

        <div className="form-row">
          <label htmlFor="asn_debrief">Debrief Narrative</label>
          <textarea
            id="asn_debrief"
            name="debrief_narrative"
            value={formData.debrief_narrative || ''}
            onChange={e => handleInputChange({ target: { name: 'debrief_narrative', value: e.target.value.slice(0, 1000) }})}
            placeholder="Search results and findings..."
            style={{ minHeight: '80px' }}
          />
          <small className="form-hint" style={{ textAlign: 'right' }}>{(formData.debrief_narrative || '').length}/1000</small>
        </div>
      </div>
    </BaseModal>
  );
};

export default AssignmentFormModal;