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
  const [opPeriod, setOpPeriod] = useState(null);
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
      const [teamsRes, assignmentsRes, respondersRes, opRes] = await Promise.all([
        supabaseClient.from('teams').select('*, current_responders:team_responders(responder_id)').eq('op_period_id', operationalPeriodId),
        supabaseClient.from('assignments').select('*').eq('op_period_id', operationalPeriodId),
        supabaseClient.from('responders').select('*'),
        supabaseClient.from('operational_periods').select('*').eq('op_period_id', operationalPeriodId).maybeSingle()
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (respondersRes.error) throw respondersRes.error;
      if (opRes.error) throw opRes.error;

      setTeams(teamsRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setResponders(respondersRes.data || []);
      setOpPeriod(opRes.data || null);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [operationalPeriodId, supabaseClient]);

  /**
   * Centralized Status Transition Logic
   * Handles the complex cascade from Assignment to Team to Responders
   */
  const updateResourceStatus = useCallback(async (assignmentId, teamId, newStatus) => {
    try {
      let finalTeamStatus = newStatus;
      let unlinkRequired = false;
      const now = new Date().toISOString();

      // 1. Handle Terminal States
      if (['Completed', 'Incomplete'].includes(newStatus)) {
        finalTeamStatus = 'Disbanded';
        unlinkRequired = true;
      } else if (newStatus === 'Planned') {
        finalTeamStatus = 'Staged';
        unlinkRequired = true;
      }

      // 2. Update Assignment
      const { error: asnError } = await supabaseClient
        .from('assignments')
        .update({ status: newStatus, team_id: unlinkRequired ? null : teamId })
        .eq('assignment_id', assignmentId);
      if (asnError) throw asnError;

      // 3. Update Team and Responders if a team is involved
      if (teamId) {
        // Update Team Record
        const { error: teamError } = await supabaseClient
          .from('teams')
          .update({ status: finalTeamStatus, last_par_check: now })
          .eq('team_id', teamId);
        if (teamError) throw teamError;

        // Fetch members for cascade
        const { data: members } = await supabaseClient
          .from('team_responders')
          .select('responder_id')
          .eq('team_id', teamId);
        
        const memberIds = members?.map(m => m.responder_id) || [];
        
        if (memberIds.length > 0) {
          if (finalTeamStatus === 'Disbanded') {
            // Release to Staged and close history
            await Promise.all([
              supabaseClient.from('responders').update({ status: 'Staged' }).in('responder_id', memberIds),
              supabaseClient.from('responder_team_history')
                .update({ detached_datetime: now })
                .eq('team_id', teamId)
                .is('detached_datetime', null)
            ]);
          } else if (['Assigned', 'Deployed'].includes(finalTeamStatus)) {
            // Cascade active status
            await supabaseClient.from('responders').update({ status: finalTeamStatus }).in('responder_id', memberIds);
          }
        }
      }

      await recordAction(`Transitioned Assignment ${assignmentId} to ${newStatus}`);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to update resource status';
      setError(errorMsg);
      throw err;
    }
  }, [supabaseClient, fetchDashboardData, recordAction]);

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
        .update({ 
          status: 'Assigned',
          last_par_check: new Date().toISOString()
        })
        .eq('team_id', teamId);

      if (teamError) throw teamError;

      // Update all team members' status to "Assigned"
      const { data: members } = await supabaseClient
        .from('team_responders')
        .select('responder_id')
        .eq('team_id', teamId);
      if (members?.length) {
        await supabaseClient.from('responders').update({ status: 'Assigned' }).in('responder_id', members.map(m => m.responder_id));
      }

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
          .update({ 
            status: 'Staged',
            last_par_check: new Date().toISOString()
          })
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
        .update({ 
          status: newStatus,
          last_par_check: new Date().toISOString()
        })
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
        poa: assignmentPayload.poa ? parseInt(assignmentPayload.poa, 10) : null,
        pod: assignmentPayload.pod ? parseInt(assignmentPayload.pod, 10) : null,
        debrief_narrative: assignmentPayload.debrief_narrative || '',
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
        poa: updates.poa ? parseInt(updates.poa, 10) : null,
        pod: updates.pod ? parseInt(updates.pod, 10) : null,
        debrief_narrative: updates.debrief_narrative || '',
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

      // Synchronize linked team status and reset PAR timer if status changed
      if (updates.team_id) {
        let teamStatus = payload.status;
        let unlinkRequired = false;

        if (teamStatus === 'Completed' || teamStatus === 'Incomplete') {
          teamStatus = 'Disbanded';
          unlinkRequired = true;
        } else if (teamStatus === 'Planned') {
          teamStatus = 'Staged';
          unlinkRequired = true;
        }

        // Check if status actually changed or if we just want to ensure timer resets on save
        const { error: teamError } = await supabaseClient
          .from('teams')
          .update({ 
            status: teamStatus,
            last_par_check: new Date().toISOString()
          })
          .eq('team_id', updates.team_id);

        if (teamError) throw teamError;

        // Cascade status to team members
        if (teamStatus === 'Assigned' || teamStatus === 'Deployed') {
          const { data: members } = await supabaseClient
            .from('team_responders')
            .select('responder_id')
            .eq('team_id', updates.team_id);
          if (members?.length) {
            await supabaseClient.from('responders').update({ status: teamStatus }).in('responder_id', members.map(m => m.responder_id));
          }
        } else if (teamStatus === 'Disbanded') {
          const { data: members } = await supabaseClient
            .from('team_responders')
            .select('responder_id')
            .eq('team_id', updates.team_id);
          if (members?.length) {
            const memberIds = members.map(m => m.responder_id);
            await supabaseClient.from('responders').update({ status: 'Staged' }).in('responder_id', memberIds);
            await supabaseClient.from('responder_team_history')
              .update({ detached_datetime: new Date().toISOString() })
              .eq('team_id', updates.team_id)
              .is('detached_datetime', null);
          }
        }

        // If assignment is finished, remove the link so the team is truly free for next task
        if (unlinkRequired) {
          await supabaseClient
            .from('assignments')
            .update({ team_id: null })
            .eq('assignment_id', assignmentId);
        }
      }

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
   * Detach a team: releases responders back to Staged status
   * but keeps the team record and historical membership.
   */
  const detachTeam = useCallback(async (teamId) => {
    if (!teamId) throw new Error('Team ID is required');

    try {
      setLoading(true);
      setError(null);

      // 1. Get current members
      const { data: members, error: membersError } = await supabaseClient
        .from('team_responders')
        .select('responder_id')
        .eq('team_id', teamId);

      if (membersError) throw membersError;
      const responderIds = members?.map(m => m.responder_id) || [];

      // 2. Release responders and update history
      if (responderIds.length > 0) {
        await supabaseClient
          .from('responders')
          .update({ status: 'Staged' })
          .in('responder_id', responderIds);

        await supabaseClient
          .from('responder_team_history')
          .update({ detached_datetime: new Date().toISOString() })
          .eq('team_id', teamId)
          .is('detached_datetime', null);
      }

      // 3. Update team status
      const { error: teamError } = await supabaseClient
        .from('teams')
        .update({ 
          status: 'Disbanded',
          last_par_check: new Date().toISOString()
        })
        .eq('team_id', teamId);

      if (teamError) throw teamError;

      const team = teams.find(t => t.team_id === teamId);
      await recordAction(`Disbanded ${team?.team_name_number || 'Team'}`);
      await fetchDashboardData();

      return { success: true };
    } catch (err) {
      setError(err.message || 'Failed to disband team');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, teams, fetchDashboardData, recordAction]);

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

  /**
   * Update responder details
   */
  const updateResponder = useCallback(async (responderId, updates) => {
    try {
      const { data, error } = await supabaseClient
        .from('responders')
        .update(updates)
        .eq('responder_id', responderId)
        .select()
        .single();

      if (error) throw error;

      await recordAction(`Updated details for responder: ${updates.name || 'Responder'}`);
      setResponders(prev => prev.map(r => r.responder_id === responderId ? data : r));
      return data;
    } catch (err) {
      setError(err.message || 'Failed to update responder');
      throw err;
    }
  }, [supabaseClient, recordAction]);

  /**
   * Mark a responder as checked out
   */
  const checkOutResponder = useCallback(async (responderId, name) => {
    try {
      setLoading(true);
      setError(null);

      // 0. Remove from all team associations to maintain clean state
      await supabaseClient
        .from('team_responders')
        .delete()
        .eq('responder_id', responderId);

      // 1. Clear leadership to prevent FK violations
      await supabaseClient
        .from('teams')
        .update({ leader_responder_id: null })
        .eq('leader_responder_id', responderId);

      // 2. Update status and timestamp
      const { data, error } = await supabaseClient
        .from('responders')
        .update({
          checkout_datetime: new Date().toISOString()
        })
        .eq('responder_id', responderId)
        .select()
        .single();

      if (error) throw error;

      await recordAction(`Checked out responder: ${name}`);
      setResponders(prev => prev.map(r => r.responder_id === responderId ? data : r));
      return data;
    } catch (err) {
      setError(err.message || 'Failed to check out responder');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction]);

  return {
    // State
    teams,
    assignments,
    responders,
    opPeriod,
    loading,
    error,
    setError,
    setLoading,

    // Methods
    fetchDashboardData,
    assignTeamToAssignment,
    unassignTeam,
    updateTeamStatus,
    createTeam,
    updateResponder,
    checkOutResponder,
    createAssignment,
    updateResourceStatus,
    detachTeam,
    updateTeam,
    attachResponderToTeam,
    updateAssignment,
    deleteAssignment,
    detachResponderFromTeam,
    deleteTeam,

    // Computed
    stagedTeams: (Array.isArray(teams) ? teams : []).filter(t => t?.status === 'Staged'),
    availableAssignments: (Array.isArray(assignments) ? assignments : []).filter(a => !a?.team_id && !a?.is_orphaned),
    availableResponders: (Array.isArray(responders) ? responders : []).filter(r => r?.status === 'Staged'),
  };
};

export default usePlanningDashboard;
