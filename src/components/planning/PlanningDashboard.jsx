import React, { useState, useMemo, useCallback } from 'react';
import '../../styles/PlanningDashboard.css';
import TeamFormModal from '../team/TeamFormModal';
import AssignmentFormModal from '../AssignmentFormModal';
import ResponderFormModal from '../responder/ResponderFormModal';
import VehicleFormModal from '../admin/VehicleFormModal';
import { useResourceDragAndDrop } from '../../hooks/useResourceDragAndDrop';
import ResponderColumn from './ResponderColumn';
import VehicleColumn from './VehicleColumn';
import TeamColumn from './TeamColumn';
import AssignmentColumn from './AssignmentColumn';

import { useToast } from '../../context/ToastContext';
/**
 * PlanningDashboard Component
 * 
 * Displays staged teams and allows operators to map teams to assignments.
 * Features:
 * - Lists all teams with "Staged" status in the current operational period
 * - Shows available assignments that can receive team assignments
 * - Provides UI to select a team and assignment, then execute the mapping
 * - Displays team details (type, equipment, leader) and assignment info
 */
const PlanningDashboard = ({ 
  operationalPeriodId, 
  teams = [],
  assignments = [], 
  responders = [],
  vehicles = [],
  defaultNewTeamName = '',
  defaultNewTeamType = 'Ground',
  defaultNewAssignmentDivision = 'A',
  defaultNewAssignmentName = '',
  defaultNewAssignmentType = 'Ground',
  defaultNewAssignmentSize = 2,
  onTeamAssigned,
  createTeam,
  createAssignment,
  createResponder,
  createVehicle,
  updateVehicle,
  updateAssignment,
  deleteAssignment,
  updateTeam,
  disbandTeam,
  updateResponder,
  checkOutResponder,
  attachResponderToTeam,
  attachVehicleToTeam,
  detachResponderFromTeam,
  deleteTeam,
}) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false); // Local loading state for individual actions
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showResponderForm, setShowResponderForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [teamForm, setTeamForm] = useState({});
  const [assignmentForm, setAssignmentForm] = useState({});
  const [responderForm, setResponderForm] = useState({});
  const [vehicleForm, setVehicleForm] = useState({});
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeTeam, setActiveTeam] = useState(null);
  const [responderFilter, setResponderFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('sarops_view_mode') || 'All');

  // Define helper functions before they are used in useMemo hooks to avoid initialization errors
  const getResponderName = (responderId) => {
    const responder = (responders || []).find(r => r.responder_id === responderId);
    return responder ? responder.name : 'Unknown';
  };

  const getTeamMemberCount = (team) => {
    return team.current_responders?.length || 0;
  };

  const getTeamVehicleCount = (team) => {
    return team.current_vehicles?.length || 0;
  };

  const isStagedResponder = (responder) => String(responder?.status || '').toLowerCase() === 'staged';

  const commandStaffExists = useMemo(() => (teams || []).some(t => t?.type === 'Staff'), [teams]);

  const isTeamHighlighted = (teamId) => {
    if (!draggedItem) return false;
    
    // Highlight if dragging team over assignment, or if dragging assignment/responder over this team
    if (draggedItem.id === teamId && draggedItem.type === 'team' && (dropTarget?.type === 'assignment')) return true;
    if (dropTarget?.id === teamId && (draggedItem.type === 'assignment' || draggedItem.type === 'responder' || draggedItem.type === 'vehicle')) return true;
    
    return false;
  };

  const isAssignmentHighlighted = (assignmentId) => {
    if (!draggedItem) return false;
    // Highlighting for symmetry (team dragged over assignment)
    if (draggedItem.id === assignmentId && draggedItem.type === 'assignment' && dropTarget?.type === 'team') return true;
    if (dropTarget?.id === assignmentId && draggedItem.type === 'team') return true;
    return false;
  };

  const isResponderHighlighted = (responderId) => {
    if (!draggedItem) return false;
    // Highlight if we are dragging a responder over a team or vice versa
    if (draggedItem.id === responderId && draggedItem.type === 'responder' && (dropTarget?.type === 'team')) return true;
    if (dropTarget?.id === responderId && (draggedItem.type === 'team')) return true;
    return false;
  };

  const isVehicleHighlighted = (vehicleId) => {
    if (!draggedItem) return false;
    // Highlight if we are dragging a vehicle over a team or vice versa
    if (draggedItem.id === vehicleId && draggedItem.type === 'vehicle' && (dropTarget?.type === 'team')) return true;
    if (dropTarget?.id === vehicleId && (draggedItem.type === 'team')) return true;
    return false;
  };

  // Filter responders logic
  const availableRespondersList = useMemo(() => {
    return (responders || []).filter(r => {
      const statusLower = String(r.status || '').toLowerCase();
      // View Mode Filter
      if (viewMode === 'Operations') {
        if (!['attached', 'assigned', 'deployed'].includes(statusLower)) return false;
      } else if (viewMode === 'Planning' && statusLower !== 'staged') return false;
      
      const term = responderFilter.toLowerCase().trim();
      if (!term) return true;
      
      return (
        r.name.toLowerCase().includes(term) ||
        r.identifier.toLowerCase().includes(term) ||
        (r.agency && r.agency.toLowerCase().includes(term)) ||
        (r.special_skills && r.special_skills.toLowerCase().includes(term))
      );
    });
  }, [responders, responderFilter, viewMode]);

  // Filter vehicles logic
  const availableVehiclesList = useMemo(() => {
    return (vehicles || []).filter(v => {
      const statusLower = String(v.status || '').toLowerCase();
      if (statusLower === 'checkedout') return false;

      if (viewMode === 'Operations') {
        if (!['attached', 'assigned', 'deployed'].includes(statusLower)) return false;
      } else if (viewMode === 'Planning' && statusLower !== 'staged') return false;
      
      const term = vehicleFilter.toLowerCase().trim();
      if (!term) return true;
      
      return (
        (v.designation || '').toLowerCase().includes(term) ||
        (v.type && v.type.toLowerCase().includes(term))
      );
    });
  }, [vehicles, vehicleFilter, viewMode]);

  // Filter teams logic
  const filteredTeams = useMemo(() => {
    return (teams || []).filter(t => {
      // View Mode Filter
      if (viewMode === 'Operations') {
        if (!['Assigned', 'Deployed'].includes(t.status)) return false;
      } else if (viewMode === 'Planning' && t.status !== 'Staged') return false;

      const term = teamFilter.toLowerCase().trim();
      if (!term) return true;

      const leaderName = getResponderName(t.leader_responder_id).toLowerCase();

      // Requirement: Include vehicle information in the filter query
      const vehicleMatch = (t.current_vehicles || []).some(v => 
        (v.designation || '').toLowerCase().includes(term) ||
        (v.type || '').toLowerCase().includes(term)
      );

      return (
        t.team_name_number.toLowerCase().includes(term) ||
        t.type.toLowerCase().includes(term) ||
        leaderName.includes(term) ||
        vehicleMatch
      );
    });
  }, [teams, teamFilter, viewMode, responders]);

  // Filter assignments logic
  const filteredAssignments = useMemo(() => {
    return (assignments || []).filter(asn => {
      if (asn.op_period_id !== operationalPeriodId || asn.is_orphaned) return false;

      // View Mode Filter
      if (viewMode === 'Operations') {
        if (!['Assigned', 'Deployed'].includes(asn.status)) return false;
      } else if (viewMode === 'Planning') {
        if (asn.status !== 'Planned' || asn.team_id) return false;
      }

      const term = assignmentFilter.toLowerCase().trim();
      if (!term) return true;

      // Requirement: Include vehicle information in the filter query
      const vehicleMatch = (asn.current_vehicles || []).some(v => 
        (v.designation || '').toLowerCase().includes(term) ||
        (v.type || '').toLowerCase().includes(term)
      );

      return (
        asn.title.toLowerCase().includes(term) ||
        (asn.resource_type && asn.resource_type.toLowerCase().includes(term)) ||
        (asn.description && asn.description.toLowerCase().includes(term)) ||
        (asn.segment && asn.segment.toLowerCase().includes(term)) ||
        vehicleMatch
      );
    });
  }, [assignments, assignmentFilter, viewMode, operationalPeriodId]);

  const onDropResource = useCallback(async (dragged, target) => {
    const { id: draggedId, type: draggedType } = dragged;
    const { id: targetId, type: targetType } = target;

    // Team <-> Assignment logic
    if ((draggedType === 'team' && targetType === 'assignment') || (draggedType === 'assignment' && targetType === 'team')) {
      const teamId = draggedType === 'team' ? draggedId : targetId;
      const assignmentId = draggedType === 'assignment' ? draggedId : targetId;
      const team = teams.find(t => t.team_id === teamId);
      const assignment = assignments.find(a => a.assignment_id === assignmentId);

      if (team && assignment) {
        setLoading(true);
        try {
          if (onTeamAssigned) {
            await onTeamAssigned({ teamId, assignmentId, team, assignment });
          }
          addToast(`Team "${team.team_name_number}" assigned to "${assignment.title}"`, 'success');
        } catch (err) {
          addToast(err.message || 'Failed to assign team', 'error');
        } finally {
          setLoading(false);
        }
      }
    } 
    // Responder <-> Team logic
    else if ((draggedType === 'responder' && targetType === 'team') || (draggedType === 'team' && targetType === 'responder')) {
      const responderId = draggedType === 'responder' ? draggedId : targetId;
      const teamId = draggedType === 'team' ? draggedId : targetId;
      const responder = (responders || []).find(r => r.responder_id === responderId);
      const team = (teams || []).find(t => t.team_id === teamId);

      if (responder && team) {
        setLoading(true);
        try {
          if (attachResponderToTeam) {
            await attachResponderToTeam(responderId, teamId); 
            addToast(`Responder "${responder.name}" attached to team "${team.team_name_number}"`, 'success');
          }
        } catch (err) {
          addToast(err.message || 'Failed to attach responder to team', 'error');
        } finally {
          setLoading(false);
        }
      }
    }
    // Vehicle <-> Team logic
    else if ((draggedType === 'vehicle' && targetType === 'team') || (draggedType === 'team' && targetType === 'vehicle')) {
      const vehicleId = draggedType === 'vehicle' ? draggedId : targetId;
      const teamId = draggedType === 'team' ? draggedId : targetId;
      const vehicle = (vehicles || []).find(v => v.vehicle_id === vehicleId);
      const team = (teams || []).find(t => t.team_id === teamId);

      if (vehicle && team) {
        setLoading(true);
        try {
          if (attachVehicleToTeam) {
            await attachVehicleToTeam(vehicleId, teamId); 
            addToast(`Vehicle "${vehicle.designation}" attached to team "${team.team_name_number}"`, 'success');
          }
        } catch (err) {
          addToast(err.message || 'Failed to attach vehicle to team', 'error');
        } finally {
          setLoading(false);
        }
      }
    }
  }, [teams, assignments, responders, vehicles, onTeamAssigned, attachResponderToTeam, attachVehicleToTeam, addToast]);

  const { draggedItem, dropTarget, ...dndHandlers } = useResourceDragAndDrop({ onDropResource });

  const openNewTeamForm = () => {
    setTeamForm({
      op_period_id: operationalPeriodId,
      team_name_number: defaultNewTeamName,
      type: defaultNewTeamType,
      status: 'Staged',
      leader_responder_id: null,
      equipment: [],
      responder_ids: [],
    });
    setShowTeamForm(true);
  };

  const openNewAssignmentForm = () => {
    setAssignmentForm({
      op_period_id: operationalPeriodId,
      segment: defaultNewAssignmentDivision,
      title: defaultNewAssignmentName,
      resource_type: defaultNewAssignmentType,
      team_size: defaultNewAssignmentSize,
      frequency_primary: '',
      description: '',
      probability_of_detection: null,
      debrief_narrative: '',
      hazards: '',
      priority: 'Medium',
      status: 'Planned',
    });
    setShowAssignmentForm(true);
  };

  const openEditAssignmentForm = (assignmentId) => {
    const assignmentToEdit = assignments.find(a => a.assignment_id === assignmentId);
    if (!assignmentToEdit) {
      console.error(`Assignment with ID ${assignmentId} not found.`);
      addToast('Could not find the specified assignment.', 'error');
      return;
    }
    console.log('📝 Opening Assignment Editor for:', assignmentToEdit.title);
    setAssignmentForm({ ...assignmentToEdit });
    setShowAssignmentForm(true);
  };

  const openEditTeamForm = (teamId) => {
    const teamToEdit = teams.find(t => t.team_id === teamId);
    if (!teamToEdit) {
      console.error(`Team with ID ${teamId} not found.`);
      addToast('Could not find the specified team.', 'error');
      return;
    }
    console.log('📝 Opening Team Editor for:', teamToEdit.team_name_number);
    console.log('[PlanningDashboard] openEditTeamForm: Setting initialData for modal:', teamToEdit);
    setTeamForm({
      ...teamToEdit,
    });
    setShowTeamForm(true);
  };

  const openEditResponderForm = (responder) => {
    if (responder) {
      console.log('📝 Opening Responder Editor for:', responder.name);
      setResponderForm({ ...responder });
    } else {
      console.log('📝 Opening Responder Editor for New Responder');
      setResponderForm({
        name: '',
        agency: '',
        identifier: '',
        cell_phone: '',
        responder_type: 'SAR',
        access_level: 'responder',
        status: 'Staged',
        special_skills: ''
      });
    }
    setShowResponderForm(true);
  };

  const openNewVehicleForm = () => {
    console.log('📝 Opening Vehicle Editor for New Vehicle');
    setVehicleForm({
      designation: '',
      type: '',
      status: 'Staged',
    });
    setShowVehicleForm(true);
  };

  const openEditVehicleForm = (vehicle) => {
    console.log('📝 Opening Vehicle Editor for:', vehicle.designation);
    setVehicleForm({
      ...vehicle,
      status: vehicle.status || 'Staged'
    });
    setShowVehicleForm(true);
  };

  const handleToggleNewTeamResponder = (responderId) => {
    const selectedIds = teamForm.responder_ids || [];
    const isSelected = selectedIds.includes(responderId);
    setTeamForm({
      ...teamForm,
      responder_ids: isSelected
        ? selectedIds.filter(id => id !== responderId)
        : [...selectedIds, responderId],
    });
  };

  const handleDisbandTeam = async (team) => {
    const msg = `Are you sure you want to disband team "${team.team_name_number}"? This will return all members to Staged status.`;
    if (!window.confirm(msg)) return;

    try {
      if (disbandTeam) {
        // This performs a "soft delete" by setting the team's status to 'Disbanded'
        // and relies on database triggers to correctly update member statuses.
        await disbandTeam(team.team_id);
        addToast(`Team "${team.team_name_number}" released.`, 'success');
      }
    } catch (err) {
      addToast(err.message || 'Failed to release team', 'error');
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${assignment.title}"? This action cannot be undone.`)) return;

    try {
      setLoading(true);
      if (deleteAssignment) {
        await deleteAssignment(assignment.assignment_id);
        addToast(`Assignment "${assignment.title}" deleted.`, 'success');
        // No local success message needed, toast handles it
      }
    } catch (err) {
      addToast(err.message || 'Failed to delete assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTeam = async (formData, stayOpen = false) => {
    console.log('[PlanningDashboard] handleSaveTeam: Received form data from modal:', formData);
    if (!formData.leader_responder_id) {
      throw new Error('A team leader must be selected in order to save a team.'); // Error handled by catch block
    }

    try {
      setLoading(true);
      
      // Auto-generate team name if blank
      let finalTeamName = formData.team_name_number?.trim();
      if (!finalTeamName) {
        const type = formData.type || 'Other';
        const existingOfSameType = (teams || []).filter(t => t.type === type);
        let nextNum = existingOfSameType.length + 1;
        finalTeamName = `${type} ${nextNum}`;

        // Local uniqueness check to avoid immediate collisions
        while ((teams || []).some(t => t.team_name_number === finalTeamName)) {
          nextNum++;
          finalTeamName = `${type} ${nextNum}`;
        }
      }

      const finalResponderIds = formData.responder_ids || [];

      console.log(`[PlanningDashboard] handleSaveTeam: Processing ${formData.team_id ? 'UPDATE' : 'CREATE'}. Final name: "${finalTeamName}". Leader: ${formData.leader_responder_id}, Members:`, finalResponderIds);
      if (formData.team_id && updateTeam) {
        const payload = {
          team_name_number: finalTeamName,
          type: formData.type,
          sartopo_color_hex: formData.sartopo_color_hex || '#ff0000',
          op_period_id: formData.op_period_id,
          status: formData.status,
          leader_responder_id: formData.leader_responder_id,
          equipment: formData.equipment,
          responder_ids: finalResponderIds
        };
        console.log('[PlanningDashboard] handleSaveTeam: Calling updateTeam with payload:', payload);
        await updateTeam(formData.team_id, payload, formData.responder_roles, formData.vehicle_ids);
        addToast('Team updated.', 'success');
      } else if (createTeam) {
        const payload = {
          team_name_number: finalTeamName,
          type: formData.type || 'Other',
          sartopo_color_hex: formData.sartopo_color_hex || '#ff0000',
          status: formData.status || 'Staged',
          leader_responder_id: formData.leader_responder_id,
          equipment: formData.equipment,
          responder_ids: finalResponderIds
        };
        console.log('[PlanningDashboard] handleSaveTeam: Calling createTeam with payload:', payload);
        await createTeam(payload, formData.responder_roles, formData.vehicle_ids);
        addToast('Team created.', 'success');
      }
      if (stayOpen) {
        openNewTeamForm();
      } else {
        setShowTeamForm(false);
      }
    } catch (err) {
      addToast(err.message || 'Failed to save team.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignment = async (formData, stayOpen = false) => {
    try {
      setLoading(true);

      // Auto-generate assignment title if blank (Requirement: next sequential AA, AB...)
      // Note: AA, AB pattern is the standard nomenclature for Assignment segments.
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

      // Cleanse payload to prevent PostgREST errors with joined/calculated fields (like 'team_name')
      const payload = {
        op_period_id: formData.op_period_id,
        title: finalTitle,
        status: formData.status || 'Planned',
        segment: formData.segment || '',
        resource_type: formData.resource_type || '',
        team_size: formData.team_size ? parseInt(formData.team_size, 10) : null,
        frequency_primary: formData.frequency_primary || '',
        description: formData.description || '',
        probability_of_detection: (formData.probability_of_detection === '' || formData.probability_of_detection === null) ? null : parseInt(formData.probability_of_detection, 10),
        debrief_narrative: formData.debrief_narrative || '',
        team_id: formData.team_id || null,
        is_orphaned: formData.is_orphaned || false,
        priority: formData.priority || null,
        transportation: formData.transportation || null,
        time_allocated: formData.time_allocated || null,
        hazards: formData.hazards || null,
        prepared_by: formData.prepared_by || null,
        sartopo_id: formData.sartopo_id || null
      };

      if (formData.assignment_id && updateAssignment) {
        await updateAssignment(formData.assignment_id, payload); // Hook handles its own error
        addToast('Assignment updated.', 'success');
      } else if (createAssignment) {
        await createAssignment(payload); // Hook handles its own error
        addToast('Assignment created.', 'success');
      }
      if (stayOpen) {
        openNewAssignmentForm();
      } else {
        setShowAssignmentForm(false);
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      addToast(err.message || 'Failed to save assignment.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResponder = async (formData, stayOpen = false) => {
    try {
      setLoading(true);

      // Cleanse payload to prevent PostgREST errors with invalid columns
      const { 
        name, agency, identifier, cell_phone, responder_type,
        access_level, status, special_skills 
      } = formData;

      if (formData.responder_id && updateResponder) {
        await updateResponder(formData.responder_id, { // Hook handles its own error
          name, agency, identifier, cell_phone, responder_type,
          access_level, status, special_skills
        });
        addToast('Responder updated.', 'success');
      } else if (!formData.responder_id && createResponder) {
        await createResponder({
          name, agency, identifier, cell_phone, responder_type,
          access_level, status: 'Staged', special_skills
        });
        addToast('Responder created.', 'success');
      } else {
        throw new Error('Missing responder identifier or service function');
      }

      if (stayOpen) {
        openEditResponderForm(null);
      } else {
        setShowResponderForm(false);
      }
    } catch (err) { // Error is handled by the hook's setError
      addToast(err.message || 'Failed to save responder', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVehicle = async (formData, stayOpen = false) => {
    try {
      setLoading(true);
      if (formData.vehicle_id && updateVehicle) {
        await updateVehicle(formData.vehicle_id, formData); // Hook handles its own error
        addToast('Vehicle updated.', 'success');
      } else if (createVehicle) {
        // Force Staged status for new vehicles from planning board
        await createVehicle({ ...formData, status: 'Staged' }); // Hook handles its own error
        addToast('Vehicle added to staging.', 'success');
      } else {
        throw new Error('Vehicle service function not provided');
      }

      if (stayOpen) {
        formData.vehicle_id ? openEditVehicleForm(formData) : openNewVehicleForm();
      } else {
        setShowVehicleForm(false);
      }
    } catch (err) { // Error is handled by the hook's setError
      addToast(err.message || 'Failed to save vehicle', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOutVehicle = async (vehicle) => {
    if (!window.confirm(`Are you sure you want to check out vehicle ${vehicle.designation}?`)) return;
    
    try {
      setLoading(true);
      if (updateVehicle) {
        await updateVehicle(vehicle.vehicle_id, { 
          status: 'CheckedOut', 
          checkout_datetime: new Date().toISOString() 
        });
        addToast('Vehicle checked out.', 'success');
      }
    } catch (err) {
      addToast(err.message || 'Failed to check out vehicle', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOutResponder = async (responder) => {
    if (!window.confirm(`Are you sure you want to check out ${responder.name}?`)) return;
    
    try {
      setLoading(true);
      if (checkOutResponder) {
        await checkOutResponder(responder.responder_id, responder.name); // Hook handles its own error
        addToast('Responder checked out.', 'success');
      }
      setShowResponderForm(false);
    } catch (err) {
      addToast(err.message || 'Failed to check out responder', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openMembersModal = (team) => {
    setActiveTeam(team);
    setShowMembersModal(true);
  };

  const handleToggleResponder = async (responder) => {
    if (!activeTeam) return;
    const isMember = (activeTeam.current_responders || []).some(r => r.responder_id === responder.responder_id);
    try {
      setLoading(true);
      if (isMember && detachResponderFromTeam) {
        await detachResponderFromTeam(responder.responder_id, activeTeam.team_id); // Hook handles its own error
        addToast(`${responder.name} removed from team.`, 'success');
      } else if (!isMember && attachResponderToTeam) {
        await attachResponderToTeam(responder.responder_id, activeTeam.team_id); // Hook handles its own error
        addToast(`${responder.name} attached to team.`, 'success');
      }
    } catch (err) {
      addToast(err.message || 'Failed to update team members.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="planning-dashboard" data-dragging={!!draggedItem} style={{ overflowY: 'auto', maxHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }}>Planning Dashboard</h1>
        <div className="view-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="view-mode-select" style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>View:</label>
          <select 
            id="view-mode-select"
            className="status-update-select" 
            style={{ width: 'auto', minWidth: '140px', height: '32px' }}
            value={viewMode}
          onChange={(e) => {
            setViewMode(e.target.value);
            localStorage.setItem('sarops_view_mode', e.target.value);
          }}
          >
            <option value="All">Incident (All)</option>
            <option value="Operations">Operations (Active)</option>
            <option value="Planning">Planning (Staged)</option>
          </select>
        </div>
      </div>

      <div className="dashboard-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', paddingBottom: '20px' }}>
        {/* Available Responders Section */}
        <ResponderColumn
          responders={availableRespondersList}
          filter={responderFilter}
          onFilterChange={setResponderFilter}
          onNew={() => openEditResponderForm(null)}
          onEdit={openEditResponderForm}
          onCheckOut={handleCheckOutResponder}
          isResponderHighlighted={isResponderHighlighted}
          draggedItem={draggedItem}
          dndHandlers={dndHandlers}
        />

        {/* Available Vehicles Section */}
        <VehicleColumn
          vehicles={availableVehiclesList}
          filter={vehicleFilter}
          onFilterChange={setVehicleFilter}
          onNew={openNewVehicleForm}
          onEdit={openEditVehicleForm}
          onCheckOut={handleCheckOutVehicle}
          isVehicleHighlighted={isVehicleHighlighted}
          draggedItem={draggedItem}
          dndHandlers={dndHandlers}
        />

        {/* Staged Teams Section */}
        <TeamColumn
          teams={filteredTeams}
          filter={teamFilter}
          onFilterChange={setTeamFilter}
          onNew={openNewTeamForm}
          onEdit={openEditTeamForm}
          onDisband={handleDisbandTeam}
          isTeamHighlighted={isTeamHighlighted}
          getResponderName={getResponderName}
          getTeamMemberCount={getTeamMemberCount}
          getTeamVehicleCount={getTeamVehicleCount}
          dndHandlers={dndHandlers}
        />

        {/* Assignments Section */}
        <div className="section assignments-section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Assignments ({filteredAssignments.length})</h2>
            <div>
              <button className="btn btn-primary" onClick={openNewAssignmentForm} style={{ fontSize: '14px' }}>New Assignment</button>
            </div>
          </div>

          <div className="responder-filters" style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Search assignment..." 
              value={assignmentFilter}
              data-lpignore="true"
              onChange={(e) => setAssignmentFilter(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            {assignmentFilter && (
              <button className="btn btn-secondary btn-sm" onClick={() => setAssignmentFilter('')} style={{ fontSize: '10px' }}>
                Clear
              </button>
            )}
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="empty-state">
              <p>No assignments matching criteria</p>
            </div>
          ) : (
            <div className="assignment-list">
              {filteredAssignments.map(assignment => (
                <div
                  key={assignment.assignment_id}
                  className={`assignment-card ${isAssignmentHighlighted(assignment.assignment_id) ? 'selected' : ''}`}
                  onClick={() => openEditAssignmentForm(assignment.assignment_id)}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, assignment.assignment_id, 'assignment')}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, 'assignment')}
                  onDragEnter={(e) => handleDragEnter(e, assignment.assignment_id, 'assignment')}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDrop(e, assignment.assignment_id, 'assignment')}
                  role="option"
                  tabIndex={0}
                >
                  <div className="assignment-header" style={{ gap: '8px', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="assignment-name clickable-name" style={{ marginRight: '4px' }}>{assignment.title}</div>
                    {assignment.resource_type && <div className="team-type" style={{ background: '#f1f5f9', color: '#475569' }}>{assignment.resource_type}</div>}
                {assignment.team_name && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '14px' }}>➔</span> {assignment.team_name}
                  </span>
                )}
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Size: {assignment.team_size}</span>
                    <div className={`assignment-status ${assignment.status.toLowerCase()}`} style={{ marginLeft: 'auto' }}>
                      {assignment.status}
                    </div>
                  </div>

                  {assignment.description && (
                    <div className="assignment-details" style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
                        {assignment.description}
                      </div>
                    </div>
                  )}

                  <div className="team-actions" style={{ marginTop: '6px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(assignment); }}
                      style={{ color: '#dc2626' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
          commandStaffExists={commandStaffExists}
          onEditVehicle={openEditVehicleForm}
        />
      )}

      {showAssignmentForm && (
        <AssignmentFormModal
          key={`asn-${assignmentForm.assignment_id || 'new'}`}
          isOpen={showAssignmentForm}
          onClose={() => setShowAssignmentForm(false)}
          onSave={handleSaveAssignment}
          initialData={assignmentForm}
          teams={teams}
          loading={loading}
        />
      )}

      {showResponderForm && (
        <ResponderFormModal
          key={`res-${responderForm.responder_id || 'new'}`}
          isOpen={showResponderForm}
          onClose={() => setShowResponderForm(false)}
          onSave={handleSaveResponder}
          onCheckOut={handleCheckOutResponder}
          initialData={responderForm}
          loading={loading}
        />
      )}

      {showVehicleForm && (
        <VehicleFormModal
          key={`veh-${vehicleForm.vehicle_id || 'new'}`}
          isOpen={showVehicleForm}
          onClose={() => setShowVehicleForm(false)}
          onSave={handleSaveVehicle}
          initialData={vehicleForm || {}}
          loading={loading}
        />
      )}

      {/* Members Modal */}
      {showMembersModal && activeTeam && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h3>Manage Members — {activeTeam.team_name_number}</h3>
            <div className="members-list" style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', minHeight: '200px' }}>
              {(responders || []).length === 0 ? (
                <p>No responders available</p>
              ) : (
                (responders || []).map(r => {
                  const isMember = (activeTeam.current_responders || []).some(cr => cr.responder_id === r.responder_id);
                  return (
                    <div key={r.responder_id} className="member-row">
                      <div>
                        <div className="member-name">{r.name}</div>
                        <div className="member-meta">{r.agency || ''}</div>
                      </div>
                      <div>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleToggleResponder(r)}>
                          {isMember ? 'Remove' : 'Attach'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowMembersModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanningDashboard;
