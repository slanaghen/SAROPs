import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/OperationsDashboard.css';
import '../styles/PlanningDashboard.css'; // Reusing form styles
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import TeamFormModal from '../components/TeamFormModal';
import AssignmentFormModal from '../components/AssignmentFormModal';
import BaseModal from '../components/BaseModal';
import OperationsTable from '../components/OperationsTable';
import OperationsMap from '../components/OperationsMap';
import VehicleFormModal from '../components/admin/VehicleFormModal';
import { checkIsParOverdue, formatTimeSince } from '../utils/operationalUtils';

const OperationsDashboardPage = ({ operationalPeriodId: propOpId }) => {
  const { 
    incidentData, incidentId, responderName, user, operationsRefreshInterval
  } = useIncident(); 
  
  const [showGlobalMap, setShowGlobalMap] = useState(false); // Local state for layout toggle
  const operationalPeriodId = propOpId || incidentData?.opPeriodId;

  const {
    teams, assignments, responders, vehicles, opPeriod, loading, error, setError, setLoading, stats,
    fetchDashboardData, updateResourceStatus, assignTeamToAssignment, unassignTeam,
    createTeam, createAssignment, deleteAssignment, deleteTeam, attachVehicleToTeam,
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
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

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

  const sartopoId = opPeriod?.incidents?.sartopo_id;
  const parInterval = opPeriod?.par_check_interval || 0;

  const commandStaffExists = useMemo(() => (teams || []).some(t => t.type === 'Staff'), [teams]);

  const teamById = useMemo(() => {
    const lookup = {};
    (teams || []).forEach(t => {
      if (t?.team_id) lookup[t.team_id] = t;
    });
    return lookup;
  }, [teams]);

  const leaderById = useMemo(() => {
    const lookup = {};
    (responders || []).forEach(r => {
      if (r?.responder_id) lookup[r.responder_id] = r.name;
    });
    return lookup;
  }, [responders]);

  const leaderIdentifierById = useMemo(() => {
    const lookup = {};
    (responders || []).forEach(r => {
      if (r?.responder_id) lookup[r.responder_id] = r.identifier;
    });
    return lookup;
  }, [responders]);

  const assignmentById = useMemo(() => {
    const lookup = {};
    (assignments || []).forEach(a => {
      if (a?.assignment_id) lookup[a.assignment_id] = a;
    });
    return lookup;
  }, [assignments]);

  const getRawUuid = (rowId) => {
    if (!rowId) return null;
    if (rowId.startsWith('asn-')) return rowId.slice(4);
    if (rowId.startsWith('team-')) return rowId.slice(5);
    return rowId;
  };

  const rows = useMemo(() => {
    const assignmentRows = (assignments || []).map(asnItem => {
      // Restore client-side join for robustness against raw table fetches or RLS join blocks
      const matchingTeam = asnItem.team_id ? teamById[asnItem.team_id] : null;
      
      return {
        id: `asn-${asnItem.assignment_id}`,
        isParOverdue: checkIsParOverdue(matchingTeam || asnItem, parInterval, currentTime),
        timeSincePar: (matchingTeam || asnItem.team_id) ? formatTimeSince(matchingTeam?.last_par_check || asnItem.last_par_check || matchingTeam?.created_at || asnItem.created_at, currentTime) : '',
        tacChannel: asnItem.frequency_primary || '—',
        assignmentId: asnItem.assignment_id,
        assignmentName: asnItem.title,
        assignmentOrigin: asnItem.origin,
        assignmentPriority: asnItem.priority || '—',
        assignmentType: asnItem.resource_type || '—',
        assignmentStatus: asnItem.status,
        teamName: matchingTeam?.team_name_number || asnItem.team_name || '',
        teamType: matchingTeam?.type || asnItem.team_type || '',
        teamLeader: matchingTeam?.leader_name || asnItem.leader_name || leaderById[matchingTeam?.leader_responder_id || asnItem.leader_responder_id] || '',
        leaderIdentifier: matchingTeam?.leader_identifier || asnItem.leader_identifier || leaderIdentifierById[matchingTeam?.leader_responder_id || asnItem.leader_responder_id] || '—',
        teamSize: matchingTeam?.member_count || asnItem.member_count || matchingTeam?.current_responders?.length || 0,
        leaderId: matchingTeam?.leader_responder_id || asnItem.leader_responder_id || null,
        teamStatus: matchingTeam?.status || asnItem.team_status || '',
        hasBoth: !!(asnItem.team_id || matchingTeam),
        teamId: asnItem.team_id,
        vehicleSearch: (matchingTeam?.current_vehicles || asnItem.current_vehicles || []).map(v => `${v.designation} ${v.type}`).join(' ').toLowerCase()
      };
    });

    const assignmentTeamSet = new Set();
    (assignments || []).forEach(a => { if (a.team_id) assignmentTeamSet.add(a.team_id); });

    // Team only rows benefit from metadata in the dashboard_teams view
    const teamOnlyRows = (teams || []).filter(tItem => !assignmentTeamSet.has(tItem.team_id)).map(tItem => ({
      id: `team-${tItem.team_id}`,
      isParOverdue: checkIsParOverdue(tItem, parInterval, currentTime),
      timeSincePar: formatTimeSince(tItem.last_par_check || tItem.created_at, currentTime),
      tacChannel: '', assignmentId: '', assignmentName: '', assignmentPriority: '', assignmentType: '', assignmentStatus: '',
      teamName: tItem.team_name_number, teamType: tItem.type, teamStatus: tItem.status,
      teamLeader: tItem.leader_name || leaderById[tItem.leader_responder_id] || 'Unknown',
      leaderIdentifier: tItem.leader_identifier || leaderIdentifierById[tItem.leader_responder_id] || '—',
      teamSize: tItem.member_count || tItem.current_responders?.length || 0,
      leaderId: tItem.leader_responder_id || null,
      hasBoth: false, teamId: tItem.team_id,
      vehicleSearch: (tItem.current_vehicles || []).map(v => `${v.designation} ${v.type}`).join(' ').toLowerCase()
    }));

    let result = [...assignmentRows, ...teamOnlyRows];
    if (viewMode === 'Operations') {
      result = result.filter(r => r.teamType === 'Staff' || (r.teamStatus === 'Assigned' || r.teamStatus === 'Deployed' || r.assignmentStatus === 'Completed' || r.assignmentStatus === 'Incomplete'));
    } else if (viewMode === 'Planning') {
      result = result.filter(r => r.teamType === 'Staff' || (!['Completed', 'Incomplete'].includes(r.assignmentStatus) && (r.assignmentStatus === 'Planned' || r.teamStatus === 'Staged')));
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
  }, [assignments, teams, teamById, leaderById, leaderIdentifierById, assignmentFilter, teamFilter, sortConfig, viewMode, parInterval, currentTime]);

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
      // Update team status - Redundant responder status updates removed.
      // The database trigger 'sync_team_status_on_team_update' automatically 
      // handles releasing responders to "Staged" and closing history logs.
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

    // Responders and Vehicles can only be dropped onto teams
    if (['responder', 'vehicle'].includes(draggedItem.type) && type !== 'team') return;

    e.preventDefault();
  };

  const handleDragEnter = (e, id, type) => {
    if (!draggedItem || draggedItem.type === type) return;

    // Validate highlighting for Team/Assignment linkage
    if (draggedItem.type === 'team' || draggedItem.type === 'assignment') {
      const targetRow = rows.find(r => r.id === id);
      if (targetRow?.hasBoth) return;
    }

    // Prevent highlighting assignments when dragging logistical resources
    if (['responder', 'vehicle'].includes(draggedItem.type) && type !== 'team') return;

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
      // Vehicle -> Team attachment
      else if (draggedItem.type === 'vehicle' && targetType === 'team') {
        const teamId = getRawUuid(targetId);
        if (teamId) await attachVehicleToTeam(draggedItem.id, teamId);
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
      // Requirement: Fetch both current membership and vehicle attachments for reconciliation
      const [membersRes, vehiclesRes] = await Promise.all([
        supabase.from('team_responders').select('responder_id, role').eq('team_id', team.team_id),
        supabase.from('vehicles').select('vehicle_id').eq('team_id', team.team_id)
      ]);

      const members = membersRes.data || [];
      const currentVehicles = vehiclesRes.data || [];

      setTeamForm({
        ...team,
        current_responders: members,
        responder_ids: members.map(m => m.responder_id),
        current_vehicles: currentVehicles,
        vehicle_ids: currentVehicles.map(v => v.vehicle_id)
      });
      setShowTeamForm(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVehicle = async (formData) => {
    setLoading(true);
    try {
      const payload = {
        designation: formData.designation,
        type: formData.type,
        status: formData.status,
        incident_id: formData.incident_id || incidentId
      };

      if (formData.vehicle_id) {
        const { error } = await supabase.from('vehicles').update(payload).eq('vehicle_id', formData.vehicle_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehicles')
          .upsert({ ...payload, checkin_datetime: new Date().toISOString() }, { onConflict: 'incident_id, designation' });
        if (error) throw error;
      }
      
      await fetchDashboardData();
      setShowVehicleForm(false);
      setEditingVehicle(null);
    } catch (err) {
      setError(err.message || 'Failed to save vehicle');
    } finally {
      setLoading(false);
    }
  };

  const openEditAssignmentForm = (assignment) => {
    if (!assignment) return;
    setAssignmentForm(assignment);
    setShowAssignmentForm(true);
  };

  const handleSaveTeam = async (formData, stayOpen = false) => {
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

        // Reconcile vehicles
        const finalVehIds = formData.vehicle_ids || [];
        const originalVehIds = teamById[formData.team_id]?.current_vehicles?.map(v => v.vehicle_id) || [];
        const vehToAdd = finalVehIds.filter(id => !originalVehIds.includes(id));
        const vehToRemove = originalVehIds.filter(id => !finalVehIds.includes(id));

        await Promise.all([
          ...vehToAdd.map(id => supabase.from('vehicles').update({ team_id: formData.team_id }).eq('vehicle_id', id)),
          ...vehToRemove.map(id => supabase.from('vehicles').update({ team_id: null }).eq('vehicle_id', id))
        ]);
      } else {
        // The createTeam hook already injects op_period_id and refreshes tactical views.
        // We construct a clean payload for the teams table here.
        const newTeam = await createTeam(payload);

        if (newTeam?.team_id) {
          // 1. Process initial responder attachments
          const finalIds = formData.responder_ids || [];
          const roles = formData.responder_roles || {};
          if (finalIds.length > 0 && attachResponderToTeam) {
             await Promise.all(finalIds.map(id => 
               attachResponderToTeam(id, newTeam.team_id, roles[id] || '')
             ));
          }
        
          // 2. Requirement: Process initial vehicle assignments using the in() operator for arrays.
          if (formData.vehicle_ids?.length > 0) {
            await supabase.from('vehicles').update({ team_id: newTeam.team_id }).in('vehicle_id', formData.vehicle_ids);
          }

          if (pendingAssignmentId) await assignTeamToAssignment(newTeam.team_id, pendingAssignmentId);
        }

      }

      setPendingAssignmentId(null);
      if (stayOpen) {
        openNewTeamForm();
      } else {
        setShowTeamForm(false);
      }
    } catch (err) {
      setPendingAssignmentId(null);
    }
  };

  const handleSaveAssignment = async (formData, stayOpen = false) => {
    const targetTeamId = !!formData.assignment_id ? formData.team_id : (pendingTeamId || null);
    
    try {
      // Auto-generate assignment title if blank (Requirement: next sequential AA, AB...)
      // This ensures assignments follow the standard [Division][Suffix] SAR pattern.
      let finalTitle = formData.title?.trim();
      if (!finalTitle) {
        const division = formData.segment?.trim() || 'A';
        const usedSuffixes = new Set(
          (assignments || [])
            .filter(a => a.segment === division)
            .map(a => (a.title && a.title.startsWith(division)) ? a.title.slice(division.length) : null)
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
        op_period_id: operationalPeriodId,
        title: finalTitle,
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
      if (stayOpen) {
        openNewAssignmentForm();
      } else {
        setShowAssignmentForm(false);
      }
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
          className="operations-content-wrapper layout-table" 
          style={{
            ...(loading ? { opacity: 0.8 } : {}),
            display: 'block',
            height: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}
        >
            <div className="table-panel" style={{
              width: '100%',
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
              onNewTeam={(asnId) => { setPendingAssignmentId(asnId); setTeamForm({ op_period_id: operationalPeriodId, status: 'Staged', type: 'Ground' }); setShowTeamForm(true); }}
                onNewAssignment={(teamId) => { setPendingTeamId(teamId); setAssignmentForm({ op_period_id: operationalPeriodId, status: 'Assigned', segment: 'A' }); setShowAssignmentForm(true); }}
              onDeleteAssignment={handleDeleteAssignment} onAssignResource={(row) => { setAssigningRow(row); setSelectedAssignTarget(''); }}
              draggedItem={draggedItem} dropTarget={dropTarget}
              onDragStart={handleDragStart} onDragEnd={() => { setDraggedItem(null); setDropTarget(null); }}
              onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={() => setDropTarget(null)} onDrop={handleDrop}
            />
          </div>
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
          vehicles={vehicles}
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
              Send a message to all <strong>{teams.length}</strong> teams in this operational period.
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
