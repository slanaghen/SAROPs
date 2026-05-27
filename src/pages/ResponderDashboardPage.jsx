import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase'; // Assuming this is the centralized Supabase client
import { useIncident } from '../context/IncidentContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment'; // The new hook
import { removeResponderFromTeam } from '../services/responderService';
import { RESPONDER_REFRESH_INTERVAL } from '../components/operationalConstants';
import OperationsMap from '../components/OperationsMap';
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
    accessLevel,
    setResponderStatus,
    currentTeamStatus,
    currentAssignmentStatus,
    setCurrentTeamStatus,
    setCurrentAssignmentStatus
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
  const [parInterval, setParInterval] = useState(0);
  const [sartopoId, setSartopoId] = useState(null);
  const [podValue, setPodValue] = useState('');
  const [debriefValue, setDebriefValue] = useState('');
  const [isUpdatingAsnData, setIsUpdatingAsnData] = useState(false);
  const [icsRole, setIcsRole] = useState(null);
  const [staffTeamId, setStaffTeamId] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // This hook must be called before any useMemos or useEffects that depend on 'team' or 'assignment'
  const { team, assignment, loading, error, refetch } = useResponderTeamAndAssignment(supabase, responderId); 

  // Section Collapsibility State
  const [isExpanded, setIsExpanded] = useState({
    narratives: true,
    team: true,
    assignment: true,
    messages: true,
    map: false
  });

  // Resolve the Staff team ID to enable directed messaging to Incident Command
  useEffect(() => {
    const fetchStaffTeamId = async () => {
      if (!incidentData?.opPeriodId) return;
      const { data } = await supabase
        .from('teams')
        .select('team_id')
        .eq('op_period_id', incidentData.opPeriodId)
        .eq('type', 'Staff')
        .neq('status', 'Disbanded')
        .maybeSingle();
      if (data) setStaffTeamId(data.team_id);
    };
    fetchStaffTeamId();
  }, [incidentData?.opPeriodId]);

  const messagingChannelId = team?.team_id;

  // Keep a live clock for timer displays and overdue calculations
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Memoized PAR status and time formatting to ensure visual parity with Operations page
  const { parRequired, timeSinceLastPar } = useMemo(() => {
    const lastCheck = team?.last_par_check || team?.created_at;
    if (!team || !parInterval || !lastCheck) {
      return { parRequired: false, timeSinceLastPar: '' };
    }

    const lastCheckMs = new Date(lastCheck).getTime();
    if (isNaN(lastCheckMs)) return { parRequired: false, timeSinceLastPar: '—' };
    
    const diffMs = currentTime - lastCheckMs;
    const minutesSince = diffMs / 60000;

    // Same logic as OperationsDashboard: parInterval + 3 min grace. Staged, Disbanded, and Staff teams are exempt.
    const required = team.status !== 'Staged' && team.status !== 'Disbanded' && team.type !== 'Staff' && parInterval > 0 && minutesSince > (parInterval + 3);

    const totalMinutes = Math.floor(diffMs / 60000);
    let displayTime = 'just now';
    if (totalMinutes >= 1 && totalMinutes < 60) displayTime = `${totalMinutes}m ago`;
    else if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      displayTime = `${hours}h ${mins}m ago`;
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

  /**
   * Refreshes dashboard data.
   * Note: The built-in real-time listener in the hook handles most updates automatically.
   */
  const refreshAllData = useCallback(() => {
    refetch();
  }, [refetch]);

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
          .select('role, teams!inner(type, status)')
          .eq('teams.type', 'Staff')
          .neq('teams.status', 'Disbanded')
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
    if (!messagingChannelId) return;

    const isStaff = accessLevel === 'command staff' || accessLevel === 'admin';
    let query = supabase.from('team_messages').select('*');

    if (isStaff && incidentData?.opPeriodId) {
      // For Staff Dashboard: Aggregate all team messages in the OP for master awareness
      query = query
        .select('*, teams!inner(op_period_id)')
        .eq('teams.op_period_id', incidentData.opPeriodId);
    } else {
      // For Responders: Fetch messages for my team plus any broadcasts from Staff
      const targetIds = [messagingChannelId];
      if (staffTeamId) targetIds.push(staffTeamId);
      query = query.in('team_id', targetIds);
    }

    const { data } = await query.order('created_at', { ascending: true });
    if (Array.isArray(data)) setMessages(data);
  }, [messagingChannelId, staffTeamId, accessLevel, incidentData?.opPeriodId]);

  useEffect(() => {
    if (!messagingChannelId) return;
    setMessages([]); // Clear previous channel messages during transition
    fetchMessages();
    const channel = supabase
      .channel(`responder-msgs-${messagingChannelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, 
        payload => {
          const msg = payload.new;
          const isStaff = accessLevel === 'command staff' || accessLevel === 'admin';
          
          // Logic: Staff Dashboard accepts all team messages. 
          // Field Responders only accept their own channel or Staff broadcasts.
          const isRelevant = isStaff || msg.team_id === messagingChannelId || msg.team_id === staffTeamId;
          if (!isRelevant) return;

          setMessages(prev => {
            const current = prev || [];
            // Prevent duplicate if the local insert response arrived first
            if (current.some(m => m.id === msg.id)) return current;
            return [...current, msg];
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [messagingChannelId, staffTeamId, accessLevel, fetchMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !messagingChannelId) return;

    const senderDisplay = (team?.type !== 'Staff' && team?.team_name_number) 
      ? `${responderName} (${team.team_name_number})` 
      : responderName;

    const { data, error } = await supabase
      .from('team_messages')
      .insert({ 
        team_id: messagingChannelId, 
        sender_name: senderDisplay, 
        message_text: messageText.trim() 
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message: ' + (error.message || 'Permission denied'));
      return;
    }

    if (data) {
      setMessages(prev => {
        const current = prev || [];
        return current.some(m => m.id === data.id) ? current : [...current, data];
      });
      setMessageText('');
    }
  };

  /**
   * Helper function to determine visibility of dashboard sections
   * based on the responder's current mission status and access level.
   */
  const getDashboardVisibilities = () => {
    const isStaffOrAdmin = accessLevel === 'command staff' || accessLevel === 'admin';

    // Show team if staff/admin (ICS view) or if responder has an active team attachment
    const showTeam = isStaffOrAdmin || !!currentTeamStatus || (team && team.status !== 'Disbanded');

    // Show assignment if staff/admin (ICS view) or if responder has an active tasking
    const showAssignment = isStaffOrAdmin || !!currentAssignmentStatus || (
      assignment &&
      assignment.status !== 'Completed' &&
      assignment.status !== 'Incomplete'
    );

    // Show empty state only for regular responders who are not attached to anything
    const showEmptyState = !isStaffOrAdmin && 
                           (!team || team.status === 'Disbanded') && 
                           !currentTeamStatus && 
                           !assignment;

    return { showTeam, showAssignment, showEmptyState };
  };

  const { showTeam, showAssignment, showEmptyState } = getDashboardVisibilities();

  // Periodically refresh data to detect status changes from Command
  useEffect(() => {
    if (!responderId) return;
    
    const interval = setInterval(() => {
      refreshAllData();
    }, RESPONDER_REFRESH_INTERVAL || 60000);

    return () => clearInterval(interval);
  }, [responderId, refreshAllData, RESPONDER_REFRESH_INTERVAL]);

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
      setResponderStatus('Staged'); // Optimistic update for current responder
      setCurrentTeamStatus(null);
      setCurrentAssignmentStatus(null);
      refreshAllData();
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
      
      refreshAllData();
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
      refreshAllData();
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
      // 1. Update assignment: status -> Completed and save final mission results.
      // Triggers now handle cascading this to the Team (Disbanded) and Responders (Staged) automatically.
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
      
      // Optimistic update for the global banner
      setResponderStatus('Staged');
      setCurrentTeamStatus(null);
      setCurrentAssignmentStatus(null);

      refreshAllData();
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
      // 1. Update assignment status.
      // Triggers now handle cascading this to the Team and all individual Responders automatically.
      const { data: asnData, error: asnError } = await supabase
        .from('assignments')
        .update({ status: 'Deployed' })
        .eq('assignment_id', assignment.assignment_id)
        .select();
      
      if (asnError) throw asnError;
      if (!asnData || asnData.length === 0) throw new Error('Deployment blocked: You do not have permission to update this assignment.');

      // Optimistic update for the global banner and local state
      setResponderStatus('Deployed');
      setCurrentTeamStatus('Deployed');
      setCurrentAssignmentStatus('Deployed');

      refreshAllData();
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
        <button className="btn" onClick={refreshAllData} style={{ fontSize: '18px' }}>Retry Load</button>
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

      {showEmptyState && (
        <div className="dashboard-section empty-state">
          <p>You are currently not attached to a team or your team is not assigned to an assignment.</p>
          <p>Please check in with incident command for your assignment.</p>
        </div>
      )}

      {showTeam && (
        <div className="dashboard-section team-info">
          <SectionHeader
            title={accessLevel === 'command staff' || accessLevel === 'admin' ? 'Staff Status' : `Your Team: ${team?.team_name_number}`} 
            sectionKey="team" 
            showBadge={team && parRequired ? (
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
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                {timeSinceLastPar}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </span>
            ) : null}
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

      {showAssignment && (
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

      {team && team.status !== 'Disbanded' && (
        <div className="dashboard-section messaging-info">
          <SectionHeader 
            title="Team Communications" 
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
                    <span style={{ fontWeight: 700, color: (m.sender_name?.startsWith && responderName && typeof m.sender_name === 'string' && m.sender_name.startsWith(responderName)) ? '#2563eb' : '#475569' }}>{m.sender_name || 'Unknown'}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString() : '...'}</span>
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
          <div className="dashboard-section" style={{ padding: '12px 16px' }}>
            <SectionHeader title="Operational Map" sectionKey="map" />
            {isExpanded.map && (
              <div style={{ 
                borderRadius: '12px', 
                overflow: 'hidden', 
                border: '1px solid #cbd5e1', 
                boxShadow: '0 6px 22px rgba(0, 0, 0, 0.04)', 
                background: '#fff', 
                height: '650px', 
                position: 'relative',
                marginTop: '12px'
              }}>
                <OperationsMap 
                  loading={loading} 
                  assignments={assignment ? [assignment] : []} 
                  teams={team ? [team] : []} 
                  sartopoId={sartopoId} 
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponderDashboardPage;