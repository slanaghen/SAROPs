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
    outdoor_mode: false,
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
        outdoor_mode: initialData.outdoor_mode || false,
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
        outdoor_mode: false,
      });
    }
  }, [isOpen, initialData, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
      <form id="user-form" onSubmit={handleSubmit}>
        <div className="modal-scroll-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '8px' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
          {success && <div className="save-message" style={{ marginBottom: '16px' }}>{success}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 12px' }}>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="user_email">Email Address</label>
              <input
                id="user_email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@agency.gov"
                required
                disabled={isEditing}
              />
            </div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="user_username">Username</label>
              <input
                id="user_username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                disabled={isEditing}
              />
            </div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="user_password">
                Password {isEditing && <span style={{ fontSize: '11px', color: '#64748b' }}>(Leave blank to keep current)</span>}
              </label>
              <input
                id="user_password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={isEditing ? '••••••••' : '•••••••• (required)'}
                required={!isEditing}
              />
            </div>
            <div className="form-row">
              <label htmlFor="user_name">Full Name</label>
              <input id="user_name" type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" />
            </div>
            <div className="form-row">
              <label htmlFor="user_agency">Agency</label>
              <input id="user_agency" type="text" name="agency" value={formData.agency} onChange={handleChange} placeholder="SAR Agency" />
            </div>
            <div className="form-row">
              <label htmlFor="user_id">Identifier</label>
              <input id="user_id" type="text" name="identifier" value={formData.identifier} onChange={handleChange} placeholder="JD-1" />
            </div>
            <div className="form-row">
              <label htmlFor="user_phone">Phone Number</label>
              <input id="user_phone" type="tel" name="cell_phone" value={formData.cell_phone} onChange={handleChange} placeholder="555-123-4567" />
            </div>
            <div className="form-row">
              <label htmlFor="user_level">Access Level</label>
              <select id="user_level" name="access_level" value={formData.access_level} onChange={handleChange} disabled={isProfileSettings}>
                <option value="responder">Responder</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              {isProfileSettings && <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>Contact an administrator to change your permissions.</span>}
            </div>
            <div className="form-row">
              <label htmlFor="user_type">Responder Type</label>
              <select id="user_type" name="responder_type" value={formData.responder_type} onChange={handleChange}>
                <option value="SAR">SAR</option>
                <option value="Fire">Fire</option>
                <option value="Law">Law Enforcement</option>
                <option value="Medical">Medical</option>
              </select>
            </div>
            <div className="form-row" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
              <label htmlFor="user_skills">Special Skills</label>
              <textarea id="user_skills" name="special_skills" value={formData.special_skills} onChange={handleChange} placeholder="EMT, Rope Rescue, K9 Handler" />
            </div>
            <div className="form-row" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
              <input 
                type="checkbox" 
                id="user_outdoor_mode" 
                name="outdoor_mode" 
                checked={formData.outdoor_mode} 
                onChange={handleChange} 
                style={{ width: '20px', height: '20px' }}
              />
              <label htmlFor="user_outdoor_mode" style={{ marginBottom: 0, fontWeight: 700 }}>Enable Outdoor Mode (High Contrast & Large UI)</label>
            </div>
          </div>
        </div>
      </form>
    </BaseModal>
  );
};

export default AdminUserFormModal;