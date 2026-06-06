import React, { useState, useEffect } from 'react';
import BaseModal from '../BaseModal';
import { RESPONDER_STATUS_LIST } from '../operationalConstants';

const VehicleFormModal = ({ isOpen, onClose, onSave, initialData, responders, loading, error }) => {
  const [formData, setFormData] = useState({
    designation: '',
    type: '',
    status: 'Staged',
    responder_id: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        vehicle_id: initialData.vehicle_id,
        designation: initialData.designation || '',
        type: initialData.type || '',
        status: initialData.status || 'Staged',
        responder_id: initialData.responder_id || '',
        incident_id: initialData.incident_id
      });
    } else {
      setFormData({
        designation: '',
        type: '',
        status: 'Staged',
        responder_id: '',
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Vehicle' : 'Add New Vehicle'}
      actions={
        <>
          {!initialData && (
            <button className="btn btn-secondary" onClick={() => onSave(formData, true)} disabled={loading}>
              Save & Add Another
            </button>
          )}
          <button className="btn btn-primary" onClick={() => onSave(formData, false)} disabled={loading}>
            {initialData ? 'Save Changes' : 'Save & Exit'}
          </button>
        </>
      }
    >
      <div className="modal-scroll-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px' }}>
        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
        
        <div className="form-row">
          <label htmlFor="designation">Vehicle Designation *</label>
          <input id="designation" name="designation" value={formData.designation} onChange={handleChange} placeholder="e.g. 3121, Rescue 1" required />
        </div>

        <div className="form-row">
          <label htmlFor="type">Vehicle Type</label>
          <input id="type" name="type" value={formData.type} onChange={handleChange} placeholder="e.g. UTV, Boat, Snowmobile" />
        </div>

        <div className="form-row">
          <label htmlFor="responder_id">Driver</label>
          <select id="responder_id" name="responder_id" value={formData.responder_id} onChange={handleChange}>
            <option value="">— Unassigned —</option>
            {responders.map(r => (
              <option key={r.responder_id} value={r.responder_id}>{r.name} ({r.agency})</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" value={formData.status} onChange={handleChange}>
            {RESPONDER_STATUS_LIST.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </BaseModal>
  );
};

export default VehicleFormModal;