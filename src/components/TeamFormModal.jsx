import React, { useState, useEffect } from 'react';

/**
 * Shared Modal for creating and editing Teams.
 */
const TeamFormModal = ({
  isOpen,
  onClose,
  onSave,
  initialData = {},
  responders = [],
  loading = false,
  error = null
}) => {
  const [teamForm, setTeamForm] = useState(initialData);

  if (!isOpen) return null;

  // Show responders who are Staged (available) OR already part of the team being edited
  const availableResponders = responders.filter(r => {
    const isStaged = r.status === 'Staged';
    const isCurrentMember = (teamForm.responder_ids || []).includes(r.responder_id);
    const isCurrentLeader = teamForm.leader_responder_id === r.responder_id;
    return isStaged || isCurrentMember || isCurrentLeader;
  });

  const handleToggleResponder = (responderId) => {
    const selectedIds = teamForm.responder_ids || [];
    const isSelected = selectedIds.includes(responderId);
    setTeamForm({
      ...teamForm,
      responder_ids: isSelected
        ? selectedIds.filter(id => id !== responderId)
        : [...selectedIds, responderId],
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{teamForm.team_id ? 'Edit Team' : 'New Team'}</h3>
        
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-row">
          <label>Team Name</label>
          <input 
            value={teamForm.team_name_number || ''} 
            onChange={e => setTeamForm({ ...teamForm, team_name_number: e.target.value })} 
            placeholder="Auto-generated as Team# if blank" 
          />
        </div>

        <div className="form-row">
          <label>Type</label>
          <select value={teamForm.type} onChange={e => setTeamForm({ ...teamForm, type: e.target.value })}>
            <option>Ground Search</option>
            <option>UAS Search</option>
            <option>Dog Air</option>
            <option>Dog Track</option>
            <option>Transport</option>
            <option>Helicopter</option>
            <option>Other</option>
          </select>
        </div>

        <div className="form-row">
          <label>Status</label>
          <select value={teamForm.status} onChange={e => setTeamForm({ ...teamForm, status: e.target.value })}>
            <option>Staged</option>
            <option>Assigned</option>
            <option>Deployed</option>
            <option>Demobilized</option>
          </select>
        </div>

        <div className="form-row">
          <label>Leader</label>
          <select 
            value={teamForm.leader_responder_id || ''} 
            onChange={e => {
              const leaderId = e.target.value;
              const currentIds = teamForm.responder_ids || [];
              setTeamForm({ 
                ...teamForm, 
                leader_responder_id: leaderId,
                responder_ids: currentIds.includes(leaderId) ? currentIds : [...currentIds, leaderId]
              });
            }}
          >
            <option value="" disabled>Select a leader...</option>
            {responders.map(r => (
              <option key={r.responder_id} value={r.responder_id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="form-row responders-selector">
          <label>Attach Responders</label>
          <div className="responders-list">
            {availableResponders.length === 0 ? (
              <p className="helper-text">No available responders</p>
            ) : (
              availableResponders.map(r => {
                const isSelected = (teamForm.responder_ids || []).includes(r.responder_id);
                return (
                  <button
                    key={r.responder_id}
                    type="button"
                    className={`responder-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleResponder(r.responder_id)}
                  >
                    <span>{r.name}</span>
                    <small>{r.agency || ''}</small>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="form-row">
          <label>Equipment (comma separated)</label>
          <input value={(teamForm.equipment || []).join(', ')} onChange={e => setTeamForm({ ...teamForm, equipment: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onSave(teamForm)} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default TeamFormModal;