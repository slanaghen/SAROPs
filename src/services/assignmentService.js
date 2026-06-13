// src/services/assignmentService.js

import { v4 as uuidv4 } from 'uuid';
import { ASSIGNMENT_STATUS, TEAM_STATUS, RESPONDER_STATUS } from '../utils/constants';

/**
 * Saves (creates or updates) an assignment record.
 * @param {object} params - The parameters for saving the assignment.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {object} params.formData - The form data for the assignment.
 * @param {string} params.incidentId - The ID of the current incident.
 * @param {string} params.opPeriodId - The ID of the current operational period.
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {function} [params.createAssignmentHook] - The `createAssignment` function from `usePlanningDashboard` (for new assignments).
 * @param {function} [params.updateAssignmentHook] - The `updateAssignment` function from `usePlanningDashboard` (for existing assignments).
 * @returns {Promise<object|null>} The saved assignment object or null if an error occurs.
 */
export const saveAssignment = async ({
  supabase,
  formData,
  incidentId,
  opPeriodId,
  addToast,
  createAssignmentHook,
  updateAssignmentHook,
}) => {
  try {
    let finalTitle = formData.title?.trim();
    if (!finalTitle && !formData.assignment_id) { // Only auto-generate for new assignments if title is blank
      const division = formData.segment?.trim() || 'A';
      const { data: existingAssignments } = await supabase
        .from('assignments')
        .select('title')
        .eq('op_period_id', opPeriodId)
        .eq('segment', division);

      const usedSuffixes = new Set(
        (existingAssignments || [])
          .filter(a => a.title && a.title.startsWith(division))
          .map(a => a.title.slice(division.length))
          .filter(s => s && s.length === 1)
      );

      let nextSuffix = 'A';
      for (let i = 65; i <= 90; i++) {
        const s = String.fromCharCode(i);
        if (!usedSuffixes.has(s)) {
          nextSuffix = s;
          break;
        }
      }
      finalTitle = `${division}${nextSuffix}`;
    }

    const payload = {
      op_period_id: opPeriodId,
      title: finalTitle,
      status: formData.team_id ? ASSIGNMENT_STATUS.ASSIGNED : (formData.status || ASSIGNMENT_STATUS.PLANNED),
      segment: formData.segment || '',
      resource_type: formData.resource_type || '',
      team_size: formData.team_size ? parseInt(formData.team_size, 10) : null,
      frequency_primary: formData.frequency_primary || '',
      description: formData.description || '',
      probability_of_detection: formData.probability_of_detection ?? null,
      debrief_narrative: formData.debrief_narrative || '',
      team_id: formData.team_id || null,
      is_orphaned: formData.is_orphaned || false,
      priority: formData.priority || null,
      transportation: formData.transportation || null,
      time_allocated: formData.time_allocated || null,
      hazards: formData.hazards || null,
      prepared_by: formData.prepared_by || null,
    };

    if (formData.assignment_id) {
      if (updateAssignmentHook) {
        await updateAssignmentHook(formData.assignment_id, payload);
      } else {
        const { error: updateError } = await supabase
          .from('assignments')
          .update(payload)
          .eq('assignment_id', formData.assignment_id);
        if (updateError) throw updateError;
      }
      addToast(`Assignment ${finalTitle} updated successfully.`, 'success');
    } else {
      if (!opPeriodId) throw new Error("No active operational period found for the selected incident.");
      if (createAssignmentHook) {
        await createAssignmentHook(payload);
      } else {
        const { error: insertError } = await supabase.from('assignments').insert({ ...payload, assignment_id: uuidv4() });
        if (insertError) throw insertError;
      }
      addToast(`Assignment ${finalTitle} created.`, 'success');
    }
    return { ...payload, assignment_id: formData.assignment_id || uuidv4() };
  } catch (err) {
    console.error('Failed to save assignment:', err);
    addToast(err.message || 'Failed to save assignment.', 'error');
    throw err;
  }
};

/**
 * Deletes an assignment record.
 * @param {object} params - The parameters for deleting the assignment.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.assignmentId - The ID of the assignment to delete.
 * @param {string} params.assignmentName - The name of the assignment (for logging).
 * @param {function} [params.recordAction] - Function to record an action in the log.
 * @param {function} params.addToast - Function to display toast notifications.
 */
export const deleteAssignment = async ({ supabase, assignmentId, assignmentName, recordAction, addToast }) => {
  if (!window.confirm(`Are you sure you want to delete assignment "${assignmentName}"? This action cannot be undone.`)) return;
  try {
    const { error: deleteError } = await supabase.from('assignments').delete().eq('assignment_id', assignmentId);
    if (deleteError) throw deleteError;
    await recordAction?.(`Admin deleted assignment "${assignmentName}" (ID: ${assignmentId}).`);
    addToast('Assignment record deleted.', 'success');
  } catch (err) {
    console.error('Failed to delete assignment:', err);
    addToast('Failed to delete assignment: ' + err.message, 'error');
    throw err;
  }
};

/**
 * Updates the POD and debrief narrative for an assignment.
 * @param {object} params - The parameters for updating assignment data.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.assignmentId - The ID of the assignment to update.
 * @param {string} params.teamId - The ID of the team assigned to the assignment (for RLS).
 * @param {string} params.podValue - The probability of detection value.
 * @param {string} params.debriefValue - The debrief narrative.
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {function} params.refreshAllData - Function to refresh all dashboard data.
 */
