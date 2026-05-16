import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/OperationsDashboard.css';

const OperationsDashboardPage = ({ operationalPeriodId: propOpId }) => {
  const { incidentData } = useIncident();
  const operationalPeriodId = propOpId || incidentData?.opPeriodId;

  const [assignments, setAssignments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!operationalPeriodId) return;

      setLoading(true);
      setError(null);

      try {
        // Breaking the Promise.all chain to aid binder resolution
        const assignmentQuery = supabase.from('assignments').select('assignment_id,name,status,team_id,op_period_id');
        const teamQuery = supabase.from('teams').select('team_id,team_name_number,type,leader_responder_id,op_period_id');
        
        const [assignmentRes, teamRes] = await Promise.all([assignmentQuery, teamQuery]);

        const { data: assignmentData, error: assignmentError } = assignmentRes;
        const { data: teamData, error: teamError } = teamRes;

        if (assignmentError) throw assignmentError;
        if (teamError) throw teamError;

        setAssignments(assignmentData || []);
        setTeams(teamData || []);

        // Use explicit Set for unique IDs
        const leaderIdSet = new Set();
        (teamData || []).forEach(t => {
          if (t.leader_responder_id) leaderIdSet.add(t.leader_responder_id);
        });
        const uniqueLeaderIds = Array.from(leaderIdSet);

        if (uniqueLeaderIds.length > 0) {
          const respQuery = supabase.from('responders').select('responder_id,name').in('responder_id', uniqueLeaderIds);
          const { data: responderData, error: responderError } = await respQuery;
          
          if (responderError) throw responderError;
          setResponders(responderData || []);
        } else {
          setResponders([]);
        }
      } catch (opsFetchErr) {
        setError(opsFetchErr?.message || 'Failed to load operations summary');
        console.error('OperationsDashboard fetch error:', opsFetchErr);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [operationalPeriodId]);

  const leaderById = useMemo(() => {
    const leaderLookup = {};
    for (const r of responders) {
      if (r?.responder_id) {
        leaderLookup[r.responder_id] = r.name;
      }
    }
    return leaderLookup;
  }, [responders]);

  const teamById = useMemo(() => {
    const teamLookup = {};
    for (const t of teams) {
      if (t?.team_id) {
        teamLookup[t.team_id] = t;
      }
    }
    return teamLookup;
  }, [teams]);

  const rows = useMemo(() => {
    // Pre-calculate sets to avoid nested lookups in map
    const assignmentRows = (assignments || []).map(asnItem => {
      const matchingTeam = asnItem.team_id ? teamById[asnItem.team_id] : null;

      return {
        id: asnItem.assignment_id,
        assignmentName: asnItem.name,
        assignmentType: 'N/A',
        assignmentStatus: asnItem.status,
        teamName: matchingTeam?.team_name_number || '',
        teamType: matchingTeam?.type || '',
        teamLeader: matchingTeam ? leaderById[matchingTeam.leader_responder_id] || 'Unknown' : '',
        isAssignmentOnly: !matchingTeam,
      };
    });

    const assignmentTeamSet = new Set();
    (assignments || []).forEach(a => { if (a.team_id) assignmentTeamSet.add(a.team_id); });

    const teamOnlyRows = (teams || [])
      .filter(tItem => !assignmentTeamSet.has(tItem.team_id))
      .map(tItem => {
      return {
          id: tItem.team_id,
          assignmentName: '',
          assignmentType: '',
          assignmentStatus: '',
          teamName: tItem.team_name_number,
          teamType: tItem.type,
          teamLeader: leaderById[tItem.leader_responder_id] || 'Unknown',
          isAssignmentOnly: false,
      };
    });

    return [...assignmentRows, ...teamOnlyRows];
  }, [assignments, teams, teamById, leaderById]);

  const totalAssignments = assignments.length;
  const totalTeams = teams.length;
  const totalRows = rows.length;

  return (
    <div className="operations-dashboard">
      <header className="operations-header">
        <div>
          <h1>Operations Dashboard</h1>
          <p>Summary of all assignments and teams in the current operational period.</p>
        </div>
        <div className="summary-pill">
          <span>{totalRows} total rows</span>
          <span>{totalAssignments} assignments</span>
          <span>{totalTeams} teams</span>
        </div>
      </header>

      {loading && (
        <div className="operations-message">Loading operations summary…</div>
      )}

      {error && (
        <div className="operations-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="operations-table-wrapper">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Assignment Name</th>
                <th>Assignment Type</th>
                <th>Assignment Status</th>
                <th>Team Name</th>
                <th>Team Type</th>
                <th>Team Leader</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">
                    No assignments or teams found for this operational period.
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  <td>{row.assignmentName || '—'}</td>
                  <td>{row.assignmentType || '—'}</td>
                  <td>{row.assignmentStatus || '—'}</td>
                  <td>{row.teamName || '—'}</td>
                  <td>{row.teamType || '—'}</td>
                  <td>{row.teamLeader || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OperationsDashboardPage;
