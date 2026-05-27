import { useCallback } from 'react';

/**
 * useAssignmentActions Hook
 * Logic for creating assignments, updating status cascades, and unassigning teams.
 */
export const useAssignmentActions = ({
  supabaseClient,
  operationalPeriodId,
  assignments,
  teams,
  responderId,
  recordAction,
  fetchDashboardData,
  setAssignments,
  setTeams,
  setLoading,
  setError,
  setResponderStatus,
  normalizeAssignment
}) => {
  
  const updateResourceStatus = useCallback(async (assignmentId, teamId, newStatus) => {
    try {
      setLoading(true);
      let unlinkRequired = false;

      if (newStatus === 'Planned') {
        unlinkRequired = true;
      }

      // Update the primary assignment record.
      // Note: Database triggers handle cascading this status to the Team (Disbanded/Staged/Assigned)
      // and all individual Responders automatically.
      const { error: asnError } = await supabaseClient
        .from('assignments')
        .update({ status: newStatus, team_id: unlinkRequired ? null : teamId })
        .eq('assignment_id', assignmentId);

      if (asnError) throw asnError;

      // Manual sync for 'Assigned' and 'Planned' status changes
      if (teamId) {
        if (newStatus === 'Assigned') {
          await supabaseClient.from('teams').update({ status: 'Assigned', last_par_check: new Date().toISOString() }).eq('team_id', teamId);
        } else if (unlinkRequired) {
          await supabaseClient.from('teams').update({ status: 'Staged', last_par_check: null }).eq('team_id', teamId);
        }
      }

      const assignment = assignments.find(a => a.assignment_id === assignmentId);
      await recordAction(`Resource status update: Assignment "${assignment?.title || 'Unknown'}" set to ${newStatus}. Automated trigger applied to associated team/responders.`);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData, recordAction, responderId, setResponderStatus, assignments, teams]);

  const assignTeamToAssignment = useCallback(async (teamId, assignmentId) => {
    try {
      setLoading(true);
      const { error: updateError } = await supabaseClient.from('assignments').update({ team_id: teamId, status: 'Assigned' }).eq('assignment_id', assignmentId);
      if (updateError) throw updateError;

      const team = teams.find(t => t.team_id === teamId);
      const assignment = assignments.find(a => a.assignment_id === assignmentId);
      await recordAction(`Assigned team "${team?.team_name_number || 'Unknown'}" to assignment "${assignment?.title || 'Unknown'}". Statuses set to "Assigned".`);

      await supabaseClient.from('teams').update({ status: 'Assigned', last_par_check: new Date().toISOString() }).eq('team_id', teamId);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, teams, assignments, recordAction, fetchDashboardData]);

  const unassignTeam = useCallback(async (assignmentId) => {
    try {
      const assignmentToUnassign = assignments.find(a => a.assignment_id === assignmentId);
      if (!assignmentToUnassign) throw new Error('Assignment not found');

      await supabaseClient.from('assignments').update({ is_orphaned: false, team_id: null, status: 'Planned' }).eq('assignment_id', assignmentId);
      await recordAction(`Unassigned team from assignment "${assignmentToUnassign.title}". Assignment status set to "Planned" and team status set to "Staged".`);

      if (assignmentToUnassign.team_id) {
        await supabaseClient.from('teams').update({ status: 'Staged', last_par_check: null }).eq('team_id', assignmentToUnassign.team_id);
      }
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [supabaseClient, assignments, recordAction, fetchDashboardData]);

  const createAssignment = useCallback(async (payload) => {
    if (!operationalPeriodId) {
      const err = 'Cannot create assignment: No operational period selected.';
      setError(err);
      throw new Error(err);
    }
    try {
      setLoading(true);
      const dbPayload = {
        title: payload.title || '',
        segment: payload.segment || null,
        resource_type: payload.resource_type || '',
        team_size: payload.team_size ?? 0,
        frequency_primary: payload.frequency_primary || '',
        description: payload.description || '',
        probability_of_detection: payload.probability_of_detection ?? null,
        debrief_narrative: payload.debrief_narrative || '',
        priority: payload.priority || null,
        transportation: payload.transportation || null,
        time_allocated: payload.time_allocated || null,
        hazards: payload.hazards || null,
        prepared_by: payload.prepared_by || null,
        op_period_id: operationalPeriodId,
        status: payload.status || 'Planned',
        team_id: payload.team_id || null,
        is_orphaned: payload.is_orphaned || false
      };
      const { data, error } = await supabaseClient.from('assignments').insert(dbPayload).select().maybeSingle();
      if (error) throw error;
      await recordAction(`Created assignment "${payload.title}".`);
      await fetchDashboardData();
      return normalizeAssignment(data);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, operationalPeriodId, recordAction, fetchDashboardData, normalizeAssignment]);

  const updateAssignment = useCallback(async (assignmentId, updates) => {
    try {
      setLoading(true);
      // Standardize the update payload to use SARTopo-aligned columns
      const dbUpdates = {
        ...updates,
        title: updates.title || '',
        segment: updates.segment || null,
        resource_type: updates.resource_type || '',
        team_size: updates.team_size ?? 0,
        frequency_primary: updates.frequency_primary || '',
        description: updates.description || '',
        probability_of_detection: updates.probability_of_detection ?? null
      };

      // Remove legacy keys before sending to DB
      ['name', 'division', 'assignment_type', 'assignment_size', 'tac_channel', 'description_narrative', 'pod'].forEach(k => delete dbUpdates[k]);

      const { data, error } = await supabaseClient.from('assignments').update(dbUpdates).eq('assignment_id', assignmentId).select().maybeSingle();
      if (error) throw error;
      await recordAction(`Updated assignment "${updates.title}".`);
      await fetchDashboardData();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction, fetchDashboardData]);

  const deleteAssignment = useCallback(async (id) => {
    try {
      setLoading(true);
      await supabaseClient.from('assignments').delete().eq('assignment_id', id);
      await recordAction(`Deleted assignment record.`);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction, fetchDashboardData]);

  return { createAssignment, updateResourceStatus, unassignTeam, assignTeamToAssignment, updateAssignment, deleteAssignment };
};