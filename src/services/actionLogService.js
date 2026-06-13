// src/services/actionLogService.js

/**
 * Adds a manual log entry to the action_logs table.
 * @param {object} params - The parameters for adding the log entry.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.incidentId - The ID of the current incident.
 * @param {string} params.action - The action description.
 * @param {string} params.userName - The name of the user performing the action.
 * @param {function} params.addToast - Function to display toast notifications.
 */
export const addLogEntry = async ({ supabase, incidentId, action, userName, addToast }) => {
  try {
    const { error: insertError } = await supabase
      .from('action_logs')
      .insert({
        incident_id: incidentId,
        action: action,
        user_name: userName
      });

    if (insertError) throw insertError;
  } catch (err) {
    throw new Error('Failed to add log entry: ' + err.message);
  }
};