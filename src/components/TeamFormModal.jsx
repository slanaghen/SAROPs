import React, { useState, useEffect, useCallback, useMemo } from 'react';
import BaseModal from './BaseModal';
import { useIncident } from '../context/IncidentContext';
import { TEAM_TYPES, STAFF_PREDEFINED_ROLES } from '../constants/operationalConstants';
import { normalizeResourceTypeName } from '../utils/dataNormalization';
import { useToast } from '../context/ToastContext';
import '../styles/FormElements.css';

/**
 * Shared Modal for creating and editing Teams.
 */
const TeamFormModal = ({
  isOpen,
  onClose,
  onSave,
  initialData = {},
  responders = [],
  vehicles = [],
  onEditVehicle,
  loading = false,
  commandStaffExists = false
}) => {
  const getInitialState = (data) => {
    const initial = data || {};
    const allResponderIds = initial.current_responders?.map(r => r.responder_id) || initial.responder_ids || [];
    const leaderId = initial.leader_responder_id;

    const rolesFromView = (initial.current_responders || []).reduce((acc, r) => {
      acc[r.responder_id] = r.role || '';
      return acc;
    }, {});

    return {
      ...initial,
      team_name_number: initial.team_name_number || '',
      status: initial.team_id ? (initial.status || 'Staged') : 'Staged',
      type: normalizeResourceTypeName(initial.type),
      equipment: Array.isArray(initial.equipment) ? initial.equipment.join(', ') : (initial.equipment || ''),
      leader_responder_id: leaderId,
      responder_ids: allResponderIds.filter(id => id !== leaderId),
      vehicle_ids: initial.current_vehicles?.map(v => v.vehicle_id) || initial.vehicle_ids || [],
      responder_roles: { ...rolesFromView, ...(initial.responder_roles || {}) },
    };
  };

  const [teamForm, setTeamForm] = useState(() => getInitialState(initialData));
  const { incidentData } = useIncident();
  const { addToast } = useToast();

  const isStaffTeam = teamForm.type === 'Staff';

  useEffect(() => {
    if (isOpen) {
      const baseData = initialData || {};
      // If creating a new team (no team_id), ensure op_period_id is sourced from context.
      // This makes the modal self-sufficient for creation.
      if (!baseData.team_id && incidentData?.opPeriodId) {
        baseData.op_period_id = incidentData.opPeriodId;
      }
      setTeamForm(getInitialState(baseData));
    }
  }, [initialData, isOpen, incidentData?.opPeriodId]);

  // Only staged responders (unassigned) or responders already on this team should be available.
  // This prevents assigning a responder to multiple teams simultaneously.
  const isStagedResponder = (responder) => String(responder?.status || '').toLowerCase() === 'staged';

  const availableResponders = useMemo(() => {
    const data = initialData || {};
    const initialMemberIds = new Set([
      ...(data.responder_ids || []),
      ...(data.current_responders?.map(r => r.responder_id) || []),
      data.leader_responder_id
    ].filter(Boolean));

    return responders.filter(r => 
      isStagedResponder(r) || initialMemberIds.has(r.responder_id)
    );
  }, [responders, initialData]);

  const availableVehicles = useMemo(() => {
    const data = initialData || {};
    const initialVehicleIds = new Set([
      ...(data.vehicle_ids || []),
      ...(data.current_vehicles?.map(v => v.vehicle_id) || [])
    ].filter(Boolean));

    return (vehicles || []).filter(v => 
      (v.status && v.status.toLowerCase() === 'staged') || 
      initialVehicleIds.has(v.vehicle_id)
    );
  }, [vehicles, initialData]);

  const handleDropIntoRole = (e, role) => {
    e.preventDefault();
    e.stopPropagation();
    const responderId = e.dataTransfer.getData('responderId');
    console.log(`[TeamFormModal] handleDropIntoRole: Drag event started for responderId: ${responderId} into role: ${role}`);
    if (!responderId) return;

    let newLeaderId = teamForm.leader_responder_id;
    let newMemberIds = [...(teamForm.responder_ids || [])];
    const newRoles = { ...(teamForm.responder_roles || {}) };
    const isICRole = role === 'Incident Commander' || role === 'Team Leader';

    // For Staff teams, ensure roles are unique by clearing the role from its previous holder.
    if (teamForm.type === 'Staff') {
      Object.keys(newRoles).forEach(id => {
        if (newRoles[id] === role) newRoles[id] = '';
      });
    }

    // Handle leader assignment
    if (isICRole) {
      const oldLeaderId = newLeaderId;
      newLeaderId = responderId; // Assign new leader

      // The new leader cannot also be in the members list.
      newMemberIds = newMemberIds.filter(id => id !== newLeaderId);

      // If there was an old leader, they are now a regular member.
      if (oldLeaderId && oldLeaderId !== newLeaderId && !newMemberIds.includes(oldLeaderId)) {
        newMemberIds.push(oldLeaderId);
        newRoles[oldLeaderId] = ''; // Demote to general member
      }
    } else { // Handle assignment to a non-leader role
      // Add the responder to the members list if they aren't already.
      if (!newMemberIds.includes(responderId)) {
        newMemberIds.push(responderId);
      }
      // If the person being assigned was the leader, they are no longer.
      if (newLeaderId === responderId) {
        newLeaderId = null;
      }
    }
    newRoles[responderId] = role;

    console.log(`[TeamFormModal] handleDropIntoRole: State updated. New Leader: ${newLeaderId}, New Members:`, newMemberIds);
    setTeamForm({ ...teamForm, leader_responder_id: newLeaderId, responder_ids: newMemberIds, responder_roles: newRoles });
  };

  const handleDropOnPool = (e) => {
    e.preventDefault();
    const responderId = e.dataTransfer.getData('responderId');
    const vehicleId = e.dataTransfer.getData('vehicleId');

    if (responderId) {
      console.log(`[TeamFormModal] handleDropOnPool: Removing responder ${responderId} from team.`);
      const newRoles = { ...(teamForm.responder_roles || {}) };
      delete newRoles[responderId];

      setTeamForm({
        ...teamForm,
        leader_responder_id: responderId === teamForm.leader_responder_id ? null : teamForm.leader_responder_id,
        responder_ids: (teamForm.responder_ids || []).filter(id => id !== responderId),
        responder_roles: newRoles
      });
    } else if (vehicleId) {
      console.log(`[TeamFormModal] handleDropOnPool: Removing vehicle ${vehicleId} from team.`);
      setTeamForm({
        ...teamForm,
        vehicle_ids: (teamForm.vehicle_ids || []).filter(id => id !== vehicleId)
      });
    }
  };
  const handleDropMember = (e) => {
    e.preventDefault();
    const responderId = e.dataTransfer.getData('responderId');
    console.log(`[TeamFormModal] handleDropMember: Attempting to add responder ${responderId} as a general member.`);
    if (!responderId) return;

    const currentIds = teamForm.responder_ids || [];
    if (responderId === teamForm.leader_responder_id || currentIds.includes(responderId)) return;

    const newRoles = { ...(teamForm.responder_roles || {}) };

    // Clear role to make them a general member if dropped into the custom area
    newRoles[responderId] = '';

    console.log(`[TeamFormModal] handleDropMember: Adding responder ${responderId} to members list.`);
    setTeamForm({
      ...teamForm,
      responder_ids: [...currentIds, responderId],
      responder_roles: newRoles
    });
  };

  const handleDropVehicle = (e) => {
    e.preventDefault();
    const vehicleId = e.dataTransfer.getData('vehicleId');
    console.log(`[TeamFormModal] handleDropVehicle: Attempting to add vehicle ${vehicleId}.`);
    if (!vehicleId) return;

    const currentIds = teamForm.vehicle_ids || [];
    if (currentIds.includes(vehicleId)) return;

    setTeamForm({
      ...teamForm,
      vehicle_ids: [...currentIds, vehicleId]
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

  const handleSave = (stayOpen = false) => {
    // Enforce business rule: A responder cannot be active on multiple teams simultaneously.
    // Active status is defined as 'Attached', 'Assigned', or 'Deployed'.
    const initialMemberIds = new Set([
      ...(initialData.responder_ids || []),
      ...(initialData.current_responders?.map(r => r.responder_id) || []),
      initialData.leader_responder_id
    ].filter(Boolean));

    const checkResponderConflict = (id) => {
      if (!id || initialMemberIds.has(id)) return null;
      const r = responders.find(res => res.responder_id === id);
      // Status logic: if not 'staged' or 'checkedout', the responder is currently active on another team.
      if (r && !['staged', 'checkedout'].includes(String(r.status || '').toLowerCase())) {
        return r.name;
      }
      return null;
    };

    const conflicts = [
      checkResponderConflict(teamForm.leader_responder_id),
      ...(teamForm.responder_ids || []).map(checkResponderConflict)
    ].filter(Boolean);

    if (conflicts.length > 0) {
      const uniqueConflicts = [...new Set(conflicts)];
      addToast(`Assignment Conflict: Responders ${uniqueConflicts.join(', ')} are already active on other teams. Responders can only belong to one team at a time.`, 'error');
      return;
    }

    // Convert equipment string back to array for the API
    const equipmentArray = typeof teamForm.equipment === 'string'
      ? teamForm.equipment.split(',').map(s => s.trim()).filter(Boolean)
      : (Array.isArray(teamForm.equipment) ? teamForm.equipment : []);
    const finalResponderIds = (teamForm.responder_ids || []).filter(id => id !== teamForm.leader_responder_id);
    const payload = {
      ...teamForm,
      equipment: equipmentArray,
      vehicle_ids: teamForm.vehicle_ids
    };
    console.log('[TeamFormModal] handleSave: Final payload being sent to parent component:', payload);
    onSave(payload, stayOpen);
  };

  const leaderRole = isStaffTeam ? 'Incident Commander' : 'Team Leader';

  const customMembers = useMemo(() => (teamForm.responder_ids || []).filter(id => {
    const role = teamForm.responder_roles?.[id];
    // For staff teams, only show members who are not assigned to a predefined role.
    if (isStaffTeam && STAFF_PREDEFINED_ROLES.includes(role)) return false;
    return true;
  }), [teamForm.responder_ids, teamForm.responder_roles, isStaffTeam]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={teamForm.team_id ? 'Edit Team' : 'New Team'}
      loading={loading}
      actions={
        <>
          {!teamForm.team_id && (
            <button 
              className="btn btn-secondary" 
              onClick={() => handleSave(true)} 
              disabled={loading || !teamForm.leader_responder_id}
            >
              {loading ? 'Saving...' : 'Save & Add Another'}
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={() => handleSave(false)} 
            disabled={loading || !teamForm.leader_responder_id}
          >
            {loading ? 'Saving...' : (teamForm.team_id ? 'Save Changes' : 'Save & Exit')}
          </button>
        </>
      }
    >
        <div className="form-grid" style={{ marginBottom: '16px' }}>
          <div className="form-field">
            <label className="form-label" htmlFor="team_name">Team Name</label>
            <input 
              id="team_name"
              className="form-input"
              value={teamForm.team_name_number || ''} 
              onChange={e => setTeamForm({ ...teamForm, team_name_number: e.target.value })} 
              placeholder="Auto-generated if blank"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="team_type">Type</label>
            <select id="team_type" className="form-select" value={teamForm.type} onChange={e => {
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

          <div className="form-field">
            <label className="form-label" htmlFor="team_status">Status</label>
            <select 
              id="team_status" 
              className="form-select"
              value={teamForm.status} 
              onChange={e => setTeamForm({ ...teamForm, status: e.target.value })}
              disabled={!teamForm.team_id}
            >
              <option>Staged</option>
              <option>Assigned</option>
              <option>Deployed</option>
              <option>Disbanded</option>
            </select>
          </div>
        </div>

        <div className="form-field responders-selector" style={{ marginBottom: '16px' }}>
          <label className="form-label">Team Members (Drag & Drop Members)</label>
          <div className="drag-drop-composition" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {/* Column 1: Personnel Management (Tactical + Pool) */}
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'stretch' }}>
              {/* Top: Team Members Table */}
              <div style={{ flex: 1, maxHeight: '35vh', overflowY: 'auto' }}>
              <table className="operations-table" style={{ width: '100%', minWidth: 'auto', border: '1px solid #e2e8f0', background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: '55%', textAlign: 'left', padding: '4px 10px', fontSize: '12px' }}>Team Members</th>
                    <th style={{ width: '40%', textAlign: 'left', padding: '4px 10px', fontSize: '12px' }}>Role / Position</th>
                  </tr>
                </thead>
                <tbody>
                  {isStaffTeam ? (
                    STAFF_PREDEFINED_ROLES.map(role => {
                    let rId;
                    // Requirement: The IC is the team leader, who is stored separately from other members.
                    if (role === 'Incident Commander') {
                      rId = teamForm.leader_responder_id;
                    } else {
                      rId = (teamForm.responder_ids || []).find(id => teamForm.responder_roles?.[id] === role);
                    }
                    const r = rId ? responders.find(res => res.responder_id === rId) : null;
                    
                    return (
                      <tr 
                        key={role} 
                        onDrop={(e) => handleDropIntoRole(e, role)}
                        onDragOver={(e) => e.preventDefault()}
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                      >
                        <td style={{ padding: '4px 10px', height: '38px' }}>
                          {r ? (
                            <div 
                              className="chip team-chip"
                              draggable="true"
                              onDragStart={(e) => e.dataTransfer.setData('responderId', r.responder_id)}
                              style={{ display: 'inline-block', padding: '3px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', cursor: 'grab' }}
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
                      <td style={{ padding: '4px 10px', height: '38px' }}>
                        {teamForm.leader_responder_id ? (
                          <div 
                            className="chip team-chip"
                            draggable="true"
                            onDragStart={(e) => e.dataTransfer.setData('responderId', teamForm.leader_responder_id)}
                            style={{ display: 'inline-block', padding: '3px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', cursor: 'grab' }}
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
                            style={{ display: 'inline-block', padding: '3px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', cursor: 'grab' }}
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
                    <td style={{ padding: '4px 10px', height: '38px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }} colSpan={2}>
                      Drop chips here to add members...
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              {/* Bottom: Personnel Pool (Staged) */}
              <div 
                className="responder-pool" 
                onDrop={handleDropOnPool}
                onDragOver={(e) => e.preventDefault()} 
                style={{ flex: 0.6, maxHeight: '20vh', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1', overflowY: 'auto' }}
              >
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Staged Responders</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>                  
                  {availableResponders.filter(r => isStagedResponder(r) && r.responder_id !== teamForm.leader_responder_id && !(teamForm.responder_ids || []).includes(r.responder_id)).map(r => (
                    <div 
                      key={r.responder_id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('responderId', r.responder_id)}
                      className="chip team-chip"
                      style={{ cursor: 'grab', padding: '4px 8px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '6px', fontSize: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    >
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div style={{ opacity: 0.7, fontSize: '10px' }}>
                        {r.agency} {r.special_skills ? `| ${r.special_skills}` : ''}
                      </div> 
                    </div>
                  ))}
                  {availableResponders.filter(r => isStagedResponder(r) && r.responder_id !== teamForm.leader_responder_id && !(teamForm.responder_ids || []).includes(r.responder_id)).length === 0 && (
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>No staged personnel available.</p>
                  )}
                </div>
                <small className="form-hint" style={{ marginTop: '16px', display: 'block' }}>Drag personnel to the table.</small>
              </div>
            </div>

            {/* Column 2: Vehicle Management (Assigned + Pool) */}
            <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'stretch' }}>
              {/* Top: Team Vehicles List */}
            <div 
              className="vehicle-drop-zone"
              onDrop={handleDropVehicle}
              onDragOver={(e) => e.preventDefault()}
              style={{ flex: 1, maxHeight: '35vh', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1', overflowY: 'auto' }}
            >
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Team Vehicles</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(teamForm.vehicle_ids || []).map(id => {
                  const v = vehicles.find(veh => veh.vehicle_id === id);
                  if (!v) return null;
                  return (
                    <div 
                      key={id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('vehicleId', id)}
                      onClick={() => onEditVehicle?.(v)}
                      className="chip vehicle-chip"
                      style={{ cursor: 'grab', padding: '6px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px' }}
                    >
                      <div style={{ fontWeight: 600 }}>{v.designation}</div>
                      <div style={{ opacity: 0.7, fontSize: '10px' }}>
                        {v.type}
                      </div>
                    </div>
                  );
                })}
                {(teamForm.vehicle_ids || []).length === 0 && (
                  <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Drop staged vehicle chips here...</p>
                )}
              </div>
              </div>

              {/* Bottom: Vehicle Pool (Staged) */}
            <div 
              className="vehicle-pool" 
              onDrop={handleDropOnPool}
              onDragOver={(e) => e.preventDefault()}
              style={{ flex: 0.6, maxHeight: '20vh', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1', overflowY: 'auto' }}
            >
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Staged Vehicles</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {availableVehicles.filter(v => !(teamForm.vehicle_ids || []).includes(v.vehicle_id)).map(v => (
                  <div 
                    key={v.vehicle_id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('vehicleId', v.vehicle_id)}
                    onClick={() => onEditVehicle?.(v)}
                    className="chip vehicle-chip"
                    style={{ cursor: 'grab', padding: '4px 8px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '6px', fontSize: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                  >
                    <div style={{ fontWeight: 600 }}>{v.designation}</div>
                    <div style={{ opacity: 0.7, fontSize: '10px' }}>
                      {v.type}
                    </div> 
                  </div>
                ))}
                {availableVehicles.filter(v => !(teamForm.vehicle_ids || []).includes(v.vehicle_id)).length === 0 && (
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>No staged vehicles available.</p>
                )}
              </div>
              <small className="form-hint" style={{ marginTop: '16px', display: 'block' }}>Drag vehicles to the team vehicles list.</small>
            </div>
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
    </BaseModal>
  );
};

export default TeamFormModal;