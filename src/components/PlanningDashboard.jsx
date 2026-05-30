import React, { useState, useMemo } from 'react';
import '../styles/PlanningDashboard.css';
import TeamFormModal from './TeamFormModal';
import AssignmentFormModal from './AssignmentFormModal';
import ResponderFormModal from './ResponderFormModal';

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
  defaultNewTeamName = '',
  defaultNewTeamType = 'Ground',
  defaultNewAssignmentDivision = 'A',
  defaultNewAssignmentName = '',
  defaultNewAssignmentType = 'Ground',
  defaultNewAssignmentSize = 2,
  onTeamAssigned,
  createTeam,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  updateTeam,
  updateResponder,
  checkOutResponder,
  attachResponderToTeam,
  detachResponderFromTeam,
  deleteTeam,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showResponderForm, setShowResponderForm] = useState(false);
  const [teamForm, setTeamForm] = useState({});
  const [assignmentForm, setAssignmentForm] = useState({});
  const [responderForm, setResponderForm] = useState({});
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeTeam, setActiveTeam] = useState(null);
  const [responderFilter, setResponderFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [viewMode, setViewMode] = useState('All');
  const [draggedItem, setDraggedItem] = useState(null); // { id, type }
  const [dropTarget, setDropTarget] = useState(null); // { id, type }

  const commandStaffExists = useMemo(() => (teams || []).some(t => t.type === 'Staff'), [teams]);

  const handleDragStart = (e, id, type) => {
    setDraggedItem({ id, type });
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (e, type) => {
    if (draggedItem && draggedItem.type !== type) {
      e.preventDefault(); // Allows the drop event to fire
    }
  };

  const handleDragEnter = (e, id, type) => {
    if (draggedItem && draggedItem.type !== type) {
      e.preventDefault();
      setDropTarget({ id, type });
    }
  };

  const handleDrop = async (e, id, type) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type === type) return;

    // Team <-> Assignment logic
    if ((draggedItem.type === 'team' && type === 'assignment') || (draggedItem.type === 'assignment' && type === 'team')) {
      const teamId = draggedItem.type === 'team' ? draggedItem.id : id;
      const assignmentId = draggedItem.type === 'assignment' ? draggedItem.id : id;
      const team = teams.find(t => t.team_id === teamId);
      const assignment = assignments.find(a => a.assignment_id === assignmentId);

      if (team && assignment) {
        handleDragEnd(); // Reset drag state
        setLoading(true);
        try {
          if (onTeamAssigned) {
            await onTeamAssigned({ teamId, assignmentId, team, assignment });
          }
          setSuccessMessage(`Team "${team.team_name_number}" assigned to "${assignment.title}"`);
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
          setError(err.message || 'Failed to assign team');
        } finally {
          setLoading(false);
        }
      }
    } 
    // Responder <-> Team logic
    else if ((draggedItem.type === 'responder' && type === 'team') || (draggedItem.type === 'team' && type === 'responder')) {
      const responderId = draggedItem.type === 'responder' ? draggedItem.id : id;
      const teamId = draggedItem.type === 'team' ? draggedItem.id : id;
      const responder = responders.find(r => r.responder_id === responderId);
      const team = teams.find(t => t.team_id === teamId);

      if (responder && team) {
        handleDragEnd();
        setLoading(true);
        try {
          if (attachResponderToTeam) {
            await attachResponderToTeam(responderId, teamId);
            setSuccessMessage(`Responder "${responder.name}" attached to team "${team.team_name_number}"`);
            setTimeout(() => setSuccessMessage(null), 3000);
          }
        } catch (err) {
          setError(err.message || 'Failed to attach responder to team');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const isTeamHighlighted = (teamId) => {
    if (!draggedItem) return false;
    
    // Highlight if dragging team over assignment, or if dragging assignment/responder over this team
    if (draggedItem.id === teamId && draggedItem.type === 'team' && (dropTarget?.type === 'assignment')) return true;
    if (dropTarget?.id === teamId && (draggedItem.type === 'assignment' || draggedItem.type === 'responder')) return true;
    
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
    if (draggedItem.id === responderId && draggedItem.type === 'responder' && dropTarget?.type === 'team') return true;
    if (dropTarget?.id === responderId && draggedItem.type === 'team') return true;
    return false;
  };

  const isStagedResponder = (responder) => String(responder?.status || '').toLowerCase() === 'staged';

  // Filter responders logic
  const availableRespondersList = useMemo(() => {
    return responders.filter(r => {
      // View Mode Filter
      if (viewMode === 'Operations') {
        if (!['Attached', 'Assigned', 'Deployed'].includes(r.status)) return false;
      } else if (viewMode === 'Planning' && r.status !== 'Staged') return false;
      
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

  // Filter teams logic
  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      // View Mode Filter
      if (viewMode === 'Operations') {
        if (!['Assigned', 'Deployed'].includes(t.status)) return false;
      } else if (viewMode === 'Planning' && t.status !== 'Staged') return false;

      const term = teamFilter.toLowerCase().trim();
      if (!term) return true;

      const leaderName = getResponderName(t.leader_responder_id).toLowerCase();
      return (
        t.team_name_number.toLowerCase().includes(term) ||
        t.type.toLowerCase().includes(term) ||
        leaderName.includes(term)
      );
    });
  }, [teams, teamFilter, viewMode, responders]);

  // Filter assignments logic
  const filteredAssignments = useMemo(() => {
    return assignments.filter(asn => {
      if (asn.op_period_id !== operationalPeriodId || asn.is_orphaned) return false;

      // View Mode Filter
      if (viewMode === 'Operations') {
        if (!['Assigned', 'Deployed'].includes(asn.status)) return false;
      } else if (viewMode === 'Planning') {
        if (asn.status !== 'Planned' || asn.team_id) return false;
      }

      const term = assignmentFilter.toLowerCase().trim();
      if (!term) return true;

      return (
        asn.title.toLowerCase().includes(term) ||
        (asn.resource_type && asn.resource_type.toLowerCase().includes(term)) ||
        (asn.description && asn.description.toLowerCase().includes(term)) ||
        (asn.segment && asn.segment.toLowerCase().includes(term))
      );
    });
  }, [assignments, assignmentFilter, viewMode, operationalPeriodId]);

  // Get responder details for the team leader
  const getResponderName = (responderId) => {
    const responder = responders.find(r => r.responder_id === responderId);
    return responder ? responder.name : 'Unknown';
  };

  // Show responders who are Staged (available) OR already part of the team being edited
  const stagedResponders = responders.filter(r => {
    const isStaged = isStagedResponder(r);
    const isCurrentMember = (teamForm.responder_ids || []).includes(r.responder_id);
    const isCurrentLeader = teamForm.leader_responder_id === r.responder_id;
    return isStaged || isCurrentMember || isCurrentLeader;
  });

  // Get team member count
  const getTeamMemberCount = (team) => {
    return team.current_responders?.length || 0;
  };

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

  const openEditAssignmentForm = (assignment) => {
    console.log('📝 Opening Assignment Editor for:', assignment.title);
    setAssignmentForm({
      ...assignment
    });
    setShowAssignmentForm(true);
  };

  const openEditTeamForm = (team) => {
    console.log('📝 Opening Team Editor for:', team.team_name_number);
    setTeamForm({
      ...team,
      equipment: team.equipment || [],
      responder_ids: team.current_responders?.map(r => r.responder_id) || [],
    });
    setShowTeamForm(true);
  };

  const openEditResponderForm = (responder) => {
    console.log('📝 Opening Responder Editor for:', responder.name);
    setResponderForm({ ...responder });
    setShowResponderForm(true);
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

  const handleReleaseTeam = async (team) => {
    if (team.status === 'Deployed') {
      alert(`Cannot disband team "${team.team_name_number}" while it is Deployed. Please complete or cancel the assignment first.`);
      return;
    }

    const msg = `Are you sure you want to release "${team.team_name_number}"? This will return all members to Staged status and delete the team record.`;
    if (!window.confirm(msg)) return;

    try {
      setLoading(true);

      // Ensure all members return to Staged status before deleting the team
      const rIds = team.current_responders?.map(r => r.responder_id) || [];
      if (rIds.length > 0 && updateResponder) {
        // Update each responder's status to 'Staged'
        await Promise.all(rIds.map(id => updateResponder(id, { status: 'Staged' })));
        // Note: history closure and status are now synchronized through these updates
      }

      if (deleteTeam) {
        await deleteTeam(team.team_id);
        
        setSuccessMessage(`Team "${team.team_name_number}" released`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to release team');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${assignment.title}"? This action cannot be undone.`)) return;

    try {
      setLoading(true);
      if (deleteAssignment) {
        await deleteAssignment(assignment.assignment_id);
        
        setSuccessMessage(`Assignment "${assignment.title}" deleted`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTeam = async (formData) => {
    if (!formData.leader_responder_id) {
      setError('A team leader must be selected in order to save a team.');
      return;
    }

    try {
      setLoading(true);
      
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

      // Ensure leader is included in responder_ids for consistency
      const currentResponders = formData.responder_ids || [];
      const finalResponderIds = (formData.leader_responder_id && !currentResponders.includes(formData.leader_responder_id))
        ? [...currentResponders, formData.leader_responder_id]
        : currentResponders;

      if (formData.team_id && updateTeam) {
        // 1. Update core team details
        await updateTeam(formData.team_id, {
          team_name_number: finalTeamName,
          type: formData.type,
          sartopo_color_hex: formData.sartopo_color_hex || '#FF0000',
          op_period_id: formData.op_period_id,
          status: formData.status,
          leader_responder_id: formData.leader_responder_id,
          equipment: formData.equipment,
        });

        // 2. Reconcile responder attachments
        const originalIds = formData.current_responders?.map(r => r.responder_id) || [];
        const roles = formData.responder_roles || {};
        const toAdd = finalResponderIds.filter(id => !originalIds.includes(id));
        const toRemove = originalIds.filter(id => !finalResponderIds.includes(id));
        const existing = finalResponderIds.filter(id => originalIds.includes(id));

        // Reconcile membership and update roles. 
        // attachResponderToTeam is now safe to call for existing members thanks to the hook fix.
        await Promise.all([
          ...toAdd.map(id => attachResponderToTeam?.(id, formData.team_id, roles[id])),
          ...existing.map(id => attachResponderToTeam?.(id, formData.team_id, roles[id])),
          ...toRemove.map(id => detachResponderFromTeam?.(id, formData.team_id))
        ]);

        setSuccessMessage('Team updated');
      } else if (createTeam) {
        await createTeam({ 
          ...formData, 
          team_name_number: finalTeamName,
          responder_ids: finalResponderIds, 
          responder_roles: formData.responder_roles 
        });
        setSuccessMessage('Team created');
      }
      setShowTeamForm(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err.message || 'Failed to save team';
      if (message.includes('row-level security')) {
        setError('Permission denied: You do not have permission to create teams. Please check database RLS policies.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignment = async (formData) => {
    try {
      setLoading(true);

      // Cleanse payload to prevent PostgREST errors with joined/calculated fields (like 'team_name')
      const payload = {
        op_period_id: formData.op_period_id,
        title: formData.title || '',
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
        await updateAssignment(formData.assignment_id, payload);
        setSuccessMessage('Assignment updated');
      } else if (createAssignment) {
        await createAssignment(payload);
        setSuccessMessage('Assignment created');
      }
      setShowAssignmentForm(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err.message || 'Failed to save assignment';
      if (message.includes('row-level security')) {
        setError('Permission denied: You do not have permission to create or update assignments. Please check database RLS policies.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResponder = async (formData) => {
    if (!formData?.responder_id) {
      setError('Internal Error: Missing responder identifier. Changes cannot be saved.');
      return;
    }

    try {
      setLoading(true);
      if (updateResponder) {
        // Cleanse payload to prevent PostgREST errors with invalid columns
        const { 
          name, agency, identifier, cell_phone, responder_type,
          access_level, status, special_skills 
        } = formData;

        await updateResponder(formData.responder_id, {
          name, agency, identifier, cell_phone, responder_type,
          access_level, status, special_skills
        });

        setSuccessMessage('Responder updated');
      }
      setShowResponderForm(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update responder');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOutResponder = async (responder) => {
    if (!window.confirm(`Are you sure you want to check out ${responder.name}?`)) return;
    
    try {
      setLoading(true);
      if (checkOutResponder) {
        await checkOutResponder(responder.responder_id, responder.name);
        setSuccessMessage('Responder checked out');
      }
      setShowResponderForm(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to check out responder');
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
    const isMember = activeTeam.current_responders?.some(r => r.responder_id === responder.responder_id);
    try {
      setLoading(true);
      if (isMember && detachResponderFromTeam) {
        await detachResponderFromTeam(responder.responder_id, activeTeam.team_id);
        setSuccessMessage(`${responder.name} removed`);
      } else if (!isMember && attachResponderToTeam) {
        await attachResponderToTeam(responder.responder_id, activeTeam.team_id);
        setSuccessMessage(`${responder.name} attached`);
      }
      // update activeTeam reference after refresh by relying on parent state updates
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err) {
      const message = err.message || 'Failed to update team members';
      if (message.includes('row-level security')) {
        setError('Permission denied: You do not have permission to modify team members. Please check database RLS policies.');
      } else {
        setError(message);
      }
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
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="All">Incident (All)</option>
            <option value="Operations">Operations (Active)</option>
            <option value="Planning">Planning (Staged)</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon">⚠️</span>
          <span className="alert-message">{error}</span>
          <button 
            className="alert-close" 
            onClick={() => setError(null)}
            aria-label="Close error"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="alert">
          <span className="alert-icon">✓</span>
          <span className="alert-message">{successMessage}</span>
        </div>
      )}

      <div className="dashboard-container" style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', paddingBottom: '20px' }}>
        {/* Available Responders Section */}
        <div className="section responders-section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Responders ({availableRespondersList.length})</h2>
            {/* Hidden spacer to ensure header height matches columns with buttons, aligning the search boxes */}
            <div style={{ visibility: 'hidden' }}>
              <button className="btn btn-primary" style={{ fontSize: '14px' }}>Spacer</button>
            </div>
          </div>

          <div className="responder-filters" style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Search name, ID, agency or skills..." 
              value={responderFilter}
              onChange={(e) => setResponderFilter(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            {responderFilter && (
              <button className="btn btn-secondary btn-sm" onClick={() => setResponderFilter('')} style={{ fontSize: '10px' }}>
                Clear
              </button>
            )}
          </div>

          {availableRespondersList.length === 0 ? (
            <div className="empty-state">
              <p>No available responders in staging</p>
            </div>
          ) : (
            <div className="responder-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {availableRespondersList.map(responder => (
                <div
                  key={responder.responder_id}
                  className={`responder-card ${isResponderHighlighted(responder.responder_id) ? 'selected' : ''} ${draggedItem?.id === responder.responder_id ? 'dragging' : ''}`}
                  draggable="true"
                  onClick={() => openEditResponderForm(responder)}
                  onDragStart={(e) => handleDragStart(e, responder.responder_id, 'responder')}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, 'responder')}
                  onDragEnter={(e) => handleDragEnter(e, responder.responder_id, 'responder')}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDrop(e, responder.responder_id, 'responder')}
                  role="option"
                  tabIndex={0}
                >
                  <div className="responder-header">
                    <div className="responder-name clickable-name">{responder.name}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                      <div className="responder-id-badge">{responder.identifier}</div>
                      <span className={`status-indicator ${responder.status?.toLowerCase() || ''}`}>
                        {responder.status}
                      </span>
                    </div>
                  </div>
                  <div className="responder-agency-meta">{responder.agency}</div>
                  {responder.special_skills && (
                    <div className="responder-skills-badge">{responder.special_skills}</div>
                  )}

                  <div className="team-actions" style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={(e) => { e.stopPropagation(); handleCheckOutResponder(responder); }}
                      disabled={responder.status?.toLowerCase() !== 'staged'}
                      style={{ color: '#dc2626' }}
                    >
                      Check Out
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staged Teams Section */}
        <div className="section teams-section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Teams ({filteredTeams.length})</h2>
            <div>
              <button className="btn btn-primary" onClick={openNewTeamForm} style={{ fontSize: '14px' }}>New Team</button>
            </div>
          </div>

          <div className="responder-filters" style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Search team or leader..." 
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            {teamFilter && (
              <button className="btn btn-secondary btn-sm" onClick={() => setTeamFilter('')} style={{ fontSize: '10px' }}>
                Clear
              </button>
            )}
          </div>

          {filteredTeams.length === 0 ? (
            <div className="empty-state">
              <p>No teams matching criteria</p>
            </div>
          ) : (
            <div className="team-list">
              {filteredTeams.map(team => (
                <div
                  key={team.team_id}
                  className={`team-card ${isTeamHighlighted(team.team_id) ? 'selected' : ''}`}
                  onClick={() => openEditTeamForm(team)}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, team.team_id, 'team')}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, 'team')}
                  onDragEnter={(e) => handleDragEnter(e, team.team_id, 'team')}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDrop(e, team.team_id, 'team')}
                  role="option"
                  tabIndex={0}
                >
                  <div className="team-header" style={{ gap: '8px', justifyContent: 'flex-start', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="team-name clickable-name" style={{ marginRight: '4px' }}>{team.team_name_number}</div>
                    <div className={`team-type ${team.type.replace(/\s+/g, '-').toLowerCase()}`}>
                      {team.type}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Size: {getTeamMemberCount(team)}</span>
                    <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>
                      {team.type === 'Staff' ? 'IC' : 'Ldr'}: {getResponderName(team.leader_responder_id)}
                    </span>
                    <span className={`status-indicator ${team.status?.toLowerCase() || ''}`} style={{ marginLeft: 'auto' }}>
                      {team.status}
                    </span>
                  </div>

                  {team.equipment && team.equipment.length > 0 && (
                    <div className="team-details" style={{ marginTop: '4px' }}>
                      <div className="detail-row">
                        <span className="detail-label">Equipment:</span>
                        <span className="detail-value">{team.equipment.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  <div className="team-actions" style={{ marginTop: '4px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={(e) => { e.stopPropagation(); handleReleaseTeam(team); }}
                      disabled={team.status === 'Deployed'}
                      style={{ color: '#dc2626' }}
                      title={team.status === 'Deployed' ? "Cannot disband team while deployed" : "Release team members to staging"}
                    >
                      Disband
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
                  onClick={() => openEditAssignmentForm(assignment)}
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

      {showResponderForm && (
        <ResponderFormModal
          key={`res-${responderForm.responder_id || 'new'}`}
          isOpen={showResponderForm}
          onClose={() => setShowResponderForm(false)}
          onSave={handleSaveResponder}
          onCheckOut={handleCheckOutResponder}
          initialData={responderForm}
          loading={loading}
          error={error}
        />
      )}

      {/* Members Modal */}
      {showMembersModal && activeTeam && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxHeight: '90vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h3>Manage Members — {activeTeam.team_name_number}</h3>
            <div className="members-list" style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', minHeight: '200px' }}>
              {responders.length === 0 ? (
                <p>No responders available</p>
              ) : (
                responders.map(r => {
                  const isMember = activeTeam.current_responders?.some(cr => cr.responder_id === r.responder_id);
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
