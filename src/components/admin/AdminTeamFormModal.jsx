import React, { useState, useEffect } from 'react';
import BaseModal from '../BaseModal';

import { useToast } from '../../context/ToastContext';
const AdminTeamFormModal = ({ isOpen, onClose, onSave, initialData, loading, error, responders }) => {
  const [formData, setFormData] = useState({
    team_id: '',
    team_name_number: '',
    sartopo_color_hex: '#FF0000',
    type: 'Ground',
    status: 'Staged',
    leader_responder_id: '',
    equipment: '', // Comma-separated string
  });

  const isEditing = !!initialData?.team_id;
  const { addToast } = useToast();

  useEffect(() => {
    if (isEditing && initialData) {
      setFormData({
        team_id: initialData.team_id || '',
        team_name_number: initialData.team_name_number || '',
        sartopo_color_hex: initialData.sartopo_color_hex || '#FF0000',
        type: initialData.type || 'Ground',
        status: initialData.status || 'Staged',
        leader_responder_id: initialData.leader_responder_id || '',
        equipment: Array.isArray(initialData.equipment) ? initialData.equipment.join(', ') : (initialData.equipment || ''),
      });
    } else {
      setFormData({
        team_id: '', team_name_number: '', sartopo_color_hex: '#FF0000',
        type: 'Ground', status: 'Staged', leader_responder_id: '', equipment: '',
      });
    }
  }, [isOpen, initialData, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Convert equipment string to array before saving
    const dataToSave = {
      ...formData,
      equipment: formData.equipment.split(',').map(item => item.trim()).filter(Boolean),
    };
    onSave(dataToSave);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Team: ${initialData?.team_name_number}` : 'Add New Team'}
      actions={
        <button type="submit" form="team-form" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Team'}
        </button>
      }
    >
      <form id="team-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <label>
          Team Name / Number
          <input type="text" name="team_name_number" value={formData.team_name_number} onChange={handleChange} placeholder="Alpha-1" required />
        </label>
        <label>
          SARTopo Color (Hex)
          <input type="color" name="sartopo_color_hex" value={formData.sartopo_color_hex} onChange={handleChange} />
        </label>
        <label>
          Type
          <select name="type" value={formData.type} onChange={handleChange} required>
            <option value="Ground">Ground</option>
            <option value="Hasty">Hasty</option>
            <option value="Vehicle">Vehicle</option>
            <option value="UAS">UAS</option>
            <option value="Water">Water</option>
            <option value="Tracking">Tracking</option>
            <option value="Dog">Dog</option>
            <option value="Avalanche">Avalanche</option>
            <option value="Transport">Transport</option>
            <option value="Helicopter">Helicopter</option>
            <option value="Medical">Medical</option>
            <option value="Staff">Staff</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" value={formData.status} onChange={handleChange} required>
            <option value="Staged">Staged</option>
            <option value="Assigned">Assigned</option>
            <option value="Deployed">Deployed</option>
            <option value="Disbanded">Disbanded</option>
          </select>
        </label>
        <label>
          Team Leader
          <select name="leader_responder_id" value={formData.leader_responder_id} onChange={handleChange}>
            <option value="">— Select Leader —</option>
            {responders.map(r => (
              <option key={r.responder_id} value={r.responder_id}>{r.name} ({r.agency} {r.identifier})</option>
            ))}
          </select>
        </label>
        <label>
          Equipment (comma-separated)
          <input type="text" name="equipment" value={formData.equipment} onChange={handleChange} placeholder="GPS, Radio, First Aid Kit" />
        </label>
      </form>
    </BaseModal>
  );
};

export default AdminTeamFormModal;