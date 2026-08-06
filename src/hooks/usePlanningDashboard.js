import { useState, useCallback, useMemo } from 'react';
import { useIncident } from '../context/IncidentContext';
import { createTeam as createTeamService, updateTeam as updateTeamService } from '../services/teamService';
import { v4 as uuidv4 } from 'uuid';

/**
 * usePlanningDashboard Hook
 * 
 * Centralizes state management and data synchronization for the Planning Dashboard.
 * Correctly differentiates between Tactical resources (OP-specific) and 
 * Logistical resources (Incident-wide).
 */
export const usePlanningDashboard = (supabase, opPeriodId) => {
  const { incidentId, responderName } = useIncident();
  const [teams, setTeams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [responders, setResponders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [opPeriod, setOpPeriod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Normalizes assignment data to handle missing titles or null values.
   */
  const normalizeAssignment = useCallback((a) => {
    if (!a) return a;
    return {
      ...a,
      title: a.title || a.name || 'Untitled Assignment',
      segment: a.segment || ''
    };
  }, []);

  /**
   * Refreshes a specific data table.
   * Logic: Logistical resources (vehicles, responders) use incident_id.
   * Tactical resources (teams, assignments) use op_period_id.
   */
  const refresh = useCallback(async (tableName) => {
    if (!incidentId) return;

    const isLogistical = tableName === 'vehicles' || tableName === 'responders';
    if (!isLogistical && !opPeriodId) return;

    try {
      let query = supabase.from(tableName).select('*');
      
      if (isLogistical) {
        // Requirement: Vehicles and Responders are incident-wide assets.
        // We filter by incident_id to ensure the equipment pool is populated correctly.
        query = query.eq('incident_id', incidentId);
      } else {
        // Teams and Assignments are specific to the tactical operational period.
        query = query.eq('op_period_id', opPeriodId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const processedData = tableName === 'assignments' ? (data || []).map(normalizeAssignment) : (data || []);

      if (tableName === 'teams') setTeams(data || []);
      if (tableName === 'assignments') setAssignments(processedData);
      if (tableName === 'responders') setResponders(data || []);
      if (tableName === 'vehicles') setVehicles(data || []);
      
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [supabase, incidentId, opPeriodId]);

  /**
   * Aggregated data fetch for the dashboard.
   */
  const fetchDashboardData = useCallback(async () => {
    if (!opPeriodId) return;
    
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Tactical Resources (Teams & Assignments) via dashboard views
      const [teamsRes, asnsRes, opRes] = await Promise.all([
        supabase.from('team_current_responders').select('*').eq('op_period_id', opPeriodId),
        supabase.from('dashboard_assignments').select('*').eq('op_period_id', opPeriodId),
        supabase.from('operational_periods').select('*, incidents(*)').eq('op_period_id', opPeriodId).maybeSingle()
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (asnsRes.error) throw asnsRes.error;

      setTeams(teamsRes.data || []);
      setAssignments((asnsRes.data || []).map(normalizeAssignment));
      setOpPeriod(opRes.data || null);

      // 2. Fetch Logistical Pools (Responders & Vehicles)
      // These are incident-level assets and are fetched regardless of the OP.
      if (incidentId) {
        await Promise.all([
          refresh('responders'),
          refresh('vehicles')
        ]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, opPeriodId, incidentId, refresh]);

  /**
   * Link a team to an assignment.
   */
  const assignTeamToAssignment = async (teamId, assignmentId) => {
    try {
      const { error: linkError } = await supabase
        .from('assignments')
        .update({ team_id: teamId, status: 'Assigned' })
        .eq('assignment_id', assignmentId);
      
      if (linkError) throw linkError;

      await supabase.from('action_logs').insert({
        incident_id: incidentId,
        action: `Linked team to assignment.`,
        user_name: responderName || 'Operations'
      });

      await fetchDashboardData();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Update the status of an assignment or team.
   * Note: Database triggers handle the status synchronization between 
   * assignments and teams (e.g., Deployed Assignment -> Deployed Team).
   */
  const updateResourceStatus = async (assignmentId, teamId, newStatus) => {
    try {
      if (assignmentId) {
        const { error } = await supabase
          .from('assignments')
          .update({ status: newStatus })
          .eq('assignment_id', assignmentId);
        if (error) throw error;
      } else if (teamId) {
        const { error } = await supabase
          .from('teams')
          .update({ status: newStatus })
          .eq('team_id', teamId);
        if (error) throw error;
      }
      await fetchDashboardData();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const unassignTeam = async (assignmentId) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ team_id: null, status: 'Planned' })
        .eq('assignment_id', assignmentId);
      if (error) throw error;

      await supabase.from('action_logs').insert({
        incident_id: incidentId,
        action: `Unlinked team from assignment.`,
        user_name: responderName || 'Operations'
      });

      await fetchDashboardData();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Tactical Mutations
   */
  const createTeam = async (teamData, responderRoles = {}, vehicleIds = []) => {
    try {
      setError(null);
      const teamName = (teamData.team_name_number || '').trim();

      const newTeam = await createTeamService(supabase, {
        opPeriodId,
        incidentId,
        teamName,
        type: teamData.type,
        leaderId: teamData.leader_responder_id,
        equipment: teamData.equipment,
        sartopoColorHex: teamData.sartopo_color_hex,
        responderIds: teamData.responder_ids,
        responderRoles,
        vehicleIds
      });

      // Logging remains on the client-side
      const membersInfo = (teamData.responder_ids || []).map(id => {
        const responder = responders?.find(r => r.responder_id === id);
        return `${responder?.name || 'Unknown'}`;
      }).join(', ');

      const actionMessage = `Created team "${teamName}" (Type: ${teamData.type}).` +
        (membersInfo ? ` Members: ${membersInfo}.` : '');
      await supabase.from('action_logs').insert({ incident_id: incidentId, action: actionMessage, user_name: responderName || 'Operations' });

      await fetchDashboardData();
      return newTeam;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateTeam = async (teamId, teamData, responderRoles = {}, vehicleIds = []) => {
    setError(null);
    try {
      // Strip view-only metadata and reconciliation fields to prevent DB "column not found" errors
      const { current_responders, current_vehicles, responder_ids: finalIds = [], ...coreTeamData } = teamData;

      await updateTeamService(supabase, {
        teamId,
        teamData: coreTeamData,
        responderIds: finalIds,
        responderRoles,
        vehicleIds
      });

      await supabase.from('action_logs').insert({
        incident_id: incidentId,
        action: `Updated composition for team "${teamData.team_name_number}".`,
        user_name: responderName || 'Operations'
      });

      await fetchDashboardData();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteTeam = async (teamId) => {
    const { error: delError } = await supabase.from('teams').delete().eq('team_id', teamId);
    if (delError) throw delError;
    await fetchDashboardData();
  };

  const createAssignment = async (asnData) => {
    if (!opPeriodId) {
      const err = 'Cannot create assignment: No operational period selected.';
      setError(err);
      throw new Error(err);
    }

    // Call the new atomic RPC function to handle creation and name generation
    const { data: newAssignment, error } = await supabase.rpc('create_assignment_atomic', {
        p_op_period_id: opPeriodId,
        p_incident_id: incidentId,
        p_title: asnData.title || null, // Pass null to trigger auto-generation
        p_segment: asnData.segment || 'A',
        p_resource_type: asnData.resource_type,
        p_team_size: asnData.team_size,
        p_frequency_primary: asnData.frequency_primary,
        p_description: asnData.description,
        p_priority: asnData.priority,
        p_transportation: asnData.transportation,
        p_time_allocated: asnData.time_allocated,
        p_hazards: asnData.hazards,
        p_prepared_by: asnData.prepared_by
    });

    if (error) throw error;

    await supabase.from('action_logs').insert({
      incident_id: incidentId,
      action: `Created assignment "${newAssignment.title}".`,
      user_name: responderName || 'Operations'
    });

    await fetchDashboardData();
    return newAssignment;
  };

  const updateAssignment = async (asnId, asnData) => {
    const { error: updError } = await supabase
      .from('assignments')
      .update(asnData)
      .eq('assignment_id', asnId);
    if (updError) throw updError;
    await fetchDashboardData();
  };

  const deleteAssignment = async (asnId) => {
    const { error: delError } = await supabase.from('assignments').delete().eq('assignment_id', asnId);
    if (delError) throw delError;
    await fetchDashboardData();
  };

  /**
   * Logistical Mutations (Responder <-> Team)
   */
  const attachResponderToTeam = async (responderId, teamId, role = '') => {
    const { error: joinError } = await supabase
      .from('team_responders')
      .upsert({ team_id: teamId, responder_id: responderId, role }, { onConflict: 'team_id, responder_id' });
    if (joinError) throw joinError;
    await refresh('responders');
    await fetchDashboardData();
  };

  const detachResponderFromTeam = async (responderId, teamId) => {
    const { error: leaveError } = await supabase
      .from('team_responders')
      .delete()
      .eq('team_id', teamId)
      .eq('responder_id', responderId);
    if (leaveError) throw leaveError;
    await refresh('responders');
    await fetchDashboardData();
  };

  /**
   * Logistical Mutations (Vehicle <-> Team)
   */
  const attachVehicleToTeam = async (vehicleId, teamId) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ team_id: teamId })
        .eq('vehicle_id', vehicleId);
      if (error) throw error;

      await supabase.auth.refreshSession();
      await refresh('vehicles');
      await fetchDashboardData();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Filtered/Computed lists for Dashboard columns.
   * Requirement: Resolve ReferenceError by providing these filtered views of the data.
   */
  const stagedTeams = useMemo(() => 
    (teams || []).filter(t => String(t.status || '').toLowerCase() === 'staged'), [teams]);
  const availableAssignments = useMemo(() => 
    (assignments || []).filter(a => !a.team_id && !a.is_orphaned), [assignments]);
  const availableResponders = useMemo(() => 
    (responders || []).filter(r => String(r.status || '').toLowerCase() === 'staged'), [responders]);
  const availableVehicles = useMemo(() => 
    (vehicles || []).filter(v => String(v.status || '').toLowerCase() === 'staged'), [vehicles]);

  /**
   * Operational Statistics
   */
  const stats = useMemo(() => {
    return {
      teams: {
        // Requirement: Use robust status checking to handle potential casing variations from views.
        staged: teams.filter(t => String(t.status || '').toLowerCase() === 'staged').length,
        assigned: teams.filter(t => String(t.status || '').toLowerCase() === 'assigned').length,
        deployed: teams.filter(t => String(t.status || '').toLowerCase() === 'deployed').length,
        total: teams.length
      },
      assignments: {
        planned: assignments.filter(a => String(a.status || '').toLowerCase() === 'planned').length,
        assigned: assignments.filter(a => String(a.status || '').toLowerCase() === 'assigned').length,
        deployed: assignments.filter(a => String(a.status || '').toLowerCase() === 'deployed').length,
        complete: assignments.filter(a => String(a.status || '').toLowerCase() === 'completed').length,
        incomplete: assignments.filter(a => String(a.status || '').toLowerCase() === 'incomplete').length,
        total: assignments.length
      },
      responders: {
        staged: responders.filter(r => String(r.status || '').toLowerCase() === 'staged').length,
        attached: responders.filter(r => String(r.status || '').toLowerCase() === 'attached').length,
        assigned: responders.filter(r => String(r.status || '').toLowerCase() === 'assigned').length,
        deployed: responders.filter(r => String(r.status || '').toLowerCase() === 'deployed').length,
        total: responders.length
      }
    };
  }, [teams, assignments, responders]);

  return {
    teams, assignments, responders, vehicles, opPeriod, loading, error, stats,
    stagedTeams, availableAssignments, availableResponders, availableVehicles,
    refresh, fetchDashboardData, updateResourceStatus, assignTeamToAssignment, unassignTeam, attachVehicleToTeam,
    createTeam, updateTeam, deleteTeam,
    createAssignment, updateAssignment, deleteAssignment,
    attachResponderToTeam, detachResponderFromTeam,
    setError, setLoading
  };
};