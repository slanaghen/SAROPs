// src/services/teamService.js

import { v4 as uuidv4 } from 'uuid';
import { TEAM_STATUS, TEAM_TYPE } from '../utils/constants';

/**
 * Saves (creates or updates) a team record, including its members and vehicles.
 * This function handles the complex reconciliation logic for team composition.
 *
 * @param {object} params - The parameters for saving the team.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {object} params.formData - The form data for the team.
 * @param {string} params.incidentId - The ID of the current incident.
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {object} [params.editingTeam] - The original team data if editing an existing team.
 * @param {function} [params.createTeamHook] - The `createTeam` function from `usePlanningDashboard` (for new teams).
 * @param {function} [params.updateTeamHook] - The `updateTeam` function from `usePlanningDashboard` (for existing teams).
 * @returns {Promise<object|null>} The saved team object or null if an error occurs.
 */
export const saveTeam = async ({
  supabase,
  formData,
  incidentId,
  addToast,
  editingTeam,
  createTeamHook,
  updateTeamHook,
}) => {
  try {
    let finalTeamName = formData.team_name_number?.trim();
    if (!finalTeamName) {
      // Auto-generate team name if blank (logic from OperationsDashboardPage)
      const type = formData.type || TEAM_TYPE.OTHER;
      const { data: existingTeams } = await supabase
        .from('teams')
        .select('team_name_number')
        .eq('op_period_id', formData.op_period_id || incidentId); // Use op_period_id if available, otherwise incidentId

      let nextNum = (existingTeams || []).filter(t => t.team_name_number.startsWith(type)).length + 1;
      finalTeamName = `${type} ${nextNum}`;

      while ((existingTeams || []).some(t => t.team_name_number === finalTeamName)) {
        nextNum++;
        finalTeamName = `${type} ${nextNum}`;
      }
    }

    const payload = {
      team_name_number: finalTeamName,
      sartopo_color_hex: formData.sartopo_color_hex || '#FF0000',
      type: formData.type || TEAM_TYPE.OTHER,
      status: formData.status || TEAM_STATUS.STAGED,
      leader_responder_id: formData.leader_responder_id || null,
      equipment: formData.equipment || [],
    };

    // Ensure leader is included in responder_ids for consistency
    const currentResponders = formData.responder_ids || [];
    const finalResponderIds = (formData.leader_responder_id && !currentResponders.includes(formData.leader_responder_id))
      ? [...currentResponders, formData.leader_responder_id]
      : currentResponders;

    if (formData.team_id) {
      // Update existing team
      if (updateTeamHook) {
        await updateTeamHook(formData.team_id, { ...payload, responder_ids: finalResponderIds }, formData.responder_roles, formData.vehicle_ids);
      } else {
        const { error: updateError } = await supabase
          .from('teams')
          .update(payload)
          .eq('team_id', formData.team_id);
        if (updateError) throw updateError;

        // Reconcile responder attachments (Add/Remove/Update roles)
        const roles = formData.responder_roles || {};
        const originalIds = editingTeam?.current_responders?.map(r => r.responder_id) || [];

        const toAdd = finalResponderIds.filter(id => !originalIds.includes(id));
        const toRemove = originalIds.filter(id => !finalResponderIds.includes(id));
        const existing = finalResponderIds.filter(id => originalIds.includes(id));

        await Promise.all([
          ...toAdd.map(id => supabase.from('team_responders').insert({ team_id: formData.team_id, responder_id: id, role: roles[id] || '' })),
          ...existing.map(id => supabase.from('team_responders').update({ role: roles[id] || '' }).eq('team_id', formData.team_id).eq('responder_id', id)),
          ...toRemove.map(id => supabase.from('team_responders').delete().eq('team_id', formData.team_id).eq('responder_id', id))
        ]);

        // Reconcile vehicles
        const finalVehIds = formData.vehicle_ids || [];
        const originalVehIds = editingTeam?.current_vehicles?.map(v => v.vehicle_id) || [];

        const vehToAdd = finalVehIds.filter(id => !originalVehIds.includes(id));
        const vehToRemove = originalVehIds.filter(id => !finalVehIds.includes(id));

        await Promise.all([
          ...vehToAdd.map(id => supabase.from('vehicles').update({ team_id: formData.team_id }).eq('vehicle_id', id)),
          ...vehToRemove.map(id => supabase.from('vehicles').update({ team_id: null }).eq('vehicle_id', id))
        ]);
      }
      addToast(`Team ${finalTeamName} updated.`, 'success');
      return { ...formData, team_name_number: finalTeamName };
    } else {
      // Create new team
      if (!incidentId) throw new Error("Please join an incident context before creating a team.");

      const { data: opData } = await supabase
        .from('operational_periods')
        .select('op_period_id')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!opData?.op_period_id) throw new Error("No active operational period found for the selected incident.");

      if (createTeamHook) {
        const newTeam = await createTeamHook({ ...payload, responder_ids: finalResponderIds }, formData.responder_roles, formData.vehicle_ids);
        addToast(`Team ${finalTeamName} created.`, 'success');
        return newTeam;
      } else {
        const newTeamId = uuidv4();
        const { error: insertError } = await supabase.from('teams').insert({
          ...payload,
          team_id: newTeamId,
          op_period_id: opData.op_period_id
        });
        if (insertError) throw insertError;

        // Process initial membership assignments
        const roles = formData.responder_roles || {};
        if (finalResponderIds.length > 0) {
          await Promise.all(finalResponderIds.map(id =>
            supabase.from('team_responders').insert({
              team_id: newTeamId,
              responder_id: id,
              role: roles[id] || ''
            })
          ));
        }

        // Process initial vehicle assignments
        const finalVehIds = formData.vehicle_ids || [];
        if (finalVehIds.length > 0) {
          await supabase.from('vehicles').update({ team_id: newTeamId }).in('vehicle_id', finalVehIds);
        }
        addToast(`Team ${finalTeamName} created.`, 'success');
        return { ...payload, team_id: newTeamId, op_period_id: opData.op_period_id };
      }
    }
  } catch (err) {
    console.error('Failed to save team:', err);
    addToast(err.message || 'Failed to save team.', 'error');
    throw err;
  }
};

