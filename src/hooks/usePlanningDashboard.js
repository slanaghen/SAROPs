import { useState, useCallback } from 'react';
import { assignResponderToTeam, removeResponderFromTeam } from '../services/responderService';
import { useIncident } from '../context/IncidentContext';

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

  const { incidentId, responderName, user } = useIncident();
  const userName = responderName || user?.email || 'System';

  /**
   * Helper to automatically log database changes
   */
  const recordAction = useCallback(async (action) => {
    if (!incidentId) return;
    await supabaseClient.from('action_logs').insert({
      incident_id: incidentId,
      action,
      user_name: userName
    });
  }, [supabaseClient, incidentId, userName]);

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
        .select('*, current_responders:team_responders(responder_id)')
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

      const team = teams.find(t => t.team_id === teamId);
      const assignment = assignments.find(a => a.assignment_id === assignmentId);
      const teamName = team?.team_name_number || 'Unknown Team';
      const asnName = assignment?.name || 'Unknown Assignment';
      await recordAction(`Assigned ${teamName} to ${asnName}`);

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

      await recordAction(`Unassigned team from ${assignmentToUnassign.name}`);

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

      const team = teams.find(t => t.team_id === teamId);
      await recordAction(`Updated status of ${team?.team_name_number || 'Team'} to ${newStatus}`);

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
        team_name_number: teamPayload.team_name_number || '',
        sartopo_color_hex: teamPayload.sartopo_color_hex || '#007bff',
        type: teamPayload.type || 'Other',
        status: teamPayload.status || 'Staged',
        leader_responder_id: teamPayload.leader_responder_id || null,
        equipment: teamPayload.equipment || [],
      };

      const { data, error } = await supabaseClient
        .from('teams')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No team data returned from server');

      await recordAction(`Created new team: ${teamPayload.team_name_number}`);

      const newTeam = data;
      setTeams(prev => [...prev, newTeam]);

      if (teamPayload.responder_ids?.length) {
        await Promise.all([
          ...teamPayload.responder_ids.map(responderId =>
            assignResponderToTeam(supabaseClient, responderId, newTeam.team_id)
          ),
          supabaseClient
            .from('responders')
            .update({ status: 'Attached' })
            .in('responder_id', teamPayload.responder_ids)
        ]);

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
    if (!operationalPeriodId) {
      const err = 'Cannot create assignment: No operational period selected.';
      setError(err);
      throw new Error(err);
    }

    try {
      const payload = {
        op_period_id: operationalPeriodId,
        name: assignmentPayload.name || '',
        status: assignmentPayload.status || 'Planned',
        team_id: assignmentPayload.team_id || null,
        division: assignmentPayload.division || '',
        assignment_type: assignmentPayload.assignment_type || '',
        assignment_size: assignmentPayload.assignment_size ? parseInt(assignmentPayload.assignment_size, 10) : null,
        tac_channel: assignmentPayload.tac_channel || '',
        description_narrative: assignmentPayload.description_narrative || '',
        is_orphaned: false
      };

      console.info('📡 Submitting New Assignment:', payload);

      const { data, error } = await supabaseClient
        .from('assignments')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No assignment data returned from server');

      await recordAction(`Created new assignment: ${assignmentPayload.name}`);

      // Atomic state update then background refresh
      setAssignments(prev => [...prev, data]);
      fetchDashboardData(); 
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create assignment';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient, operationalPeriodId, fetchDashboardData]);

  /**
   * Update an existing assignment
   */
  const updateAssignment = useCallback(async (assignmentId, updates) => {
    try {
      const payload = {
        name: updates.name || '',
        status: updates.status || 'Planned',
        division: updates.division || '',
        assignment_type: updates.assignment_type || '',
        assignment_size: updates.assignment_size ? parseInt(updates.assignment_size, 10) : null,
        tac_channel: updates.tac_channel || '',
        description_narrative: updates.description_narrative || '',
        team_id: updates.team_id || null,
        is_orphaned: updates.is_orphaned || false
      };

      console.info('📡 Updating Assignment:', assignmentId, payload);

      const { data, error } = await supabaseClient
        .from('assignments')
        .update(payload)
        .eq('assignment_id', assignmentId)
        .select()
        .single();

      if (error) throw error;

      await recordAction(`Updated details for assignment: ${payload.name}`);

      // Refresh to ensure any status sync triggers are reflected
      await fetchDashboardData();
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update assignment';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient, fetchDashboardData]);

  /**
   * Delete an assignment record
   */
  const deleteAssignment = useCallback(async (assignmentId) => {
    try {
      const { error } = await supabaseClient
        .from('assignments')
        .delete()
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      const assignment = assignments.find(a => a.assignment_id === assignmentId);
      await recordAction(`Deleted Assignment: ${assignment?.name || 'Unknown'}`);

      setAssignments(prev => prev.filter(a => a.assignment_id !== assignmentId));
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete assignment';
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

      const team = teams.find(t => t.team_id === teamId);
      await recordAction(`Updated details for ${team?.team_name_number || 'Team'}`);

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
      // Update both the junction table and the responder's operational status
      await Promise.all([
        assignResponderToTeam(supabaseClient, responderId, teamId),
        supabaseClient
          .from('responders')
          .update({ status: 'Attached' })
          .eq('responder_id', responderId)
      ]);
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
      // Remove association and return responder to the 'Staged' pool
      await Promise.all([
        removeResponderFromTeam(supabaseClient, responderId, teamId),
        supabaseClient
          .from('responders')
          .update({ status: 'Staged' })
          .eq('responder_id', responderId)
      ]);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to remove responder from team';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient, fetchDashboardData]);

  /**
   * Delete a team and release members back to Staged status
   */
  const deleteTeam = useCallback(async (teamId) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get the members of the team before deleting
      const { data: members, error: membersError } = await supabaseClient
        .from('team_responders')
        .select('responder_id')
        .eq('team_id', teamId);

      if (membersError) throw membersError;
      const responderIds = members?.map(m => m.responder_id) || [];

      // 2. Set responders back to Staged status
      if (responderIds.length > 0) {
        const { error: respError } = await supabaseClient
          .from('responders')
          .update({ status: 'Staged' })
          .in('responder_id', responderIds);

        if (respError) throw respError;
      }

      // 3. Delete the team record (cascading deletes team_responders entries)
      const { error: deleteError } = await supabaseClient
        .from('teams')
        .delete()
        .eq('team_id', teamId);

      if (deleteError) throw deleteError;

      const team = teams.find(t => t.team_id === teamId);
      await recordAction(`Released/Deleted ${team?.team_name_number || 'Team'}`);

      // 4. Update local state
      setTeams(prev => prev.filter(t => t.team_id !== teamId));
      setResponders(prev => prev.map(r => 
        responderIds.includes(r.responder_id) ? { ...r, status: 'Staged' } : r
      ));

      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to release team';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

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
    updateTeam,
    attachResponderToTeam,
    updateAssignment,
    deleteAssignment,
    detachResponderFromTeam,
    deleteTeam,

    // Computed
    stagedTeams: teams.filter(t => t.status === 'Staged'),
    availableAssignments: assignments.filter(a => !a.team_id && !a.is_orphaned),
  };
};

export default usePlanningDashboard;
