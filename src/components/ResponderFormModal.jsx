import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { 
  RESPONDER_TYPES, 
  RESPONDER_STATUS_LIST, 
  ACCESS_LEVELS, 
  SKILLS_LIST 
} from './operationalConstants';

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

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleInputChange = (e) => {
    const target = e.target;
    const name = target.name;
    let processedValue;

    if (target.type === 'select-multiple') {
      const select = target;
      processedValue = Array.from(select.selectedOptions)
        .map(opt => opt.value)
        .filter(v => v !== '')
        .join(', ');
    }
    else {
      const { value, type, checked } = target;
      processedValue = type === 'checkbox' ? checked : value;
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
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

      <div className="modal-scroll-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 12px' }}>
          <div className="form-row" style={{ gridColumn: '1 / -1' }}>
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
            <label htmlFor="res_type">Responder Type</label>
            <select
              id="res_type"
              name="responder_type"
              value={formData.responder_type || ''}
              onChange={handleInputChange}
            >
              <option value="">— Select Type —</option>
              {RESPONDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="res_level">Access Level</label>
            <select
              id="res_level"
              name="access_level"
              value={formData.access_level || 'responder'}
              onChange={handleInputChange}
              disabled={true}
            >
              {ACCESS_LEVELS.map(level => (
                <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
              ))}
            </select>
            <small className="form-hint" style={{ fontSize: '10px', display: 'block', marginTop: '4px' }}>Access levels can only be modified in the Administration panel.</small>
          </div>

          <div className="form-row">
            <label htmlFor="res_status">Status</label>
            <select id="res_status" name="status" value={formData.status || 'Staged'} onChange={handleInputChange}>
              {RESPONDER_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '8px' }}>
          <label htmlFor="res_skills">Special Skills (Hold Ctrl/Cmd to multi-select)</label>
          <select
            id="res_skills"
            name="special_skills" // Ensure name attribute matches formData key
            multiple
            value={formData.special_skills ? formData.special_skills.split(', ') : []}
            onChange={handleInputChange}
            className="multi-select"
            style={{ minHeight: '120px' }}
          >
            {SKILLS_LIST.map(skill => <option key={skill} value={skill}>{skill}</option>)}
          </select>
        </div>
      </div>
    </BaseModal>
  );
};


export default ResponderFormModal;