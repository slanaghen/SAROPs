import React, { useState, useEffect, useCallback } from 'react';
import BaseModal from './BaseModal';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';

/**
 * Configuration for available team types. 
 * Moving this out of the JSX makes the component more extensible.
 */
const TEAM_TYPES = [
  'Hasty', 'Ground Search', 'Vehicle Search', 'Aerial Search', 
  'Water Search', 'Tracking', 'Dog', 'Avalanche', 
  'Helicopter', 'Medical', 'Other'
];

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
  error = null,
  commandStaffExists = false
}) => {
  const { responderName, user } = useIncident();
  const staffName = responderName || user?.email || 'Operations';

  // Initialize roles from current responders
  const initialRoles = {};
  if (initialData.current_responders) {
    initialData.current_responders.forEach(r => {
      initialRoles[r.responder_id] = r.role || '';
    });
  }

  const [teamForm, setTeamForm] = useState({
    ...initialData,
    equipment: Array.isArray(initialData.equipment) ? initialData.equipment.join(', ') : (initialData.equipment || ''),
    responder_roles: initialRoles
  });

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');

  const fetchMessages = useCallback(async () => {
    if (!teamForm.team_id) return;
    const { data } = await supabase
      .from('team_messages')
      .select('*')
      .eq('team_id', teamForm.team_id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [teamForm.team_id]);

  useEffect(() => {
    if (!isOpen || !teamForm.team_id) return;
    fetchMessages();
    
    const channel = supabase
      .channel(`staff-team-msgs-${teamForm.team_id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'team_messages', 
        filter: `team_id=eq.${teamForm.team_id}` 
      }, payload => setMessages(prev => {
        // Prevent duplicate if the local insert response arrived first
        if (prev.some(m => m.id === payload.new.id)) return prev;
        return [...prev, payload.new];
      }))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, teamForm.team_id, fetchMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !teamForm.team_id) return;
    const { data, error: sendErr } = await supabase.from('team_messages').insert({
      team_id: teamForm.team_id,
      sender_name: staffName,
      message_text: messageText.trim()
    })
    .select()
    .single();

    if (data && !sendErr) {
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
      setMessageText('');
    }
  };

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
    
    const newRoles = { ...(teamForm.responder_roles || {}) };
    if (isSelected) {
      delete newRoles[responderId];
    } else {
      newRoles[responderId] = '';
    }

    setTeamForm({
      ...teamForm,
      responder_ids: isSelected
        ? selectedIds.filter(id => id !== responderId)
        : [...selectedIds, responderId],
      responder_roles: newRoles
    });
  };

  const handleRoleChange = (responderId, role) => {
    setTeamForm({
      ...teamForm,
      responder_roles: {
        ...(teamForm.responder_roles || {}),
        [responderId]: role
      }
    });
  };

  const handleSave = () => {
    // Convert equipment string back to array for the API
    const equipmentArray = typeof teamForm.equipment === 'string'
      ? teamForm.equipment.split(',').map(s => s.trim()).filter(Boolean)
      : (Array.isArray(teamForm.equipment) ? teamForm.equipment : []);

    onSave({
      ...teamForm,
      equipment: equipmentArray
    });
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={teamForm.team_id ? 'Edit Team' : 'New Team'}
      loading={loading}
      actions={<button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>}
    >
        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <div className="form-row">
          <label htmlFor="team_name">Team Name</label>
          <input 
            id="team_name"
            value={teamForm.team_name_number || ''} 
            onChange={e => setTeamForm({ ...teamForm, team_name_number: e.target.value })} 
            placeholder="Auto-generated as Team# if blank" 
          />
        </div>

        <div className="form-row">
          <label htmlFor="team_type">Type</label>
          <select id="team_type" value={teamForm.type} onChange={e => {
            const newType = e.target.value;
            const newRoles = { ...(teamForm.responder_roles || {}) };
            if (teamForm.leader_responder_id) {
              const oldLeaderRole = teamForm.type === 'Command Staff' ? 'Incident Commander' : 'Team Leader';
              if (newRoles[teamForm.leader_responder_id] === oldLeaderRole || !newRoles[teamForm.leader_responder_id]) {
                newRoles[teamForm.leader_responder_id] = newType === 'Command Staff' ? 'Incident Commander' : 'Team Leader';
              }
            }
            setTeamForm({ ...teamForm, type: newType, responder_roles: newRoles });
          }}>
            {TEAM_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
            {(teamForm.type === 'Command Staff' || !commandStaffExists) && (
              <option value="Command Staff">Command Staff</option>
            )}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="team_status">Status</label>
          <select id="team_status" value={teamForm.status} onChange={e => setTeamForm({ ...teamForm, status: e.target.value })}>
            <option>Staged</option>
            <option>Assigned</option>
            <option>Deployed</option>
            <option>Disbanded</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="team_leader">{teamForm.type === 'Command Staff' ? 'Incident Commander' : 'Leader'}</label>
          <select 
            id="team_leader"
            value={teamForm.leader_responder_id || ''} 
            onChange={e => {
              const leaderId = e.target.value;
              const oldLeaderId = teamForm.leader_responder_id;
              const currentIds = teamForm.responder_ids || [];
              const newRoles = { ...(teamForm.responder_roles || {}) };
              const leaderRole = teamForm.type === 'Command Staff' ? 'Incident Commander' : 'Team Leader';
              
              if (oldLeaderId && oldLeaderId !== leaderId && (newRoles[oldLeaderId] === 'Team Leader' || newRoles[oldLeaderId] === 'Incident Commander')) {
                newRoles[oldLeaderId] = '';
              }
              
              newRoles[leaderId] = leaderRole;

              setTeamForm({ 
                ...teamForm, 
                leader_responder_id: leaderId,
                responder_ids: currentIds.includes(leaderId) ? currentIds : [...currentIds, leaderId],
                responder_roles: newRoles
              });
            }}
          >
            <option value="" disabled>Select a leader...</option>
            {availableResponders.map(r => (
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
                const role = (teamForm.responder_roles || {})[r.responder_id] || '';
                return (
                  <div key={r.responder_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      className={`responder-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleResponder(r.responder_id)}
                      style={{ flex: 1, textAlign: 'left' }}
                    >
                      <span>{r.name}</span>
                      <small>{r.agency || ''}</small>
                    </button>
                    {isSelected && (
                      <input 
                        type="text" 
                        placeholder="Role (optional)" 
                        value={role}
                        onChange={(e) => handleRoleChange(r.responder_id, e.target.value)}
                        style={{ width: '120px', padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        disabled={r.responder_id === teamForm.leader_responder_id}
                        title={r.responder_id === teamForm.leader_responder_id ? `${teamForm.type === 'Command Staff' ? 'Incident Commander' : 'Leader'} role is fixed` : "Assign a team role"}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="team_equipment">Equipment</label>
          <input 
            id="team_equipment" 
            value={teamForm.equipment || ''} 
            onChange={e => setTeamForm({ ...teamForm, equipment: e.target.value })} 
            placeholder="e.g. Radios, GPS, First Aid Kit"
          />
        </div>

        {teamForm.team_id && (
          <div className="form-row" style={{ borderTop: '1px solid #eee', paddingTop: '16px', marginTop: '16px' }}>
            <label>Team Communications</label>
            <div className="messages-log" style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '10px', background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              {messages.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '12px' }}>No messages found.</p> : (
                messages.map((m, i) => (
                  <div key={m.id || i} style={{ marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <strong style={{ color: m.sender_name === staffName ? '#0066cc' : '#475569' }}>{m.sender_name}</strong>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString() : '...'}</span>
                    </div>
                    <span>{m.message_text}</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={messageText} 
                onChange={(e) => setMessageText(e.target.value)} 
                placeholder="Message team leader..." 
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleSendMessage}>Send</button>
            </div>
          </div>
        )}
    </BaseModal>
  );
};

export default TeamFormModal;