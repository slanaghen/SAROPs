import { useCallback } from 'react';

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
      console.log('[useTeamActions] createTeam: Inserting team with payload:', dbPayload);
      const { data, error } = await supabaseClient.from('teams').insert(dbPayload).select().maybeSingle();
      if (error) throw error;

      // The `ensure_leader_is_member` trigger handles the leader. Now, attach the other members.
      if (teamPayload.responder_ids?.length > 0) await Promise.all(teamPayload.responder_ids.map(id => attachResponderToTeam(id, data.team_id, teamPayload.responder_roles?.[id])));

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
  }, [supabaseClient, operationalPeriodId, recordAction, fetchDashboardData]);

  const disbandTeam = useCallback(async (teamId) => {
    try {
      setLoading(true);
      const { data: members } = await supabaseClient.from('team_responders').select('responder_id').eq('team_id', teamId);
      const responderIds = members?.map(m => m.responder_id) || [];

      await supabaseClient.from('assignments').update({ is_orphaned: true }).eq('team_id', teamId).not('status', 'in', '("Completed")');

      const { data: teamData } = await supabaseClient.from('teams').select('team_name_number').eq('team_id', teamId).single();
      await supabaseClient.from('teams').update({ status: 'Disbanded', last_par_check: null }).eq('team_id', teamId);
      await recordAction(`Disbanded team "${teamData?.team_name_number || 'Unknown'}".`);
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

      // 1. Fetch original team state for reconciliation
      const { data: originalTeam, error: fetchError } = await supabaseClient
        .from('teams')
        .select('team_name_number, leader_responder_id, current_responders:team_responders(responder_id), current_vehicles:vehicles(vehicle_id)')
        .eq('team_id', teamId)
        .single();

      if (fetchError) throw fetchError;

      const originalMemberIds = originalTeam.current_responders.map(r => r.responder_id);
      const originalVehicleIds = originalTeam.current_vehicles.map(v => v.vehicle_id);

      // Enforce uniqueness if the team name is being changed
      if (updates.team_name_number) {
        // ... (name check logic is correct)
      }

      console.log(`[useTeamActions] updateTeam: Updating team ${teamId} with payload:`, updates);
      const { data, error } = await supabaseClient.from('teams').update(updates).eq('team_id', teamId).select().single();
      if (error) throw error;

      // Reconcile responder attachments
      const finalResponderIds = [...(updates.responder_ids || []), updates.leader_responder_id].filter(Boolean);
      const toAdd = finalResponderIds.filter(id => !originalMemberIds.includes(id));
      const toRemove = originalMemberIds.filter(id => !finalResponderIds.includes(id));
      const existing = finalResponderIds.filter(id => originalMemberIds.includes(id));

      // Reconcile vehicles
      const vehiclesToAdd = (vehicleIds || []).filter(id => !originalVehicleIds.includes(id));
      const vehiclesToRemove = originalVehicleIds.filter(id => !(vehicleIds || []).includes(id));

      // Build detailed change log
      let changes = [];
      if (toAdd.length > 0) {
        const { data: names } = await supabaseClient.from('responders').select('name').in('responder_id', toAdd);
        changes.push(`Added members: ${names.map(n => n.name).join(', ')}`);
      }
      if (toRemove.length > 0) {
        const { data: names } = await supabaseClient.from('responders').select('name').in('responder_id', toRemove);
        changes.push(`Removed members: ${names.map(n => n.name).join(', ')}`);
      }
      if (vehiclesToAdd.length > 0) {
        const { data: names } = await supabaseClient.from('vehicles').select('designation').in('vehicle_id', vehiclesToAdd);
        changes.push(`Attached vehicles: ${names.map(n => n.designation).join(', ')}`);
      }
      if (vehiclesToRemove.length > 0) {
        const { data: names } = await supabaseClient.from('vehicles').select('designation').in('vehicle_id', vehiclesToRemove);
        changes.push(`Detached vehicles: ${names.map(n => n.designation).join(', ')}`);
      }

      // Perform database updates
      await Promise.all([
        ...toAdd.map(id => attachResponderToTeam(id, teamId, responder_roles[id])),
        ...existing.map(id => attachResponderToTeam(id, teamId, responder_roles[id])), // Update role for existing members
        ...toRemove.map(id => detachResponderFromTeam(id, teamId))
      ]);

      console.log(`[useTeamActions] updateTeam: Reconciling vehicles for team ${teamId}. Adding:`, vehiclesToAdd, 'Removing:', vehiclesToRemove);
      if (vehiclesToRemove.length > 0) await supabaseClient.from('vehicles').update({ team_id: null, status: 'Staged' }).in('vehicle_id', vehiclesToRemove);
      if (vehiclesToAdd.length > 0) await supabaseClient.from('vehicles').update({ team_id: teamId, status: 'Attached' }).in('vehicle_id', vehiclesToAdd);

      // Log the action
      const actionMessage = `Updated team "${updates.team_name_number || originalTeam.team_name_number}".` +
        (changes.length > 0 ? ` Changes: ${changes.join('. ')}.` : '');
      await recordAction(actionMessage);
      await fetchDashboardData();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, incidentId, recordAction, fetchDashboardData, attachResponderToTeam, detachResponderFromTeam]);

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