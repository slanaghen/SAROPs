import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // Assuming this is the centralized Supabase client
import { useIncident } from '../context/IncidentContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment'; // The new hook
import { removeResponderFromTeam } from '../services/responderService';
import '../styles/ResponderDashboard.css'; // New CSS file for styling

/**
 * ResponderDashboardPage
 *
 * Displays the team information for the team the responder is attached to
 * and the assignment information for the assignment the responder's team is assigned to.
 */
const ResponderDashboardPage = ({ responderId: propId }) => {
  const { 
    responderId: contextId, 
    incidentId, 
    incidentData, 
    setResponderStatus,
    responderName,
    setCurrentTeamStatus,
    setCurrentAssignmentStatus,
    accessLevel 
  } = useIncident();
  const [responderId, setResponderId] = useState(propId || contextId);
  const [responders, setResponders] = useState([]);
  const [isLeavingTeam, setIsLeavingTeam] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [narratives, setNarratives] = useState({
    incidentNotes: '',
    opObjective: '',
    saNarrative: ''
  });
  const [parInterval, setParInterval] = useState(60);

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
          supabase.from('operational_periods').select('situation_narrative, situational_awareness_narrative, par_check_interval').eq('op_period_id', incidentData.opPeriodId).maybeSingle()
        ]);

        if (incRes.data || opRes.data) {
          setNarratives({
            incidentNotes: incRes.data?.notes || '',
            opObjective: opRes.data?.situation_narrative || '',
            saNarrative: opRes.data?.situational_awareness_narrative || ''
          });
          if (opRes.data?.par_check_interval !== undefined) setParInterval(opRes.data.par_check_interval);
        }
      } catch (err) {
        console.error('Error fetching narratives:', err);
      }
    };

    fetchIncidentDetails();
  }, [incidentId, incidentData?.opPeriodId]);

  const { team, assignment, loading, error, refetch } = useResponderTeamAndAssignment(supabase, responderId);

  const isLeader = useMemo(() => team && team.leader_responder_id === responderId, [team, responderId]);

  const fetchMessages = useCallback(async () => {
    if (!team?.team_id) return;
    const { data } = await supabase
      .from('team_messages')
      .select('*')
      .eq('team_id', team.team_id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [team?.team_id]);

  useEffect(() => {
    if (!team?.team_id || !isLeader) return;
    fetchMessages();
    const channel = supabase
      .channel(`team-msgs-${team.team_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `team_id=eq.${team.team_id}` }, 
        payload => setMessages(prev => {
          // Prevent duplicate if the local insert response arrived first
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [team?.team_id, isLeader, fetchMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !team?.team_id) return;

    const { data, error } = await supabase
      .from('team_messages')
      .insert({ 
        team_id: team.team_id, 
        sender_name: responderName, 
        message_text: messageText.trim() 
      })
      .select()
      .single();

    if (data && !error) {
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
      setMessageText('');
    }
  };

  // Periodically refresh data to detect status changes from Command (every 30s)
  useEffect(() => {
    if (!responderId) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [responderId, refetch]);

  const handleLeaveTeam = async () => {
    if (!team || !responderId) return;
    
    const msg = `Are you sure you want to leave team "${team.team_name_number}"? This will return you to "Staged" status.`;
    if (!window.confirm(msg)) return;

    setIsLeavingTeam(true);
    try {
      await removeResponderFromTeam(supabase, responderId, team.team_id);
      await refetch();
    } catch (err) {
      console.error('Error leaving team:', err);
      alert('Failed to leave team: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLeavingTeam(false);
    }
  };

  const [parRequired, setParRequired] = useState(false);
  const [timeSinceLastPar, setTimeSinceLastPar] = useState('');

  useEffect(() => {
    if (!team || !parInterval || team.status === 'Staged') {
      setParRequired(false);
      setTimeSinceLastPar('');
      return;
    }

    const checkPar = () => {
      const lastCheckMs = team.last_par_check ? new Date(team.last_par_check).getTime() : new Date(team.created_at || Date.now()).getTime();
      const now = Date.now();
      const diffMs = now - lastCheckMs;
      const minutesSince = diffMs / 60000;
      setParRequired(minutesSince >= parInterval);

      if (!team.last_par_check) {
        setTimeSinceLastPar('Never');
      } else {
        const totalMinutes = Math.floor(diffMs / 60000);
        if (totalMinutes < 1) {
          setTimeSinceLastPar('just now');
        } else if (totalMinutes < 60) {
          setTimeSinceLastPar(`${totalMinutes}m ago`);
        } else {
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          setTimeSinceLastPar(`${hours}h ${mins}m ago`);
        }
      }
    };

    checkPar();
    const timer = setInterval(checkPar, 15000); // Check every 15s
    return () => clearInterval(timer);
  }, [team, parInterval]);

  const handleParResponse = async (status) => {
    if (!team?.team_id) return;
    
    try {
      const { error } = await supabase
        .from('teams')
        .update({ 
          last_par_check: new Date().toISOString(),
          par_status: status 
        })
        .eq('team_id', team.team_id);

      if (error) throw error;
      refetch();
    } catch (err) {
      console.error('Error sending PAR:', err);
    }
  };

  const handleDeploy = async () => {
    if (!team?.team_id || !assignment?.assignment_id) return;
    
    try {
      const now = new Date().toISOString();
      
      // 1. Update assignment status
      const { error: asnError } = await supabase
        .from('assignments')
        .update({ status: 'Deployed' })
        .eq('assignment_id', assignment.assignment_id);
      
      if (asnError) throw asnError;

      // 2. Update team status and reset PAR timer
      const { error: teamError } = await supabase
        .from('teams')
        .update({ 
          status: 'Deployed', 
          last_par_check: now 
        })
        .eq('team_id', team.team_id);
      
      if (teamError) throw teamError;

      // 3. Cascade status to team members
      const { data: members } = await supabase
        .from('team_responders')
        .select('responder_id')
        .eq('team_id', team.team_id);
      
      const ids = members?.map(m => m.responder_id) || [];
      if (ids.length > 0) {
        await supabase.from('responders').update({ status: 'Deployed' }).in('responder_id', ids);
      }

      await refetch();
    } catch (err) {
      console.error('Error deploying assignment:', err);
    }
  };

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
      } else {
        // Revert to base status if no longer on a team
        setResponderStatus(accessLevel === 'command staff' ? 'Assigned' : 'Staged');
      }
      // Also update team and assignment status in context for App.jsx to listen
      setCurrentTeamStatus(team?.status || null);
      setCurrentAssignmentStatus(assignment?.status || null);
    }
  }, [team, assignment, loading, error, responderId, setResponderStatus, setCurrentTeamStatus, setCurrentAssignmentStatus, accessLevel]);

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

        {team.status !== 'Staged' && parInterval > 0 && (
          <div className={`par-integration ${parRequired ? 'par-required' : ''}`} style={{ 
            marginTop: '16px', 
            padding: '16px', 
            backgroundColor: parRequired ? '#fff7ed' : '#f8fafc',
            borderRadius: '8px',
            border: parRequired ? '2px solid #f59e0b' : '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '15px', marginBottom: '8px', marginTop: 0 }}>Status Check (PAR)</h3>
            {parRequired && (
              <div className="alert alert-warning" style={{ marginBottom: '12px', fontSize: '12px', padding: '8px' }}>
                <strong>Check-in Required!</strong> Please confirm your team's status.
              </div>
            )}
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              Last PAR Check: {timeSinceLastPar}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleParResponse('OK')} style={{ flex: 1 }}>
                PAR OK
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleParResponse('Contact me')} style={{ flex: 1, borderColor: '#f59e0b', color: '#d97706' }}>
                Contact Command
              </button>
            </div>
          </div>
        )}

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleLeaveTeam}
            disabled={isLeavingTeam || (assignment && assignment.status === 'Deployed')}
            style={{ marginTop: '12px', color: '#dc2626', borderColor: '#fecaca' }}
            title={assignment?.status === 'Deployed' ? "Cannot leave team while deployed" : "Remove yourself from this team"}
          >
            {isLeavingTeam ? 'Leaving...' : 'Leave Team'}
          </button>
        </div>
      )}

      {assignment && (
        <div className="dashboard-section assignment-info">
          <h2>Team Assignment: {assignment.name}</h2>
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
          {assignment.poa !== null && assignment.poa !== undefined && <p><strong>POA:</strong> {assignment.poa}%</p>}
          {assignment.pod !== null && assignment.pod !== undefined && <p><strong>POD:</strong> {assignment.pod}%</p>}
          {assignment.debrief_narrative && <p><strong>Debrief:</strong> {assignment.debrief_narrative}</p>}

          {isLeader && assignment.status === 'Assigned' && (
            <button 
              className="btn btn-primary" 
              onClick={handleDeploy}
              style={{ marginTop: '16px', width: '100%' }}
            >
              Deploy
            </button>
          )}
        </div>
      )}

      {team && (
        <div className="dashboard-section messaging-info">
          <h2>Team Leader Communications</h2>
          <div className="messages-container" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px', background: '#f1f5f9', padding: '12px', borderRadius: '6px' }}>
            {messages.length === 0 ? <p style={{ color: '#64748b', fontSize: '13px' }}>No messages yet.</p> : (
              messages.map((m, i) => (
                <div key={m.id || i} style={{ marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 700, color: m.sender_name === responderName ? '#2563eb' : '#475569' }}>{m.sender_name}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(m.created_at).toLocaleTimeString()}</span>
                  </div>
                  <span>{m.message_text}</span>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={messageText} 
              onChange={(e) => setMessageText(e.target.value)} 
              placeholder="Send message to Command..."
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <button type="submit" className="btn btn-primary btn-sm">Send</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ResponderDashboardPage;