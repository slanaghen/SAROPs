import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useIncident } from '../context/IncidentContext';
import { useToast } from '../context/ToastContext';

/**
 * A centralized hook for creating and updating team records and their related
 * responder and vehicle attachments.
 *
 * @param {object} supabase - The Supabase client instance.
 */
export const useTeamManagement = (supabase) => {
  const { incidentId, responderName } = useIncident();
  const { addToast } = useToast();

  const recordAction = useCallback(async (actionText) => {
    if (!incidentId) return;
    await supabase.from('action_logs').insert({
      incident_id: incidentId,
      action: actionText,
      user_name: responderName || 'System'
    });
  }, [incidentId, responderName, supabase]);

  const createTeam = useCallback(async (teamData) => {
    if (!incidentId) throw new Error("Cannot create team: No active incident context.");

    const { data: opData } = await supabase
      .from('operational_periods')
      .select('op_period_id')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!opData?.op_period_id) throw new Error("No active operational period found for this incident.");

    const newTeamId = uuidv4();
    const payload = {
      team_id: newTeamId,
      op_period_id: opData.op_period_id,
      team_name_number: teamData.team_name_number,
      sartopo_color_hex: teamData.sartopo_color_hex || '#FF0000',
      type: teamData.type,
      status: teamData.status || 'Staged',
      leader_responder_id: teamData.leader_responder_id || null,
      equipment: teamData.equipment || [],
    };

    const { error: insertError } = await supabase.from('teams').insert(payload);
    if (insertError) throw insertError;

    // Process initial membership and vehicle assignments
    const responderIds = teamData.responder_ids || [];
    const roles = teamData.responder_roles || {};
    if (responderIds.length > 0) {
      await supabase.from('team_responders').insert(
        responderIds.map(id => ({ team_id: newTeamId, responder_id: id, role: roles[id] || '' }))
      );
    }

    const vehicleIds = teamData.vehicle_ids || [];
    if (vehicleIds.length > 0) {
      await supabase.from('vehicles').update({ team_id: newTeamId }).in('vehicle_id', vehicleIds);
    }

    await recordAction(`Created team "${payload.team_name_number}" (Type: ${payload.type}).`);
    addToast(`Team "${payload.team_name_number}" created successfully.`, 'success');

    return { ...payload, team_id: newTeamId };
  }, [supabase, incidentId, recordAction, addToast]);

  const updateTeam = useCallback(async (teamId, teamData, originalResponderIds = [], originalVehicleIds = []) => {
    const payload = {
      team_name_number: teamData.team_name_number,
      sartopo_color_hex: teamData.sartopo_color_hex,
      type: teamData.type,
      status: teamData.status,
      leader_responder_id: teamData.leader_responder_id,
      equipment: teamData.equipment,
    };

    const { error: updateError } = await supabase.from('teams').update(payload).eq('team_id', teamId);
    if (updateError) throw updateError;

    // Reconcile Responders
    const finalResponderIds = teamData.responder_ids || [];
    const roles = teamData.responder_roles || {};
    const respondersToAdd = finalResponderIds.filter(id => !originalResponderIds.includes(id));
    const respondersToRemove = originalResponderIds.filter(id => !finalResponderIds.includes(id));
    const respondersToUpdate = finalResponderIds.filter(id => originalResponderIds.includes(id));

    await Promise.all([
      respondersToAdd.length > 0 && supabase.from('team_responders').insert(respondersToAdd.map(id => ({ team_id: teamId, responder_id: id, role: roles[id] || '' }))),
      respondersToRemove.length > 0 && supabase.from('team_responders').delete().eq('team_id', teamId).in('responder_id', respondersToRemove),
      ...respondersToUpdate.map(id => supabase.from('team_responders').update({ role: roles[id] || '' }).eq('team_id', teamId).eq('responder_id', id))
    ]);

    // Reconcile Vehicles
    const finalVehicleIds = teamData.vehicle_ids || [];
    const vehiclesToAdd = finalVehicleIds.filter(id => !originalVehicleIds.includes(id));
    const vehiclesToRemove = originalVehicleIds.filter(id => !finalVehicleIds.includes(id));

    await Promise.all([
      vehiclesToAdd.length > 0 && supabase.from('vehicles').update({ team_id: teamId }).in('vehicle_id', vehiclesToAdd),
      vehiclesToRemove.length > 0 && supabase.from('vehicles').update({ team_id: null }).in('vehicle_id', vehiclesToRemove)
    ]);

    await recordAction(`Updated team "${payload.team_name_number}".`);
    addToast(`Team "${payload.team_name_number}" updated successfully.`, 'success');

  }, [supabase, recordAction, addToast]);

  return { createTeam, updateTeam };
};