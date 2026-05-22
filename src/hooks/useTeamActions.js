import { useCallback } from 'react';
import { assignResponderToTeam, removeResponderFromTeam } from '../services/responderService';

/**
 * useTeamActions Hook
 * Logic for creating teams, disbanding them, and reconciling responder memberships.
 */
export const useTeamActions = ({
  supabaseClient,
  operationalPeriodId,
  incidentId,
  teams,
  responders,
  responderId,
  recordAction,
  fetchDashboardData,
  setLoading,
  setError,
  setResponderStatus
}) => {
  
  const createTeam = useCallback(async (teamPayload) => {
    try {
      setLoading(true);

      // Enforce unique team names within the incident (across all operational periods)
      const { data: existing, error: checkError } = await supabaseClient
        .from('teams')
        .select('team_id, operational_periods!inner(incident_id)')
        .eq('team_name_number', teamPayload.team_name_number.trim())
        .eq('operational_periods.incident_id', incidentId)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) {
        throw new Error(`A team named "${teamPayload.team_name_number}" already exists in this incident. Team names must be unique.`);
      }

      // Clean the payload to include only valid columns for the 'teams' table.
      const dbPayload = {
        team_name_number: teamPayload.team_name_number.trim(),
        sartopo_color_hex: teamPayload.sartopo_color_hex || '#FF0000',
        type: teamPayload.type,
        status: teamPayload.status || 'Staged',
        leader_responder_id: teamPayload.leader_responder_id,
        equipment: teamPayload.equipment || [],
        op_period_id: operationalPeriodId,
      };
      const { data, error } = await supabaseClient.from('teams').insert(dbPayload).select().maybeSingle();
      if (error) throw error;

      if (teamPayload.responder_ids?.length) {
        const roles = teamPayload.responder_roles || {};
        await Promise.all(teamPayload.responder_ids.map(id => assignResponderToTeam(supabaseClient, id, data.team_id)));
        await Promise.all([
          ...teamPayload.responder_ids.map(id => 
            supabaseClient.from('team_responders').update({ role: roles[id] || null }).match({ team_id: data.team_id, responder_id: id })
          ),
          supabaseClient.from('responders').update({ status: 'Attached' }).in('responder_id', teamPayload.responder_ids)
        ]);
      }

      await recordAction(`Created team "${teamPayload.team_name_number}".`);
      await fetchDashboardData();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, operationalPeriodId, recordAction, fetchDashboardData]);

  const detachTeam = useCallback(async (teamId) => {
    try {
      setLoading(true);
      const { data: members } = await supabaseClient.from('team_responders').select('responder_id').eq('team_id', teamId);
      const responderIds = members?.map(m => m.responder_id) || [];

      await supabaseClient.from('assignments').update({ is_orphaned: true }).eq('team_id', teamId).not('status', 'in', '("Completed")');

      if (responderIds.length > 0) {
        await Promise.all([
          supabaseClient.from('responders').update({ status: 'Staged' }).in('responder_id', responderIds),
          supabaseClient.from('responder_team_history').update({ detached_datetime: new Date().toISOString() }).eq('team_id', teamId).is('detached_datetime', null)
        ]);
        if (responderId && responderIds.includes(responderId)) setResponderStatus('Staged');
      }

      await supabaseClient.from('teams').update({ status: 'Disbanded', last_par_check: null }).eq('team_id', teamId);
      await recordAction(`Disbanded team.`);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction, fetchDashboardData, responderId, setResponderStatus]);

  const attachResponderToTeam = useCallback(async (resId, teamId, role = null) => {
    try {
      setLoading(true);
      const { data: existing } = await supabaseClient.from('team_responders').select('team_id').match({ team_id: teamId, responder_id: resId }).maybeSingle();
      if (!existing) await assignResponderToTeam(supabaseClient, resId, teamId);
      await Promise.all([
        supabaseClient.from('responders').update({ status: 'Attached' }).eq('responder_id', resId),
        supabaseClient.from('team_responders').update({ role }).match({ team_id: teamId, responder_id: resId })
      ]);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData]);

  const detachResponderFromTeam = useCallback(async (resId, teamId) => {
    try {
      setLoading(true);
      await Promise.all([
        removeResponderFromTeam(supabaseClient, resId, teamId),
        supabaseClient.from('responders').update({ status: 'Staged' }).eq('responder_id', resId)
      ]);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData]);

  const updateTeam = useCallback(async (teamId, updates) => {
    try {
      setLoading(true);

      // Enforce uniqueness if the team name is being changed
      if (updates.team_name_number) {
        const { data: existing, error: checkError } = await supabaseClient
          .from('teams')
          .select('team_id, operational_periods!inner(incident_id)')
          .eq('team_name_number', updates.team_name_number.trim())
          .eq('operational_periods.incident_id', incidentId)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existing && existing.team_id !== teamId) {
          throw new Error(`A team named "${updates.team_name_number}" already exists in this incident.`);
        }
      }

      const { data, error } = await supabaseClient.from('teams').update(updates).eq('team_id', teamId).select().single();
      if (error) throw error;
      await recordAction(`Updated team details.`);
      await fetchDashboardData();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction, fetchDashboardData]);

  const deleteTeam = useCallback(async (teamId) => {
    try {
      setLoading(true);
      await supabaseClient.from('teams').delete().eq('team_id', teamId);
      await recordAction(`Deleted team record.`);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction, fetchDashboardData]);


  const updateTeamStatus = useCallback(async (teamId, newStatus) => {
    if (!teamId || !newStatus) throw new Error('Team ID and status are required');
    try {
      setLoading(true);
      let teamUpdatePayload = { status: newStatus };
      if (['Assigned', 'Deployed'].includes(newStatus)) {
        teamUpdatePayload.last_par_check = new Date().toISOString();
      } else {
        teamUpdatePayload.last_par_check = null;
      }
      const { error } = await supabaseClient.from('teams').update(teamUpdatePayload).eq('team_id', teamId);
      if (error) throw error;
      await recordAction(`Updated status of team to ${newStatus}`);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData, recordAction, setLoading, setError]);

  return { createTeam, detachTeam, attachResponderToTeam, detachResponderFromTeam, updateTeam, deleteTeam, updateTeamStatus };
};