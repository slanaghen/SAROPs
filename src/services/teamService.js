// src/services/teamService.js

/**
 * Prepares a team object for editing by fetching and attaching its current members,
 * their roles, and any attached vehicles. This ensures the edit form is populated
 * with the complete, current state of the team.
 *
 * @param {object} supabase - The Supabase client instance.
 * @param {object} team - The team object to prepare for editing.
 * @returns {Promise<object>} The enriched team object ready for a form.
 * @throws {Error} If the team object is not provided.
 */
export const prepareTeamForEditing = async (supabase, team) => {
  if (!team || !team.team_id) {
    throw new Error("A valid team object with a team_id must be provided.");
  }

  const [membersRes, vehiclesRes] = await Promise.all([
    supabase.from('team_responders').select('responder_id, role').eq('team_id', team.team_id),
    supabase.from('vehicles').select('vehicle_id').eq('team_id', team.team_id)
  ]);

  const members = membersRes.data || [];
  const responderRoles = {};
  members.forEach(m => { responderRoles[m.responder_id] = m.role || ''; });

  return {
    ...team,
    responder_ids: members.map(m => m.responder_id),
    responder_roles: responderRoles,
    vehicle_ids: (vehiclesRes.data || []).map(v => v.vehicle_id)
  };
};