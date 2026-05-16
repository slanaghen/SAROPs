import { useState, useCallback } from 'react';
import { assignResponderToTeam, removeResponderFromTeam } from '../services/responderService';

/**
 * usePlanningDashboard Hook
 * 
 * Manages state and operations for the Planning Dashboard component.
 * Handles:
 * - Fetching staged teams and available assignments for an operational period
 * - Updating assignment-to-team mappings
 * - Error handling and loading states
 */
export const usePlanningDashboard = (supabaseClient, operationalPeriodId) => {
  const [teams, setTeams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch all data needed for the Planning Dashboard
   */
  const fetchDashboardData = useCallback(async () => {
    if (!operationalPeriodId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch teams for the operational period
      const { data: teamsData, error: teamsError } = await supabaseClient
        .from('teams')
        .select('*')
        .eq('op_period_id', operationalPeriodId);

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

      // Fetch assignments for the operational period
      const { data: assignmentsData, error: assignmentsError } = await supabaseClient
        .from('assignments')
        .select('*')
        .eq('op_period_id', operationalPeriodId);

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch responders (for team leaders, etc.)
      const { data: respondersData, error: respondersError } = await supabaseClient
        .from('responders')
        .select('*');

      if (respondersError) throw respondersError;
      setResponders(respondersData || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [operationalPeriodId, supabaseClient]);

  /**
   * Assign a team to an assignment
   * Updates the assignment's team_id
   */
  const assignTeamToAssignment = useCallback(async (teamId, assignmentId) => {
    if (!teamId || !assignmentId) {
      throw new Error('Team ID and Assignment ID are required');
    }

    try {
      const { error: updateError } = await supabaseClient
        .from('assignments')
        .update({ 
          team_id: teamId,
          status: 'Assigned'  // Update status to Assigned
        })
        .eq('assignment_id', assignmentId);

      if (updateError) throw updateError;

      // Update local state
      setAssignments(prev =>
        prev.map(a =>
          a.assignment_id === assignmentId
            ? { ...a, team_id: teamId, status: 'Assigned' }
            : a
        )
      );

      // Update team status to "Assigned"
      const { error: teamError } = await supabaseClient
        .from('teams')
        .update({ status: 'Assigned' })
        .eq('team_id', teamId);

      if (teamError) throw teamError;

      setTeams(prev =>
        prev.map(t =>
          t.team_id === teamId
            ? { ...t, status: 'Assigned' }
            : t
        )
      );

      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to assign team to assignment';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient]);

  /**
   * Unassign a team from an assignment
   * Clears the assignment's team_id
   */
  const unassignTeam = useCallback(async (assignmentId) => {
    if (!assignmentId) {
      throw new Error('Assignment ID is required');
    }

    try {
      // Get the assignment first to find the team
      const assignmentToUnassign = assignments.find(
        a => a.assignment_id === assignmentId
      );

      if (!assignmentToUnassign) {
        throw new Error('Assignment not found');
      }

      // Update assignment
      const { error: updateError } = await supabaseClient
        .from('assignments')
        .update({ 
          team_id: null,
          status: 'Planned'
        })
        .eq('assignment_id', assignmentId);

      if (updateError) throw updateError;

      // Update local state
      setAssignments(prev =>
        prev.map(a =>
          a.assignment_id === assignmentId
            ? { ...a, team_id: null, status: 'Planned' }
            : a
        )
      );

      // Update team status back to "Staged"
      if (assignmentToUnassign.team_id) {
        const { error: teamError } = await supabaseClient
          .from('teams')
          .update({ status: 'Staged' })
          .eq('team_id', assignmentToUnassign.team_id);

        if (teamError) throw teamError;

        setTeams(prev =>
          prev.map(t =>
            t.team_id === assignmentToUnassign.team_id
              ? { ...t, status: 'Staged' }
              : t
          )
        );
      }

      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to unassign team';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient, assignments]);

  /**
   * Update team status
   * Useful for advancing teams through their lifecycle
   */
  const updateTeamStatus = useCallback(async (teamId, newStatus) => {
    if (!teamId || !newStatus) {
      throw new Error('Team ID and status are required');
    }

    try {
      const { error } = await supabaseClient
        .from('teams')
        .update({ status: newStatus })
        .eq('team_id', teamId);

      if (error) throw error;

      setTeams(prev =>
        prev.map(t =>
          t.team_id === teamId
            ? { ...t, status: newStatus }
            : t
        )
      );

      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to update team status';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient]);

  /**
   * Create a new team
   */
  const createTeam = useCallback(async (teamPayload) => {
    try {
      const payload = {
        op_period_id: teamPayload.op_period_id,
        team_name_number: teamPayload.team_name_number,
        sartopo_color_hex: teamPayload.sartopo_color_hex || '#007bff',
        type: teamPayload.type || 'Other',
        status: teamPayload.status || 'Draft',
        leader_responder_id: teamPayload.leader_responder_id || null,
        equipment: teamPayload.equipment || [],
      };

      const { data, error } = await supabaseClient
        .from('teams')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      const newTeam = data;
      setTeams(prev => [...prev, newTeam]);

      if (teamPayload.responder_ids?.length) {
        await Promise.all(
          teamPayload.responder_ids.map(responderId =>
            assignResponderToTeam(supabaseClient, responderId, newTeam.team_id)
          )
        );

        // Refresh dashboard data after adding responders
        await fetchDashboardData();
      }

      return newTeam;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create team';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient, fetchDashboardData]);

  /**
   * Create a new assignment
   */
  const createAssignment = useCallback(async (assignmentPayload) => {
    try {
      const payload = {
        op_period_id: assignmentPayload.op_period_id,
        name: assignmentPayload.name,
        status: assignmentPayload.status || 'Draft',
        team_id: assignmentPayload.team_id || null,
      };

      const { data, error } = await supabaseClient
        .from('assignments')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      const newAssignment = {
        ...data,
        division: assignmentPayload.division || '',
        assignment_type: assignmentPayload.assignment_type || '',
        assignment_size: assignmentPayload.assignment_size || '',
        tac_channel: assignmentPayload.tac_channel || '',
        description_narrative: assignmentPayload.description_narrative || '',
      };

      setAssignments(prev => [...prev, newAssignment]);
      return newAssignment;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create assignment';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient]);

  /**
   * Update an existing team
   */
  const updateTeam = useCallback(async (teamId, updates) => {
    try {
      const { data, error } = await supabaseClient
        .from('teams')
        .update(updates)
        .eq('team_id', teamId)
        .select()
        .single();

      if (error) throw error;

      setTeams(prev => prev.map(t => t.team_id === teamId ? data : t));
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update team';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient]);

  /**
   * Attach a responder to a team (uses responder service)
   */
  const attachResponderToTeam = useCallback(async (responderId, teamId) => {
    try {
      await assignResponderToTeam(supabaseClient, responderId, teamId);
      // refresh dashboard data to keep everything in sync
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to attach responder to team';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient, fetchDashboardData]);

  /**
   * Detach a responder from a team
   */
  const detachResponderFromTeam = useCallback(async (responderId, teamId) => {
    try {
      await removeResponderFromTeam(supabaseClient, responderId, teamId);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to remove responder from team';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient, fetchDashboardData]);

  return {
    // State
    teams,
    assignments,
    responders,
    loading,
    error,

    // Methods
    fetchDashboardData,
    assignTeamToAssignment,
    unassignTeam,
    updateTeamStatus,
    createTeam,
    createAssignment,

    // Computed
    stagedTeams: teams.filter(t => t.status === 'Staged'),
    availableAssignments: assignments.filter(a => !a.team_id && !a.is_orphaned),
  };
};

export default usePlanningDashboard;
