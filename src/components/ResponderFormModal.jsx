import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { useIncident } from '../context/IncidentContext';

/**
 * Constant lists for form options
 */
const skillsList = [
  "Air Scent Dog", "Trail Dog", "UAS", "Vehicle", "Snowmobile", "UTV", 
  "Swiftwater", "Dive", "Avalanche", "Boat", "Helicopter", "Rope Rescue", 
  "Litter", "Medical", "Other"
];
const ACCESS_LEVELS = ["responder", "command staff"];
const STATUS_LIST = ["Staged", "Attached", "Assigned", "Deployed"];


/**
 * Shared Modal for editing Responder details.
 */
const ResponderFormModal = ({
  isOpen,
  onClose,
  onSave,
  onCheckOut,
  initialData = {},
  loading = false,
  error = null
}) => {
  const { setAccessLevel: setContextAccessLevel } = useIncident();
  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleInputChange = (e) => {
    const target = e.target;
    const name = target.name;
    let processedValue;

    if (target instanceof HTMLSelectElement && target.multiple) {
      processedValue = Array.from(target.selectedOptions).map(opt => opt.value).filter(v => v !== '').join(', ');
      setFormData(prev => ({
        ...prev,
        [name]: processedValue,
      }));
    }
    else { // This else block was missing, causing the subsequent `if` to be outside the function
      const { value, type, checked } = target;
      processedValue = type === 'checkbox' ? checked : value;
      setFormData(prev => ({
        ...prev,
        [name]: processedValue,
      }));
    }

    // This part should be after setFormData, within the function
    if (name === 'access_level' && formData.responder_id === initialData.responder_id) {
      setContextAccessLevel(processedValue); // Update context if editing current responder
    }
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Responder"
      loading={loading}
      actions={
        <>
          {onCheckOut && (
            <button className="btn btn-secondary" onClick={() => onCheckOut(formData)} disabled={loading} style={{ color: '#dc2626', marginRight: 'auto' }}>
              Check Out
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <div className="form-row">
        <label htmlFor="res_name">Full Name</label>
        <input id="res_name" name="name" value={formData.name || ''} onChange={handleInputChange} required />
      </div>

      <div className="form-row">
        <label htmlFor="res_agency">Agency</label>
        <input id="res_agency" name="agency" value={formData.agency || ''} onChange={handleInputChange} />
      </div>

      <div className="form-row">
        <label htmlFor="res_id">Identifier</label>
        <input id="res_id" name="identifier" value={formData.identifier || ''} onChange={handleInputChange} />
      </div>

      <div className="form-row">
        <label htmlFor="res_phone">Cell Phone</label>
        <input id="res_phone" name="cell_phone" value={formData.cell_phone || ''} onChange={handleInputChange} />
      </div>

      <div className="form-row">
        <label htmlFor="res_level">Access Level</label>
        <select
          id="res_level"
          name="access_level"
          value={formData.access_level || 'responder'}
          onChange={handleInputChange}
          disabled={loading}
        >
          {ACCESS_LEVELS.map(level => (
            <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="res_status">Status</label>
        <select id="res_status" name="status" value={formData.status || 'Staged'} onChange={handleInputChange}>
          {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="res_skills">Special Skills (Hold Ctrl/Cmd to multi-select)</label>
        <select
          id="res_skills"
          name="special_skills"
          multiple
          value={formData.special_skills ? formData.special_skills.split(', ') : []}
          onChange={handleInputChange}
          className="multi-select"
          style={{ minHeight: '120px' }}
        >
          {skillsList.map(skill => <option key={skill} value={skill}>{skill}</option>)}
        </select>
      </div>
    </BaseModal>
  );
};


export default ResponderFormModal;