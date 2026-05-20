import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
 * Predefined roles for Staff teams
 */
const STAFF_PREDEFINED_ROLES = ['Incident Commander', 'Operations', 'Planning', 'Logistics', 'PIO', 'Safety', 'Liaison'];

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

  // Only staged responders (unassigned) or responders already on this team should be available.
  // This prevents assigning a responder to multiple teams simultaneously.
  const availableResponders = useMemo(() => {
    const initialMemberIds = new Set([
      ...(initialData.responder_ids || []),
      ...(initialData.current_responders?.map(r => r.responder_id) || []),
      initialData.leader_responder_id
    ].filter(Boolean));

    return responders.filter(r => 
      r.status === 'Staged' || initialMemberIds.has(r.responder_id)
    );
  }, [responders, initialData]);

  const handleDropIntoRole = (e, role) => {
    e.preventDefault();
    e.stopPropagation();
    const responderId = e.dataTransfer.getData('responderId');
    if (!responderId) return;

    const currentIds = teamForm.responder_ids || [];
    const newRoles = { ...(teamForm.responder_roles || {}) };
    
    let newLeaderId = teamForm.leader_responder_id;
    const isICRole = role === 'Incident Commander' || role === 'Team Leader';

    // Clear this specific role from anyone else (Staff roles are unique positions, non-staff teams can have multiple of same role)
    if (teamForm.type === 'Staff') {
      Object.keys(newRoles).forEach(id => {
        if (newRoles[id] === role) newRoles[id] = '';
      });
    }

    if (isICRole) {
      if (newLeaderId && newLeaderId !== responderId) {
        newRoles[newLeaderId] = ''; // Former leader becomes general member
      }
      newLeaderId = responderId;
    } else {
      if (newLeaderId === responderId) {
        newLeaderId = null; // Former leader moved to a section head role
      }
    }

    newRoles[responderId] = role;

    setTeamForm({ ...teamForm, leader_responder_id: newLeaderId, responder_ids: currentIds.includes(responderId) ? currentIds : [...currentIds, responderId], responder_roles: newRoles });
  };

  const handleDropOnPool = (e) => {
    e.preventDefault();
    const responderId = e.dataTransfer.getData('responderId');
    if (!responderId) return;

    const currentIds = teamForm.responder_ids || [];
    const newRoles = { ...(teamForm.responder_roles || {}) };
    delete newRoles[responderId];

    const isLeader = responderId === teamForm.leader_responder_id;

    setTeamForm({
      ...teamForm,
      leader_responder_id: isLeader ? null : teamForm.leader_responder_id,
      responder_ids: currentIds.filter(id => id !== responderId),
      responder_roles: newRoles
    });
  };
  const handleDropMember = (e) => {
    e.preventDefault();
    const responderId = e.dataTransfer.getData('responderId');
    if (!responderId) return;

    // Don't add if already the leader or already a member
    if (responderId === teamForm.leader_responder_id) return;
    
    const currentIds = teamForm.responder_ids || [];
    const newRoles = { ...(teamForm.responder_roles || {}) };

    // Clear role to make them a general member if dropped into the custom area
    newRoles[responderId] = '';

    setTeamForm({
      ...teamForm,
      responder_ids: currentIds.includes(responderId) ? currentIds : [...currentIds, responderId],
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

  const isStaffTeam = teamForm.type === 'Staff';
  const leaderRole = isStaffTeam ? 'Incident Commander' : 'Team Leader';

  const customMembers = (teamForm.responder_ids || []).filter(id => {
    if (id === teamForm.leader_responder_id) return false;
    const role = teamForm.responder_roles?.[id]; // Get the role assigned to this responder
    if (isStaffTeam && STAFF_PREDEFINED_ROLES.includes(role)) return false; // Exclude if it's a predefined staff role
    return true;
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={teamForm.team_id ? 'Edit Team' : 'New Team'}
      loading={loading}
      actions={<button className="btn btn-primary" onClick={handleSave} disabled={loading || !teamForm.leader_responder_id}>{loading ? 'Saving...' : 'Save'}</button>}
    >
        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', alignItems: 'flex-start' }}>
          <div className="form-row" style={{ flex: 0.8, minWidth: 0 }}>
            <label htmlFor="team_name">Team Name</label>
            <input 
              id="team_name"
              value={teamForm.team_name_number || ''} 
              onChange={e => setTeamForm({ ...teamForm, team_name_number: e.target.value })} 
              placeholder="Auto-generated if blank"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="team_type">Type</label>
            <select id="team_type" value={teamForm.type} onChange={e => {
              const newType = e.target.value;
              const newRoles = { ...(teamForm.responder_roles || {}) };
              if (teamForm.leader_responder_id) {
                const oldLeaderRole = teamForm.type === 'Staff' ? 'Incident Commander' : 'Team Leader';
                if (newRoles[teamForm.leader_responder_id] === oldLeaderRole || !newRoles[teamForm.leader_responder_id]) {
                  newRoles[teamForm.leader_responder_id] = newType === 'Staff' ? 'Incident Commander' : 'Team Leader';
                }
              }
              setTeamForm({ ...teamForm, type: newType, responder_roles: newRoles });
            }}>
              {TEAM_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
              {(teamForm.type === 'Staff' || !commandStaffExists) && (
                <option value="Staff">Staff</option>
              )}
            </select>
          </div>

          <div className="form-row" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="team_status">Status</label>
            <select id="team_status" value={teamForm.status} onChange={e => setTeamForm({ ...teamForm, status: e.target.value })}>
              <option>Staged</option>
              <option>Assigned</option>
              <option>Deployed</option>
              <option>Disbanded</option>
            </select>
          </div>
        </div>

        <div className="form-row responders-selector">
          <label>Team Composition (Drag & Drop Members)</label>
          <div className="drag-drop-composition" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Left Panel: Available Chips */}
            <div 
              className="responder-pool" 
              onDrop={handleDropOnPool} // Add drop handler for the pool
              onDragOver={(e) => e.preventDefault()} // Allow drops on the pool
              style={{ flex: 1, minHeight: '300px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}
            >
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Staged Responders</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {availableResponders.filter(r => !(teamForm.responder_ids || []).includes(r.responder_id)).map(r => (
                  <div 
                    key={r.responder_id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('responderId', r.responder_id)}
                    className="chip team-chip"
                    style={{ cursor: 'grab', padding: '8px 12px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '6px', fontSize: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ opacity: 0.7, fontSize: '10px' }}>
                      {r.agency} {r.special_skills ? `| ${r.special_skills}` : ''}
                    </div>
                  </div>
                ))}
                {availableResponders.filter(r => !(teamForm.responder_ids || []).includes(r.responder_id)).length === 0 && (
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>No staged responders available.</p>
                )}
              </div>
              <small className="form-hint" style={{ marginTop: '16px', display: 'block' }}>Drag a chip and drop it on the table to add a member.</small>
            </div>

            {/* Right Panel: Composition Table */}
            <div style={{ flex: 1.5 }}>
              <table className="operations-table" style={{ width: '100%', minWidth: 'auto', border: '1px solid #e2e8f0', background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: '60%', textAlign: 'left', padding: '8px 12px', fontSize: '12px' }}>Team Member</th>
                    <th style={{ width: '40%', textAlign: 'left', padding: '8px 12px', fontSize: '12px' }}>Role / Position</th>
                  </tr>
                </thead>
                <tbody>
                  {isStaffTeam ? (
                    STAFF_PREDEFINED_ROLES.map(role => {
                    const rId = (teamForm.responder_ids || []).find(id => teamForm.responder_roles?.[id] === role);
                    const r = rId ? responders.find(res => res.responder_id === rId) : null;
                    
                    return (
                      <tr 
                        key={role} 
                        onDrop={(e) => handleDropIntoRole(e, role)}
                        onDragOver={(e) => e.preventDefault()}
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                      >
                        <td style={{ padding: '8px 12px', height: '58px' }}>
                          {r ? (
                            <div 
                              className="chip team-chip"
                              draggable="true"
                              onDragStart={(e) => e.dataTransfer.setData('responderId', r.responder_id)}
                              style={{ display: 'inline-block', padding: '6px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', cursor: 'grab' }}
                            >
                              <div style={{ fontWeight: 600 }}>{r.name}</div>
                              <div style={{ opacity: 0.7, fontSize: '10px' }}>{r.agency}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                              Drop chip here to assign {role}...
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                          {role}
                        </td>
                      </tr>
                    )
                  })
                  ) : (
                    /* Original leader row for non-Staff teams */
                    <tr 
                      onDrop={(e) => handleDropIntoRole(e, leaderRole)}
                      onDragOver={(e) => e.preventDefault()}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                    >
                      <td style={{ padding: '8px 12px', height: '58px' }}>
                        {teamForm.leader_responder_id ? (
                          <div 
                            className="chip team-chip"
                            draggable="true"
                            onDragStart={(e) => e.dataTransfer.setData('responderId', teamForm.leader_responder_id)}
                            style={{ display: 'inline-block', padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', cursor: 'grab' }}
                          >
                            <div style={{ fontWeight: 600 }}>
                              {responders.find(r => r.responder_id === teamForm.leader_responder_id)?.name}
                            </div>
                            <div style={{ opacity: 0.7, fontSize: '10px' }}>
                              {responders.find(r => r.responder_id === teamForm.leader_responder_id)?.agency}
                            </div>
                          </div>
                        ) : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Drop chip here to assign {leaderRole}...</span>}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        {leaderRole}
                      </td>
                    </tr>
                  )}
                  {/* Dynamic Member Rows */}
                  {customMembers.map(id => {
                    const r = responders.find(res => res.responder_id === id);
                    if (!r) return null;
                    return (
                      <tr
                        key={id}
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                      >
                        <td style={{ padding: '8px 12px' }}>
                          <div 
                            className="chip team-chip"
                            draggable="true"
                            onDragStart={(e) => e.dataTransfer.setData('responderId', id)}
                            style={{ display: 'inline-block', padding: '6px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', cursor: 'grab' }}
                          >
                            <div style={{ fontWeight: 600 }}>{r.name}</div>
                            <div style={{ opacity: 0.7, fontSize: '10px' }}>
                              {r.agency}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input 
                            type="text" 
                            placeholder="Assign role..." 
                            value={teamForm.responder_roles?.[id] || ''}
                            onChange={(e) => handleRoleChange(id, e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {/* Blank Row Placeholder */}
                  <tr onDrop={handleDropMember} onDragOver={(e) => e.preventDefault()} style={{ background: '#fcfcfc' }}>
                    <td style={{ padding: '8px 12px', height: '58px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }} colSpan={2}>
                      Drop chips here to add members...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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