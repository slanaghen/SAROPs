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
    display_density: 'comfortable',
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
        display_density: initialData.display_density || 'comfortable',
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
        display_density: 'comfortable',
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

          <div className="form-row">
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

          <div className="form-row">
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

          <div className="form-row">
            <label htmlFor="user_password">
              Password {isEditing && <span style={{ fontSize: '10px', color: '#64748b', display: 'inline', fontWeight: 400 }}> (Leave blank to keep current)</span>}
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

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div className="form-row" style={{ flex: 1 }}>
              <label htmlFor="user_name">Full Name</label>
              <input id="user_name" type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" />
            </div>
            <div className="form-row" style={{ flex: 1 }}>
              <label htmlFor="user_agency">Agency</label>
              <input id="user_agency" type="text" name="agency" value={formData.agency} onChange={handleChange} placeholder="SAR Agency" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div className="form-row" style={{ flex: 1 }}>
              <label htmlFor="user_id">Identifier</label>
              <input id="user_id" type="text" name="identifier" value={formData.identifier} onChange={handleChange} placeholder="JD-1" />
            </div>
            <div className="form-row" style={{ flex: 1 }}>
              <label htmlFor="user_phone">Phone Number</label>
              <input id="user_phone" type="tel" name="cell_phone" value={formData.cell_phone} onChange={handleChange} placeholder="555-123-4567" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'start' }}>
            <div className="form-row" style={{ flex: 1 }}>
              <label htmlFor="user_type">Responder Type</label>
              <select id="user_type" name="responder_type" value={formData.responder_type} onChange={handleChange}>
                <option value="SAR">SAR</option>
                <option value="Fire">Fire</option>
                <option value="Law">Law Enforcement</option>
                <option value="Medical">Medical</option>
              </select>
            </div>
            <div className="form-row" style={{ flex: 1 }}>
              <label>Display Density</label>
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0', width: 'fit-content' }}>
                {['comfortable', 'compact'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleChange({ target: { name: 'display_density', value: mode } })}
                    style={{
                      border: 'none', padding: 'var(--chip-padding)', borderRadius: '6px', fontSize: 'var(--chip-font-size)', fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.2s ease', background: formData.display_density === mode ? 'white' : 'transparent', color: formData.display_density === mode ? '#2563eb' : '#64748b', boxShadow: formData.display_density === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="user_level">Access Level</label>
            <select id="user_level" name="access_level" value={formData.access_level} onChange={handleChange} disabled={isProfileSettings}>
              <option value="responder">Responder</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            {isProfileSettings && <small className="form-hint">Contact an administrator to change permissions.</small>}
          </div>

          <div className="form-row">
            <label htmlFor="user_skills">Special Skills</label>
            <textarea id="user_skills" name="special_skills" value={formData.special_skills} onChange={handleChange} placeholder="EMT, Rope Rescue, K9 Handler" style={{ minHeight: '80px' }} />
          </div>
        </div>
      </form>
    </BaseModal>
  );
};

export default AdminUserFormModal;