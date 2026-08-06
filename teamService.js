/**
 * @file Centralized service for all team-related database operations.
 * This service uses RPC functions to ensure atomicity and consistency.
 */

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
    p_equipment: JSON.stringify(equipment || []),
    p_sartopo_color_hex: sartopoColorHex || '#FF0000',
    p_responder_ids: responderIds || [],
    p_responder_roles:  (responderRoles || {}),
    p_vehicle_ids: vehicleIds || []
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
  // Ensure equipment is stringified before sending to the database.
  if (teamData.equipment && Array.isArray(teamData.equipment)) {
    teamData.equipment = JSON.stringify(teamData.equipment);
  }

  // 1. Update core team metadata
  const { error: updError } = await supabase
    .from('teams')
    .update(teamData)
    .eq('team_id', teamId);
  if (updError) throw updError;

  // 2. Reconcile Memberships and Vehicles atomically using an RPC.
  const { error: rpcError } = await supabase.rpc('reconcile_team_resources', {
    p_team_id: teamId,
    p_responder_ids: responderIds || [],
    p_responder_roles: responderRoles || {},
    p_vehicle_ids: vehicleIds || []
  });

  if (rpcError) throw rpcError;
};