import React, { useState, useEffect } from 'react';
import BaseModal from '../BaseModal';
import { RESPONDER_STATUS_LIST } from '../operationalConstants';
import { useToast } from '../../context/ToastContext';

const VehicleFormModal = ({ isOpen, onClose, onSave, initialData, loading, error }) => {
  const getInitialState = (data) => ({
    designation: data?.designation || '',
    type: data?.type || '',
    status: data?.status || 'Staged',
    vehicle_id: data?.vehicle_id || null,
    incident_id: data?.incident_id || null,
  });

  const [formData, setFormData] = useState(() => getInitialState(initialData));

  const isEditing = !!initialData?.vehicle_id;
  const { addToast } = useToast();

  useEffect(() => {
    // This effect now primarily serves to reset the form state if the modal is
    // re-opened with different initialData, or reset for a new entry.
    setFormData(getInitialState(initialData));
  }, [initialData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Vehicle: ${formData.designation}` : 'Add New Vehicle'}
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
        <div className="form-row">
          <label htmlFor="designation">Vehicle Designation *</label>
          <input id="designation" name="designation" value={formData.designation} onChange={handleChange} placeholder="e.g. 3121, Rescue 1" required />
        </div>

        <div className="form-row">
          <label htmlFor="type">Vehicle Type</label>
          <input id="type" name="type" value={formData.type} onChange={handleChange} placeholder="e.g. UTV, Boat, Snowmobile" />
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