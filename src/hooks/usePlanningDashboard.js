import { useState, useCallback, useMemo } from 'react';
import { useIncident } from '../context/IncidentContext';
import { updateResponderStatus as updateResponderStatusService } from '../services/responderService';
import { useAssignmentActions } from './useAssignmentActions';
import { useTeamActions } from './useTeamActions';
import { useIncidentStats } from './useIncidentStats';
import { useResponderActions } from './useResponderActions';

/**
 * usePlanningDashboard Hook
 * 
 * Manages state and operations for the Planning Dashboard component.
 * Handles:
 * - Fetching staged teams and available assignments for an operational period
 * - Updating assignment-to-team mappings
 * - Error handling and loading states
 */
export const usePlanningDashboard = (supabaseClient, operationalPeriodId) => {
  const [teams, setTeams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [responders, setResponders] = useState([]);
  const [opPeriod, setOpPeriod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizeAssignment = useCallback((assignment) => {
    if (!assignment) return null;
    return {
      ...assignment,
      title: assignment.title || 'Untitled Assignment',
      segment: assignment.segment || '',
      resource_type: assignment.resource_type || '',
      team_size: assignment.team_size || 0,
      frequency_primary: assignment.frequency_primary || '',
      description: assignment.description || '',
      debrief_narrative: assignment.debrief_narrative || '',
      probability_of_detection: (
        assignment.probability_of_detection !== undefined && 
        assignment.probability_of_detection !== null && 
        assignment.probability_of_detection !== ''
      ) ? Number(assignment.probability_of_detection) : null,
      priority: assignment.priority || 'Medium',
      hazards: assignment.hazards || '',
      team_name: assignment.team_name || ''
    };
  }, []);

  const { incidentId, responderName, user, responderId, setResponderStatus } = useIncident();
  const userName = responderName || user?.email || 'System';

  /**
   * Helper to automatically log database changes
   */
  const recordAction = useCallback(async (action) => {
    if (!incidentId) return;
    await supabaseClient.from('action_logs').insert({
      incident_id: incidentId,
      action,
      user_name: userName
    });
  }, [supabaseClient, incidentId, userName]);

  /**
   * Fetch all data needed for the Planning Dashboard
   */
  const fetchDashboardData = useCallback(async () => {
    if (!operationalPeriodId) return;

    setLoading(true);
    setError(null);

    try {
      const [teamsRes, assignmentsRes, respondersRes, opRes] = await Promise.all([
        supabaseClient.from('teams').select('*, current_responders:team_responders(responder_id, role)').eq('op_period_id', operationalPeriodId),
        supabaseClient.from('assignments').select('*').eq('op_period_id', operationalPeriodId),
        supabaseClient.from('responders').select('*, access_level').eq('incident_id', incidentId), // Restrict to current incident
        supabaseClient.from('operational_periods').select('*, incidents(*)').eq('op_period_id', operationalPeriodId).maybeSingle()
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (respondersRes.error) throw respondersRes.error;
      if (opRes.error) throw opRes.error;

      setTeams(Array.isArray(teamsRes.data) ? teamsRes.data : []);
      setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data.map(normalizeAssignment) : []);
      setResponders(Array.isArray(respondersRes.data) ? respondersRes.data : []);
      setOpPeriod(opRes.data || null);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [operationalPeriodId, supabaseClient, incidentId]);

  const assignmentActions = useAssignmentActions({
    supabaseClient, operationalPeriodId, assignments, teams, responderId, recordAction,
    fetchDashboardData, setAssignments, setTeams, setLoading, setError, setResponderStatus, normalizeAssignment
  });

  const teamActions = useTeamActions({
    supabaseClient, operationalPeriodId, incidentId, teams, responders, responderId, recordAction,
    fetchDashboardData, setLoading, setError, setResponderStatus
  });

  const responderActions = useResponderActions({
    supabaseClient, recordAction, fetchDashboardData, 
    setLoading, setError
  });

  const stats = useIncidentStats(teams, assignments, responders);

  return {
    // State
    teams,
    assignments,
    responders,
    opPeriod,
    loading,
    error,
    setError,
    setLoading,
    stats,

    // Methods
    fetchDashboardData,
    ...assignmentActions,
    ...teamActions,
    ...responderActions,
    updateResponderStatus: updateResponderStatusService, // Expose service function

    // Computed
    stagedTeams: (Array.isArray(teams) ? teams : []).filter(t => t?.status === 'Staged'),
    availableAssignments: (Array.isArray(assignments) ? assignments : []).filter(a => !a?.team_id && !a?.is_orphaned),
    availableResponders: (Array.isArray(responders) ? responders : []).filter(r => String(r?.status || '').toLowerCase() === 'staged'),
  };
};

export default usePlanningDashboard;
