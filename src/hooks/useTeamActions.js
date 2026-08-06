import { useCallback } from 'react';
import { createTeam as createTeamService, updateTeam as updateTeamService } from '../services/teamService';

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
  
  const createTeam = useCallback(async (teamPayload, responderRoles = {}, vehicleIds = []) => {
    try {
      setLoading(true);
      const teamName = (teamPayload.team_name_number || '').trim();

      const data = await createTeamService(supabaseClient, {
        opPeriodId: operationalPeriodId,
        incidentId: incidentId,
        teamName: teamName,
        type: teamPayload.type,
        leaderId: teamPayload.leader_responder_id,
        equipment: teamPayload.equipment,
        sartopoColorHex: teamPayload.sartopo_color_hex,
        responderIds: teamPayload.responder_ids,
        responderRoles: responderRoles,
        vehicleIds: vehicleIds
      });

      // Fetch fresh names from DB to ensure they are known before logging
      let membersInfo = '';
      if (teamPayload.responder_ids?.length) {
        const { data: nameData } = await supabaseClient
          .from('responders')
          .select('responder_id, name')
          .in('responder_id', teamPayload.responder_ids);

        membersInfo = teamPayload.responder_ids.map(id => {
          // Prioritize name from local responders list to ensure availability during logging
          const responder = responders?.find(r => r.responder_id === id) || nameData?.find(r => r.responder_id === id);
          const role = teamPayload.responder_roles?.[id];
          return `${responder?.name || 'Unknown'} (${role || 'Member'})`;
        }).join(', ');
      }

      let vehicleInfo = '';
      if (vehicleIds?.length > 0) {
        const { data: vehicleData } = await supabaseClient.from('vehicles').select('designation').in('vehicle_id', vehicleIds);
        if (vehicleData) {
          vehicleInfo = vehicleData.map(v => v.designation).join(', ');
        }
      }

      const actionMessage = `Created team "${teamPayload.team_name_number}" (Type: ${teamPayload.type}, Status: ${teamPayload.status}).` +
        (membersInfo ? ` Members: ${membersInfo}.` : '') +
        (vehicleInfo ? ` Vehicles: ${vehicleInfo}.` : '');
      await recordAction(actionMessage);
      await fetchDashboardData();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, operationalPeriodId, incidentId, recordAction, fetchDashboardData, setLoading, setError, responders]);

  const disbandTeam = useCallback(async (teamId) => {
    try {
      setLoading(true);
      const { data: members } = await supabaseClient.from('team_responders').select('responder_id').eq('team_id', teamId);
      const responderIds = members?.map(m => m.responder_id) || [];

      await supabaseClient.from('assignments').update({ is_orphaned: true }).eq('team_id', teamId).not('status', 'in', '("Completed")');

      const { data: teamData } = await supabaseClient.from('teams').select('team_name_number').eq('team_id', teamId).single();
      await supabaseClient.from('teams').update({ status: 'Disbanded', last_par_check: null }).eq('team_id', teamId);
      await recordAction(`Disbanded team "${teamData?.team_name_number || 'Unknown'}". All members returned to Staged.`);
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
      // This is now the single point of attachment. The database trigger `sync_responder_access_level`
      // will handle updating the responder's status to 'Attached' automatically.
      const { error } = await supabaseClient.from('team_responders').upsert(
        { team_id: teamId, responder_id: resId, role: role },
        { onConflict: 'team_id, responder_id' }
      );
      if (error) throw error;
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  const detachResponderFromTeam = useCallback(async (resId, teamId) => {
    try {
      setLoading(true);
      // This is the single point of detachment. The database trigger `sync_responder_access_level`
      // will handle updating the responder's status back to 'Staged' automatically.
      const { error } = await supabaseClient.from('team_responders').delete().match({ team_id: teamId, responder_id: resId });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  const updateTeam = useCallback(async (teamId, updates, responder_roles = {}, vehicleIds = []) => {
    try {
      setLoading(true);

      // The service handles the core update. This hook is now responsible for logging.
      const { responder_ids, ...coreTeamData } = updates;

      await updateTeamService(supabaseClient, {
        teamId,
        teamData: coreTeamData,
        responderIds: responder_ids,
        responderRoles: responder_roles,
        vehicleIds
      });

      // Simplified logging for brevity. A more detailed diff could be implemented here if needed.
      const { data: teamData } = await supabaseClient.from('teams').select('team_name_number').eq('team_id', teamId).single();

      // Build detailed change log
      let changes = [];
      if (responder_ids) {
        const { data: names } = await supabaseClient.from('responders').select('name').in('responder_id', responder_ids);
        changes.push(`Added members: ${names.map(n => n.name).join(', ')}`);
      }
      if (vehicleIds) {
        const { data: names } = await supabaseClient.from('vehicles').select('designation').in('vehicle_id', vehicleIds);
        changes.push(`Attached vehicles: ${names.map(n => n.designation).join(', ')}`);
      }

      // Log the action
      const actionMessage = `Updated team "${teamData?.team_name_number}".` +
        (changes.length > 0 ? ` Changes: ${changes.join('. ')}.` : '');
      await recordAction(actionMessage);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, incidentId, recordAction, fetchDashboardData, setLoading, setError]);

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
      const { data: teamData } = await supabaseClient.from('teams').select('team_name_number').eq('team_id', teamId).single();
      setLoading(true);
      let teamUpdatePayload = { status: newStatus };
      if (['Assigned', 'Deployed'].includes(newStatus)) {
        teamUpdatePayload.last_par_check = new Date().toISOString();
      } else {
        teamUpdatePayload.last_par_check = null;
      }
      const { error } = await supabaseClient.from('teams').update(teamUpdatePayload).eq('team_id', teamId);
      if (error) throw error;
      await recordAction(`Updated status of team "${teamData?.team_name_number || 'Unknown'}" to ${newStatus}.`);
      await fetchDashboardData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, fetchDashboardData, recordAction, setLoading, setError]);

  return { createTeam, disbandTeam, attachResponderToTeam, detachResponderFromTeam, updateTeam, deleteTeam, updateTeamStatus };
};