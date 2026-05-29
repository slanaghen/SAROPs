import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import { v4 as uuidv4 } from 'uuid';
import '../styles/IncidentEditPage.css'; // Reusing form styles for consistency
import { usePlanningDashboard } from '../hooks/usePlanningDashboard'; // Import usePlanningDashboard
import { 
  OPERATIONS_REFRESH_INTERVAL,
  RESPONDER_REFRESH_INTERVAL,
  SARTOPO_REFRESH_INTERVAL
} from '../components/operationalConstants';
import AdminUserFormModal from '../components/admin/AdminUserFormModal';
import AdminResponderFormModal from '../components/admin/AdminResponderFormModal';
import AdminTeamFormModal from '../components/admin/AdminTeamFormModal';
import AdminAssignmentFormModal from '../components/admin/AdminAssignmentFormModal';
import AdminIncidentFormModal from '../components/admin/AdminIncidentFormModal';
import AdminLogin from '../components/admin/AdminLogin';
import AdminUsersTable from '../components/admin/AdminUsersTable';
import AdminRespondersTable from '../components/admin/AdminRespondersTable';
import AdminTeamsTable from '../components/admin/AdminTeamsTable';
import AdminAssignmentsTable from '../components/admin/AdminAssignmentsTable';
import AdminIncidentsTable from '../components/admin/AdminIncidentsTable';