/**
 * Disbands a team, setting its status to 'Disbanded' and clearing PAR check.
 * This action is typically cascaded to responders via database triggers.
 * @param {object} params - The parameters for disbanding the team.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.teamId - The ID of the team to disband.
 * @param {string} params.teamName - The name of the team (for logging).
 * @param {string} [params.teamType] - The type of the team (for logging).
 * @param {function} [params.recordAction] - Function to record an action in the log.
 * @param {function} params.addToast - Function to display toast notifications.
 */
export const disbandTeam = async ({ supabase, teamId, teamName, teamType, recordAction, fetchDashboardData, addToast }) => {
  try {
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        status: TEAM_STATUS.DISBANDED,
        last_par_check: null // Clear PAR check when disbanded
      })
      .eq('team_id', teamId);

    if (updateError) throw updateError;

    await recordAction?.(`Admin disbanded team "${teamName}" (ID: ${teamId}, Type: ${teamType}). Fields modified: status="${TEAM_STATUS.DISBANDED}", last_par_check=null. Automated trigger: All members released to "${TEAM_STATUS.STAGED}".`);
    await fetchDashboardData?.();
    addToast('Team disbanded successfully.', 'success');
  } catch (err) {
    console.error('Failed to disband team:', err);
    addToast(err.message || 'Failed to disband team.', 'error');
    throw err;
  }
};

/**
 * Deletes a team record.
 * @param {object} params - The parameters for deleting the team.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.teamId - The ID of the team to delete.
 * @param {string} params.teamName - The name of the team (for logging).
 * @param {function} [params.recordAction] - Function to record an action in the log.
 * @param {function} params.addToast - Function to display toast notifications.
 */
export const deleteTeam = async ({ supabase, teamId, teamName, recordAction, fetchDashboardData, addToast }) => {
  try {
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('team_id', teamId);

    if (deleteError) throw deleteError;

    await recordAction?.(`Admin deleted team "${teamName}" (ID: ${teamId}).`);
    await fetchDashboardData?.();
    addToast('Team record deleted.', 'success');
  } catch (err) {
    console.error('Failed to delete team:', err);
    addToast('Failed to delete team: ' + err.message, 'error');
    throw err;
  }
};

/**
 * Resets the PAR (Personnel Accountability Report) timer for a given team.
 * @param {object} params - The parameters for resetting PAR.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.teamId - The ID of the team.
 * @param {string} [params.teamName] - The name of the team (for logging).
 * @param {string} params.status - The PAR status to set (e.g., 'OK').
 * @param {function} [params.recordAction] - Function to record an action in the log.
 * @param {function} params.fetchDashboardData - Function to refresh dashboard data.
 * @param {function} params.addToast - Function to display toast notifications.
 */
export const resetPar = async ({ supabase, teamId, teamName, status, recordAction, fetchDashboardData, addToast }) => {
  if (!teamId) return;

  try {
    const now = new Date().toISOString();
    const { data, error: resetErr } = await supabase
      .from('teams')
      .update({
        last_par_check: now,
        par_status: status
      })
      .eq('team_id', teamId)
      .select();

    if (resetErr) throw resetErr;
    if (!data || data.length === 0) throw new Error('PAR update blocked: You must be a member of the team to perform this action.');

    await recordAction?.(`Manual PAR reset for team "${teamName}" (ID: ${teamId}). Fields modified: last_par_check="${now}", par_status="${status}".`);
    await fetchDashboardData?.();
    addToast('PAR reset successfully.', 'success');
  } catch (err) {
    console.error('Error sending PAR:', err);
    addToast(err.message || 'Failed to reset PAR', 'error');
    throw err;
  }
};