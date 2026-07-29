// src/services/incidentService.js

import { ASSIGNMENT_STATUS, RESPONDER_STATUS, TEAM_STATUS } from '../utils/constants';

/**
 * Ends an incident, performing necessary cleanup of associated resources.
 * This function encapsulates the complex logic for incident termination,
 * including updating assignment statuses, disbanding teams, checking out responders,
 * and logging the action.
 *
 * @param {object} params - The parameters for ending the incident.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.incidentId - The ID of the incident to end.
 * @param {string} params.opPeriodId - The ID of the current operational period.
 * @param {string} params.responderName - The name of the responder initiating the action (for logging).
 * @param {function} params.endIncident - Function to update global incident context.
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {function} params.navigate - Function to navigate to another page.
 * @param {string} [params.currentIncidentId] - The ID of the currently active incident in the UI context (for AdminPage).
 * @param {function} [params.refreshDashboardData] - Function to refresh dashboard data (for AdminPage).
 */
export const endIncidentAndCleanup = async ({
  supabase,
  incidentId,
  opPeriodId,
  responderName,
  endIncident,
  addToast,
  navigate,
  currentIncidentId,
  refreshDashboardData,
}) => {
  if (!incidentId || !opPeriodId) {
    addToast('Incident ID or Operational Period ID is missing.', 'error');
    return;
  }

  try {
    // 1. Fetch counts of active assignments and responders to determine if cleanup is needed
    const [asnRes, resRes] = await Promise.all([
      supabase.from('assignments')
        .select('assignment_id, status')
        .eq('op_period_id', opPeriodId)
        .in('status', [ASSIGNMENT_STATUS.ASSIGNED, ASSIGNMENT_STATUS.DEPLOYED]),
      supabase.from('responders')
        .select('responder_id')
        .eq('incident_id', incidentId)
        .is('checkout_datetime', null)
    ]);

    const activeAssignments = asnRes.data || [];
    const activeResponders = resRes.data || [];

    // 2. Display confirmation and perform automated actions if resources are still active
    if (activeAssignments.length > 0 || activeResponders.length > 0) {
      const deployedCount = activeAssignments.filter(a => a.status === ASSIGNMENT_STATUS.DEPLOYED).length;
      const assignedCount = activeAssignments.filter(a => a.status === ASSIGNMENT_STATUS.ASSIGNED).length;

      const confirmMsg = `The incident has ${activeAssignments.length} active assignments and ${activeResponders.length} responders still checked in.\n\n` +
        `Would you like to automatically take the following actions?\n` +
        `- Mark ${deployedCount} Deployed assignments as ${ASSIGNMENT_STATUS.INCOMPLETE}\n` +
        `- Mark ${assignedCount} Assigned assignments as ${ASSIGNMENT_STATUS.PLANNED}\n` +
        `- Disband all teams in this operational period\n` +
        `- Check out all remaining responders\n` +
        `- Close the operational period and end incident tracking`;

      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    // 3. Update the incident end_datetime.
    // This triggers the 'cleanup_resources_on_incident_end' DB function which
    // automatically closes the OP and cleans up all active assignments, teams, and responders.
    const endTimestamp = new Date().toISOString();
    const { error: updateError } = await supabase.from('incidents').update({ end_datetime: endTimestamp }).eq('incident_id', incidentId);

    if (updateError) throw updateError;

    // Log incident end
    await supabase.from('action_logs').insert({
      incident_id: incidentId,
      action: `Incident ended. Automated cleanup of assignments, teams, and responders performed.`,
      user_name: responderName || 'Staff'
    });

    // Update global context if we ended the currently active incident
    if (incidentId === currentIncidentId) {
      endIncident(); // Reset global context state
    }

    addToast('Incident ended and resources cleaned up.', 'success');

    if (refreshDashboardData) {
      await refreshDashboardData();
    }

    if (navigate) {
      navigate('/checkin'); // Redirect to checkin page after ending incident
    }
  } catch (err) {
    console.error('Error ending incident:', err);
    addToast('Failed to end incident: ' + (err.message || 'Database error'), 'error');
    throw err; // Re-throw to allow calling component to handle loading state
  }
};

/**
 * Deletes an incident and all its associated data.
 * @param {object} params - The parameters for deleting the incident.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.incidentId - The ID of the incident to delete.
 * @param {string} params.incidentName - The name of the incident (for logging).
 * @param {function} params.recordAction - Function to record an action in the log.
 * @param {function} params.logout - Function to log out the current user (if the deleted incident was active).
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {string} [params.currentIncidentId] - The ID of the currently active incident in the UI context.
 * @param {function} [params.refreshDashboardData] - Function to refresh dashboard data.
 */
export const deleteIncident = async ({
  supabase,
  incidentId,
  incidentName,
  recordAction,
  logout,
  addToast,
  currentIncidentId,
  refreshDashboardData,
}) => {
  const message = 'Permanently delete this incident? This will remove all associated operational periods, assignments, teams, responders, and logs. This action cannot be undone.';
  if (!window.confirm(message)) return;

  try {
    // Log the intent to delete before the record and its associated logs are purged
    await recordAction?.(`Admin initiated permanent deletion of incident "${incidentName}" (ID: ${incidentId}).`);
    // Delete the incident record.
    // This will automatically cascade through operational_periods, teams,
    // assignments, action_logs, and clues due to PostgreSQL foreign key constraints.
    const { error: deleteError } = await supabase
      .from('incidents')
      .delete()
      .eq('incident_id', incidentId);

    if (deleteError) throw deleteError;
    // Update context if we deleted the current active session
    if (incidentId === currentIncidentId) {
      logout();
    }

    addToast('Incident and all associated data deleted.', 'success');

    if (refreshDashboardData) {
      await refreshDashboardData();
    }
  } catch (err) {
    console.error('Failed to delete incident:', err);
    addToast('Failed to delete incident: ' + err.message, 'error');
    throw err;
  }
};