const AdminPage = () => {
  const navigate = useNavigate();
  const { 
    isAdmin, setIsAdmin, incidentId, responderId, endIncident, logout, startIncident,
    setResponderId, setResponderName, setResponderStatus, setAccessLevel,
    setOperationsRefreshInterval: setOpsRate, setResponderRefreshInterval: setResRate, setSartopoRefreshInterval: setTopoRate
  } = useIncident();
  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [allIncidents, setAllIncidents] = useState([]);
  const [allResponders, setAllResponders] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isRespondersExpanded, setIsRespondersExpanded] = useState(true);
  const { recordAction } = usePlanningDashboard(supabase, incidentId); // Use recordAction from hook

  const [opRefresh, setOpRefresh] = useState(OPERATIONS_REFRESH_INTERVAL / 1000);
  const [resRefresh, setResRefresh] = useState(RESPONDER_REFRESH_INTERVAL / 1000);
  const [sartopoRefresh, setSartopoRefresh] = useState(SARTOPO_REFRESH_INTERVAL / 1000);
  const [appliedSettings, setAppliedSettings] = useState({
    op: OPERATIONS_REFRESH_INTERVAL / 1000,
    res: RESPONDER_REFRESH_INTERVAL / 1000,
    sartopo: SARTOPO_REFRESH_INTERVAL / 1000
  });

  const isSettingsDirty = opRefresh !== appliedSettings.op || 
                          resRefresh !== appliedSettings.res || 
                          sartopoRefresh !== appliedSettings.sartopo;
  const [isTeamsExpanded, setIsTeamsExpanded] = useState(true);
  const [isAssignmentsExpanded, setIsAssignmentsExpanded] = useState(true);
  const [isIncidentsExpanded, setIsIncidentsExpanded] = useState(true);
  const [isUsersExpanded, setIsUsersExpanded] = useState(true);

  // State for Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [editingResponder, setEditingResponder] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);

  // Authentication Gate: Redirect to dedicated login page if not authenticated
  useEffect(() => {
    if (!isAdmin && !fetching) {
      navigate('/login');
    }
  }, [isAdmin, fetching, navigate]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setFetching(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .order('email');

      if (fetchError) throw fetchError;
      console.log('All system users retrieved:', data);
      setUsers(data || []);
    } catch (err) {
      setError('Failed to load user list');
      console.error(err);
    } finally {
      setFetching(false);
    }
  }, [isAdmin]);

  const fetchAllIncidents = useCallback(async () => {
    if (!isAdmin) return;
    try {
      // Fetch incidents and join with operational periods to find the latest one
      const { data, error: fetchError } = await supabase
        .from('incidents')
        .select('*, operational_periods(op_number, start_datetime)')
        .order('start_datetime', { ascending: false });

      if (fetchError) throw fetchError;
      setAllIncidents(data || []);
    } catch (err) {
      console.error('Error fetching incident list:', err);
    }
  }, [isAdmin]);

  const fetchAllResponders = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('responders')
        .select('*')
        .order('checkin_datetime', { ascending: false });

      if (fetchError) throw fetchError;
      setAllResponders(data || []);
    } catch (err) {
      console.error('Error fetching responders list:', err);
    }
  }, [isAdmin]);

  const fetchAllTeams = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*, operational_periods(op_number, incidents(name, number))')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAllTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams list:', err);
    }
  }, [isAdmin]);

  const fetchAllAssignments = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('assignments')
        .select('*, operational_periods(op_period_id, op_number, incident_id)') // Fetch incident_id from op_periods
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAllAssignments(data || []);
    } catch (err) {
      console.error('Error fetching assignments list:', err);
    }
  }, [isAdmin]);

  const handleLogout = async () => {
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
    setError(null);
    setSuccess(null);

    try {
      // Execute the seeding logic via RPC. Ensure the seed-data-specific.sql 
      // content is defined as a function named 'seed_data_specific' in Postgres.
      const { error: seedError } = await supabase.rpc('seed_data_specific');
      if (seedError) throw seedError;

      await recordAction?.('Admin triggered specific development data seeding (15 assignments, 31 responders).');
      
      // Await all refreshes to ensure UI parity
      await Promise.all([
        fetchAllIncidents(),
        fetchAllResponders(),
        fetchAllTeams(),
        fetchAllAssignments()
      ]);
      setSuccess('Database successfully seeded with test data.');
    } catch (err) {
      let userFriendlyMessage = err.message;
      // Specifically catch the "missing function" error to provide a setup hint
      if (err.message?.includes('seed_data_specific') && err.message?.includes('schema cache')) {
        userFriendlyMessage = 'The database function "seed_data_specific" is not defined. Please run the seeding SQL script in your Supabase SQL Editor.';
      }
      setError('Failed to seed database: ' + userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * DANGER: Triggers a full database schema reset.
   * This calls the 'reinitialize_database' RPC function which should contain
   * the content of sarops-schema.sql.
   */
  const handleReinitializeDatabase = async () => {
    const confirmMsg = "DANGER: This will completely wipe the database and re-initialize the schema. ALL DATA WILL BE PERMANENTLY LOST. Continue?";
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: resetError } = await supabase.rpc('reinitialize_database');
      if (resetError) throw resetError;

      await recordAction?.('Admin triggered full database re-initialization (Schema Reset).');
      setSuccess('Database successfully re-initialized.');
      // Since data is wiped, clear the current session and redirect
      logout();
      navigate('/checkin');
    } catch (err) {
      setError('Failed to re-initialize database: ' + err.message);
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
    setSuccess('System refresh intervals updated successfully.');
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchAllIncidents();
      fetchAllResponders();
      fetchAllTeams();
      fetchAllAssignments();
    }
  }, [isAdmin, fetchUsers, fetchAllIncidents, fetchAllResponders, fetchAllTeams, fetchAllAssignments]);

  const handleSaveUser = async (formData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setShowUserModal(false); // Close modal immediately

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
        });
        if (updateError) throw updateError;
        setSuccess(`User ${formData.email} updated successfully.`);
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
        });
        if (insertError) throw insertError;
        setSuccess(`User ${formData.email} added successfully.`);
      }
      await fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to save user.');
    } finally {
      setLoading(false);
      setEditingUser(null);
    }
  };

  const handleSaveResponder = async (formData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setShowResponderModal(false);

    try {
      const payload = {
        name: formData.name,
        agency: formData.agency,
        identifier: formData.identifier,
        cell_phone: formData.cell_phone,
        special_skills: formData.special_skills,
        access_level: formData.access_level,
        responder_type: formData.responder_type,
      };

      if (formData.responder_id) {
        const { error: updateError } = await supabase
          .from('responders')
          .update(payload)
          .eq('responder_id', formData.responder_id);
        if (updateError) throw updateError;
        setSuccess(`Responder ${formData.name} updated successfully.`);
      } else {
        const { error: insertError } = await supabase
          .from('responders')
          .insert({
            ...payload,
            responder_id: uuidv4(),
            incident_id: incidentId, // Link to current active incident if available
            checkin_datetime: new Date().toISOString(),
            status: 'Staged'
          });
        if (insertError) throw insertError;
        setSuccess(`Responder ${formData.name} added to system.`);
      }
      await fetchAllResponders();
    } catch (err) {
      setError(err.message || 'Failed to save responder.');
    } finally {
      setLoading(false);
      setEditingResponder(null);
    }
  };

  const handleSaveTeam = async (formData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setShowTeamModal(false);

    try {
      const payload = {
        team_name_number: formData.team_name_number,
        sartopo_color_hex: formData.sartopo_color_hex,
        type: formData.type,
        status: formData.status,
        leader_responder_id: formData.leader_responder_id || null,
        equipment: formData.equipment,
      };

      if (formData.team_id) {
        const { error: updateError } = await supabase
          .from('teams')
          .update(payload)
          .eq('team_id', formData.team_id);
        if (updateError) throw updateError;
        setSuccess(`Team ${formData.team_name_number} updated successfully.`);
      } else {
        // Find current OP ID from context or database
        const { data: opData } = await supabase
          .from('operational_periods')
          .select('op_period_id')
          .eq('incident_id', incidentId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
          
        const { error: insertError } = await supabase.from('teams').insert({ ...payload, team_id: uuidv4(), op_period_id: opData?.op_period_id });
        if (insertError) throw insertError;
        setSuccess(`Team ${formData.team_name_number} created.`);
      }
      await fetchAllTeams();
    } catch (err) {
      setError(err.message || 'Failed to save team.');
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
        logout();
      }

      const responder = allResponders.find(r => r.responder_id === id);
      await recordAction?.(`Admin checked out responder "${responder?.name || 'Unknown'}" (ID: ${id}). Fields modified: status="CheckedOut", checkout_datetime="${now}".`);

      setSuccess('Responder checked out.');
      await fetchAllResponders();
    } catch (err) {
      setError('Failed to check out responder: ' + err.message);
    }
  };

  const handleDisbandTeam = async (id, name, type) => { // Added type
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
      
      // Await refreshes since responder status is affected by the disband trigger
      await Promise.all([
        fetchAllTeams(),
        fetchAllResponders()
      ]);
      setSuccess('Team disbanded.');
    } catch (err) {
      setError('Failed to disband team: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (id, name, type) => { // Added type
    if (!window.confirm(`Permanently delete team "${name}"? This action cannot be undone and will remove all assignment links.`)) return;

    try {
      // Release members to Staged status before deletion to ensure they aren't orphaned in an active status
      const { data: members } = await supabase.from('team_responders').select('responder_id').eq('team_id', id);
      const rIds = members?.map(m => m.responder_id) || [];
      
      if (rIds.length > 0) {
        await supabase.from('responders').update({ status: 'Staged' }).in('responder_id', rIds);
        await supabase.from('responder_team_history')
          .update({ detached_datetime: new Date().toISOString() })
          .eq('team_id', id)
          .is('detached_datetime', null);
      }

      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('team_id', id);

      if (deleteError) throw deleteError;

      await recordAction?.(`Admin deleted team "${name}" (ID: ${id}, Type: ${type}).`);
      setSuccess('Team record deleted.');
      await fetchAllTeams();
    } catch (err) {
      setError('Failed to delete team: ' + err.message);
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
      setSuccess('Assignment record deleted.');
      await fetchAllAssignments();
    } catch (err) {
      setError('Failed to delete assignment: ' + err.message);
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
      setSuccess('Responder record deleted.');
      await fetchAllResponders();
    } catch (err) {
      setError('Failed to delete responder: ' + err.message);
    }
  };

  const handleEndIncident = async (id) => {
    try {
      setLoading(true);
      setError(null);

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

      setSuccess('Incident ended and resources cleaned up.');
      
      // Refresh all management views simultaneously
      await Promise.all([
        fetchAllIncidents(),
        fetchAllResponders(),
        fetchAllTeams(),
        fetchAllAssignments()
      ]);
    } catch (err) {
      setError('Failed to end incident: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignment = async (formData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setShowAssignmentModal(false);

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
        setSuccess(`Assignment ${formData.title} updated successfully.`);
      } else {
        const { data: opData } = await supabase
          .from('operational_periods')
          .select('op_period_id')
          .eq('incident_id', incidentId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        const { error: insertError } = await supabase.from('assignments').insert({ ...payload, assignment_id: uuidv4(), op_period_id: opData?.op_period_id });
        if (insertError) throw insertError;
        setSuccess(`Assignment ${formData.title} created.`);
      }
      await fetchAllAssignments();
    } catch (err) {
      setError(err.message || 'Failed to save assignment.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIncident = async (formData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setShowIncidentModal(false);
    try {
      const payload = {
        name: formData.name,
        number: formData.number,
        sartopo_id: formData.sartopo_id || null,
        notes: formData.notes,
        start_datetime: formData.start_datetime,
      };

      if (formData.incident_id) {
        const { error: updateError } = await supabase.from('incidents').update(payload).eq('incident_id', formData.incident_id);
        if (updateError) throw updateError;
        setSuccess(`Incident ${formData.name} updated successfully.`);
      } else {
        const inc_id = formData.number || uuidv4();
        const { error: insertError } = await supabase.from('incidents').insert({ ...payload, incident_id: inc_id });
        if (insertError) throw insertError;
        // Create default OP 1
        await supabase.from('operational_periods').insert({ op_period_id: uuidv4(), incident_id: inc_id, op_number: 1, start_datetime: formData.start_datetime, situation_narrative: 'Incident started.' });
        setSuccess(`Incident ${formData.name} created successfully.`);
      }
      await fetchAllIncidents();
    } catch (err) {
      setError(err.message || 'Failed to save incident.');
    } finally {
      setLoading(false);
      setEditingIncident(null);
    }
  };

  const handleDeleteIncident = async (id, name) => { // Added name
    const message = 'Permanently delete this incident? This will remove all associated operational periods, assignments, teams, responders, and logs. This action cannot be undone.';
    if (!window.confirm(message)) return;

    try {
      setLoading(true);
      setError(null);

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

      setSuccess('Incident and all associated data deleted.');
      
      // 4. Await all refreshes to ensure UI is in sync
      await Promise.all([
        fetchAllIncidents(),
        fetchAllResponders(),
        fetchAllTeams(),
        fetchAllAssignments()
      ]);
    } catch (err) {
      setError('Failed to delete incident: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (email) => {
    const newPwd = window.prompt(`Enter new password for ${email}:`);
    if (!newPwd || !newPwd.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase.rpc('admin_update_password', {
        p_email: email,
        p_password: newPwd.trim()
      });

      if (updateError) throw updateError;
      setSuccess(`Password updated for ${email}`);
    } catch (err) {
      setError('Failed to update password: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (email) => {
    setError(null);
    setSuccess(null);

    if (users.length <= 1) {
      setError('Cannot remove the last user. At least one system user is required to maintain access.');
      return;
    }

    if (!window.confirm(`Remove ${email} from system users?`)) return;

    try {
      const { error: deleteError } = await supabase.rpc('admin_remove_user', { p_email: email });
      
      if (deleteError) throw deleteError;
      await fetchUsers();
    } catch (err) {
      setError('Failed to remove user');
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
          <button className="btn btn-primary" onClick={handleApplySettings} disabled={!isSettingsDirty} style={{ height: '38px' }}>
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
            style={{ height: '38px' }}
          >
            {loading ? 'Seeding...' : 'Seed Data'}
          </button>
          <button 
            onClick={handleReinitializeDatabase} 
            className="btn btn-secondary" 
            disabled={loading} 
            style={{ height: '38px', color: '#dc2626', borderColor: '#fecaca' }}
          >
            {loading ? 'Resetting...' : 'Re-initialize Database'}
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

      <AdminTeamsTable
        allTeams={allTeams}
        isTeamsExpanded={isTeamsExpanded}
        setIsTeamsExpanded={setIsTeamsExpanded}
        handleDisbandTeam={handleDisbandTeam}
        handleDeleteTeam={handleDeleteTeam}
        handleEditTeam={(team) => {
          setEditingTeam(team);
          setShowTeamModal(true);
        }}
        handleNewTeam={() => {
          setEditingTeam(null);
          setShowTeamModal(true);
        }}
      />

      <AdminAssignmentsTable
        allAssignments={allAssignments}
        allIncidents={allIncidents}
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
        handleEditIncident={(incident) => {
          setEditingIncident(incident);
          setShowIncidentModal(true);
        }}
        handleNewIncident={() => {
          setEditingIncident(null);
          setShowIncidentModal(true);
        }}
      />

      {/* Modals for Editing */}
      <AdminUserFormModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSave={handleSaveUser}
        initialData={editingUser}
        loading={loading}
        error={error}
        success={success}
      />

      <AdminResponderFormModal
        isOpen={showResponderModal}
        onClose={() => setShowResponderModal(false)}
        onSave={handleSaveResponder}
        initialData={editingResponder}
        loading={loading}
        error={error}
      />

      <AdminTeamFormModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        onSave={handleSaveTeam}
        initialData={editingTeam}
        loading={loading}
        error={error}
        responders={allResponders} // Pass all responders for leader selection
      />

      <AdminAssignmentFormModal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        onSave={handleSaveAssignment}
        initialData={editingAssignment}
        loading={loading}
        error={error}
      />

      <AdminIncidentFormModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
        onSave={handleSaveIncident}
        initialData={editingIncident}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default AdminPage;