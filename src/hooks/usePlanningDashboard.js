import { useState, useCallback, useMemo } from 'react';
import { assignResponderToTeam, removeResponderFromTeam } from '../services/responderService';
import { useIncident } from '../context/IncidentContext';
import { updateResponderStatus as updateResponderStatusService } from '../services/responderService';

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

  const { incidentId, responderName, user, responderId, setResponderStatus, setAccessLevel } = useIncident();
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
        supabaseClient.from('teams').select('*, current_responders:team_responders(responder_id, role)').eq('op_period_id', operationalPeriodId),
        supabaseClient.from('assignments').select('*').eq('op_period_id', operationalPeriodId),
        supabaseClient.from('responders').select('*, access_level'), // Ensure access_level is fetched
        supabaseClient.from('operational_periods').select('*, incidents(*)').eq('op_period_id', operationalPeriodId).maybeSingle()
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (respondersRes.error) throw respondersRes.error;
      if (opRes.error) throw opRes.error;

      setTeams(Array.isArray(teamsRes.data) ? teamsRes.data : []);
      setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
      setResponders(Array.isArray(respondersRes.data) ? respondersRes.data : []);
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
      setLoading(true);
      let finalTeamStatus = newStatus;
      let unlinkRequired = false;
      const now = new Date().toISOString();

      // 1. Handle Terminal States
      let teamUpdatePayload = { status: finalTeamStatus };
      if (['Completed', 'Incomplete'].includes(newStatus)) {
        finalTeamStatus = 'Disbanded';
        unlinkRequired = false;
        teamUpdatePayload.last_par_check = null; // Clear PAR check for non-active states
      } else if (newStatus === 'Planned') {
        finalTeamStatus = 'Staged';
        unlinkRequired = true;
        teamUpdatePayload.last_par_check = null; // Clear PAR check for non-active states
      } else if (['Assigned', 'Deployed'].includes(finalTeamStatus)) {
        teamUpdatePayload.last_par_check = now; // Set PAR check for active states
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
          .update(teamUpdatePayload)
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

            // Sync local context if current user was on this team
            if (responderId && memberIds.includes(responderId)) {
              setResponderStatus('Staged');
            }
          } else if (['Assigned', 'Deployed'].includes(finalTeamStatus)) {
            // Cascade active status
            await supabaseClient.from('responders').update({ status: finalTeamStatus }).in('responder_id', memberIds);
          }
        }
      }

      const assignment = assignments.find(a => a.assignment_id === assignmentId);
      const team = teams.find(t => t.team_id === teamId);
      const asnName = assignment?.name || 'Unknown Assignment';
      const teamName = team?.team_name_number || 'No Team';
      await recordAction(`Resource status update: Assignment "${asnName}" set to ${newStatus}${teamId ? `, Team "${teamName}" set to ${finalTeamStatus}` : ''}.`);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to update resource status';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData, recordAction, responderId, setResponderStatus, setAccessLevel, responders]);

  /**
   * Assign a team to an assignment
   * Updates the assignment's team_id
   */
  const assignTeamToAssignment = useCallback(async (teamId, assignmentId) => {
    if (!teamId || !assignmentId) {
      throw new Error('Team ID and Assignment ID are required');
    }

    try {
      setLoading(true);
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
      await recordAction(`Assigned team "${teamName}" to assignment "${asnName}". Statuses set to "Assigned".`);

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
    } finally {
      setLoading(false);
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
          is_orphaned: true, // Mark as orphaned when manually unassigned
          team_id: null,
          status: 'Planned'
        })
        .eq('assignment_id', assignmentId);

      if (updateError) throw updateError;

      await recordAction(`Unassigned team from assignment "${assignmentToUnassign.name}". Assignment status set to "Planned", team status set to "Staged", assignment marked as "Orphaned".`);

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
            last_par_check: null // Clear PAR check when unassigned/staged
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
    } finally {
      setLoading(false);
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
      setLoading(true);
      let teamUpdatePayload = { status: newStatus };
      if (['Assigned', 'Deployed'].includes(newStatus)) {
        teamUpdatePayload.last_par_check = new Date().toISOString();
      } else {
        teamUpdatePayload.last_par_check = null; // Clear PAR check for non-active states
      }
      const { error } = await supabaseClient
        .from('teams')
        .update(teamUpdatePayload)
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
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  /**
   * Create a new team
   */
  const createTeam = useCallback(async (teamPayload) => {
    try {
      setLoading(true);
      const payload = {
        op_period_id: teamPayload.op_period_id,
        team_name_number: teamPayload.team_name_number || '',
        sartopo_color_hex: teamPayload.sartopo_color_hex || '#FF0000',
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

      const leaderName = responders.find(r => r.responder_id === teamPayload.leader_responder_id)?.name || 'None';
      await recordAction(`Created team "${teamPayload.team_name_number}". Type: ${teamPayload.type}, Status: ${teamPayload.status}, Leader: ${leaderName}, Members: ${teamPayload.responder_ids?.length || 0}.`);

      const newTeam = data;
      setTeams(prev => [...prev, newTeam]);

      if (teamPayload.responder_ids?.length) {
        const roles = teamPayload.responder_roles || {};

        // 1. Ensure all responders are assigned to the team first (creates team_responders rows)
        // We do this first to ensure the row exists before attempting to update the role
        await Promise.all(teamPayload.responder_ids.map(id => assignResponderToTeam(supabaseClient, id, newTeam.team_id)));

        // 2. Now safe to update roles and responder operational status concurrently
        await Promise.all([
          ...teamPayload.responder_ids.map(id => 
            supabaseClient.from('team_responders')
              .update({ role: roles[id] || null })
              .match({ team_id: newTeam.team_id, responder_id: id })
          ),
          // Bulk status update
          supabaseClient
            .from('responders')
            .update({ status: 'Attached' })
            .in('responder_id', teamPayload.responder_ids)
        ]);
      }

      await fetchDashboardData();

      return newTeam;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create team';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
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
      setLoading(true);
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

      await recordAction(`Created assignment "${assignmentPayload.name}". Division: ${assignmentPayload.division}, Type: ${assignmentPayload.assignment_type}, Status: ${assignmentPayload.status}.`);

      // Atomic state update then background refresh
      setAssignments(prev => [...prev, data]);
      fetchDashboardData(); 
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create assignment';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, operationalPeriodId, fetchDashboardData]);

  /**
   * Update an existing assignment
   */
  const updateAssignment = useCallback(async (assignmentId, updates) => {
    try {
      setLoading(true);
      const payload = {
        name: updates.name || '',
        status: updates.status || 'Planned',
        division: updates.division || '',
        assignment_type: updates.assignment_type || '',
        assignment_size: updates.assignment_size ? parseInt(updates.assignment_size, 10) : null,
        tac_channel: updates.tac_channel || '',
        description_narrative: updates.description_narrative || '',
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

      const oldAsn = assignments.find(a => a.assignment_id === assignmentId);
      const changes = [];
      if (oldAsn) {
        Object.keys(payload).forEach(key => {
          if (payload[key] !== oldAsn[key] && key !== 'updated_at' && key !== 'op_period_id') {
            changes.push(`${key}: "${oldAsn[key] ?? 'null'}" -> "${payload[key] ?? 'null'}"`);
          }
        });
      }
      const changeLog = changes.length > 0 ? ` Details: ${changes.join(', ')}` : '';
      await recordAction(`Updated assignment "${payload.name}".${changeLog}`);

      // Synchronize linked team status and reset PAR timer if status changed
      if (updates.team_id) {
        let teamStatus = payload.status;
        let unlinkRequired = false;

        if (teamStatus === 'Completed' || teamStatus === 'Incomplete') {
          teamStatus = 'Disbanded';
          unlinkRequired = false;
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
            await Promise.all([
              supabaseClient.from('responder_team_history')
                .update({ detached_datetime: new Date().toISOString() })
                .eq('team_id', updates.team_id)
                .is('detached_datetime', null)
            ]);
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
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData]);

  /**
   * Delete an assignment record
   */
  const deleteAssignment = useCallback(async (assignmentId) => {
    try {
      setLoading(true);
      const { error } = await supabaseClient
        .from('assignments')
        .delete()
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      const assignment = assignments.find(a => a.assignment_id === assignmentId);
      await recordAction(`Deleted assignment "${assignment?.name || 'Unknown'}".`);

      setAssignments(prev => prev.filter(a => a.assignment_id !== assignmentId));
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete assignment';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
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
      // Check if this team was attached to an active assignment
      await supabaseClient
        .from('assignments')
        .update({ is_orphaned: true })
        .eq('team_id', teamId)
        .not('status', 'in', '("Completed")');

      if (responderIds.length > 0) {
        await Promise.all([
          supabaseClient
            .from('responders')
            .update({ status: 'Staged' })
            .in('responder_id', responderIds),
          supabaseClient
            .from('responder_team_history')
            .update({ detached_datetime: new Date().toISOString() })
            .eq('team_id', teamId)
            .is('detached_datetime', null)
        ]);

        // Sync local context if current user was on this team
        if (responderId && responderIds.includes(responderId)) {
          setResponderStatus('Staged');
        }
      }

      // 3. Update team status
      const { error: teamError } = await supabaseClient
        .from('teams')
        .update({ 
          status: 'Disbanded',
          last_par_check: null // Clear PAR check when disbanded
        })
        .eq('team_id', teamId);

      if (teamError) throw teamError;

      const team = teams.find(t => t.team_id === teamId);
      await recordAction(`Disbanded team "${team?.team_name_number || 'Team'}". Members released to Staged status. Associated incomplete assignments marked as "Orphaned".`);
      await fetchDashboardData();

      return { success: true };
    } catch (err) {
      setError(err.message || 'Failed to disband team');
      throw err;
    } finally {
      setLoading(false); // This was missing
    }
  }, [supabaseClient, teams, fetchDashboardData, recordAction]);

  /**
   * Update an existing team
   */
  const updateTeam = useCallback(async (teamId, updates) => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('teams')
        .update(updates)
        .eq('team_id', teamId)
        .select()
        .single();

      if (error) throw error;

      const oldTeam = teams.find(t => t.team_id === teamId);
      const changes = [];
      if (oldTeam) {
        Object.keys(updates).forEach(key => {
          if (key === 'equipment') {
            if (JSON.stringify(updates[key]) !== JSON.stringify(oldTeam[key])) {
              changes.push(`${key}: [${(oldTeam[key] || []).join(', ')}] -> [${(updates[key] || []).join(', ')}]`);
            }
          } else if (updates[key] !== oldTeam[key] && key !== 'updated_at' && key !== 'current_responders') {
            changes.push(`${key}: "${oldTeam[key] ?? 'null'}" -> "${updates[key] ?? 'null'}"`);
          }
        });
      }
      const changeLog = changes.length > 0 ? ` Details: ${changes.join(', ')}` : '';
      await recordAction(`Updated team "${oldTeam?.team_name_number || 'Team'}".${changeLog}`);

      setTeams(prev => prev.map(t => t.team_id === teamId ? data : t));
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update team';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  /**
   * Attach a responder to a team (uses responder service)
   */
  const attachResponderToTeam = useCallback(async (responderId, teamId, role = null) => {
    try {
      setLoading(true);

      // Check if membership already exists to avoid duplicate key errors from unconditional inserts
      const { data: existing } = await supabaseClient
        .from('team_responders')
        .select('team_id')
        .match({ team_id: teamId, responder_id: responderId })
        .maybeSingle();

      // 1. Ensure the membership record exists first if it doesn't
      if (!existing) {
        await assignResponderToTeam(supabaseClient, responderId, teamId);
      }

      // 2. Now update the role and responder status
      await Promise.all([
        supabaseClient.from('responders').update({ status: 'Attached' }).eq('responder_id', responderId),
        supabaseClient.from('team_responders').update({ role }).match({ team_id: teamId, responder_id: responderId })
      ]);

      // refresh dashboard data to keep everything in sync
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Failed to attach responder to team';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData, responders]);

  /**
   * Detach a responder from a team
   */
  const detachResponderFromTeam = useCallback(async (responderId, teamId) => {
    try {
      setLoading(true);
      // Remove association and return responder to the 'Staged' pool
      await Promise.all([
        removeResponderFromTeam(supabaseClient, responderId, teamId), // This service call updates status to 'Staged'
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
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData, responders]);

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

        // Sync local context if current user was on this team
        if (responderId && responderIds.includes(responderId)) {
          setResponderStatus('Staged');
        }
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
      setLoading(false); // This was missing
    }
  }, [supabaseClient]);

  /**
   * Update responder details
   */
  const updateResponder = useCallback(async (responderId, updates) => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('responders')
        .update(updates)
        .eq('responder_id', responderId)
        .select()
        .single();

      if (error) throw error;

      const oldResponder = responders.find(r => r.responder_id === responderId);
      const changes = [];
      if (oldResponder) {
        Object.keys(updates).forEach(key => {
          if (updates[key] !== oldResponder[key] && key !== 'updated_at') {
            changes.push(`${key}: "${oldResponder[key] ?? 'null'}" -> "${updates[key] ?? 'null'}"`);
          }
        });
      }
      const changeLog = changes.length > 0 ? ` Details: ${changes.join(', ')}` : '';
      await recordAction(`Updated details for responder "${updates.name || 'Responder'}".${changeLog}`);
      setResponders(prev => prev.map(r => r.responder_id === responderId ? data : r));
      return data;
    } catch (err) {
      setError(err.message || 'Failed to update responder');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction, responders]);

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
          status: 'CheckedOut',
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
      setLoading(false); // This was missing
    }
  }, [supabaseClient, recordAction]);

  /**
   * Memoized operational statistics to prevent calculation drift across pages
   */
  const stats = useMemo(() => ({
    teams: {
      staged: (Array.isArray(teams) ? teams : []).filter(t => t.status === 'Staged').length,
      assigned: (Array.isArray(teams) ? teams : []).filter(t => t.status === 'Assigned').length,
      deployed: (Array.isArray(teams) ? teams : []).filter(t => t.status === 'Deployed').length,
      total: (Array.isArray(teams) ? teams : []).length,
    },
    assignments: {
      planned: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Planned').length,
      assigned: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Assigned').length,
      deployed: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Deployed').length,
      complete: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Completed').length,
      incomplete: (Array.isArray(assignments) ? assignments : []).filter(a => a.status === 'Incomplete').length,
      total: (Array.isArray(assignments) ? assignments : []).length,
    },
    responders: {
      staged: (Array.isArray(responders) ? responders : []).filter(r => r.status === 'Staged').length,
      attached: (Array.isArray(responders) ? responders : []).filter(r => r.status === 'Attached').length,
      assigned: (Array.isArray(responders) ? responders : []).filter(r => r.status === 'Assigned').length,
      deployed: (Array.isArray(responders) ? responders : []).filter(r => r.status === 'Deployed').length,
      total: (Array.isArray(responders) ? responders : []).length,
    }
  }), [assignments, teams, responders]);

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
    stats,

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
    updateResponderStatus: updateResponderStatusService, // Expose service function
    deleteTeam,

    // Computed
    stagedTeams: (Array.isArray(teams) ? teams : []).filter(t => t?.status === 'Staged'),
    availableAssignments: (Array.isArray(assignments) ? assignments : []).filter(a => !a?.team_id && !a?.is_orphaned),
    availableResponders: (Array.isArray(responders) ? responders : []).filter(r => r?.status === 'Staged'),
  };
};

export default usePlanningDashboard;
