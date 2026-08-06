import React, { useState, useEffect } from 'react';
import { useIncident } from '../context/IncidentContext';
import { supabase } from '../lib/supabase';
// Assuming some styling will be created for the chart
import '../styles/IcsChartPage.css';

const IcsPosition = ({ title, name, agency }) => (
  <div className="ics-box">
    <div className="ics-title">{title}</div>
    <div className="ics-name">{name || 'Unassigned'}</div>
    {name && agency && <div className="ics-agency">{agency}</div>}
  </div>
);

const IcsChartPage = () => {
  const { incidentData } = useIncident();
  const [icsData, setIcsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIcsData = async () => {
      console.log('[ICS Chart] Fetch effect triggered. opPeriodId:', incidentData?.opPeriodId);
      if (!incidentData?.opPeriodId) {
        setError('No active operational period selected.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: staffTeam, error: teamError } = await supabase
          .from('teams')
          .select('team_id, leader_responder_id') // Explicitly select the leader ID
          .eq('op_period_id', incidentData.opPeriodId)
          .eq('type', 'Staff')
          .single();

        if (teamError) throw teamError;
        if (!staffTeam) {
          throw new Error('No Staff team found for this operational period.');
        }

        const assignments = {};

        // 1. Fetch the Incident Commander directly via the leader_responder_id
        if (staffTeam.leader_responder_id) {
          console.log('[ICS Chart] Staff team has a leader_responder_id:', staffTeam.leader_responder_id);
          const { data: leaderData, error: leaderError } = await supabase
            .from('responders')
            .select('name, agency')
            .eq('responder_id', staffTeam.leader_responder_id)
            .single();
          
          if (leaderError) throw leaderError;
          if (leaderData) {
            assignments.incidentCommander = { name: leaderData.name, agency: leaderData.agency };
          }
        } else {
          console.warn('[ICS Chart] Staff team record does not have a leader_responder_id set.');
        }

        const { data: members, error: membersError } = await supabase
          .from('team_responders')
          .select('role, responders(name, agency)')
          .eq('team_id', staffTeam.team_id);

        if (membersError) throw membersError;

        // Fallback: If no leader was found via leader_responder_id, check the members list for the role.
        if (!assignments.incidentCommander) {
          const icMember = (members || []).find(m => m.role === 'Incident Commander');
          if (icMember?.responders) {
            assignments.incidentCommander = icMember.responders;
          }
        }

        const roleToStateKey = {
          'Operations Section Chief': 'operationsChief',
          'Planning Section Chief': 'planningChief',
          'Logistics Section Chief': 'logisticsChief',
          'Mapper': 'mapper',
          'Safety Officer': 'safety',
          'Public Information Officer': 'pio',
          'Liaison Officer': 'liaison',
          'Finance/Admin Section Chief': 'admin'
        };

        // Populate the rest of the command staff roles
        (members || []).forEach(member => {
          const stateKey = roleToStateKey[member.role];
          if (stateKey && member.responders) {
            assignments[stateKey] = member.responders;
          }
        });
        
        setIcsData(assignments);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching ICS data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchIcsData();
  }, [incidentData?.opPeriodId]);

  if (loading) {
    return <div className="ics-chart-page"><h1>Incident Command Structure</h1><p>Loading Chart Data...</p></div>;
  }

  if (error) {
    return <div className="ics-chart-page"><h1>Incident Command Structure</h1><p style={{ color: 'red' }}>Error: {error}</p></div>;
  }

  return (
    <div className="ics-chart-page">
      <h1>Incident Command Structure</h1>
      <div className="ics-chart">
        <div className="ics-row ics-top">
          <IcsPosition title="Incident Commander" name={icsData.incidentCommander?.name} agency={icsData.incidentCommander?.agency} />
        </div>
        <div className="ics-connector-down" />
        <div className="ics-row ics-command">
          <IcsPosition title="Safety Officer" name={icsData.safety?.name} agency={icsData.safety?.agency} />
          <IcsPosition title="PIO" name={icsData.pio?.name} agency={icsData.pio?.agency} />
          <IcsPosition title="Liaison" name={icsData.liaison?.name} agency={icsData.liaison?.agency} />
        </div>
        <div className="ics-connector-down" />
        <div className="ics-divider-horizontal" />
        <div className="ics-connector-vertical-group">
          <div className="ics-connector-vertical"></div>
          <div className="ics-connector-vertical"></div>
          <div className="ics-connector-vertical"></div>
          <div className="ics-connector-vertical"></div>
        </div>
        <div className="ics-row ics-general">
          <div className="ics-section">
            <IcsPosition title="Operations Section Chief" name={icsData.operationsChief?.name} agency={icsData.operationsChief?.agency} />
          </div>
          <div className="ics-section">
            <IcsPosition title="Planning Section Chief" name={icsData.planningChief?.name} agency={icsData.planningChief?.agency} />
            <div className="ics-connector-down-short" />
            <div className="ics-unit">
              <IcsPosition title="Mapper" name={icsData.mapper?.name} agency={icsData.mapper?.agency} />
            </div>
          </div>
          <div className="ics-section">
            <IcsPosition title="Logistics Section Chief" name={icsData.logisticsChief?.name} agency={icsData.logisticsChief?.agency} />
          </div>
          <div className="ics-section">
            <IcsPosition title="Finance/Admin Section Chief" name={icsData.admin?.name} agency={icsData.admin?.agency} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IcsChartPage;