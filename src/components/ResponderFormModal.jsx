import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';

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
  const [formData, setFormData] = useState(initialData);
  const [isCommandStaffChecked, setIsCommandStaffChecked] = useState(
    initialData.access_level === 'command staff'
  );

  useEffect(() => {
    setFormData(initialData);
    setIsCommandStaffChecked(initialData.access_level === 'command staff');
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
    } else if (name === 'is_command_staff') {
      const checked = target.checked;
      setIsCommandStaffChecked(checked);
      setFormData(prev => ({
        ...prev,
        access_level: checked ? 'command staff' : 'responder', // Default to responder if unchecked
      }));
    } else if (name === 'access_level') {
      processedValue = target.value;
      setIsCommandStaffChecked(processedValue === 'command staff'); // Sync checkbox with select
      setFormData(prev => ({
        ...prev,
        [name]: processedValue,
      }));
    } else {
      const { value, type, checked } = target;
      processedValue = type === 'checkbox' ? checked : value;
      setFormData(prev => ({
        ...prev,
        [name]: processedValue,
      }));
    }
  };

  const skillsList = [
    "Air Scent Dog", "Trail Dog", "UAS", "Vehicle", "Snowmobile", "UTV", 
    "Swiftwater", "Dive", "Avalanche", "Boat", "Helicopter", "Rope Rescue", 
    "Litter", "Medical", "Other"
  ];

  const statusList = ["Staged", "Attached", "Assigned", "Deployed"];

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
          <button className="btn btn-primary" onClick={() => onSave(formData)} disabled={loading}>
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

      {/* Command Staff Checkbox */}
      <div className="form-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <input
          id="is_command_staff"
          type="checkbox"
          name="is_command_staff"
          checked={isCommandStaffChecked}
          onChange={handleInputChange}
          disabled={loading}
          style={{ width: 'auto', margin: 0 }}
        />
        <label htmlFor="is_command_staff" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>Command Staff</label>
      </div>

      <div className="form-row">
        <label htmlFor="res_level">Access Level</label>
        <select
          id="res_level"
          name="access_level"
          value={formData.access_level || 'responder'}
          onChange={handleInputChange}
          disabled={isCommandStaffChecked || loading} // Disable if command staff is checked
        >
          <option value="responder">Responder</option>
          <option value="command staff">Command Staff</option>
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="res_status">Status</label>
        <select id="res_status" name="status" value={formData.status || 'Staged'} onChange={handleInputChange}>
          {statusList.map(s => <option key={s} value={s}>{s}</option>)}
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