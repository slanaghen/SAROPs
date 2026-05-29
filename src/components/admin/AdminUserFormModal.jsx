import React, { useState, useEffect } from 'react';
import BaseModal from '../BaseModal';
import { supabase } from '../../lib/supabase';

const AdminUserFormModal = ({ isOpen, onClose, onSave, initialData, loading, error, success, isProfileSettings = false }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    access_level: 'responder',
    name: '',
    agency: '',
    identifier: '',
    cell_phone: '',
    responder_type: 'SAR',
    special_skills: '',
  });

  const isEditing = !!initialData?.email;

  useEffect(() => {
    if (isEditing && initialData) {
      setFormData({
        email: initialData.email || '',
        username: initialData.username || initialData.email || '',
        password: '', // Password is never pre-filled for security
        access_level: initialData.access_level || 'responder',
        name: initialData.name || '',
        agency: initialData.agency || '',
        identifier: initialData.identifier || '',
        cell_phone: initialData.cell_phone || '',
        responder_type: initialData.responder_type || 'SAR',
        special_skills: initialData.special_skills || '',
      });
    } else {
      // Reset form for new user
      setFormData({
        email: '',
        username: '',
        password: '',
        access_level: 'responder',
        name: '',
        agency: '',
        identifier: '',
        cell_phone: '',
        responder_type: 'SAR',
        special_skills: '',
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
      title={isProfileSettings ? 'Account Settings' : (isEditing ? `Edit User: ${initialData.email}` : 'Add New User')}
      actions={
        <button type="submit" form="user-form" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save User'}
        </button>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <label>
          Email Address
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="admin@agency.gov"
            required
            disabled={isEditing} // Email cannot be changed for existing users
          />
        </label>
        <label>
          Username
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            disabled={isEditing} // Requirement: users cannot edit their own username
          />
        </label>
        <label>
          Password {isEditing && <span style={{ fontSize: '11px', color: '#64748b' }}>(Leave blank to keep current)</span>}
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={isEditing ? '••••••••' : '•••••••• (required)'}
            required={!isEditing}
          />
        </label>
        <label>
          Full Name
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" />
        </label>
        <label>
          Agency
          <input type="text" name="agency" value={formData.agency} onChange={handleChange} placeholder="SAR Agency" />
        </label>
        <label>
          Identifier
          <input type="text" name="identifier" value={formData.identifier} onChange={handleChange} placeholder="JD-1" />
        </label>
        <label>
          Phone Number
          <input type="tel" name="cell_phone" value={formData.cell_phone} onChange={handleChange} placeholder="555-123-4567" />
        </label>
        <label>
          Access Level
          <select name="access_level" value={formData.access_level} onChange={handleChange} disabled={isProfileSettings}>
            <option value="responder">Responder</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          {isProfileSettings && <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>Contact an administrator to change your permissions.</span>}
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
        {success && <p className="save-message" style={{ marginTop: '12px' }}>{success}</p>}
      </form>
    </BaseModal>
  );
};

export default AdminUserFormModal;