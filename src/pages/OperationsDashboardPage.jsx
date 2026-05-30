import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/OperationsDashboard.css';
import '../styles/PlanningDashboard.css'; // Reusing form styles
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import TeamFormModal from '../components/TeamFormModal';
import AssignmentFormModal from '../components/AssignmentFormModal';
import BaseModal from '../components/BaseModal';
// import OperationsToolbar from '../components/OperationsToolbar'; // Not used
import OperationsTable from '../components/OperationsTable';
import OperationsMap from '../components/OperationsMap';
import { checkIsParOverdue, formatTimeSince } from '../utils/operationalUtils';
const OperationsDashboardPage = ({ operationalPeriodId: propOpId }) => {
  const { 
    incidentData, incidentId, responderName, user, operationsRefreshInterval, showGlobalMap, setShowGlobalMap 
  } = useIncident(); // showGlobalMap and setShowGlobalMap are no longer in context
  const operationalPeriodId = propOpId || incidentData?.opPeriodId;

  const {
    teams, assignments, responders, opPeriod, loading, error, setError, setLoading, stats,
    fetchDashboardData, updateResourceStatus, assignTeamToAssignment, unassignTeam,
    createTeam, createAssignment, deleteAssignment, deleteTeam,
    detachTeam: disbandTeam, updateTeam, updateAssignment,
    attachResponderToTeam, detachResponderFromTeam
  } = usePlanningDashboard(supabase, operationalPeriodId);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [teamForm, setTeamForm] = useState({});
  const [assignmentForm, setAssignmentForm] = useState({});

  const [pendingAssignmentId, setPendingAssignmentId] = useState(null);
  const [pendingTeamId, setPendingTeamId] = useState(null);

  const [draggedItem, setDraggedItem] = useState(null); // { id, type }
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('sarops_view_mode') || 'All'); 
  const [dropTarget, setDropTarget] = useState(null); // { id, type }
  const [assigningRow, setAssigningRow] = useState(null); // Stores the row object being manually assigned
  const [selectedAssignTarget, setSelectedAssignTarget] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  const contentWrapperRef = useRef(null);

  const [splitWidth, setSplitWidth] = useState(50); // percentage for table width in split view
  const isResizing = useRef(false);

  // Persist layout choices when they change
  useEffect(() => {
    localStorage.setItem('sarops_view_mode', viewMode);
  }, [viewMode]);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current || !contentWrapperRef.current) return;
    
    const containerRect = contentWrapperRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constraints: Keep both panels visible (between 20% and 80%)
    if (newWidth > 20 && newWidth < 80) {
      setSplitWidth(newWidth);
    }
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
  }, [handleMouseMove, stopResizing]);

  const sartopoId = opPeriod?.incidents?.sartopo_id;
  const parInterval = opPeriod?.par_check_interval || 0;

  const commandStaffExists = useMemo(() => (teams || []).some(t => t.type === 'Staff'), [teams]);


  const getRawUuid = (rowId) => {
    if (!rowId) return null;
    if (rowId.startsWith('asn-')) return rowId.slice(4);
    if (rowId.startsWith('team-')) return rowId.slice(5);
    return rowId;
  };

  const teamById = useMemo(() => {
    const lookup = {};
    (teams || []).forEach(t => {
      if (t?.team_id) lookup[t.team_id] = t;
    });
    return lookup;
  }, [teams]);

  const assignmentById = useMemo(() => {
    const lookup = {};
    (assignments || []).forEach(a => {
      if (a?.assignment_id) lookup[a.assignment_id] = a;
    });
    return lookup;
  }, [assignments]);

  const rows = useMemo(() => {
    // Assignment rows now benefit from pre-joined metadata in the dashboard_assignments view
    const assignmentRows = (assignments || []).map(asnItem => {
      return {
        id: `asn-${asnItem.assignment_id}`,
        isParOverdue: checkIsParOverdue(asnItem, parInterval, currentTime),
        timeSincePar: asnItem.team_id ? formatTimeSince(asnItem.last_par_check, asnItem.created_at, currentTime) : '',
        tacChannel: asnItem.frequency_primary || '—',
        assignmentId: asnItem.assignment_id,
        assignmentName: asnItem.title,
        assignmentOrigin: asnItem.origin,
        assignmentPriority: asnItem.priority || '—',
        assignmentType: asnItem.resource_type || '—',
        assignmentStatus: asnItem.status,
        teamName: asnItem.team_name || '',
        teamType: asnItem.team_type || '',
        teamLeader: asnItem.leader_name || '',
        leaderIdentifier: asnItem.leader_identifier || '—',
        teamSize: asnItem.team_size || 0,
        leaderId: asnItem.leader_responder_id || null,
        teamStatus: asnItem.team_status || '',
        hasBoth: !!asnItem.team_id,
        teamId: asnItem.team_id,
      };
    });

    const assignmentTeamSet = new Set();
    (assignments || []).forEach(a => { if (a.team_id) assignmentTeamSet.add(a.team_id); });

    // Team only rows benefit from metadata in the dashboard_teams view
    const teamOnlyRows = (teams || []).filter(tItem => !assignmentTeamSet.has(tItem.team_id)).map(tItem => ({
      id: `team-${tItem.team_id}`,
      isParOverdue: checkIsParOverdue(tItem, parInterval, currentTime),
      timeSincePar: formatTimeSince(tItem.last_par_check, tItem.created_at, currentTime),
      tacChannel: '', assignmentId: '', assignmentName: '', assignmentPriority: '', assignmentType: '', assignmentStatus: '',
      teamName: tItem.team_name_number, teamType: tItem.type, teamStatus: tItem.status,
      teamLeader: tItem.leader_name || 'Unknown',
      leaderIdentifier: tItem.leader_identifier || '—',
      teamSize: tItem.member_count || 0,
      leaderId: tItem.leader_responder_id || null,
      hasBoth: false, teamId: tItem.team_id,
    }));

    let result = [...assignmentRows, ...teamOnlyRows];
    if (viewMode === 'Operations') {
      result = result.filter(r => (r.teamStatus === 'Assigned' || r.teamStatus === 'Deployed' || r.assignmentStatus === 'Completed' || r.assignmentStatus === 'Incomplete') && r.teamType !== 'Staff');
    } else if (viewMode === 'Planning') {
      result = result.filter(r => !['Completed', 'Incomplete'].includes(r.assignmentStatus) && (r.assignmentStatus === 'Planned' || r.teamStatus === 'Staged') && r.teamType !== 'Staff');
    }

    const aTerm = assignmentFilter.toLowerCase().trim();
    const tTerm = teamFilter.toLowerCase().trim();

    if (aTerm) {
      result = result.filter(row => {
        const fields = ['assignmentName', 'assignmentType', 'assignmentPriority', 'tacChannel', 'assignmentStatus'];
        return fields.some(key => (row[key] || '').toString().toLowerCase().includes(aTerm));
      });
    }
    if (tTerm) {
      result = result.filter(row => {
        const fields = ['teamName', 'teamType', 'teamLeader', 'leaderIdentifier'];
        return fields.some(key => (row[key] || '').toString().toLowerCase().includes(tTerm));
      });
    }

    result.sort((a, b) => {
      // Custom operational priority sort
      const getPriority = (row) => {
        if (row.assignmentStatus === 'Deployed') return 1;
        if (row.assignmentStatus === 'Assigned') return 2;
        if (row.assignmentId && !row.teamId) return 3; // Assignment with no team
        if (!row.assignmentId && row.teamId) return 4; // Team with no assignment
        if (row.assignmentStatus === 'Incomplete') return 5;
        if (row.assignmentStatus === 'Completed') return 6;
        return 7;
      };

      if (!sortConfig.key) {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return (a.assignmentName || a.teamName).localeCompare(b.assignmentName || b.teamName);
      }

      const aVal = (a[sortConfig.key] || '').toString().toLowerCase();
      const bVal = (b[sortConfig.key] || '').toString().toLowerCase();
      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return result; // currentTime is a dependency for checkIsParOverdue and formatTimeSince
  }, [assignments, teams, assignmentFilter, teamFilter, sortConfig, viewMode, parInterval, currentTime]);

  // Keep a live clock for timer displays and overdue calculations
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [operationalPeriodId, fetchDashboardData]);

  // Periodically refresh dashboard data to ensure real-time accuracy (every 60s)
  useEffect(() => {
    if (!operationalPeriodId) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, operationsRefreshInterval || 30000);

    return () => clearInterval(interval);
  }, [operationalPeriodId, fetchDashboardData, operationsRefreshInterval]);

  const recordAction = async (action) => {
    if (!incidentId) return;
    await supabase.from('action_logs').insert({
      incident_id: incidentId,
      action,
      user_name: responderName || user?.email || 'Operations'
    });
  };

  const handleStatusUpdate = async (assignmentId, teamId, newStatus) => {
    try {
      await updateResourceStatus(assignmentId, teamId, newStatus);
    } catch (err) {
      console.error('Failed to update status:', err);
      // Use the local setError state from the planning hook
      setError(err.message || 'Permission denied or update failed. Please verify your access level.');
    }
  };

  /**
   * Manually reset the PAR timer for a team.
   * Used when status checks are received via radio.
   */
  const handleResetPar = async (teamId, teamName) => {
    if (!teamId) return;

    try {
      setLoading(true);
      setError(null);
      const now = new Date().toISOString();

      const { error: resetErr } = await supabase
        .from('teams')
        .update({ 
          last_par_check: now,
          par_status: 'OK' 
        })
        .eq('team_id', teamId);

      if (resetErr) throw resetErr;

      await recordAction(`Manual PAR reset for team "${teamName}" (ID: ${teamId}). Fields modified: last_par_check="${now}", par_status="OK".`);
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to reset PAR');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Manually detach a staged team
   */
  const handleDisbandTeam = async (teamId, teamName, teamType) => {
    const team = teams.find(t => t.team_id === teamId);
    if (team?.status === 'Deployed') {
      alert(`Cannot disband team "${teamName}" while it is Deployed.`);
      return;
    }
    if (!window.confirm(`Disband "${teamName}"? Members will be released back to staging, but the team record will remain for logs.`)) return;

    try {
      setLoading(true);
      const now = new Date().toISOString();
      const { data: members } = await supabase.from('team_responders').select('responder_id').eq('team_id', teamId);
      const rIds = members?.map(m => m.responder_id) || [];
      
      if (rIds.length > 0) {
        await supabase.from('responders').update({ status: 'Staged' }).in('responder_id', rIds);
        await supabase.from('responder_team_history').update({ detached_datetime: now }).eq('team_id', teamId).is('detached_datetime', null);
      }

      await supabase.from('teams').update({ status: 'Disbanded', last_par_check: null }).eq('team_id', teamId);
      await recordAction(`Disbanded team "${teamName}" (ID: ${teamId}, Type: ${teamType}). Fields modified: status="Disbanded", last_par_check=null. All members released back to "Staged" status.`);
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to disband team');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sends a broadcast message to all teams in the operational period.
   */
  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim() || teams.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const staffTeam = teams.find(t => t.type === 'Staff');
      if (!staffTeam) throw new Error('No Staff team found to receive broadcast.');

      const { error: broadcastErr } = await supabase.from('team_messages').insert({
        team_id: staffTeam.team_id,
        sender_name: `${responderName || user?.email || 'Operations'} (Broadcast)`,
        message_text: broadcastMessage.trim()
      });

      if (broadcastErr) throw broadcastErr;

      await recordAction(`Sent broadcast message to ${teams.length} teams. Message: "${broadcastMessage.trim()}"`);
      setBroadcastMessage('');
      setShowBroadcastModal(false);
    } catch (err) {
      setError(err.message || 'Failed to send broadcast message');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Manually link a team and assignment via the action menu
   */
  const handlePerformLink = async (assignmentId, teamId) => {
    // The logging is now handled within the assignTeamToAssignment hook function.
    // This function only needs to call the hook function.
    await assignTeamToAssignment(teamId, assignmentId);
  };

  const handleDragStart = (e, id, type) => {
    setDraggedItem({ id, type });
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id, type) => {
    if (!draggedItem || draggedItem.type === type) return;

    // Validate drop targets for Team/Assignment linkage
    if (draggedItem.type === 'team' || draggedItem.type === 'assignment') {
      const targetRow = rows.find(r => r.id === id);
      if (targetRow?.hasBoth) return;
    }

    // Responders can only be dropped onto teams
    if (draggedItem.type === 'responder' && type !== 'team') return;

    e.preventDefault();
  };

  const handleDragEnter = (e, id, type) => {
    if (!draggedItem || draggedItem.type === type) return;

    // Validate highlighting for Team/Assignment linkage
    if (draggedItem.type === 'team' || draggedItem.type === 'assignment') {
      const targetRow = rows.find(r => r.id === id);
      if (targetRow?.hasBoth) return;
    }

    // Prevent highlighting assignments when dragging a responder
    if (draggedItem.type === 'responder' && type !== 'team') return;

    setDropTarget({ id, type });
  };

  const handleDrop = async (e, targetId, targetType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type === targetType) return;

    try {
      // Team <-> Assignment linkage
      if ((draggedItem.type === 'team' && targetType === 'assignment') || (draggedItem.type === 'assignment' && targetType === 'team')) {
        const targetRow = rows.find(r => r.id === targetId);
        if (targetRow?.hasBoth) return;

        const rawTeamId = draggedItem.type === 'team' ? draggedItem.id : targetId;
        const teamId = getRawUuid(rawTeamId);
        const rawAssignmentId = draggedItem.type === 'assignment' ? draggedItem.id : targetId;
        const assignmentId = getRawUuid(rawAssignmentId);
        
        await assignTeamToAssignment(teamId, assignmentId);
      } 
      // Responder -> Team attachment
      else if (draggedItem.type === 'responder' && targetType === 'team') {
        const teamId = getRawUuid(targetId);
        if (teamId) await attachResponderToTeam(draggedItem.id, teamId);
      }
    } catch (err) {
       // Error is handled by hook
    } finally {
      setDraggedItem(null);
      setDropTarget(null);
    }
  };

  const openNewTeamForm = () => {
    setPendingAssignmentId(null);
    setTeamForm({
      op_period_id: operationalPeriodId,
      team_name_number: '',
      type: 'Ground',
      status: 'Staged',
      leader_responder_id: null,
      equipment: [],
      responder_ids: []
    });
    setShowTeamForm(true);
  };

  const openNewAssignmentForm = () => {
    setPendingTeamId(null);
    setAssignmentForm({
      op_period_id: operationalPeriodId,
      segment: 'A',
      title: '',
      resource_type: 'Ground',
      team_size: 2,
      frequency_primary: '',
      status: 'Planned',
      priority: 'Medium'
    });
    setShowAssignmentForm(true);
  };

  const openEditTeamForm = async (team) => {
    if (!team) return;
    setLoading(true);
    try {
      const { data: members } = await supabase.from('team_responders').select('responder_id, role').eq('team_id', team.team_id);
      setTeamForm({
        ...team,
        current_responders: members, // Ensure roles are passed to the modal
        responder_ids: members?.map(m => m.responder_id) || []
      });
      setShowTeamForm(true);
    } finally {
      setLoading(false);
    }
  };

  const openEditAssignmentForm = (assignment) => {
    if (!assignment) return;
    setAssignmentForm(assignment);
    setShowAssignmentForm(true);
  };

  const handleSaveTeam = async (formData) => {
    try {
      // Auto-generate team name if blank
      let finalTeamName = formData.team_name_number?.trim();
      if (!finalTeamName) {
        const type = formData.type || 'Other';
        const existingOfSameType = teams.filter(t => t.type === type);
        let nextNum = existingOfSameType.length + 1;
        finalTeamName = `${type} ${nextNum}`;

        // Local uniqueness check to avoid immediate collisions
        while (teams.some(t => t.team_name_number === finalTeamName)) {
          nextNum++;
          finalTeamName = `${type} ${nextNum}`;
        }
      }

      const payload = {
        team_name_number: finalTeamName,
        sartopo_color_hex: formData.sartopo_color_hex || '#FF0000',
        type: formData.type || 'Other',
        status: formData.status || 'Staged',
        leader_responder_id: formData.leader_responder_id || null,
        equipment: formData.equipment || []
      };

      if (formData.team_id) {
        const finalIds = formData.responder_ids || [];
        const roles = formData.responder_roles || {};
        const originalIds = teamById[formData.team_id]?.current_responders?.map(r => r.responder_id) || [];
        // Reconciliation is now handled within updateTeam
        await updateTeam(formData.team_id, payload, originalIds, finalIds, roles);
      } else {
        const newTeam = await createTeam({ ...payload, op_period_id: operationalPeriodId, responder_ids: formData.responder_ids, responder_roles: formData.responder_roles });
        if (pendingAssignmentId) await assignTeamToAssignment(newTeam.team_id, pendingAssignmentId);
      }

      setPendingAssignmentId(null);
      setShowTeamForm(false);
    } catch (err) {
      setPendingAssignmentId(null);
    }
  };

  const handleSaveAssignment = async (formData) => {
    const targetTeamId = !!formData.assignment_id ? formData.team_id : (pendingTeamId || null);
    
    try {
      const payload = {
        op_period_id: operationalPeriodId,
        title: formData.title || '',
        status: pendingTeamId ? 'Assigned' : (formData.status || 'Planned'),
        segment: formData.segment || '',
        resource_type: formData.resource_type || '',
        team_size: formData.team_size ? parseInt(formData.team_size, 10) : null,
        frequency_primary: formData.frequency_primary || '',
        description: formData.description || '',
        probability_of_detection: formData.probability_of_detection ?? null,
        debrief_narrative: formData.debrief_narrative || '',
        team_id: targetTeamId,
        is_orphaned: formData.is_orphaned || false,
        // Map SARTopo metadata using standardized snake_case
        priority: formData.priority || null,
        transportation: formData.transportation || null,
        time_allocated: formData.time_allocated || null,
        hazards: formData.hazards || null,
        prepared_by: formData.prepared_by || null
      };

      if (formData.assignment_id) {
        await updateAssignment(formData.assignment_id, payload);
      } else {
        await createAssignment(payload);
      }

      setPendingTeamId(null);
      setShowAssignmentForm(false);
    } catch (err) {
      setPendingTeamId(null);
    }
  };

  const handleUnassignTeam = async (assignmentId, teamId, assignmentName, teamName) => {
    if (!window.confirm(`Are you sure you want to unassign "${teamName || 'the team'}" from "${assignmentName || 'this assignment'}"?`)) return;

    try {
      await unassignTeam(assignmentId);
    } catch (err) {
       // Error handled by hook
    }
  };

  const handleDeleteAssignment = async (assignmentId, assignmentName) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${assignmentName}"? This action cannot be undone.`)) return;

    try {
      await deleteAssignment(assignmentId);
    } catch (err) {
       // Error handled by hook
    }
  };

  const handleReleaseTeam = async (teamId, teamName) => {
    const msg = `Are you sure you want to release "${teamName}"? This will return all members to Staged status and delete the team record.`;
    if (!window.confirm(msg)) return;

    try {
      await deleteTeam(teamId);
    } catch (err) {
       // Error handled by hook
    }
  };

  const availableTeams = useMemo(() => teams.filter(t => t.status === 'Staged'), [teams]);
  const availableAssignments = useMemo(() => assignments.filter(a => !a.team_id && a.status === 'Planned'), [assignments]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalAssignments = assignments.length;
  const totalTeams = teams.length;
  const totalRows = rows.length;

  if (!operationalPeriodId) {
    return (
      <div className="operations-dashboard">
        <header className="operations-header"><h1>Operations Dashboard</h1></header>
        <div className="operations-message">Please select or start an incident to view operations data.</div>
      </div>
    );
  }

  return (
    <div className="operations-dashboard">
      <header className="operations-header">
        <div>
          <h1>Operations Dashboard</h1>
          <p>Drag and drop teams onto assignments (or vice versa) to link resources.</p>
        </div>
        <div className="view-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="view-mode-select" style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>View:</label>
          <select 
            id="view-mode-select"
            className="status-update-select" 
            style={{ width: 'auto', minWidth: '140px', height: '32px' }}
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="All">Incident (All)</option>
            <option value="Operations">Operations (Active)</option>
            <option value="Planning">Planning (Staged)</option>
          </select>
          <button 
            className="btn btn-secondary" 
            style={{ 
              height: '32px', 
              fontSize: '13px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '0 12px'
            }}
            onClick={() => setShowBroadcastModal(true)}
            title="Send message to all teams"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Broadcast
          </button>
        </div>
      </header>

      {loading && !rows.length && <div className="operations-message">Loading operations summary…</div>}

      {error && (
        <div className="operations-error" role="alert">
          {error}
        </div>
      )}

      {!error && (
        <div 
          ref={contentWrapperRef} 
          className={`operations-content-wrapper ${showGlobalMap ? 'layout-split' : 'layout-table'}`} 
          style={{
            ...(loading ? { opacity: 0.8 } : {}),
            display: showGlobalMap ? 'flex' : 'block',
            flexDirection: showGlobalMap ? 'row' : 'column',
            flexWrap: 'nowrap',
            alignItems: 'stretch',
            height: 'calc(100vh - 200px)',
            gap: showGlobalMap ? '12px' : '0',
            overflow: 'hidden'
          }}
        >
            <div className="table-panel" style={{
              width: showGlobalMap ? `${splitWidth}%` : '100%',
              flexShrink: 0, 
              overflowY: 'auto',
              height: '100%',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#fff'
            }}>
           <OperationsTable 
              rows={rows} sortConfig={sortConfig} requestSort={requestSort}
              assignmentFilter={assignmentFilter} onAssignmentFilterChange={setAssignmentFilter}
              teamFilter={teamFilter} onTeamFilterChange={setTeamFilter}
              parInterval={parInterval}
              onStatusUpdate={(asnId, teamId, status) => handleStatusUpdate(asnId, teamId, status)}
              onResetPar={handleResetPar} onUnassignTeam={handleUnassignTeam}
              onEditTeam={(id) => openEditTeamForm(teamById[id])} onReleaseTeam={handleReleaseTeam}
              openNewTeamForm={openNewTeamForm}
              openNewAssignmentForm={openNewAssignmentForm}
              onEditAssignment={(id) => openEditAssignmentForm(assignmentById[id])}
              onNewTeam={(asnId) => { setPendingAssignmentId(asnId); setTeamForm({ op_period_id: operationalPeriodId, status: 'Assigned', type: 'Ground' }); setShowTeamForm(true); }}
                onNewAssignment={(teamId) => { setPendingTeamId(teamId); setAssignmentForm({ op_period_id: operationalPeriodId, status: 'Assigned', segment: 'A' }); setShowAssignmentForm(true); }}
              onDeleteAssignment={handleDeleteAssignment} onAssignResource={(row) => { setAssigningRow(row); setSelectedAssignTarget(''); }}
              draggedItem={draggedItem} dropTarget={dropTarget}
              onDragStart={handleDragStart} onDragEnd={() => { setDraggedItem(null); setDropTarget(null); }}
              onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={() => setDropTarget(null)} onDrop={handleDrop}
            />
          </div>

          {showGlobalMap && (
            <div className="resizer-handle" onMouseDown={startResizing} style={{ width: '10px', cursor: 'col-resize', backgroundColor: '#f1f5f9', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '2px', height: '24px', backgroundColor: '#cbd5e1', borderRadius: '1px' }} />
            </div>
          )}

          {showGlobalMap && (
            <div className="map-panel" style={{ flex: 1, minWidth: '400px', overflowY: 'auto' }}>
              <div className="dashboard-section" style={{ padding: '12px 16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', marginBottom: '12px' }}>Operational Map</h2>
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
                      assignments={assignments} 
                      teams={teams} 
                      sartopoId={sartopoId} 
                      layoutMode="map" 
                      style={{ height: '100%' }} 
                    />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && (
        <div className="operations-stats-footer" style={{ 
          marginTop: '24px',
          display: 'flex',
          gap: '32px',
          flexWrap: 'wrap',
          padding: '8px 20px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          alignItems: 'center'
        }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Teams</strong>
            <div style={{ fontSize: '12px', color: '#475569' }}>
              Staged: {stats.teams.staged}, Assigned: {stats.teams.assigned}, Deployed: {stats.teams.deployed}, 
              Overdue: <span style={{ color: rows.some(r => r.isParOverdue) ? '#dc2626' : 'inherit', fontWeight: rows.some(r => r.isParOverdue) ? 700 : 'inherit' }}>{rows.filter(r => r.isParOverdue).length}</span>, 
              Total: {stats.teams.total}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Assignments</strong>
            <div style={{ fontSize: '12px', color: '#475569' }}>
              Planned: {stats.assignments.planned}, Assigned: {stats.assignments.assigned}, Deployed: {stats.assignments.deployed}, 
              Complete: {stats.assignments.complete}, Incomplete: {stats.assignments.incomplete}, Total: {stats.assignments.total}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Responders</strong>
            <div style={{ fontSize: '12px', color: '#475569' }}>
              Staged: {stats.responders.staged}, Attached: {stats.responders.attached}, Assigned: {stats.responders.assigned}, 
              Deployed: {stats.responders.deployed}, Total: {stats.responders.total}
            </div>
          </div>

          <div style={{ fontSize: '13px', marginLeft: 'auto', fontWeight: 700, color: '#1e293b' }}>
            {new Date(currentTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')}
          </div>
        </div>
      )}

      {showTeamForm && (
        <TeamFormModal
          key={`team-${teamForm.team_id || 'new'}`}
          isOpen={showTeamForm}
          onClose={() => setShowTeamForm(false)}
          onSave={handleSaveTeam}
          initialData={teamForm}
          responders={responders}
          loading={loading}
          error={error}
          commandStaffExists={commandStaffExists}
        />
      )}

      {showAssignmentForm && (
        <AssignmentFormModal
          key={`asn-${assignmentForm.assignment_id || 'new'}`}
          isOpen={showAssignmentForm}
          onClose={() => setShowAssignmentForm(false)}
          onSave={handleSaveAssignment}
          initialData={assignmentForm}
          loading={loading}
          error={error}
        />
      )}

      {showBroadcastModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '8px',
            maxWidth: '500px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>Broadcast Message</h3>
            <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '16px' }}>
              Send a message to the leaders of all <strong>{teams.length}</strong> teams in this operational period.
            </p>
            <textarea
              style={{
                width: '100%', minHeight: '120px', padding: '12px', borderRadius: '6px',
                border: '1px solid #cbd5e1', marginBottom: '20px', fontSize: '14px',
                fontFamily: 'inherit', boxSizing: 'border-box'
              }}
              placeholder="Enter message for all teams..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowBroadcastModal(false);
                  setBroadcastMessage('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSendBroadcast}
                disabled={!broadcastMessage.trim() || loading}
              >
                {loading ? 'Sending...' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assigningRow && (
        <BaseModal
          isOpen={!!assigningRow}
          onClose={() => setAssigningRow(null)}
          title={assigningRow.assignmentId ? 'Assign Team to Assignment' : 'Assign to Assignment'}
          loading={loading}
          actions={
            <button 
              className="btn btn-primary" 
              disabled={!selectedAssignTarget || loading}
              onClick={() => {
                const asnId = assigningRow.assignmentId ? assigningRow.assignmentId : selectedAssignTarget;
                const teamId = assigningRow.teamId ? assigningRow.teamId : selectedAssignTarget;
                handlePerformLink(asnId, teamId);
                setAssigningRow(null);
              }}
            >
              Link Resource
            </button>
          }
        >
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px' }}>
            Assigning resource for: <strong>{assigningRow.assignmentName || assigningRow.teamName}</strong>
          </p>
          <div className="form-row">
            <label htmlFor="assign-resource-select">{assigningRow.assignmentId ? 'Select Staged Team' : 'Select Planned Assignment'}</label>
            <select
              id="assign-resource-select"
              className="status-update-select" 
              value={selectedAssignTarget} 
              onChange={(e) => setSelectedAssignTarget(e.target.value)}
            >
              <option value="" disabled>Choose a resource...</option>
              {assigningRow.assignmentId ? 
                availableTeams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name_number} ({t.type})</option>) :
                availableAssignments.map(a => <option key={a.assignment_id} value={a.assignment_id}>{a.title} ({a.segment})</option>)
              }
            </select>
          </div>
        </BaseModal>
      )}
    </div>
  );
};

export default OperationsDashboardPage;
