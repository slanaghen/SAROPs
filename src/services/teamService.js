import { TEAM_STATUS } from '../constants/operationalConstants';

/**
 * Prepares a team object for editing by fetching and attaching related responders and vehicles.
 * @param {object} supabase - The Supabase client instance.
 * @param {object} team - The initial team object.
 * @returns {Promise<object>} The team object augmented with responder and vehicle IDs and roles.
 */
export const prepareTeamForEditing = async (supabase, team) => {
  if (!team || !team.team_id) {
    throw new Error('A valid team object with a team_id must be provided.');
  }

  const [membersRes, vehiclesRes] = await Promise.all([
    supabase.from('team_responders').select('responder_id, role').eq('team_id', team.team_id),
    supabase.from('vehicles').select('vehicle_id').eq('team_id', team.team_id),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (vehiclesRes.error) throw vehiclesRes.error;

  const responder_ids = membersRes.data.map(m => m.responder_id);
  const responder_roles = membersRes.data.reduce((acc, m) => {
    acc[m.responder_id] = m.role;
    return acc;
  }, {});
  const vehicle_ids = vehiclesRes.data.map(v => v.vehicle_id);

  return {
    ...team,
    responder_ids,
    responder_roles,
    vehicle_ids,
  };
};

/**
 * Creates a new team and attaches specified responders and vehicles.
 *
 * @param {object} supabase - The Supabase client.
 * @param {object} params - The parameters for team creation.
 * @param {string} params.opPeriodId - The operational period ID.
 * @param {string} params.incidentId - The incident ID.
 * @param {string} params.teamName - The name of the team.
 * @param {string} params.type - The team type (e.g., 'Ground').
 * @param {string} [params.leaderId] - The ID of the team leader.
 * @param {string[]} [params.equipment] - An array of equipment strings.
 * @param {string} [params.sartopoColorHex] - The hex color for SARTopo.
 * @param {string[]} [params.responderIds] - IDs of responders to attach.
 * @param {object} [params.responderRoles] - A map of responderId -> role.
 * @param {string[]} [params.vehicleIds] - IDs of vehicles to attach.
 * @returns {Promise<object>} The newly created team data.
 */
export const createTeam = async (supabase, { opPeriodId, incidentId, teamName, type, leaderId, equipment, sartopoColorHex, responderIds, responderRoles, vehicleIds }) => {
  if (!teamName) throw new Error("Team name is required.");

  const { data, error } = await supabase.rpc('create_team_with_resources', {
    p_op_period_id: opPeriodId,
    p_incident_id: incidentId,
    p_team_name_number: teamName,
    p_type: type,
    p_leader_responder_id: leaderId,
    p_equipment: equipment || [],
    p_sartopo_color_hex: sartopoColorHex || '#FF0000',
    p_responder_ids: (responderIds && responderIds.length > 0) ? responderIds : '{}',
    p_responder_roles: responderRoles instanceof Map ? Object.fromEntries(responderRoles) : (responderRoles || {}),
    p_vehicle_ids: (vehicleIds && vehicleIds.length > 0) ? vehicleIds : '{}'
  });

  if (error) throw error;
  return data;
};

/**
 * Updates an existing team's metadata and reconciles its members and vehicles.
 *
 * @param {object} supabase - The Supabase client.
 * @param {object} params - The parameters for the update.
 * @param {string} params.teamId - The ID of the team to update.
 * @param {object} params.teamData - The core team data to update (name, type, etc.).
 * @param {string[]} [params.responderIds] - The final list of responder IDs for the team.
 * @param {object} [params.responderRoles] - A map of responderId -> role.
 * @param {string[]} [params.vehicleIds] - The final list of vehicle IDs for the team.
 */
export const updateTeam = async (supabase, { teamId, teamData, responderIds, responderRoles, vehicleIds }) => {
  // 1. Update core team metadata. equipment is sent as a plain array: teams.equipment
  // is JSONB, so PostgREST serializes it correctly on its own. JSON.stringify-ing it
  // here would double-encode it into a JSON string *scalar* stored inside the jsonb
  // column (e.g. the literal text '["Radio","GPS"]') instead of a real array,
  // breaking every consumer that expects to call .join()/.map() on it.
  const { error: updError } = await supabase
    .from('teams')
    .update(teamData)
    .eq('team_id', teamId);
  if (updError) throw updError;

  // 2. Reconcile Memberships and Vehicles atomically using an RPC.
  const { error: rpcError } = await supabase.rpc('reconcile_team_resources', {
    p_team_id: teamId,
    p_responder_ids: (responderIds && responderIds.length > 0) ? responderIds : '{}',
    p_responder_roles: responderRoles instanceof Map ? Object.fromEntries(responderRoles) : (responderRoles || {}),
    p_vehicle_ids: (vehicleIds && vehicleIds.length > 0) ? vehicleIds : '{}'
  });

  if (rpcError) throw rpcError;
};

/**
 * Disbands a team, updating its status and releasing its members.
 * @param {object} params - The parameters for disbanding the team.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.teamId - The ID of the team to disband.
 * @param {string} params.teamName - The name of the team.
 * @param {string} params.teamType - The type of the team.
 * @param {function} params.recordAction - Function to log the action.
 * @param {function} params.addToast - Function to display a toast notification.
 * @param {function} params.refreshDashboardData - Function to refresh dashboard data.
 */
export const disbandTeam = async ({
  supabase,
  teamId,
  teamName,
  teamType,
  recordAction,
  addToast,
  refreshDashboardData,
}) => {
  try {
    const { error: updateError } = await supabase
      .from('teams')
      .update({ 
        status: TEAM_STATUS.DISBANDED,
        last_par_check: null // Clear PAR check when disbanded
      })
      .eq('team_id', teamId);

    if (updateError) throw updateError;

    await recordAction?.(`Admin disbanded team "${teamName}" (ID: ${teamId}, Type: ${teamType}). Fields modified: status="Disbanded", last_par_check=null. Automated trigger: All members released to "Staged".`);
    
    addToast('Team disbanded.', 'success');
    refreshDashboardData?.();
  } catch (err) {
    addToast('Failed to disband team: ' + err.message, 'error');
    throw err;
  }
};