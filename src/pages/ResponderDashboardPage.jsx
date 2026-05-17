import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase'; // Assuming this is the centralized Supabase client
import { useIncident } from '../context/IncidentContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment'; // The new hook
import '../styles/ResponderDashboard.css'; // New CSS file for styling

/**
 * ResponderDashboardPage
 *
 * Displays the team information for the team the responder is attached to
 * and the assignment information for the assignment the responder's team is assigned to.
 */
const ResponderDashboardPage = ({ responderId: propId }) => {
  const { responderId: contextId, incidentId, incidentData, setResponderStatus } = useIncident();
  const [responderId, setResponderId] = useState(propId || contextId);
  const [responders, setResponders] = useState([]);
  const [narratives, setNarratives] = useState({
    incidentNotes: '',
    opObjective: '',
    saNarrative: ''
  });

  useEffect(() => {
    if (!responderId && contextId) {
      setResponderId(contextId);
    }
  }, [propId, contextId, responderId]);

  useEffect(() => {
    const fetchResponders = async () => {
      if (!incidentId) return;
      const { data } = await supabase
        .from('responders')
        .select('responder_id, name')
        .eq('incident_id', incidentId);
      if (data) {
        setResponders(data);
      }
    };
    fetchResponders();
  }, [incidentId]);

  useEffect(() => {
    const fetchIncidentDetails = async () => {
      if (!incidentId || !incidentData?.opPeriodId) return;

      try {
        const [incRes, opRes] = await Promise.all([
          supabase.from('incidents').select('notes').eq('incident_id', incidentId).maybeSingle(),
          supabase.from('operational_periods').select('situation_narrative, situational_awareness_narrative').eq('op_period_id', incidentData.opPeriodId).maybeSingle()
        ]);

        if (incRes.data || opRes.data) {
          setNarratives({
            incidentNotes: incRes.data?.notes || '',
            opObjective: opRes.data?.situation_narrative || '',
            saNarrative: opRes.data?.situational_awareness_narrative || ''
          });
        }
      } catch (err) {
        console.error('Error fetching narratives:', err);
      }
    };

    fetchIncidentDetails();
  }, [incidentId, incidentData?.opPeriodId]);

  const { team, assignment, loading, error, refetch } = useResponderTeamAndAssignment(supabase, responderId);

  const leaderById = useMemo(() => {
    const lookup = {};
    responders.forEach(r => {
      lookup[r.responder_id] = r.name;
    });
    return lookup;
  }, [responders]);

  // Sync context status with database reality found via the dashboard data
  useEffect(() => {
    if (!loading && !error && responderId && setResponderStatus) {
      if (assignment && assignment.status === 'Deployed') {
        setResponderStatus('Deployed');
      } else if (team) {
        setResponderStatus('Attached');
      }
    }
  }, [team, assignment, loading, error, responderId, setResponderStatus]);

  if (!responderId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>Please provide a Responder ID to view the dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        <p>Loading responder dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" style={{ margin: '16px' }}>
        <p><strong>Error:</strong> {error}</p>
        <button className="btn" onClick={refetch}>Retry Load</button>
      </div>
    );
  }

  return (
    <div className="responder-dashboard-page">
      <h1>Responder Dashboard</h1>

      {(narratives.incidentNotes || narratives.opObjective || narratives.saNarrative) && (
        <div className="dashboard-section narratives-info">
          <h2>Mission Overview</h2>
          {narratives.incidentNotes && <p><strong>Incident Narrative:</strong> {narratives.incidentNotes}</p>}
          {narratives.opObjective && <p><strong>OP Objective:</strong> {narratives.opObjective}</p>}
          {narratives.saNarrative && <p><strong>Situational Awareness:</strong> {narratives.saNarrative}</p>}
        </div>
      )}

      {!team && !assignment && (
        <div className="dashboard-section empty-state">
          <p>You are currently not attached to a team or your team is not assigned to an assignment.</p>
          <p>Please check in with incident command for your assignment.</p>
        </div>
      )}

      {team && (
        <div className="dashboard-section team-info">
          <h2>Your Team: {team.team_name_number}</h2>
          <p><strong>Type:</strong> {team.type}</p>
          <p>
            <strong>Status:</strong> 
            <span className={`status-indicator ${team.status?.toLowerCase()}`} style={{ marginLeft: '8px' }}>
              {team.status}
            </span>
          </p>
          {team.leader_responder_id && <p><strong>Leader Name:</strong> {leaderById[team.leader_responder_id] || 'Unknown'}</p>}
          {team.equipment && team.equipment.length > 0 && <p><strong>Equipment:</strong> {team.equipment.join(', ')}</p>}
        </div>
      )}

      {assignment && (
        <div className="dashboard-section assignment-info">
          <h2>Current Assignment: {assignment.name}</h2>
          <p>
            <strong>Status:</strong> 
            <span className={`status-indicator ${assignment.status?.toLowerCase()}`} style={{ marginLeft: '8px' }}>
              {assignment.status}
            </span>
          </p>
          {assignment.division && <p><strong>Division:</strong> {assignment.division}</p>}
          {assignment.assignment_type && <p><strong>Type:</strong> {assignment.assignment_type}</p>}
          {assignment.assignment_size && <p><strong>Size:</strong> {assignment.assignment_size}</p>}
          {assignment.tac_channel && <p><strong>TAC Channel:</strong> {assignment.tac_channel}</p>}
          {assignment.description_narrative && <p><strong>Description:</strong> {assignment.description_narrative}</p>}
        </div>
      )}
    </div>
  );
};

export default ResponderDashboardPage;