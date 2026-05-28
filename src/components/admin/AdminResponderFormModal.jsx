import React, { useState, useEffect } from 'react';
import BaseModal from '../BaseModal';

const AdminResponderFormModal = ({ isOpen, onClose, onSave, initialData, loading, error }) => {
  const [formData, setFormData] = useState({
    responder_id: '',
    name: '',
    agency: '',
    identifier: '',
    cell_phone: '',
    special_skills: '',
    access_level: 'responder',
    responder_type: 'SAR',
  });

  const isEditing = !!initialData?.responder_id;

  useEffect(() => {
    if (isEditing && initialData) {
      setFormData({
        responder_id: initialData.responder_id || '',
        name: initialData.name || '',
        agency: initialData.agency || '',
        identifier: initialData.identifier || '',
        cell_phone: initialData.cell_phone || '',
        special_skills: initialData.special_skills || '',
        access_level: initialData.access_level || 'responder',
        responder_type: initialData.responder_type || 'SAR',
      });
    } else {
      setFormData({
        responder_id: '',
        name: '',
        agency: '',
        identifier: '',
        cell_phone: '',
        special_skills: '',
        access_level: 'responder',
        responder_type: 'SAR',
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
      title={isEditing ? `Edit Responder: ${initialData?.name}` : 'Add New Responder'}
      actions={
        <button type="submit" form="responder-form" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Responder'}
        </button>
      }
    >
      <form id="responder-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <label>
          Full Name
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" required />
        </label>
        <label>
          Agency
          <input type="text" name="agency" value={formData.agency} onChange={handleChange} placeholder="SAR Agency" required />
        </label>
        <label>
          Identifier
          <input type="text" name="identifier" value={formData.identifier} onChange={handleChange} placeholder="JD-1" required />
        </label>
        <label>
          Phone Number
          <input type="tel" name="cell_phone" value={formData.cell_phone} onChange={handleChange} placeholder="555-123-4567" />
        </label>
        <label>
          Access Level
          <select name="access_level" value={formData.access_level} onChange={handleChange}>
            <option value="responder">Responder</option>
            <option value="staff">Staff</option>
            {/* Admin access level is managed via the Users table */}
          </select>
        </label>
        <label>
          Responder Type
          <select name="responder_type" value={formData.responder_type} onChange={handleChange}>
            <option value="SAR">SAR</option>
            <option value="Fire">Fire</option>
            <option value="Law">Law Enforcement</option>
            <option value="Medical">Medical</option>
          </select>
        </label>
        <label>
          Special Skills
          <textarea name="special_skills" value={formData.special_skills} onChange={handleChange} placeholder="EMT, Rope Rescue, K9 Handler" />
        </label>
        {error && <p className="alert alert-error" style={{ marginTop: '12px' }}>{error}</p>}
      </form>
    </BaseModal>
  );
};

export default AdminResponderFormModal;