import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import { v4 as uuidv4 } from 'uuid';
import '../styles/IncidentEditPage.css'; // Reusing form styles for consistency
import { useAdminData } from '../hooks/useAdminData';
import { 
  OPERATIONS_REFRESH_INTERVAL,
  RESPONDER_REFRESH_INTERVAL,
  SARTOPO_REFRESH_INTERVAL
} from '../components/operationalConstants';
import AdminUserFormModal from '../components/admin/AdminUserFormModal';
import ResponderFormModal from '../components/ResponderFormModal';
import TeamFormModal from '../components/TeamFormModal';
import AssignmentFormModal from '../components/AssignmentFormModal';
import Login from '../pages/LoginPage';
import AdminUsersTable from '../components/admin/AdminUsersTable';
import AdminRespondersTable from '../components/admin/AdminRespondersTable';
import AdminTeamsTable from '../components/admin/AdminTeamsTable';
import AdminAssignmentsTable from '../components/admin/AdminAssignmentsTable';
import AdminIncidentsTable from '../components/admin/AdminIncidentsTable';
import AdminVehiclesTable from '../components/admin/AdminVehiclesTable';
import VehicleFormModal from '../components/admin/VehicleFormModal';
import { useToast } from '../context/ToastContext';

const AdminPage = () => {
  const navigate = useNavigate();
  const { 
    isAdmin, setIsAdmin, isActive, incidentId, incidentData, responderId, responderName, responderStatus, endIncident, logout, startIncident,
    setResponderId, setResponderName, setResponderStatus, setAccessLevel,
    setOperationsRefreshInterval: setOpsRate, setResponderRefreshInterval: setResRate, setSartopoRefreshInterval: setTopoRate,
    clearIncident
  } = useIncident();

  const { 
    users, incidents: allIncidents, responders: allResponders, 
    teams: allTeams, assignments: allAssignments, vehicles: allVehicles,
    loading: fetching, refresh: fetchTable, refreshAll: refreshDashboardData
  } = useAdminData();

  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isRespondersExpanded, setIsRespondersExpanded] = useState(true);
  const [isVehiclesExpanded, setIsVehiclesExpanded] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const recordAction = useCallback(async (actionText) => {
    if (!incidentId) return;
    await supabase.from('action_logs').insert({
      incident_id: incidentId,
      action: actionText,
      user_name: responderName || 'Administration'
    });
  }, [incidentId, responderName]);

  const [opRefresh, setOpRefresh] = useState(OPERATIONS_REFRESH_INTERVAL / 1000);
  const [resRefresh, setResRefresh] = useState(RESPONDER_REFRESH_INTERVAL / 1000);
  const [sartopoRefresh, setSartopoRefresh] = useState(SARTOPO_REFRESH_INTERVAL / 1000);
  const [appliedSettings, setAppliedSettings] = useState({
    op: OPERATIONS_REFRESH_INTERVAL / 1000,
    res: RESPONDER_REFRESH_INTERVAL / 1000,
    sartopo: SARTOPO_REFRESH_INTERVAL / 1000
  });
  const [selectedActivationId, setSelectedActivationId] = useState(incidentId || '');

  const isSettingsDirty = opRefresh !== appliedSettings.op || 
                          resRefresh !== appliedSettings.res || 
                          sartopoRefresh !== appliedSettings.sartopo;

  // Sync activation dropdown with current context
  useEffect(() => {
    setSelectedActivationId(incidentId || '');
  }, [incidentId]);

  const [isTeamsExpanded, setIsTeamsExpanded] = useState(true);
  const [isAssignmentsExpanded, setIsAssignmentsExpanded] = useState(true);
  const [isIncidentsExpanded, setIsIncidentsExpanded] = useState(true);
  const [isUsersExpanded, setIsUsersExpanded] = useState(true);

  // Keep a live clock for timer displays and overdue calculations
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // State for Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [editingResponder, setEditingResponder] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  /**
   * Determines if a non-disbanded Staff team already exists for the operational period
   * being edited. This ensures only one Command Staff team exists per mission slice.
   */
  const commandStaffExists = useMemo(() => {
    const targetOpId = editingTeam?.op_period_id;
    if (targetOpId) {
      return (allTeams || []).some(t => 
        t.op_period_id === targetOpId && 
        t.type === 'Staff' && 
        t.status !== 'Disbanded' &&
        t.team_id !== editingTeam.team_id
      );
    }
    return (allTeams || []).some(t => t.type === 'Staff' && t.status !== 'Disbanded');
  }, [allTeams, editingTeam]);

  // Authentication Gate: Redirect to dedicated login page if not authenticated
  useEffect(() => {
    if (!isAdmin && !fetching) {
      navigate('/login');
    }
  }, [isAdmin, fetching, navigate]);

  const handleLogout = async () => {
    if (responderId && responderStatus !== 'CheckedOut') {
      // Synchronize logout with operational check-out
      try {
        await supabase.from('teams').update({ leader_responder_id: null }).eq('leader_responder_id', responderId);
        await supabase.from('responders')
          .update({ status: 'CheckedOut', checkout_datetime: new Date().toISOString() })
          .eq('responder_id', responderId);
      } catch (err) {
        console.error('Failed to perform operational check-out during logout:', err);
      }
    }
    await supabase.auth.signOut();
    localStorage.removeItem('sarops_user_email');
    logout(); // Use the global logout to clear everything
    navigate('/checkin');
  };

  /**
   * Triggers the database seeding logic.
   * This calls the 'seed_data_specific' RPC function which contains the logic
   * from the seed-data-specific.sql script.
   */
  const handleSeedData = async () => {
    const confirmMsg = "Run the specific database seed script? This will add 15 test assignments and 31 responders to the most recent incident. Existing data will be preserved.";
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);

    try {
      // Execute the seeding logic via RPC. Ensure the seed-data-specific.sql 
      // content is defined as a function named 'seed_data_specific' in Postgres.
      const { error: seedError } = await supabase.rpc('seed_data_specific');
      if (seedError) throw seedError;

      await recordAction?.('Admin triggered specific development data seeding (15 assignments, 31 responders).');

      await refreshDashboardData();
      addToast('Database successfully seeded with test data.', 'success');
    } catch (err) {
      let userFriendlyMessage = err.message;
      // Specifically catch the "missing function" error to provide a setup hint
      if (err.message?.includes('seed_data_specific') && err.message?.includes('schema cache')) {
        userFriendlyMessage = 'The database function "seed_data_specific" is not defined. Please run the seeding SQL script in your Supabase SQL Editor.';
      }
      addToast('Failed to seed database: ' + userFriendlyMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveIncident = async () => {
    if (responderId && responderStatus !== 'CheckedOut') {
      setLoading(true);
      try {
        // Attempt clean operational checkout in the database
        try {
          await supabase.from('teams').update({ leader_responder_id: null }).eq('leader_responder_id', responderId);
          await supabase.from('responders')
            .update({ status: 'CheckedOut', checkout_datetime: new Date().toISOString() })
            .eq('responder_id', responderId);
        } catch (dbErr) {
          console.warn('Operational check-out database update failed:', dbErr);
        }
        
        await supabase.from('action_logs').insert({
          incident_id: incidentId,
          action: `Admin left their operational session and checked out: ${responderName}`,
          user_name: responderName
        });
      } catch (err) {
        console.error('Failed to deactivate session:', err);
        addToast("Deactivation encountered an error. Context has been reset locally.", 'error');
      }
    }

    // Unconditionally clear global operational context and local UI state
    try {
      // Restore system user identity to the banner by re-syncing from profile
      const userEmail = localStorage.getItem('sarops_user_email');
      const myProfile = users.find(u => u.email?.toLowerCase() === (userEmail || '').toLowerCase());
      if (myProfile) {
        if (setResponderName) setResponderName(myProfile.name || myProfile.username);
        if (setAccessLevel) setAccessLevel(myProfile.access_level);
      }

      // Nullify incident context to trigger UI transition to activation dropdown
      if (clearIncident) clearIncident();
      if (setResponderId) setResponderId(null);
      if (setResponderStatus) setResponderStatus('CheckedOut');

      // Reset local activation selection for the dropdown
      setSelectedActivationId('');

      // Refresh Supabase session to clear operational JWT claims (incident_id)
      await supabase.auth.refreshSession();
      
      addToast("Successfully left incident. You can now select a new context.", 'success');
    } catch (localErr) {
      console.error('Failed to clear local context:', localErr);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Effectively checks the current admin user into the selected incident.
   * This establishes both the database responder record and the global
   * application context for navigation and monitoring.
   */
  const handleActivateSession = async () => {
    if (!selectedActivationId) return;

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session found. Please refresh.");

      // Fix: session.user.email is null for anonymous logins. Use localStorage fallback.
      const userEmail = session.user.email || localStorage.getItem('sarops_user_email');
      if (!userEmail) throw new Error("Could not find your system user identity. Please log in again.");

      const myProfile = users.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
      if (!myProfile) throw new Error("Could not find your system user profile in the active users list.");

      const selectedInc = allIncidents.find(i => i.incident_id === selectedActivationId);
      if (!selectedInc) throw new Error("Selected incident not found.");

      // Since useAdminData now pre-sorts nested resources, we can simply take the first record
      let latestOp = selectedInc.operational_periods?.[0];

      if (!latestOp) {
        console.debug('[Admin] Operational period missing in local state. Checking database...');
        const { data: existingOp } = await supabase
          .from('operational_periods')
          .select('*')
          .eq('incident_id', selectedActivationId)
          .order('op_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (existingOp) {
          latestOp = existingOp;
        } else {
          console.info('[Admin] No operational periods found for incident. Creating default OP 1...');
          const { data: newOp, error: createError } = await supabase
            .from('operational_periods')
            .insert({
              incident_id: selectedActivationId,
              op_number: 1,
              start_datetime: selectedInc.start_datetime || new Date().toISOString(),
              situation_narrative: 'Initial operational period created via session activation.'
            })
            .select()
            .single();
          if (createError) throw new Error(`Could not initialize operational period: ${createError.message}`);
          latestOp = newOp;
        }
      }

      // Perform the secure check-in to establish operational identity
      const { data: responderRecord, error: checkinError } = await supabase
        .rpc('checkin_responder_securely', {
          p_incident_id: selectedActivationId,
          p_auth_uid: session.user.id,
          p_name: myProfile.name || myProfile.username,
          p_agency: myProfile.agency || 'Unknown',
          p_identifier: myProfile.identifier || myProfile.username,
          p_cell_phone: myProfile.cell_phone,
          p_responder_type: myProfile.responder_type || 'SAR',
          p_special_skills: myProfile.special_skills,
          p_access_level: myProfile.access_level,
          p_status: 'Staged',
          p_device_id: `admin_${myProfile.email}_${selectedActivationId}`
        })
        .maybeSingle();

      if (checkinError) throw checkinError;

      const finalResponder = Array.isArray(responderRecord) ? responderRecord[0] : responderRecord;
      if (finalResponder) {
        setResponderId(finalResponder.responder_id);
        setResponderName(finalResponder.name);
        setResponderStatus(finalResponder.status);
        if (setAccessLevel) setAccessLevel(finalResponder.access_level);
      }

      // Refresh Supabase session to apply new JWT claims (access_level and incident_id)
      // and ensure RLS policies work immediately without waiting for auto-renewal.
      await supabase.auth.refreshSession();

      // Log administrative check-in
      await supabase.from('action_logs').insert({
        incident_id: selectedActivationId,
        action: `Admin activated session and checked in as Staff: ${finalResponder.name || myProfile.name || myProfile.username}`,
        user_name: finalResponder.name || myProfile.name || myProfile.username
      });

      // Hydrate incident context and establish operational "Active" state
      // This triggers the appearance of Operations/Planning links in the banner menu
      startIncident(
        selectedActivationId,
        selectedInc.name,
        latestOp.op_number,
        latestOp.op_period_id,
        selectedInc.sartopo_id,
        latestOp.par_check_interval
      );

      setIsAdmin(true);
      
      // Refresh local data so the Incidents table immediately reflects the highlighted active session
      if (refreshDashboardData) await refreshDashboardData();

      addToast(`Session activated for "${selectedInc.name}". Your responder identity has been established.`, 'success');
      // Requirement: Command Staff/Admin users should be directed to the Operations dashboard 
      // immediately upon establishing incident context, rather than the responder dashboard.
      navigate('/operations');
    } catch (err) {
      addToast(err.message || "Failed to activate session.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySettings = () => {
    setOpsRate(opRefresh * 1000);
    setResRate(resRefresh * 1000);
    setTopoRate(sartopoRefresh * 1000);
    setAppliedSettings({
      op: opRefresh,
      res: resRefresh,
      sartopo: sartopoRefresh
    });
    addToast('System refresh intervals updated successfully.', 'success');
  };

  useEffect(() => {
    if (isAdmin) {
      refreshDashboardData();
      // Ensure vehicles are specifically fetched to resolve the reported 
      // timing issue where they appear missing on initial page load.
      fetchTable('vehicles');
    }
  }, [isAdmin, incidentId, refreshDashboardData, fetchTable]);

  const handleSaveUser = async (formData, stayOpen = false) => {
    setLoading(true);

    try {
      if (formData.email && editingUser) { // Editing existing user
        const { error: updateError } = await supabase.rpc('admin_add_user', {
          p_email: formData.email,
          p_username: formData.username,
          p_password: formData.password || null, // Only update if provided
          p_access_level: formData.access_level,
          p_name: formData.name,
          p_agency: formData.agency,
          p_identifier: formData.identifier,
          p_phone: formData.cell_phone,
          p_type: formData.responder_type,
          p_skills: formData.special_skills,
          p_display_density: formData.display_density,
        });
        if (updateError) throw updateError;
        addToast(`User ${formData.email} updated successfully.`, 'success');
      } else { // Adding new user
        const { error: insertError } = await supabase.rpc('admin_add_user', {
          p_email: formData.email,
          p_username: formData.email, // For new users, username defaults to email as there's no separate input
          p_password: formData.password,
          p_access_level: formData.access_level,
          p_name: formData.name,
          p_agency: formData.agency,
          p_identifier: formData.identifier,
          p_phone: formData.cell_phone,
          p_type: formData.responder_type,
          p_skills: formData.special_skills,
          p_display_density: formData.display_density,
        });
        if (insertError) throw insertError;
        addToast(`User ${formData.email} added successfully.`, 'success');
      }
      await fetchTable('users');

      if (stayOpen) {
        setEditingUser(null);
        setShowUserModal(true);
      } else {
        setShowUserModal(false);
        setEditingUser(null);
      }
    } catch (err) {
      addToast(err.message || 'Failed to save user.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResponder = async (formData, stayOpen = false) => {
    setLoading(true);

    try {
      const targetIncidentId = formData.incident_id || incidentId;
      if (!targetIncidentId) {
        throw new Error("No active incident context. Please join an incident before adding responders.");
      }

      // Requirement: Use the secure check-in RPC to handle vehicle parsing and status rules automatically
      const { data: responderData, error: rpcError } = await supabase.rpc('checkin_responder_securely', {
        p_incident_id: targetIncidentId,
        p_auth_uid: formData.auth_uid || null,
        p_name: formData.name,
        p_agency: formData.agency,
        p_identifier: formData.identifier,
        p_cell_phone: formData.cell_phone,
        p_responder_type: formData.responder_type || 'SAR',
        p_special_skills: formData.special_skills,
        p_vehicles: formData.vehicles,
        p_access_level: formData.access_level,
        p_status: formData.responder_id ? (formData.status || 'Staged') : 'Staged',
        p_device_id: formData.device_id || `admin_created_${uuidv4()}`
      });

      if (rpcError) throw rpcError;
      
      addToast(`Responder ${formData.name} saved successfully.`, 'success');
      await refreshDashboardData();

      if (stayOpen) {
        setEditingResponder(null);
        setShowResponderModal(true);
      } else {
        setShowResponderModal(false);
        setEditingResponder(null);
      }
    } catch (err) {
      addToast(err.message || 'Failed to save responder.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVehicle = async (formData, stayOpen = false) => {
    setLoading(true);
    try {
      const payload = {
        designation: formData.designation,
        type: formData.type,
        status: formData.status,
        incident_id: formData.incident_id || incidentId
      };

      if (formData.vehicle_id) {
        const { error: updateError } = await supabase.from('vehicles').update(payload).eq('vehicle_id', formData.vehicle_id);
        if (updateError) throw updateError;
        addToast(`Vehicle ${formData.designation} updated.`, 'success');
      } else {
        if (!incidentId && !formData.incident_id) throw new Error("Select an incident context.");
        // Use upsert to handle cases where the designation already exists for this incident
        const { error: insertError } = await supabase
          .from('vehicles')
          .upsert({ ...payload, checkin_datetime: new Date().toISOString() }, { onConflict: 'incident_id, designation' });
        if (insertError) throw insertError;
        addToast(`Vehicle ${formData.designation} checked in.`, 'success');
      }
      await fetchTable('vehicles');
      if (stayOpen) {
        setEditingVehicle(null);
        setShowVehicleModal(true);
      } else {
        setShowVehicleModal(false);
        setEditingVehicle(null);
      }
    } catch (err) {
      addToast(err.message || 'Failed to save vehicle.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEditTeamForm = async (team) => {
    if (!team) return;
    setLoading(true);
    try {
      // Requirement: Fetch current membership, roles, and vehicle attachments for reconciliation
      const [membersRes, vehiclesRes] = await Promise.all([
        supabase
          .from('team_responders')
          .select('responder_id, role')
          .eq('team_id', team.team_id),
        supabase
          .from('vehicles')
          .select('vehicle_id')
          .eq('team_id', team.team_id)
      ]);

      const members = membersRes.data || [];
      const currentVehicles = vehiclesRes.data || [];
      
      setEditingTeam({
        ...team,
        current_responders: members,
        responder_ids: members.map(m => m.responder_id),
        current_vehicles: currentVehicles,
        vehicle_ids: currentVehicles.map(v => v.vehicle_id)
      });
      setShowTeamModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTeam = async (formData, stayOpen = false) => {
    setLoading(true);

    try {
      const teamId = formData.team_id;
      const payload = {
        team_name_number: formData.team_name_number || `Team ${Date.now()}`,
        sartopo_color_hex: formData.sartopo_color_hex || '#FF0000',
        type: formData.type || 'Other',
        status: formData.status || 'Staged',
        leader_responder_id: formData.leader_responder_id || null,
        equipment: formData.equipment || [],
      };

      if (teamId) {
        // 1. Update core team metadata
        const { error: updateError } = await supabase
          .from('teams')
          .update(payload)
          .eq('team_id', teamId);
        if (updateError) throw updateError;

        // 2. Reconcile responder attachments (Add/Remove/Update roles)
        // Requirement: Ensure the leader is always included in the membership set to prevent accidental removal.
        const currentResponders = formData.responder_ids || [];
        const finalIds = (formData.leader_responder_id && !currentResponders.includes(formData.leader_responder_id))
          ? [...currentResponders, formData.leader_responder_id]
          : currentResponders;

        const roles = formData.responder_roles || {};
        const originalIds = editingTeam?.current_responders?.map(r => r.responder_id) || [];
        
        const toAdd = finalIds.filter(id => !originalIds.includes(id));
        const toRemove = originalIds.filter(id => !finalIds.includes(id));
        const existing = finalIds.filter(id => originalIds.includes(id));

        await Promise.all([
          ...toAdd.map(id => supabase.from('team_responders').insert({ team_id: teamId, responder_id: id, role: roles[id] || '' })),
          ...existing.map(id => supabase.from('team_responders').update({ role: roles[id] || '' }).eq('team_id', teamId).eq('responder_id', id)),
          ...toRemove.map(id => supabase.from('team_responders').delete().eq('team_id', teamId).eq('responder_id', id))
        ]);

        // 3. Reconcile vehicles
        const finalVehIds = formData.vehicle_ids || [];
        const originalVehIds = editingTeam?.current_vehicles?.map(v => v.vehicle_id) || [];
        
        const vehToAdd = finalVehIds.filter(id => !originalVehIds.includes(id));
        const vehToRemove = originalVehIds.filter(id => !finalVehIds.includes(id));

        await Promise.all([
          ...vehToAdd.map(id => supabase.from('vehicles').update({ team_id: teamId }).eq('vehicle_id', id)),
          ...vehToRemove.map(id => supabase.from('vehicles').update({ team_id: null }).eq('vehicle_id', id))
        ]);

        addToast(`Team ${formData.team_name_number} updated.`, 'success');
      } else {
        // Adding new team to the current active incident context
        if (!incidentId) throw new Error("Please join an incident context before creating a team.");

        const { data: opData } = await supabase
          .from('operational_periods')
          .select('op_period_id')
          .eq('incident_id', incidentId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (!opData?.op_period_id) throw new Error("No active operational period found for the selected incident.");
          
        const newTeamId = uuidv4();
        const { error: insertError } = await supabase.from('teams').insert({ 
          ...payload, 
          team_id: newTeamId, 
          op_period_id: opData.op_period_id 
        });

        if (insertError) throw insertError;

        // Process initial membership assignments
        const finalIds = formData.responder_ids || [];
        const roles = formData.responder_roles || {};
        if (finalIds.length > 0) {
           await Promise.all(finalIds.map(id => 
             supabase.from('team_responders').insert({ 
               team_id: newTeamId, 
               responder_id: id, 
               role: roles[id] || '' 
             })
           ));
        }

        // Process initial vehicle assignments
        const finalVehIds = formData.vehicle_ids || [];
        if (finalVehIds.length > 0) {
          await supabase.from('vehicles').update({ team_id: newTeamId }).in('vehicle_id', finalVehIds);
        }

        addToast(`Team ${formData.team_name_number} created.`, 'success');
      }
      await refreshDashboardData();

      if (stayOpen) {
        setEditingTeam(null);
        setShowTeamModal(true);
      } else {
        setShowTeamModal(false);
        setEditingTeam(null);
      }
    } catch (err) {
      addToast(err.message || 'Failed to save team.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOutResponder = async (id) => {
    if (!window.confirm('Mark this responder as checked out?')) return;

    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('responders')
        .update({ 
          status: 'CheckedOut',
          checkout_datetime: now
        })
        .eq('responder_id', id);

      if (updateError) throw updateError;

      // Update context if we checked out our own current responder session
      if (id === responderId) {
        await supabase.auth.signOut();
        localStorage.removeItem('sarops_user_email');
        logout();
      }

      const responder = allResponders.find(r => r.responder_id === id);
      await recordAction?.(`Admin checked out responder "${responder?.name || 'Unknown'}" (ID: ${id}). Fields modified: status="CheckedOut", checkout_datetime="${now}".`);

      addToast('Responder checked out.', 'success');
      await fetchTable('responders');
    } catch (err) {
      addToast('Failed to check out responder: ' + err.message, 'error');
    }
  };

  const handleDisbandTeam = async (id, name, type) => { // Added type
    const team = allTeams.find(t => t.team_id === id);
    if (team?.status === 'Deployed') {
      alert(`Cannot disband team "${name}" while it is Deployed.`);
      return;
    }

    if (!window.confirm(`Disband team "${name}"? Members will be released back to staging.`)) return;

    try {
      setLoading(true);
      // Update team status - Redundant responder status updates removed.
      // The database trigger 'sync_team_status_on_team_update' automatically 
      // handles releasing responders to "Staged" and closing history logs.
      const { error: updateError } = await supabase
        .from('teams')
        .update({ 
          status: 'Disbanded',
          last_par_check: null // Clear PAR check when disbanded
        })
        .eq('team_id', id);

      if (updateError) throw updateError;

      await recordAction?.(`Admin disbanded team "${name}" (ID: ${id}, Type: ${type}). Fields modified: status="Disbanded", last_par_check=null. Automated trigger: All members released to "Staged".`);
      
      await refreshDashboardData();
      addToast('Team disbanded.', 'success');
    } catch (err) {
      addToast('Failed to disband team: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (id, name, type) => { // Added type
    if (!window.confirm(`Permanently delete team "${name}"? This action cannot be undone and will remove all assignment links.`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('team_id', id);

      if (deleteError) throw deleteError;

      await recordAction?.(`Admin deleted team "${name}" (ID: ${id}, Type: ${type}).`);
      addToast('Team record deleted.', 'success');
      await fetchTable('teams');
    } catch (err) {
      addToast('Failed to delete team: ' + err.message, 'error');
    }
  };

  const handleDeleteAssignment = async (id, name, type) => { // Added type
    if (!window.confirm(`Permanently delete assignment "${name}"? This action cannot be undone.`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('assignment_id', id);

      if (deleteError) throw deleteError;

      await recordAction?.(`Admin deleted assignment "${name}" (ID: ${id}, Type: ${type}).`);
      addToast('Assignment record deleted.', 'success');
      await fetchTable('assignments');
    } catch (err) {
      addToast('Failed to delete assignment: ' + err.message, 'error');
    }
  };

  const handleDeleteResponder = async (id, name, agency) => { // Added agency
    if (!window.confirm(`Permanently delete responder "${name}"? This action cannot be undone.`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('responders')
        .delete()
        .eq('responder_id', id);

      if (deleteError) throw deleteError;

      // Update context if we deleted our own current responder session
      if (id === responderId) {
        logout();
      }

      await recordAction?.(`Admin deleted responder "${name}" (ID: ${id}, Agency: ${agency}).`);
      addToast('Responder record deleted.', 'success');
      await fetchTable('responders');
    } catch (err) {
      addToast('Failed to delete responder: ' + err.message, 'error');
    }
  };

  const handleCheckOutVehicle = async (id) => {
    if (!window.confirm('Mark this vehicle as checked out?')) return;
    try {
      setLoading(true);
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({ status: 'CheckedOut', checkout_datetime: now })
        .eq('vehicle_id', id);

      if (updateError) throw updateError;
      const vehicle = allVehicles.find(v => v.vehicle_id === id);
      await recordAction?.(`Admin checked out vehicle "${vehicle?.designation || 'Unknown'}" (ID: ${id}).`);
      addToast('Vehicle checked out.', 'success');
      await fetchTable('vehicles');
    } catch (err) {
      addToast('Failed to check out vehicle: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (id, designation) => {
    if (!window.confirm(`Permanently delete vehicle "${designation}"?`)) return;
    try {
      const { error: deleteError } = await supabase.from('vehicles').delete().eq('vehicle_id', id);
      if (deleteError) throw deleteError;
      await recordAction?.(`Admin deleted vehicle "${designation}" (ID: ${id}).`);
      addToast('Vehicle record deleted.', 'success');
      await fetchTable('vehicles');
    } catch (err) {
      addToast('Failed to delete vehicle: ' + err.message, 'error');
    }
  };

  const handleEndIncident = async (id) => {
    try {
      setLoading(true);

      // 1. Get the latest operational period for this incident to clean up its resources
      const { data: opData } = await supabase
        .from('operational_periods')
        .select('op_period_id')
        .eq('incident_id', id)
        .is('end_datetime', null)
        .order('start_datetime', { ascending: false })
        .maybeSingle();

      const opId = opData?.op_period_id;

      // 2. Fetch counts for confirmation message
      const [asnRes, resRes] = await Promise.all([
        opId ? supabase.from('assignments')
          .select('assignment_id, status')
          .eq('op_period_id', opId)
          .in('status', ['Assigned', 'Deployed']) : Promise.resolve({ data: [] }),
        supabase.from('responders')
          .select('responder_id')
          .eq('incident_id', id)
          .is('checkout_datetime', null)
      ]);

      const activeAssignments = asnRes.data || [];
      const activeResponders = resRes.data || [];
      const deployedCount = activeAssignments.filter(a => a.status === 'Deployed').length;
      const assignedCount = activeAssignments.filter(a => a.status === 'Assigned').length;

      const confirmMsg = `Ending this incident will perform the following actions automatically:\n\n` +
        `- Mark ${deployedCount} Deployed assignments as Incomplete\n` +
        `- Mark ${assignedCount} Assigned assignments as Planned\n` +
        `- Disband all teams in the current operational period\n` +
        `- Check out all ${activeResponders.length} active responders\n` +
        `- Close the operational period and incident tracking\n\n` +
        `Continue?`;
      
      if (!window.confirm(confirmMsg)) {
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();

      // Update the incident record. 
      // The database trigger 'trigger_incident_cleanup_on_end' handles the cleanup of
      // operational periods, assignments, teams, and responders automatically.
      const { error: updateError } = await supabase
        .from('incidents')
        .update({ end_datetime: now })
        .eq('incident_id', id);
      
      await recordAction?.(`Admin ended incident (ID: ${id}). Triggered automated cleanup of assignments, teams, and responders.`);

      if (updateError) throw updateError;

      // Update context if we ended the current active incident session
      if (id === incidentId) {
        endIncident();
      }

      addToast('Incident ended and resources cleaned up.', 'success');
      
      await refreshDashboardData();
    } catch (err) {
      addToast('Failed to end incident: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignment = async (formData, stayOpen = false) => {
    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        status: formData.status,
        segment: formData.segment,
        resource_type: formData.resource_type,
        team_size: formData.team_size ? parseInt(formData.team_size, 10) : null,
        frequency_primary: formData.frequency_primary,
        description: formData.description,
        debrief_narrative: formData.debrief_narrative,
        probability_of_detection: formData.probability_of_detection ? parseInt(formData.probability_of_detection, 10) : null,
        priority: formData.priority,
        transportation: formData.transportation,
        time_allocated: formData.time_allocated,
        hazards: formData.hazards,
        prepared_by: formData.prepared_by,
      };

      if (formData.assignment_id) {
        const { error: updateError } = await supabase
          .from('assignments')
          .update(payload)
          .eq('assignment_id', formData.assignment_id);
        if (updateError) throw updateError;
        addToast(`Assignment ${formData.title} updated successfully.`, 'success');
      } else {
        const { data: opData } = await supabase
          .from('operational_periods')
          .select('op_period_id')
          .eq('incident_id', incidentId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        const { error: insertError } = await supabase.from('assignments').insert({ ...payload, assignment_id: uuidv4(), op_period_id: opData?.op_period_id });
        if (insertError) throw insertError;
        addToast(`Assignment ${formData.title} created.`, 'success');
      }
      await refreshDashboardData();

      if (stayOpen) {
        setEditingAssignment(null);
        setShowAssignmentModal(true);
      } else {
        setShowAssignmentModal(false);
        setEditingAssignment(null);
      }
    } catch (err) {
      addToast(err.message || 'Failed to save assignment.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIncident = async (id, name) => { // Added name
    const message = 'Permanently delete this incident? This will remove all associated operational periods, assignments, teams, responders, and logs. This action cannot be undone.';
    if (!window.confirm(message)) return;

    try {
      setLoading(true);

      // Delete the incident record.
      // This will automatically cascade through operational_periods, teams, 
      // assignments, action_logs, and clues due to PostgreSQL foreign key constraints.
      const { error: deleteError } = await supabase
        .from('incidents')
        .delete()
        .eq('incident_id', id);

      if (deleteError) throw deleteError;

      await recordAction?.(`Admin deleted incident "${name}" (ID: ${id}).`);
      // 3. Update context if we deleted the current active session
      if (id === incidentId) {
        logout();
      }

      addToast('Incident and all associated data deleted.', 'success');
      
      await refreshDashboardData();
    } catch (err) {
      addToast('Failed to delete incident: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (email) => {
    const newPwd = window.prompt(`Enter new password for ${email}:`);
    if (!newPwd || !newPwd.trim()) return;

    setLoading(true);

    try {
      const { error: updateError } = await supabase.rpc('admin_update_password', {
        p_email: email,
        p_password: newPwd.trim()
      });

      if (updateError) throw updateError;
      addToast(`Password updated for ${email}`, 'success');
    } catch (err) {
      addToast('Failed to update password: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (email) => {
    if (users.length <= 1) {
      addToast('Cannot remove the last user. At least one system user is required to maintain access.', 'error');
      return;
    }

    if (!window.confirm(`Remove ${email} from system users?`)) return;

    try {
      const { error: deleteError } = await supabase.rpc('admin_remove_user', { p_email: email });
      
      if (deleteError) throw deleteError;
      addToast(`User ${email} removed successfully.`, 'success');
      await fetchTable('users');
    } catch (err) {
      addToast('Failed to remove user: ' + err.message, 'error');
    }
  };

  const handleOpenUserModal = (user = null) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  if (!isAdmin) return null;

  return (
    <div className="incident-edit-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>System Administration</h1>
          <p className="subtitle">Manage users with administrative access to SAROps.</p>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary">
          Sign Out Admin
        </button>
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <h2>Incident Activation</h2>
        {isActive ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#0369a1' }}>Current Active Session: {incidentData?.name || 'In Progress'}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#0c4a6e' }}>
                The top banner now reflects this incident. Use the menu to navigate to Operations, Planning, or Dashboards.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/operations')}>Go to Operations</button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/planning')}>Go to Planning</button>
              <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={handleLeaveIncident}>Leave Incident</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <p className="subtitle" style={{ fontSize: '13px', margin: '0 0 4px' }}>
                Select an active incident to check in as a responder and establish session context.
              </p>
              {allIncidents.filter(inc => !inc.end_datetime).length === 0 && !fetching && (
                <p style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, margin: 0 }}>
                  ⚠️ No active incidents found. Use the "New Incident" button in the management table below to start one.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
                Select Incident
                <select 
                  value={selectedActivationId} 
                  onChange={(e) => setSelectedActivationId(e.target.value)}
                >
                  <option value="">— Select an active incident —</option>
                  {allIncidents.filter(inc => !inc.end_datetime).map(inc => (
                    <option key={inc.incident_id} value={inc.incident_id}>
                      {inc.name} (#{inc.number})
                    </option>
                  ))}
                </select>
              </label>
              <button 
                className="btn btn-primary" 
                onClick={handleActivateSession} 
                disabled={loading || fetching || !selectedActivationId}
              >
                {loading ? 'Joining...' : (fetching ? 'Loading Data...' : 'Check in to Incident')}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <h2>System Settings</h2>
        <p className="subtitle" style={{ fontSize: '13px', margin: '0 0 16px' }}>Configure global refresh and polling intervals (in seconds).</p>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
            Operations Refresh
            <input 
              type="number" 
              value={opRefresh} 
              onChange={(e) => setOpRefresh(parseInt(e.target.value, 10) || 0)}
              min="5"
            />
          </label>
          <label style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
            Responder Refresh
            <input 
              type="number" 
              value={resRefresh} 
              onChange={(e) => setResRefresh(parseInt(e.target.value, 10) || 0)}
              min="5"
            />
          </label>
          <label style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
            SARTopo Refresh
            <input 
              type="number" 
              value={sartopoRefresh} 
              onChange={(e) => setSartopoRefresh(parseInt(e.target.value, 10) || 0)}
              min="5"
            />
          </label>
          <button className="btn btn-primary" onClick={handleApplySettings} disabled={!isSettingsDirty}>
            Apply
          </button>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <h2>Data Management</h2>
        <p className="subtitle" style={{ fontSize: '13px', margin: '0 0 16px' }}>Manage incident records, perform cascading deletions, and initialize test data.</p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <button 
            onClick={handleSeedData} 
            className="btn btn-secondary" 
            disabled={loading} 
          >
            {loading ? 'Seeding...' : 'Seed Data'}
          </button>
        </div>
      </div>

      <AdminUsersTable
        users={users}
        fetching={fetching}
        isUsersExpanded={isUsersExpanded}
        setIsUsersExpanded={setIsUsersExpanded}
        handleChangePassword={handleChangePassword}
        handleRemoveAdmin={handleRemoveAdmin}
        handleEditUser={(user) => handleOpenUserModal(user)}
        handleNewUser={() => handleOpenUserModal(null)}
      />

      <AdminRespondersTable
        allResponders={allResponders}
        allIncidents={allIncidents}
        allTeams={allTeams}
        isRespondersExpanded={isRespondersExpanded}
        setIsRespondersExpanded={setIsRespondersExpanded}
        handleCheckOutResponder={handleCheckOutResponder}
        handleDeleteResponder={handleDeleteResponder}
        handleEditResponder={(responder) => {
          setEditingResponder(responder);
          setShowResponderModal(true);
        }}
        handleNewResponder={() => {
          setEditingResponder(null);
          setShowResponderModal(true);
        }}
      />

      <AdminVehiclesTable
        allVehicles={allVehicles}
        allIncidents={allIncidents}
        allTeams={allTeams}
        fetching={fetching}
        isVehiclesExpanded={isVehiclesExpanded}
        setIsVehiclesExpanded={setIsVehiclesExpanded}
        handleCheckOutVehicle={handleCheckOutVehicle}
        handleDeleteVehicle={handleDeleteVehicle}
        handleEditVehicle={(v) => { setEditingVehicle(v); setShowVehicleModal(true); }}
        handleNewVehicle={() => { setEditingVehicle(null); setShowVehicleModal(true); }}
      />

      <AdminTeamsTable
        allTeams={allTeams}
        allIncidents={allIncidents}
        allAssignments={allAssignments}
        currentTime={currentTime}
        isTeamsExpanded={isTeamsExpanded}
        setIsTeamsExpanded={setIsTeamsExpanded}
        handleDisbandTeam={handleDisbandTeam}
        handleDeleteTeam={handleDeleteTeam}
        handleEditTeam={openEditTeamForm}
        handleNewTeam={() => {
          setEditingTeam(null);
          setShowTeamModal(true);
        }}
      />

      <AdminAssignmentsTable
        allAssignments={allAssignments}
        allIncidents={allIncidents}
        allTeams={allTeams}
        isAssignmentsExpanded={isAssignmentsExpanded}
        setIsAssignmentsExpanded={setIsAssignmentsExpanded}
        handleDeleteAssignment={handleDeleteAssignment}
        handleEditAssignment={(assignment) => {
          setEditingAssignment(assignment);
          setShowAssignmentModal(true);
        }}
        handleNewAssignment={() => {
          setEditingAssignment(null);
          setShowAssignmentModal(true);
        }}
      />

      <AdminIncidentsTable
        allIncidents={allIncidents}
        isIncidentsExpanded={isIncidentsExpanded}
        setIsIncidentsExpanded={setIsIncidentsExpanded}
        handleEndIncident={handleEndIncident}
        handleDeleteIncident={handleDeleteIncident}
        handleEditIncident={(inc) => navigate('/incident', { state: { targetIncident: inc, fromAdmin: true } })}
        handleNewIncident={() => navigate('/incident', { state: { fromAdmin: true } })}
        currentIncidentId={incidentId}
      />

      <AdminUserFormModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSave={handleSaveUser}
        initialData={editingUser}
        loading={loading}
      />

      <ResponderFormModal
        isOpen={showResponderModal}
        onClose={() => setShowResponderModal(false)}
        onSave={handleSaveResponder}
        onCheckOut={(data) => handleCheckOutResponder(data.responder_id)}
        initialData={editingResponder || {}}
        loading={loading}
        isAdminMode={true}
      />

      <VehicleFormModal
        isOpen={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
        onSave={handleSaveVehicle}
        initialData={editingVehicle}
        responders={allResponders}
        loading={loading}
      />

      <TeamFormModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        onSave={handleSaveTeam}
        initialData={editingTeam || {}}
        loading={loading}
        responders={allResponders}
        vehicles={allVehicles}
        commandStaffExists={commandStaffExists}
        onEditVehicle={(v) => { setEditingVehicle(v); setShowVehicleModal(true); }}
      />

      <AssignmentFormModal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        onSave={handleSaveAssignment}
        initialData={editingAssignment || {}}
        loading={loading}
      />

    </div>
  );
};

export default AdminPage;