export const updateAssignmentData = async ({ supabase, assignmentId, teamId, podValue, debriefValue, addToast, refreshAllData }) => {
  if (!assignmentId) return;
  const { data, error: updateErr } = await supabase
    .from('assignments')
    .update({
      probability_of_detection: podValue === '' ? null : parseInt(podValue, 10),
      debrief_narrative: debriefValue.trim()
    })
    .eq('assignment_id', assignmentId)
    .select();

  if (updateErr) throw updateErr;
  if (!data || data.length === 0) throw new Error('Update blocked: You must be a member of the assigned team to modify this assignment.');
  addToast('Mission data updated successfully.', 'success');
  refreshAllData?.();
  return data[0];
};

/**
 * Marks an assignment as 'Completed'.
 * @param {object} params - The parameters for completing the assignment.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.assignmentId - The ID of the assignment to complete.
 * @param {string} params.teamId - The ID of the team assigned to the assignment (for RLS).
 * @param {string} params.podValue - The probability of detection value.
 * @param {string} params.debriefValue - The debrief narrative.
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {function} params.refreshAllData - Function to refresh all dashboard data.
 * @param {function} params.setResponderStatus - Function to set the responder's global status.
 * @param {function} params.setCurrentTeamStatus - Function to set the current team's global status.
 * @param {function} params.setCurrentAssignmentStatus - Function to set the current assignment's global status.
 */
export const completeAssignment = async ({ supabase, assignmentId, teamId, podValue, debriefValue, addToast, refreshAllData, setResponderStatus, setCurrentTeamStatus, setCurrentAssignmentStatus }) => {
  if (!assignmentId) return;
  const { data: asnData, error: asnError } = await supabase
    .from('assignments')
    .update({
      status: ASSIGNMENT_STATUS.COMPLETED,
      probability_of_detection: podValue === '' ? null : parseInt(podValue, 10),
      debrief_narrative: debriefValue.trim()
    })
    .eq('assignment_id', assignmentId)
    .select();

  if (asnError) throw asnError;
  if (!asnData || asnData.length === 0) throw new Error('Completion blocked: You must be a member of the assigned team to complete this assignment.');
  setResponderStatus(RESPONDER_STATUS.STAGED);
  setCurrentTeamStatus(null);
  setCurrentAssignmentStatus(null);
  addToast('Assignment completed successfully.', 'success');
  refreshAllData?.();
};

/**
 * Marks an assignment as 'Incomplete'.
 * @param {object} params - The parameters for canceling the assignment.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.assignmentId - The ID of the assignment to cancel.
 * @param {string} params.teamId - The ID of the team assigned to the assignment (for RLS).
 * @param {string} params.podValue - The probability of detection value.
 * @param {string} params.debriefValue - The debrief narrative.
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {function} params.refreshAllData - Function to refresh all dashboard data.
 * @param {function} params.setResponderStatus - Function to set the responder's global status.
 * @param {function} params.setCurrentTeamStatus - Function to set the current team's global status.
 * @param {function} params.setCurrentAssignmentStatus - Function to set the current assignment's global status.
 */
export const cancelAssignment = async ({ supabase, assignmentId, teamId, podValue, debriefValue, addToast, refreshAllData, setResponderStatus, setCurrentTeamStatus, setCurrentAssignmentStatus }) => {
  if (!assignmentId) return;
  const { data: asnData, error: asnError } = await supabase
    .from('assignments')
    .update({
      status: ASSIGNMENT_STATUS.INCOMPLETE,
      probability_of_detection: podValue === '' ? null : parseInt(podValue, 10),
      debrief_narrative: debriefValue.trim()
    })
    .eq('assignment_id', assignmentId)
    .select();

  if (asnError) throw asnError;
  if (!asnData || asnData.length === 0) throw new Error('Action blocked: You must be a member of the assigned team to cancel this assignment.');
  setResponderStatus(RESPONDER_STATUS.STAGED);
  setCurrentTeamStatus(null);
  setCurrentAssignmentStatus(null);
  addToast('Assignment cancelled successfully.', 'success');
  refreshAllData?.();
};

/**
 * Deploys an assignment, setting its status to 'Deployed'.
 * @param {object} params - The parameters for deploying the assignment.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.assignmentId - The ID of the assignment to deploy.
 * @param {string} params.teamId - The ID of the team assigned to the assignment (for RLS).
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {function} params.refreshAllData - Function to refresh all dashboard data.
 * @param {function} params.setResponderStatus - Function to set the responder's global status.
 * @param {function} params.setCurrentTeamStatus - Function to set the current team's global status.
 * @param {function} params.setCurrentAssignmentStatus - Function to set the current assignment's global status.
 */
export const deployAssignment = async ({ supabase, assignmentId, teamId, addToast, refreshAllData, setResponderStatus, setCurrentTeamStatus, setCurrentAssignmentStatus }) => {
  if (!assignmentId) return;
  const { data: asnData, error: asnError } = await supabase
    .from('assignments')
    .update({ status: ASSIGNMENT_STATUS.DEPLOYED })
    .eq('assignment_id', assignmentId)
    .select();

  if (asnError) throw asnError;
  if (!asnData || asnData.length === 0) throw new Error('Deployment blocked: You do not have permission to update this assignment.');
  setResponderStatus(RESPONDER_STATUS.DEPLOYED);
  setCurrentTeamStatus(TEAM_STATUS.DEPLOYED);
  setCurrentAssignmentStatus(ASSIGNMENT_STATUS.DEPLOYED);
  addToast('Assignment deployed successfully.', 'success');
  refreshAllData?.();
};