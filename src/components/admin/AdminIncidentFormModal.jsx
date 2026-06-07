import React, { useState, useEffect } from 'react';
import BaseModal from '../BaseModal';

import { useToast } from '../../context/ToastContext';
const AdminIncidentFormModal = ({ isOpen, onClose, onSave, initialData, loading, error }) => {
  const [formData, setFormData] = useState({
    incident_id: '',
    name: '',
    number: '',
    sartopo_id: '',
    notes: '',
    start_datetime: '',
  });

  const isEditing = !!initialData?.incident_id;
  const { addToast } = useToast();

  useEffect(() => {
    if (isEditing && initialData) {
      setFormData({
        incident_id: initialData.incident_id || '',
        name: initialData.name || '',
        number: initialData.number || '',
        sartopo_id: initialData.sartopo_id || '',
        notes: initialData.notes || '',
        start_datetime: initialData.start_datetime ? initialData.start_datetime.slice(0, 16) : '',
      });
    } else {
      setFormData({
        incident_id: '',
        name: '',
        number: '',
        sartopo_id: '',
        notes: '',
        start_datetime: new Date().toISOString().slice(0, 16),
      });
    }
  }, [isOpen, initialData, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Incident: ${initialData?.name}` : 'Add New Incident'}
      actions={
        <button type="submit" form="incident-form" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Incident'}
        </button>
      }
    >
      <form id="incident-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <label>
          Incident Name
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Missing Person Search" required />
        </label>
        <label>
          Incident Number
          <input type="text" name="number" value={formData.number} onChange={handleChange} placeholder="SAR-2024-001" required />
        </label>
        <label>
          SARTopo Map ID
          <input type="text" name="sartopo_id" value={formData.sartopo_id} onChange={handleChange} placeholder="e.g. 9ABC" />
        </label>
        <label>
          Start Date / Time
          <input type="datetime-local" name="start_datetime" value={formData.start_datetime} onChange={handleChange} required />
        </label>
        <label>
          Notes
          <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Optional notes or summary about the incident" />
        </label>
      </form>
    </BaseModal>
  );
};

export default AdminIncidentFormModal;