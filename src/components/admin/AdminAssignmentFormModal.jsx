import React, { useState, useEffect } from 'react';
import BaseModal from '../BaseModal';

import { useToast } from '../../context/ToastContext';
const AdminAssignmentFormModal = ({ isOpen, onClose, onSave, initialData, loading, error }) => {
  const [formData, setFormData] = useState({
    assignment_id: '',
    title: '',
    status: 'Planned',
    segment: '',
    resource_type: '',
    team_size: '',
    frequency_primary: '',
    description: '',
    debrief_narrative: '',
    probability_of_detection: '',
    priority: '',
    transportation: '',
    time_allocated: '',
    hazards: '',
    prepared_by: '',
  });

  const isEditing = !!initialData?.assignment_id;
  const { addToast } = useToast();

  useEffect(() => {
    if (isEditing && initialData) {
      setFormData({
        assignment_id: initialData.assignment_id || '',
        title: initialData.title || '',
        status: initialData.status || 'Planned',
        segment: initialData.segment || '',
        resource_type: initialData.resource_type || '',
        team_size: initialData.team_size || '',
        frequency_primary: initialData.frequency_primary || '',
        description: initialData.description || '',
        debrief_narrative: initialData.debrief_narrative || '',
        probability_of_detection: initialData.probability_of_detection || '',
        priority: initialData.priority || '',
        transportation: initialData.transportation || '',
        time_allocated: initialData.time_allocated || '',
        hazards: initialData.hazards || '',
        prepared_by: initialData.prepared_by || '',
      });
    } else {
      setFormData({
        assignment_id: '', title: '', status: 'Planned', segment: '', resource_type: '',
        team_size: '', frequency_primary: '', description: '', debrief_narrative: '',
        probability_of_detection: '', priority: '', transportation: '', time_allocated: '',
        hazards: '', prepared_by: '',
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
      title={isEditing ? `Edit Assignment: ${initialData?.title}` : 'Add New Assignment'}
      actions={
        <button type="submit" form="assignment-form" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Assignment'}
        </button>
      }
    >
      <form id="assignment-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
        <label>
          Title
          <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Sector Alpha Search" required />
        </label>
        <label>
          Status
          <select name="status" value={formData.status} onChange={handleChange} required>
            <option value="Planned">Planned</option>
            <option value="Assigned">Assigned</option>
            <option value="Deployed">Deployed</option>
            <option value="Completed">Completed</option>
            <option value="Incomplete">Incomplete</option>
          </select>
        </label>
        <label>
          Segment / Division
          <input type="text" name="segment" value={formData.segment} onChange={handleChange} placeholder="Alpha" />
        </label>
        <label>
          Resource Type
          <input type="text" name="resource_type" value={formData.resource_type} onChange={handleChange} placeholder="Ground Team" />
        </label>
        <label>
          Team Size
          <input type="number" name="team_size" value={formData.team_size} onChange={handleChange} min="0" />
        </label>
        <label>
          Primary Frequency / TAC Channel
          <input type="text" name="frequency_primary" value={formData.frequency_primary} onChange={handleChange} placeholder="TAC 1" />
        </label>
        <label>
          Description
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Search area for missing person..." />
        </label>
        <label>
          Debrief Narrative
          <textarea name="debrief_narrative" value={formData.debrief_narrative} onChange={handleChange} placeholder="Findings, tracks, etc." />
        </label>
        <label>
          Probability of Detection (%)
          <input type="number" name="probability_of_detection" value={formData.probability_of_detection} onChange={handleChange} min="0" max="100" />
        </label>
        <label>
          Priority
          <input type="text" name="priority" value={formData.priority} onChange={handleChange} placeholder="High" />
        </label>
        <label>
          Transportation
          <input type="text" name="transportation" value={formData.transportation} onChange={handleChange} placeholder="Foot" />
        </label>
        <label>
          Time Allocated
          <input type="text" name="time_allocated" value={formData.time_allocated} onChange={handleChange} placeholder="4 hours" />
        </label>
        <label>
          Hazards
          <input type="text" name="hazards" value={formData.hazards} onChange={handleChange} placeholder="Steep terrain, weather" />
        </label>
        <label>
          Prepared By
          <input type="text" name="prepared_by" value={formData.prepared_by} onChange={handleChange} placeholder="IC" />
        </label>
        {error && <p className="alert alert-error" style={{ marginTop: '12px' }}>{error}</p>}
      </form>
    </BaseModal>
  );
};

export default AdminAssignmentFormModal;