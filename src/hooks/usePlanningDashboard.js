import { useState, useCallback, useMemo } from 'react';
import { useIncident } from '../context/IncidentContext';
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
  const createTeam = async (teamData) => {
    // Requirement: Enforce unique team names within the incident (across all operational periods)
    const { data: existing, error: checkError } = await supabase
      .from('teams')
      .select('team_id, operational_periods!inner(incident_id)')
      .eq('team_name_number', (teamData.team_name_number || '').trim())
      .eq('operational_periods.incident_id', incidentId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
      throw new Error(`A team named "${teamData.team_name_number}" already exists in this incident. Team names must be unique.`);
    }

    const { error: insError, data } = await supabase
      .from('teams')
      .insert({ ...teamData, op_period_id: opPeriodId, status: 'Staged' })
      .select()
      .single();
    if (insError) throw insError;

    await supabase.from('action_logs').insert({
      incident_id: incidentId,
      action: `Created team "${teamData.team_name_number}".`,
      user_name: responderName || 'Operations'
    });

    await fetchDashboardData();
    return data;
  };

  const updateTeam = async (teamId, teamData) => {
    const { error: updError } = await supabase
      .from('teams')
      .update(teamData)
      .eq('team_id', teamId);
    if (updError) throw updError;
    await fetchDashboardData();
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

    const { error: insError } = await supabase
      .from('assignments')
      .insert({ ...asnData, op_period_id: opPeriodId });

    if (insError) throw insError;

    await supabase.from('action_logs').insert({
      incident_id: incidentId,
      action: `Created assignment "${asnData.title || asnData.name}".`,
      user_name: responderName || 'Operations'
    });

    await fetchDashboardData();
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