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
      let finalTeamStatus = newStatus;
      let unlinkRequired = false;
      const now = new Date().toISOString();

      if (['Completed', 'Incomplete'].includes(newStatus)) {
        finalTeamStatus = 'Disbanded';
        unlinkRequired = false; // Keep link for history/accountability
      } else if (newStatus === 'Planned') {
        finalTeamStatus = 'Staged';
        unlinkRequired = true;
      }

      let teamUpdatePayload = { status: finalTeamStatus };
      if (['Assigned', 'Deployed'].includes(finalTeamStatus)) { // Only set last_par_check for active statuses
        teamUpdatePayload.last_par_check = now;
      } else { // Clear last_par_check for non-active statuses
        teamUpdatePayload.last_par_check = null;
      }

      const { error: asnError } = await supabaseClient
        .from('assignments')
        .update({ status: newStatus, team_id: unlinkRequired ? null : teamId })
        .eq('assignment_id', assignmentId);
      if (asnError) throw asnError;

      if (teamId) {
        const { error: teamError } = await supabaseClient.from('teams').update(teamUpdatePayload).eq('team_id', teamId);
        if (teamError) throw teamError;

        const { data: members } = await supabaseClient.from('team_responders').select('responder_id').eq('team_id', teamId);
        const memberIds = members?.map(m => m.responder_id) || [];
        
        if (memberIds.length > 0) {
          if (finalTeamStatus === 'Disbanded') {
            await Promise.all([
              supabaseClient.from('responders').update({ status: 'Staged' }).in('responder_id', memberIds),
              supabaseClient.from('responder_team_history').update({ detached_datetime: now }).eq('team_id', teamId).is('detached_datetime', null)
            ]);
            if (responderId && memberIds.includes(responderId)) setResponderStatus('Staged');
          } else if (['Assigned', 'Deployed'].includes(finalTeamStatus)) {
            await supabaseClient.from('responders').update({ status: finalTeamStatus }).in('responder_id', memberIds);
          }
        }
      }

      const assignment = assignments.find(a => a.assignment_id === assignmentId);
      const team = teams.find(t => t.team_id === teamId);
      await recordAction(`Resource status update: Assignment "${assignment?.title || 'Unknown'}" set to ${newStatus}${teamId ? `, Team "${team?.team_name_number || 'No Team'}" set to ${finalTeamStatus}` : ''}.`);
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
      const { data: members } = await supabaseClient.from('team_responders').select('responder_id').eq('team_id', teamId);
      if (members?.length) {
        await supabaseClient.from('responders').update({ status: 'Assigned' }).in('responder_id', members.map(m => m.responder_id));
      }
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
        team_name: payload.team_name || null,
        priority: payload.priority || null,
        transportation: payload.transportation || null,
        time_allocated: payload.time_allocated || null,
        segment_area: payload.segment_area || null,
        hazards: payload.hazards || null,
        prepared_by: payload.prepared_by || null,
        folder_id: payload.folder_id || null,
        color: payload.color || null,
        stroke: payload.stroke || null,
        fill: payload.fill || null,
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