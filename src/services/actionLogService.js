// src/services/actionLogService.js

/**
 * Records an action to the action_logs table. This is a fire-and-forget
 * operation; it logs errors to the console but does not throw them, as logging
 * is a non-critical background task.
 *
 * @param {object} params - The parameters for recording the action.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.incidentId - The ID of the current incident.
 * @param {string} params.action - The action description.
 * @param {string} params.userName - The name of the user performing the action.
 */
export const recordAction = async ({ supabase, incidentId, action, userName }) => {
  if (!incidentId || !userName || !action) {
    // Do not proceed if essential information is missing.
    return;
  }

  try {
    const { error } = await supabase.from('action_logs').insert({
        incident_id: incidentId,
        action: action,
        user_name: userName
    });

    if (error) {
      throw error;
    }
  } catch (err) {
    // Log the error but do not re-throw, as this is a non-critical background task.
    console.error('Failed to record action log:', err);
  }
};