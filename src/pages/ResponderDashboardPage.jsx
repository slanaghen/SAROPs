import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
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
    responderName,
    accessLevel 
  } = useIncident();
  const responderId = propId || contextId;
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
  const [sartopoId, setSartopoId] = useState(null);
  const [podValue, setPodValue] = useState('');
  const [debriefValue, setDebriefValue] = useState('');
  const [isUpdatingAsnData, setIsUpdatingAsnData] = useState(false);
  const [icsRole, setIcsRole] = useState(null);

  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapError, setMapError] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // This hook must be called before any useMemos or useEffects that depend on 'team' or 'assignment'
  const { team, assignment, loading, error, refetch } = useResponderTeamAndAssignment(supabase, responderId); 

  // Section Collapsibility State
  const [isExpanded, setIsExpanded] = useState({
    narratives: true,
    team: true,
    assignment: true,
    messages: true
  });

  // Keep a live clock for timer displays and overdue calculations
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Memoized PAR status and time formatting to ensure visual parity with Operations page
  const { parRequired, timeSinceLastPar } = useMemo(() => {
    if (!team || !parInterval) {
      return { parRequired: false, timeSinceLastPar: '' };
    }

    const lastCheckMs = team.last_par_check 
      ? new Date(team.last_par_check).getTime() 
      : new Date(team.created_at || Date.now()).getTime();
    
    const diffMs = currentTime - lastCheckMs;
    const minutesSince = diffMs / 60000;

    // Same logic as OperationsDashboard: parInterval + 3 min grace. Staged and Staff teams are exempt.
    const required = team.status !== 'Staged' && team.type !== 'Staff' && parInterval > 0 && minutesSince > (parInterval + 3);

    let displayTime = 'Never';
    if (team.last_par_check) {
      const totalMinutes = Math.floor(diffMs / 60000);
      if (totalMinutes < 1) displayTime = 'just now';
      else if (totalMinutes < 60) displayTime = `${totalMinutes}m ago`;
      else {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        displayTime = `${hours}h ${mins}m ago`;
      }
    }

    return { parRequired: required, timeSinceLastPar: displayTime };
  }, [team, parInterval, currentTime]);
  
  const lastMessageCountRef = useRef(0);
  const prevTeamId = useRef(null);
  const prevAsnId = useRef(null);
  const prevIcsRole = useRef(null);

  // Trigger: Force open Team section if PAR is overdue
  useEffect(() => {
    if (parRequired) setIsExpanded(prev => ({ ...prev, team: true }));
  }, [parRequired]);

  // Trigger: Force open Messages if unread messages arrive
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      setIsExpanded(prev => ({ ...prev, messages: true }));
    }
    if (isExpanded.messages) {
      lastMessageCountRef.current = messages.length;
    }
  }, [messages.length, isExpanded.messages]);

  // Trigger: Force open if sections are newly added
  useEffect(() => {
    if (team?.team_id && team.team_id !== prevTeamId.current) {
      setIsExpanded(prev => ({ ...prev, team: true }));
    }
    prevTeamId.current = team?.team_id;

    if (assignment?.assignment_id && assignment.assignment_id !== prevAsnId.current) {
      setIsExpanded(prev => ({ ...prev, assignment: true }));
    }
    prevAsnId.current = assignment?.assignment_id;

    if (icsRole && icsRole !== prevIcsRole.current) {
      setIsExpanded(prev => ({ ...prev, assignment: true }));
    }
    prevIcsRole.current = icsRole;
  }, [team?.team_id, assignment?.assignment_id, icsRole]);

  // Real-time subscription to detect team assignments and status changes immediately
  useEffect(() => {
    if (!responderId) return;

    const channel = supabase
      .channel(`responder-team-sync-${responderId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'team_responders', 
        filter: `responder_id=eq.${responderId}` 
      }, (payload) => {
        console.log('📡 Team membership change detected:', payload.eventType);
        refetch();
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'responders', 
        filter: `responder_id=eq.${responderId}` 
      }, (payload) => {
        console.log('📡 Responder status change detected:', payload.new.status);
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [responderId, refetch]);

  // Real-time subscription to detect changes to the team itself (like Command resetting PAR)
  useEffect(() => {
    if (!team?.team_id) return;

    const channel = supabase
      .channel(`responder-team-data-sync-${team.team_id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'teams', 
        filter: `team_id=eq.${team.team_id}` 
      }, () => {
        console.log('📡 Team data change detected (e.g. PAR reset)');
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [team?.team_id, refetch]);

  useEffect(() => {
    const fetchResponders = async () => {
      if (!incidentId) return;
      const { data } = await supabase
        .from('responders')
        .select('responder_id, name, agency')
        .eq('incident_id', incidentId);
      if (Array.isArray(data)) {
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
          supabase.from('incidents').select('notes, sartopo_id').eq('incident_id', incidentId).maybeSingle(),
          supabase.from('operational_periods').select('situation_narrative, situational_awareness_narrative, par_check_interval').eq('op_period_id', incidentData.opPeriodId).maybeSingle()
        ]);

        if (incRes.data || opRes.data) {
          setNarratives({
            incidentNotes: incRes.data?.notes || '',
            opObjective: opRes.data?.situation_narrative || '',
            saNarrative: opRes.data?.situational_awareness_narrative || ''
          });
          if (incRes.data?.sartopo_id) setSartopoId(incRes.data.sartopo_id);
          if (opRes.data?.par_check_interval !== undefined) setParInterval(opRes.data.par_check_interval);
        }
      } catch (err) {
        console.error('Error fetching narratives:', err);
      }
    };

    fetchIncidentDetails();
  }, [incidentId, incidentData?.opPeriodId]);

  // Fetch ICS Role for command staff
  useEffect(() => {
    const fetchIcsRole = async () => {
      if ((accessLevel === 'command staff' || accessLevel === 'admin') && incidentId && responderId) {
        const { data } = await supabase
          .from('team_responders')
          .select('role, teams!inner(type)')
          .eq('teams.type', 'Staff')
          .eq('responder_id', responderId)
          .maybeSingle();
        if (data) setIcsRole(data.role);
      } else {
        setIcsRole(null);
      }
    };
    fetchIcsRole();
  }, [accessLevel, incidentId, responderId]);

  const isLeader = useMemo(() => team && team.leader_responder_id === responderId, [team, responderId]);

  useEffect(() => {
    if (assignment) {
      setPodValue(assignment.probability_of_detection !== null && assignment.probability_of_detection !== undefined ? String(assignment.probability_of_detection) : '');
      setDebriefValue(assignment.debrief_narrative || '');
    }
  }, [assignment]);

  const fetchMessages = useCallback(async () => {
    if (!team?.team_id) return;
    const { data } = await supabase
      .from('team_messages')
      .select('*')
      .eq('team_id', team.team_id)
      .order('created_at', { ascending: true });
    if (Array.isArray(data)) setMessages(data);
  }, [team?.team_id]);

  useEffect(() => {
    if (!team?.team_id || !isLeader) return;
    fetchMessages();
    const channel = supabase
      .channel(`team-msgs-${team.team_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `team_id=eq.${team.team_id}` }, 
        payload => setMessages(prev => {
          const current = Array.isArray(prev) ? prev : [];
          // Prevent duplicate if the local insert response arrived first
          if (current.some(m => m.id === payload.new.id)) return current;
          return [...current, payload.new];
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
      setMessages(prev => {
        const current = Array.isArray(prev) ? prev : [];
        return current.some(m => m.id === data.id) ? current : [...current, data];
      });
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
    
    // Safety guard: Team Leaders cannot leave while the team is deployed
    if (isLeader && (team.status === 'Deployed' || assignment?.status === 'Deployed')) {
      alert("As the Team Leader, you cannot leave your team while it is deployed to the field. Please complete your assignment or return to base first.");
      return;
    }

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

  const handleParResponse = async (status) => {
    if (!team?.team_id) return;
    
    try {
      const { data, error } = await supabase
        .from('teams')
        .update({ 
          last_par_check: new Date().toISOString(),
          par_status: status 
        })
        .eq('team_id', team.team_id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('PAR update blocked: You must be the Team Leader to perform this action.');
      refetch();
    } catch (err) {
      console.error('Error sending PAR:', err);
    }
  };

  const handleUpdateAssignmentData = async () => {
    if (!assignment?.assignment_id) return;
    
    setIsUpdatingAsnData(true);
    try {
      const { data, error: updateErr } = await supabase
        .from('assignments')
        .update({ 
          probability_of_detection: podValue === '' ? null : parseInt(podValue, 10),
          debrief_narrative: debriefValue.trim()
        })
        .eq('assignment_id', assignment.assignment_id)
        .select();

      if (updateErr) throw updateErr;
      if (!data || data.length === 0) throw new Error('Update blocked: You are not authorized to modify this assignment.');
      await refetch();
    } catch (err) {
      console.error('Error updating mission data:', err);
      alert('Failed to update mission data: ' + err.message);
    } finally {
      setIsUpdatingAsnData(false);
    }
  };

  const handleCompleteAssignment = async () => {
    if (!team?.team_id || !assignment?.assignment_id) return;
    
    setIsUpdatingAsnData(true);
    try {
      const now = new Date().toISOString();
      
      // 1. Update assignment: status -> Completed, team_id -> null, and save final mission results
      const { data: asnData, error: asnError } = await supabase
        .from('assignments')
        .update({ 
          status: 'Completed',
          probability_of_detection: podValue === '' ? null : parseInt(podValue, 10),
          debrief_narrative: debriefValue.trim()
        })
        .eq('assignment_id', assignment.assignment_id)
        .select();
      
      if (asnError) throw asnError;
      if (!asnData || asnData.length === 0) throw new Error('Completion blocked: Unauthorized assignment update.');

      // 2. Update team status to Disbanded (standard terminal state to release resources)
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .update({
          status: 'Disbanded', 
          last_par_check: null // Clear PAR check when disbanded
        })
        .eq('team_id', team.team_id)
        .select();
      
      if (teamError) throw teamError;
      if (!teamData || teamData.length === 0) throw new Error('Completion blocked: Unauthorized team update.');

      // 3. Cascade status to team members (return to Staged) and close history
      const { data: members, error: membersErr } = await supabase.from('team_responders').select('responder_id').eq('team_id', team.team_id);
      if (membersErr) throw membersErr;
      
      const ids = members?.map(m => m.responder_id) || [];
      if (ids.length > 0) {
        const { data: respData, error: respErr } = await supabase.from('responders').update({ status: 'Staged' }).in('responder_id', ids).select();
        if (respErr) throw respErr;
        
        const { error: histErr } = await supabase.from('responder_team_history').update({ detached_datetime: now }).eq('team_id', team.team_id).is('detached_datetime', null).select();
        if (histErr) throw histErr;
      }

      await refetch();
    } catch (err) {
      console.error('Error completing assignment:', err);
      alert('Failed to complete assignment: ' + err.message);
    } finally {
      setIsUpdatingAsnData(false);
    }
  };

  const handleDeploy = async () => {
    if (!team?.team_id || !assignment?.assignment_id) return;
    
    try {
      const now = new Date().toISOString();
      
      // 1. Update assignment status
      const { data: asnData, error: asnError } = await supabase
        .from('assignments')
        .update({ status: 'Deployed' })
        .eq('assignment_id', assignment.assignment_id)
        .select();
      
      if (asnError) throw asnError;
      if (!asnData || asnData.length === 0) throw new Error('Deployment blocked: You do not have permission to update this assignment.');

      // 2. Update team status and reset PAR timer
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .update({ 
          status: 'Deployed', 
          last_par_check: now 
        })
        .eq('team_id', team.team_id)
        .select();
      
      if (teamError) throw teamError;
      if (!teamData || teamData.length === 0) throw new Error('Deployment blocked: You do not have permission to update this team.');

      // 3. Cascade status to team members
      const { data: members, error: membersErr } = await supabase
        .from('team_responders')
        .select('responder_id')
        .eq('team_id', team.team_id);
      
      if (membersErr) throw membersErr;
      
      const ids = members?.map(m => m.responder_id) || [];
      if (ids.length > 0) {
        const { error: cascadeError } = await supabase.from('responders').update({ status: 'Deployed' }).in('responder_id', ids).select();
        if (cascadeError) throw cascadeError;
      }

      await refetch();
    } catch (err) {
      console.error('Error deploying assignment:', err);
      alert('Deployment failed: ' + (err.message || 'Permission denied'));
    }
  };

  const leaderById = useMemo(() => {
    const lookup = {};
    responders.forEach(r => {
      lookup[r.responder_id] = r.name;
    });
    return lookup;
  }, [responders]);

  const responderDisplayName = useMemo(() => {
    const r = responders.find(res => res.responder_id === responderId);
    if (!r) return responderName;
    return `${r.name}${r.agency ? ` (${r.agency})` : ''}`;
  }, [responders, responderId, responderName]);

  // Debug log to verify session IDs match database records
  useEffect(() => {
    if (responderId) {
      console.debug(`📊 Dashboard session: responderId=${responderId}, currentTeam=${team?.team_id || 'none'}`);
    }
  }, [responderId, team?.team_id]);

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
        <button className="btn" onClick={refetch} style={{ fontSize: '18px' }}>Retry Load</button>
      </div>
    );
  }

  const SectionHeader = ({ title, sectionKey, showBadge }) => (
    <div 
      onClick={() => setIsExpanded(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
    >
      <h2 style={{ margin: 0, border: 'none', padding: 0, fontSize: '18px' }}>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {showBadge}
        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
          {isExpanded[sectionKey] ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="responder-dashboard-page">
      <h1 style={{ marginBottom: '16px' }}>Responder Dashboard</h1>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left Content Panel */}
        <div style={{ flex: '1 1 0', minWidth: '400px' }}>

      {(narratives.incidentNotes || narratives.opObjective || narratives.saNarrative) && (
        <div className="dashboard-section narratives-info" style={{ marginBottom: '16px' }}>
          <SectionHeader title="Mission Overview" sectionKey="narratives" />
          {isExpanded.narratives && (
            <div style={{ marginTop: '10px' }}>
              {narratives.incidentNotes && <p><strong>Incident Narrative:</strong> {narratives.incidentNotes}</p>}
              {narratives.opObjective && <p><strong>OP Objective:</strong> {narratives.opObjective}</p>}
              {narratives.saNarrative && <p><strong>Situational Awareness:</strong> {narratives.saNarrative}</p>}
            </div>
          )}
        </div>
      )}

      {!team && !assignment && accessLevel === 'responder' && (
        <div className="dashboard-section empty-state">
          <p>You are currently not attached to a team or your team is not assigned to an assignment.</p>
          <p>Please check in with incident command for your assignment.</p>
        </div>
      )}

      {(team || accessLevel === 'command staff' || accessLevel === 'admin') && (
        <div className="dashboard-section team-info">
          <SectionHeader
            title={accessLevel === 'command staff' || accessLevel === 'admin' ? 'Staff Status' : `Your Team: ${team?.team_name_number}`} 
            sectionKey="team" 
            showBadge={parRequired && (
              <span 
                className="status-indicator incomplete" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  backgroundColor: '#dc2626', 
                  color: 'white', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '9px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                {timeSinceLastPar}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </span>
            )}
          />

          {isExpanded.team && (
            <div style={{ marginTop: '10px' }}>
              {accessLevel === 'command staff' || accessLevel === 'admin' ? (
                <div className="staff-status-card" style={{ padding: '24px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🛡️</div>
                  <h3 style={{ color: '#0369a1', marginBottom: '8px' }}>{icsRole ? icsRole.toUpperCase() : 'Staff'}</h3>
                  {icsRole && (
                    <p style={{ color: '#0c4a6e', fontSize: '14px', marginBottom: '16px' }}>
                      You are assigned as the {icsRole} for this incident.
                    </p>
                  )}
                  <button className="btn btn-primary" style={{ width: '100%', fontSize: '18px' }} onClick={() => window.location.href = '/operations'}>
                    Go to Operations Dashboard
                  </button>
                </div>
              ) : team && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Type</label>
                      <div style={{ fontSize: '15px', fontWeight: 500 }}>{team.type}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Status</label>
                      <span className={`status-indicator ${team.status?.toLowerCase()}`}>
                        {team.status}
                      </span>
                    </div>
                    {team.leader_responder_id && (
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                          {team.type === 'Staff' ? 'Incident Commander' : 'Leader Name'}
                        </label>
                        <div style={{ fontSize: '15px', fontWeight: 500 }}>{leaderById[team.leader_responder_id] || 'Unknown'}</div>
                      </div>
                    )}
                  </div>
                  
                  {team.equipment && team.equipment.length > 0 && <p><strong>Equipment:</strong> {team.equipment.join(', ')}</p>}

                  {team.status !== 'Staged' && team.type !== 'Staff' && parInterval > 0 && (
                    <div className={`par-integration ${parRequired ? 'par-required' : ''}`} style={{ marginTop: '16px', padding: '16px', backgroundColor: parRequired ? '#fff7ed' : '#f8fafc', borderRadius: '8px', border: parRequired ? '2px solid #f59e0b' : '1px solid #e2e8f0' }}>
                      <h3 style={{ fontSize: '15px', marginBottom: '8px', marginTop: 0 }}>Status Check (PAR)</h3>
                      {parRequired && <div className="alert alert-warning" style={{ marginBottom: '12px', fontSize: '12px', padding: '8px' }}><strong>Check-in Required!</strong> Please confirm your team's status.</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Last PAR Check:</span>
                        {parRequired ? (
                          <span 
                            className="status-indicator incomplete" 
                            onClick={() => handleParResponse('OK')}
                            title="Click to reset PAR"
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              backgroundColor: '#dc2626', 
                              color: 'white', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              cursor: 'pointer'
                            }}
                          >
                            {timeSinceLastPar}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{timeSinceLastPar}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" onClick={() => handleParResponse('OK')} style={{ flex: 1, fontSize: '18px' }}>PAR OK</button>
                        <button className="btn btn-secondary" onClick={() => handleParResponse('Contact me')} style={{ flex: 1, borderColor: '#f59e0b', color: '#d97706', fontSize: '18px' }}>Contact Command</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {team && !isLeavingTeam && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handleLeaveTeam}
                  disabled={isLeavingTeam || (team.status === 'Deployed' || assignment?.status === 'Deployed')}
                  style={{ marginTop: '12px', color: '#dc2626', borderColor: '#fecaca', fontSize: '18px' }}
                  title={(team.status === 'Deployed' || assignment?.status === 'Deployed') ? "Cannot leave team while deployed" : "Remove yourself from this team"}
                >
                  {isLeavingTeam ? 'Leaving...' : 'Leave Team'}
                </button>
              )}
              </div>
          )}
        </div>
      )}

      {(assignment || accessLevel === 'command staff' || accessLevel === 'admin') && (
        <div className="dashboard-section assignment-info">
          <SectionHeader
            title={accessLevel === 'command staff' || accessLevel === 'admin' ? 'ICS Chart' : `Team Assignment: ${assignment?.title}`} 
            sectionKey="assignment" 
          />
          {isExpanded.assignment && (
            <div style={{ marginTop: '10px' }}>
              {accessLevel === 'command staff' || accessLevel === 'admin' ? (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '24px' }}>📋</div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Current Position</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>{icsRole ? icsRole.toUpperCase() : 'General Staff'}</div>
                    <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>{responderDisplayName}</div>
                  </div>
                </div>
              ) : assignment && (
                <>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Status</label>
              <span className={`status-indicator ${assignment.status?.toLowerCase()}`}>
                {assignment.status}
              </span>
            </div>
            {assignment.segment && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Division</label>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>{assignment.segment}</div>
              </div>
            )}
            {assignment.resource_type && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Assignment Type</label>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>{assignment.resource_type}</div>
              </div>
            )}
            {assignment.team_size && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Size</label>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>{assignment.team_size}</div>
              </div>
            )}
            {assignment.frequency_primary && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>TAC Channel</label>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>{assignment.frequency_primary}</div>
              </div>
            )}
          </div>

          {assignment.description && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Description</label>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>{assignment.description}</p>
            </div>
          )}

          {assignment.status === 'Deployed' && (
            <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
              <div className="form-row">
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>POD (Probability of Detection %)</label>
                {isLeader ? (
                  <input 
                    type="number" 
                    value={podValue} 
                    onChange={e => setPodValue(e.target.value)} 
                    min="0" max="100"
                    placeholder="0-100"
                    style={{ width: '100px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                ) : (
                  <span>{assignment.probability_of_detection !== null && assignment.probability_of_detection !== undefined ? `${assignment.probability_of_detection}%` : '—'}</span>
                )}
              </div>

              <div className="form-row" style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Debrief Narrative</label>
                {isLeader ? (
                  <textarea 
                    value={debriefValue} 
                    onChange={e => setDebriefValue(e.target.value)}
                    placeholder="Enter findings, tracks, or completion notes..."
                    style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                ) : (
                  <p style={{ margin: 0, fontSize: '13px' }}>{assignment.debrief_narrative || '—'}</p>
                )}
              </div>

              {isLeader && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleUpdateAssignmentData}
                    disabled={isUpdatingAsnData}
                    style={{ width: '100%', fontSize: '18px' }}
                  >
                    {isUpdatingAsnData ? 'Saving...' : 'Save Mission Data'}
                  </button>

                  <button 
                    className="btn btn-primary" 
                    onClick={handleCompleteAssignment}
                    disabled={isUpdatingAsnData || podValue === '' || !debriefValue.trim()}
                    style={{ width: '100%', backgroundColor: '#059669', borderColor: '#059669', fontSize: '18px' }}
                  >
                    {isUpdatingAsnData ? 'Completing...' : 'Complete Assignment'}
                  </button>
                </div>
              )}

            </div>
          )}

          {isLeader && assignment.status === 'Assigned' && team && (
            <button 
              className="btn btn-primary" 
              onClick={handleDeploy}
              style={{ marginTop: '16px', width: '100%', fontSize: '18px' }}
            >
              Deploy
            </button>
          )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {team && (
        <div className="dashboard-section messaging-info">
          <SectionHeader 
            title="Team Leader Communications" 
            sectionKey="messages" 
            showBadge={messages.length > lastMessageCountRef.current && <span className="status-indicator active" style={{ fontSize: '9px' }}>NEW</span>}
          />
          {isExpanded.messages && (
            <div style={{ marginTop: '10px' }}>
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
            <button type="submit" className="btn btn-primary" style={{ fontSize: '18px' }}>Send</button>
          </form>
            </div>
          )}
        </div>
      )}
        </div>

        {/* Right Map Panel */}
        <div style={{ flex: 1, minWidth: '400px' }}>
          <div style={{ 
            borderRadius: '12px', 
            overflow: 'hidden', 
            border: '1px solid #cbd5e1', 
            boxShadow: '0 6px 22px rgba(0, 0, 0, 0.04)', 
            background: '#fff', 
            height: '650px', 
            position: 'relative' 
          }}>
            {mapError ? (
              <div className="map-fallback" style={{ 
                height: '100%', 
                width: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                background: '#f1f5f9',
                backgroundImage: 'url("https://placehold.co/600x400/e2e8f0/64748b?text=Boulder,+CO+Static+Preview")',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}>
                <div style={{ 
                  background: 'rgba(255,255,255,0.9)', 
                  padding: '20px', 
                  borderRadius: '8px', 
                  textAlign: 'center',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  border: '1px solid #e2e8f0',
                  maxWidth: '80%'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                  <h4 style={{ margin: '0 0 8px', color: '#1e293b' }}>Interactive Map Unavailable</h4>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    This is a static preview. To enable the live operations map, please configure a valid <strong>Google Maps API Key</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div ref={mapContainer} style={{ height: '100%', width: '100%', background: '#f1f5f9' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponderDashboardPage;