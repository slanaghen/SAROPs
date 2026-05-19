import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/OperationsDashboard.css';
import '../styles/PlanningDashboard.css'; // Reusing form styles
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import TeamFormModal from '../components/TeamFormModal';
import AssignmentFormModal from '../components/AssignmentFormModal';
import BaseModal from '../components/BaseModal';

const OperationsDashboardPage = ({ operationalPeriodId: propOpId }) => {
  const { incidentData, incidentId, responderName, user } = useIncident();
  const operationalPeriodId = propOpId || incidentData?.opPeriodId;

  const {
    teams, assignments, responders, opPeriod, loading, error, setError, setLoading,
    fetchDashboardData, updateResourceStatus, assignTeamToAssignment, unassignTeam,
    deleteAssignment, deleteTeam, detachTeam: disbandTeam, updateTeam, updateAssignment,
    attachResponderToTeam, detachResponderFromTeam
  } = usePlanningDashboard(supabase, operationalPeriodId);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({
    assignmentName: '',
    assignmentType: '',
    tacChannel: '',
    assignmentStatus: '',
    teamName: '',
    teamType: '',
    teamLeader: ''
  });
  
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [teamForm, setTeamForm] = useState({});
  const [assignmentForm, setAssignmentForm] = useState({});

  const [pendingAssignmentId, setPendingAssignmentId] = useState(null);
  const [pendingTeamId, setPendingTeamId] = useState(null);

  const [draggedItem, setDraggedItem] = useState(null); // { id, type }
  const [viewMode, setViewMode] = useState('All'); // Options: 'All', 'Operations', 'Planning'
  const [dropTarget, setDropTarget] = useState(null); // { id, type }
  const [assigningRow, setAssigningRow] = useState(null); // Stores the row object being manually assigned
  const [selectedAssignTarget, setSelectedAssignTarget] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  const parInterval = opPeriod?.par_check_interval || 0;

  // Keep a live clock for timer displays and overdue calculations
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeSince = (timestamp, createdAt) => {
    if (!timestamp && !createdAt) return '—';
    const lastCheckMs = timestamp ? new Date(timestamp).getTime() : new Date(createdAt).getTime();
    const diffMs = currentTime - lastCheckMs;
    const totalMinutes = Math.floor(diffMs / 60000);

    if (!timestamp) return 'Never';
    if (totalMinutes < 1) return 'just now';
    if (totalMinutes < 60) return `${totalMinutes}m ago`;
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m ago`;
  };

  /**
   * Helper to safely extract UUID from prefixed row IDs (asn-xxx or team-xxx)
   */
  const getRawUuid = (rowId) => {
    if (!rowId) return null;
    if (rowId.startsWith('asn-')) return rowId.slice(4);
    if (rowId.startsWith('team-')) return rowId.slice(5);
    return rowId;
  };

  useEffect(() => {
    fetchDashboardData();
  }, [operationalPeriodId, fetchDashboardData]);

  const recordAction = async (action) => {
    if (!incidentId) return;
    await supabase.from('action_logs').insert({
      incident_id: incidentId,
      action,
      user_name: responderName || user?.email || 'Operations'
    });
  };

  const handleStatusUpdate = async (assignmentId, teamId, newStatus) => {
    if (newStatus === 'Completed' && teamId) {
      const keepStaged = window.confirm("Assignment Complete. Keep team together (Staged)?\n\n- OK: Keep Staged (available for tasks)\n- Cancel: DISBAND Team (release members)");
      if (keepStaged) {
        return updateResourceStatus(assignmentId, teamId, 'Planned');
      }
    }
    await updateResourceStatus(assignmentId, teamId, newStatus);
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

      const { error: resetErr } = await supabase
        .from('teams')
        .update({ 
          last_par_check: new Date().toISOString(),
          par_status: 'OK' 
        })
        .eq('team_id', teamId);

      if (resetErr) throw resetErr;

      await recordAction(`Manual PAR reset for ${teamName || 'Team'}`);
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
  const handleDisbandTeam = async (teamId, teamName) => {
    if (!window.confirm(`Disband "${teamName}"? Members will be released back to staging, but the team record will remain for logs.`)) return;

    try {
      setLoading(true);
      const { data: members } = await supabase.from('team_responders').select('responder_id').eq('team_id', teamId);
      const rIds = members?.map(m => m.responder_id) || [];
      
      if (rIds.length > 0) {
        await supabase.from('responders').update({ status: 'Staged' }).in('responder_id', rIds);
        await supabase.from('responder_team_history').update({ detached_datetime: new Date().toISOString() }).eq('team_id', teamId).is('detached_datetime', null);
      }

      await supabase.from('teams').update({ status: 'Disbanded', last_par_check: new Date().toISOString() }).eq('team_id', teamId);
      await recordAction(`Disbanded team: ${teamName}`);
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
      const messagesToInsert = teams.map(t => ({
        team_id: t.team_id,
        sender_name: responderName || user?.email || 'Operations',
        message_text: `[BROADCAST]: ${broadcastMessage.trim()}`
      }));

      const { error: broadcastErr } = await supabase
        .from('team_messages')
        .insert(messagesToInsert);

      if (broadcastErr) throw broadcastErr;

      await recordAction(`Sent broadcast message to ${teams.length} teams`);
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
    try {
      await assignTeamToAssignment(teamId, assignmentId);
      
      const team = teamById[teamId];
      const assignment = assignmentById[getRawUuid(assignmentId)];
      const teamName = team?.team_name_number || 'Unknown Team';
      const asnName = assignment?.name || 'Unknown Assignment';
      
      await recordAction(`Assigned ${teamName} to ${asnName} via manual menu action`);
    } catch (err) {
      // Error is handled by hook
    }
  };

  const handleDragStart = (e, id, type) => {
    setDraggedItem({ id, type });
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetType) => {
    // Only allow dropping if the dragged item is the opposite type
    if (draggedItem && draggedItem.type !== targetType) {
      e.preventDefault();
    }
  };

  const handleDragEnter = (e, id, type) => {
    if (draggedItem && draggedItem.type !== type) {
      setDropTarget({ id, type });
    }
  };

  const handleDrop = async (e, targetId, targetType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type === targetType) return;

    const teamId = draggedItem.type === 'team' ? draggedItem.id : targetId;
    const rawAssignmentId = draggedItem.type === 'assignment' ? draggedItem.id : targetId;
    const assignmentId = getRawUuid(rawAssignmentId);

    try {
      await assignTeamToAssignment(teamId, assignmentId);

      const team = teamById[teamId];
      const assignment = assignmentById[assignmentId];
      const teamName = team?.team_name_number || 'Unknown Team';
      const asnName = assignment?.name || 'Unknown Assignment';
      
      setDraggedItem(null);
      setDropTarget(null);
      await recordAction(`Assigned ${teamName} to ${asnName} via drag and drop`);
    } catch (err) {
       // Error is handled by hook
    }
  };

  const openEditTeamForm = async (team) => {
    if (!team) return;
    setLoading(true);
    try {
      const { data: members } = await supabase.from('team_responders').select('responder_id').eq('team_id', team.team_id);
      setTeamForm({
        ...team,
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
      const payload = {
        team_name_number: formData.team_name_number || '',
        type: formData.type || 'Other',
        status: formData.status || 'Staged',
        leader_responder_id: formData.leader_responder_id || null,
        equipment: formData.equipment || []
      };

      if (formData.team_id) {
        await updateTeam(formData.team_id, payload);
        
        // Reconciliation
        const finalIds = formData.responder_ids || [];
        const originalIds = teamById[formData.team_id]?.current_responders?.map(r => r.responder_id) || [];
        const toAdd = finalIds.filter(id => !originalIds.includes(id));
        const toRemove = originalIds.filter(id => !finalIds.includes(id));

        await Promise.all([
          ...toAdd.map(id => attachResponderToTeam(id, formData.team_id)),
          ...toRemove.map(id => detachResponderFromTeam(id, formData.team_id))
        ]);
      } else {
        const newTeam = await createTeam({ ...payload, op_period_id: operationalPeriodId, responder_ids: formData.responder_ids });
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
        name: formData.name || '',
        status: pendingTeamId ? 'Assigned' : (formData.status || 'Planned'),
        division: formData.division || '',
        assignment_type: formData.assignment_type || '',
        assignment_size: formData.assignment_size ? parseInt(formData.assignment_size, 10) : null,
        tac_channel: formData.tac_channel || '',
        description_narrative: formData.description_narrative || '',
        poa: formData.poa ? parseInt(formData.poa, 10) : null,
        pod: formData.pod ? parseInt(formData.pod, 10) : null,
        debrief_narrative: formData.debrief_narrative || '',
        team_id: targetTeamId,
        is_orphaned: formData.is_orphaned || false
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
      await recordAction(`Unassigned ${teamName || 'Team'} from ${assignmentName || 'Assignment'}`);
    } catch (err) {
       // Error handled by hook
    }
  };

  const handleDeleteAssignment = async (assignmentId, assignmentName) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${assignmentName}"? This action cannot be undone.`)) return;

    try {
      await deleteAssignment(assignmentId);
      await recordAction(`Deleted Assignment: ${assignmentName}`);
    } catch (err) {
       // Error handled by hook
    }
  };

  const handleReleaseTeam = async (teamId, teamName) => {
    const msg = `Are you sure you want to release "${teamName}"? This will return all members to Staged status and delete the team record.`;
    if (!window.confirm(msg)) return;

    try {
      await deleteTeam(teamId);
      await recordAction(`Released Team: ${teamName}`);
    } catch (err) {
       // Error handled by hook
    }
  };

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

  const assignmentById = useMemo(() => {
    const lookup = {};
    for (const a of assignments) {
      if (a?.assignment_id) {
        lookup[a.assignment_id] = a;
      }
    }
    return lookup;
  }, [assignments]);

  const rows = useMemo(() => {
    // Pre-calculate sets to avoid nested lookups in map
    const assignmentRows = (assignments || []).map(asnItem => {
      const matchingTeam = asnItem.team_id ? teamById[asnItem.team_id] : null;

      return {
        id: `asn-${asnItem.assignment_id}`, // Prefixed ID ensures no collision after unassign
        isParOverdue: matchingTeam && matchingTeam.status !== 'Staged' && parInterval > 0 && (() => {
          const lastCheck = matchingTeam.last_par_check 
            ? new Date(matchingTeam.last_par_check).getTime() 
            : new Date(matchingTeam.created_at || Date.now()).getTime();
          const minutesSince = (currentTime - lastCheck) / 60000;
          // Overdue if past interval + 3 minute grace period
          return minutesSince > (parInterval + 3);
        })(),
        timeSincePar: matchingTeam ? formatTimeSince(matchingTeam.last_par_check, matchingTeam.created_at) : '',
        tacChannel: asnItem.tac_channel || '—',
        assignmentId: asnItem.assignment_id,
        assignmentName: asnItem.name,
        assignmentType: asnItem.assignment_type || '—',
        assignmentStatus: asnItem.status,
        teamName: matchingTeam?.team_name_number || '',
        teamType: matchingTeam?.type || '',
        teamLeader: matchingTeam ? leaderById[matchingTeam.leader_responder_id] || 'Unknown' : '',
        teamStatus: matchingTeam?.status || '',
        hasBoth: !!matchingTeam,
        teamId: asnItem.team_id,
      };
    });

    const assignmentTeamSet = new Set();
    (assignments || []).forEach(a => { if (a.team_id) assignmentTeamSet.add(a.team_id); });

    const teamOnlyRows = (teams || [])
      .filter(tItem => {
        // Show team as a standalone row if it's not linked to any assignment
        // Hide Disbanded teams from active board
        return !assignmentTeamSet.has(tItem.team_id) && tItem.status !== 'Disbanded';
      })
      .map(tItem => {
      return {
          id: `team-${tItem.team_id}`, // Prefixed ID ensures React sees this as a new row type
          isParOverdue: tItem.status !== 'Staged' && parInterval > 0 && (() => {
            const lastCheck = tItem.last_par_check 
              ? new Date(tItem.last_par_check).getTime() 
              : new Date(tItem.created_at || Date.now()).getTime();
            const minutesSince = (currentTime - lastCheck) / 60000;
            return minutesSince > (parInterval + 3);
          })(),
          timeSincePar: formatTimeSince(tItem.last_par_check, tItem.created_at),
          tacChannel: '',
          assignmentId: '',
          assignmentName: '',
          assignmentType: '',
          assignmentStatus: '',
          teamName: tItem.team_name_number,
          teamType: tItem.type,
          teamStatus: tItem.status,
          teamLeader: leaderById[tItem.leader_responder_id] || 'Unknown',
          hasBoth: false,
          teamId: tItem.team_id,
      };
    });

    let result = [...assignmentRows, ...teamOnlyRows];

    // Apply View Mode Filter
    if (viewMode === 'Operations') {
      result = result.filter(row => 
        row.teamStatus === 'Assigned' || row.teamStatus === 'Deployed'
      );
    } else if (viewMode === 'Planning') {
      result = result.filter(row => 
        !['Completed', 'Incomplete'].includes(row.assignmentStatus) &&
        (row.assignmentStatus === 'Planned' || row.teamStatus === 'Staged')
      );
    }

    // Apply Filters
    result = result.filter(row => {
      return Object.keys(filters).every(key => {
        if (!filters[key]) return true;
        const val = (row[key] || '').toString().toLowerCase();
        return val.includes(filters[key].toLowerCase());
      });
    });

    // Apply Sorting
    result.sort((a, b) => {
      if (!sortConfig.key) {
        // Default sort: Deployed on top, Completed at bottom
        const getPriority = (status) => {
          if (status === 'Deployed') return 1;
          if (status === 'Assigned') return 2;
          if (status === 'Planned') return 3;
          if (status === 'Completed') return 5;
          if (status === 'Incomplete') return 6;
          return 4; // team-only staged rows or empty status
        };

        const pA = getPriority(a.assignmentStatus);
        const pB = getPriority(b.assignmentStatus);

        if (pA !== pB) return pA - pB;

        if (a.hasBoth && !b.hasBoth) return -1;
        if (!a.hasBoth && b.hasBoth) return 1;
        return 0;
      }

      const aVal = (a[sortConfig.key] || '').toString().toLowerCase();
      const bVal = (b[sortConfig.key] || '').toString().toLowerCase();

      // Always sort empty values to the bottom regardless of direction
      if (aVal === '' && bVal !== '') return 1;
      if (aVal !== '' && bVal === '') return -1;
      if (aVal === '' && bVal === '') return 0;

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [assignments, teams, teamById, leaderById, filters, sortConfig, viewMode, parInterval, currentTime]);

  /**
   * Calculate operations statistics based on current data
   */
  const stats = useMemo(() => ({
    deployed: assignments.filter(a => a.status === 'Deployed').length,
    planned: assignments.filter(a => a.status === 'Planned').length,
    stagedTeams: teams.filter(t => t.status === 'Staged').length,
    stagedResponders: responders.filter(r => r.status === 'Staged').length,
    completed: assignments.filter(a => a.status === 'Completed').length,
    incomplete: assignments.filter(a => a.status === 'Incomplete').length,
  }), [assignments, teams, responders]);

  const availableTeams = useMemo(() => teams.filter(t => t.status === 'Staged'), [teams]);
  const availableAssignments = useMemo(() => assignments.filter(a => !a.team_id && a.status === 'Planned'), [assignments]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
          <p>Summary of assignments and teams in the current operational period.</p>
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
                <th onClick={() => requestSort('assignmentName')} style={{ cursor: 'pointer' }}>
                  Assignment Name {sortConfig.key === 'assignmentName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('assignmentType')} style={{ cursor: 'pointer' }}>
                  Assignment Type {sortConfig.key === 'assignmentType' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('tacChannel')} style={{ cursor: 'pointer' }}>
                  TAC {sortConfig.key === 'tacChannel' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('assignmentStatus')} style={{ cursor: 'pointer' }}>
                  Assignment Status {sortConfig.key === 'assignmentStatus' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('teamName')} style={{ cursor: 'pointer' }}>
                  Team Name {sortConfig.key === 'teamName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('teamType')} style={{ cursor: 'pointer' }}>
                  Team Type {sortConfig.key === 'teamType' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('teamLeader')} style={{ cursor: 'pointer' }}>
                  Team Leader {sortConfig.key === 'teamLeader' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => requestSort('teamStatus')} style={{ cursor: 'pointer' }}>
                  Team Status {sortConfig.key === 'teamStatus' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                {parInterval > 0 && (
                  <th onClick={() => requestSort('timeSincePar')} style={{ cursor: 'pointer' }}>
                    Last PAR Check {sortConfig.key === 'timeSincePar' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                )}
                <th>Actions</th>
              </tr>
              <tr className="filter-row">
                {Object.keys(filters).map(key => (
                  <td key={key}>
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={filters[key]}
                      onChange={(e) => handleFilterChange(key, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="column-filter-input"
                      style={{ width: '100%', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </td>
                ))}
                {parInterval > 0 && <td></td>}
                <td></td>
                <td></td>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-row">
                    No assignments or teams found for this operational period.
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.id} className={
                  (row.assignmentStatus === 'Deployed' && row.hasBoth) ? 'row-deployed' :
                  (row.assignmentStatus === 'Assigned' && row.hasBoth) ? 'row-assigned' :
                  (row.assignmentStatus === 'Completed' && row.hasBoth) ? 'row-complete' : ''
                }
                style={row.isParOverdue ? { backgroundColor: '#fff7ed', borderLeft: '4px solid #f97316' } : {}}>
                  <td>
                    {row.assignmentName ? (
                      <div 
                        className={`chip assignment-chip ${draggedItem?.id === row.id && draggedItem?.type === 'assignment' ? 'dragging' : ''} ${dropTarget?.id === row.id && dropTarget?.type === 'assignment' ? 'drop-target' : ''} ${row.hasBoth ? 'locked' : ''}`}
                        draggable={!row.hasBoth}
                        onDragStart={!row.hasBoth ? (e) => handleDragStart(e, row.id, 'assignment') : undefined}
                        onDragEnd={!row.hasBoth ? () => { setDraggedItem(null); setDropTarget(null); } : undefined}
                        onDragOver={!row.hasBoth ? (e) => handleDragOver(e, 'assignment') : undefined}
                        onDragEnter={!row.hasBoth ? (e) => handleDragEnter(e, row.id, 'assignment') : undefined}
                        onDragLeave={!row.hasBoth ? () => setDropTarget(null) : undefined}
                        onDrop={!row.hasBoth ? (e) => handleDrop(e, row.id, 'assignment') : undefined}
                        onClick={() => openEditAssignmentForm(assignmentById[getRawUuid(row.id)])}
                      >
                        {row.assignmentName}
                      </div>
                    ) : '—'}
                  </td>
                  <td>{row.assignmentType || '—'}</td>
                  <td>{row.tacChannel || '—'}</td>
                  <td>
                    {row.hasBoth ? (
                      <select 
                        value={row.assignmentStatus} 
                        // Correctly extract the full UUID after the 'asn-' prefix
                        onChange={(e) => handleStatusUpdate(row.id.slice(4), row.teamId, e.target.value)}
                        className={`status-indicator ${row.assignmentStatus.toLowerCase()} status-select-inline`}
                      >
                        <option value="Planned">Planned</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Deployed">Deployed</option>
                        <option value="Completed">Completed</option>
                        <option value="Incomplete">Incomplete</option>
                      </select>
                    ) : row.assignmentStatus ? (
                        <span className={`status-indicator ${row.assignmentStatus.toLowerCase()}`}>
                          {row.assignmentStatus}
                        </span>
                    ) : '—'}
                  </td>
                  <td>
                    {row.teamName ? (
                      <div 
                        className={`chip team-chip ${draggedItem?.id === row.teamId && draggedItem?.type === 'team' ? 'dragging' : ''} ${dropTarget?.id === row.teamId && dropTarget?.type === 'team' ? 'drop-target' : ''} ${row.hasBoth ? 'locked' : ''}`}
                        draggable={!row.hasBoth}
                        onDragStart={!row.hasBoth ? (e) => handleDragStart(e, row.teamId, 'team') : undefined}
                        onDragEnd={!row.hasBoth ? () => { setDraggedItem(null); setDropTarget(null); } : undefined}
                        onDragOver={!row.hasBoth ? (e) => handleDragOver(e, 'team') : undefined}
                        onDragEnter={!row.hasBoth ? (e) => handleDragEnter(e, row.teamId, 'team') : undefined}
                        onDragLeave={!row.hasBoth ? () => setDropTarget(null) : undefined}
                        onDrop={!row.hasBoth ? (e) => handleDrop(e, row.teamId, 'team') : undefined}
                        onClick={() => openEditTeamForm(teamById[row.teamId])}
                      >
                        {row.teamName}
                      </div>
                    ) : '—'}
                  </td>
                  <td>{row.teamType || '—'}</td>
                  <td>{row.teamLeader || '—'}</td>
                  <td>
                    {row.teamStatus ? (
                      <span className={`status-indicator ${row.teamStatus.toLowerCase()}`}>
                        {row.teamStatus}
                      </span>
                    ) : '—'}
                  </td>
                  {parInterval > 0 && (
                    <td>
                      {row.isParOverdue ? (
                        <span style={{ 
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
                        }}>
                          {row.timeSincePar}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {row.timeSincePar}
                        </span>
                      )}
                    </td>
                  )}
                  <td>
                    <select 
                      className="status-update-select"
                      value=""
                      onChange={(e) => {
                        const action = e.target.value;
                        const rawId = getRawUuid(row.id);

                        if (action === 'edit-team') {
                          openEditTeamForm(teamById[row.teamId]);
                        } else if (action === 'edit-assignment') {
                          openEditAssignmentForm(assignmentById[rawId]);
                        } else if (action === 'reset-par') {
                          handleResetPar(row.teamId, row.teamName);
                        } else if (action === 'unassign') {
                          handleUnassignTeam(rawId, row.teamId, row.assignmentName, row.teamName);
                        } else if (action === 'assign-resource') {
                          setAssigningRow(row);
                          setSelectedAssignTarget('');
                        } else if (action === 'edit') {
                          if (row.teamId) openEditTeamForm(teamById[row.teamId]);
                          else openEditAssignmentForm(assignmentById[rawId]);
                        } else if (action === 'new-team') {
                          // Link new team to current assignment if it exists in this row
                          setPendingAssignmentId(row.id.startsWith('asn-') ? rawId : null);
                          setTeamForm({
                            op_period_id: operationalPeriodId,
                            team_name_number: '',
                            status: 'Assigned',
                            type: 'Ground Search',
                            leader_responder_id: null,
                            equipment: [],
                            responder_ids: []
                          });
                          setShowTeamForm(true);
                        } else if (action === 'new-assignment') {
                          // Link new assignment to current team if it exists in this row
                          setPendingTeamId(row.teamId || null);
                          setAssignmentForm({
                            op_period_id: operationalPeriodId,
                            name: '',
                            status: 'Assigned',
                            division: 'A',
                            assignment_type: 'Ground',
                            assignment_size: 2,
                            tac_channel: '',
                            description_narrative: ''
                          });
                          setShowAssignmentForm(true);
                        }
                        else if (action === 'release') handleReleaseTeam(row.teamId, row.teamName);
                        else if (action === 'delete') handleDeleteAssignment(rawId, row.assignmentName);
                      }}
                    >
                      <option value="" disabled>Actions...</option>
                      {row.hasBoth ? (
                        <>
                          <option value="edit-team">Edit Team</option>
                          <option value="edit-assignment">Edit Assignment</option>
                          <option value="unassign">Unassign Team</option>
                          {parInterval > 0 && <option value="reset-par">Reset PAR</option>}
                          <option value="new-team">New Team</option>
                          <option value="new-assignment">New Assignment</option>
                        </>
                      ) : (
                        <>
                          <option value="edit">Edit</option>
                          <option value="assign-resource">
                            {row.assignmentId ? 'Assign Team' : 'Assign Assignment'}
                          </option>
                          <option value="new-team">New Team</option>
                          <option value="new-assignment">New Assignment</option>
                          {row.teamId ? (
                            <>
                              {parInterval > 0 && <option value="reset-par">Reset PAR</option>}
                                {row.teamStatus === 'Staged' && <option value="detach">Disband Team</option>}
                              <option value="release">Release Team</option>
                            </>
                          ) : (
                            <option value="delete">Delete Assignment</option>
                          )}
                        </>
                      )}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        <div className="operations-stats-footer" style={{ 
          marginTop: '24px',
          display: 'flex',
          gap: '32px',
          flexWrap: 'wrap',
          padding: '16px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}
        >
          <div style={{ fontSize: '13px' }}><strong>Assignments/Teams Deployed:</strong> {stats.deployed}</div>
          <div style={{ fontSize: '13px' }}><strong>Assignments planned:</strong> {stats.planned}</div>
          <div style={{ fontSize: '13px' }}><strong>Teams staged:</strong> {stats.stagedTeams}</div>
          <div style={{ fontSize: '13px' }}><strong>Responders staged:</strong> {stats.stagedResponders}</div>
          <div style={{ fontSize: '13px' }}><strong>Assignments completed:</strong> {stats.completed}</div>
          <div style={{ fontSize: '13px' }}><strong>Assignments incomplete:</strong> {stats.incomplete}</div>
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
            <label>{assigningRow.assignmentId ? 'Select Staged Team' : 'Select Planned Assignment'}</label>
            <select 
              className="status-update-select" 
              value={selectedAssignTarget} 
              onChange={(e) => setSelectedAssignTarget(e.target.value)}
            >
              <option value="" disabled>Choose a resource...</option>
              {assigningRow.assignmentId ? 
                availableTeams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name_number} ({t.type})</option>) :
                availableAssignments.map(a => <option key={a.assignment_id} value={a.assignment_id}>{a.name} ({a.division})</option>)
              }
            </select>
          </div>
        </BaseModal>
      )}
    </div>
  );
};

export default OperationsDashboardPage;
