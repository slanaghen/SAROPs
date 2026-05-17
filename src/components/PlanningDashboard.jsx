import React, { useState } from 'react';
import '../styles/PlanningDashboard.css';
import TeamFormModal from './TeamFormModal';
import AssignmentFormModal from './AssignmentFormModal';

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
  defaultNewTeamType = 'Ground Search',
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
  attachResponderToTeam,
  detachResponderFromTeam,
  deleteTeam,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [teamForm, setTeamForm] = useState({});
  const [assignmentForm, setAssignmentForm] = useState({});
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeTeam, setActiveTeam] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null); // { id, type }
  const [dropTarget, setDropTarget] = useState(null); // { id, type }

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
      setDropTarget({ id, type });
    }
  };

  const handleDrop = async (e, id, type) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type === type) return;

    const teamId = draggedItem.type === 'team' ? draggedItem.id : id;
    const assignmentId = draggedItem.type === 'assignment' ? draggedItem.id : id;

    const team = teams.find(t => t.team_id === teamId);
    const assignment = assignments.find(a => a.assignment_id === assignmentId);

    if (team && assignment) {
      handleDragEnd();
      // Execute assignment using existing logic
      setLoading(true);
      try {
        if (onTeamAssigned) {
          await onTeamAssigned({ teamId, assignmentId, team, assignment });
        }
        setSuccessMessage(`Team "${team.team_name_number}" assigned to "${assignment.name}"`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setSelectedTeamId(null);
        setSelectedAssignmentId(null);
      } catch (err) {
        setError(err.message || 'Failed to assign team');
      } finally {
        setLoading(false);
      }
    }
  };

  const isTeamHighlighted = (teamId) => {
    if (selectedTeamId === teamId) return true;
    if (!draggedItem) return false;
    if (draggedItem.id === teamId && draggedItem.type === 'team' && dropTarget?.type === 'assignment') return true;
    if (dropTarget?.id === teamId && draggedItem.type === 'assignment') return true;
    return false;
  };

  const isAssignmentHighlighted = (assignmentId) => {
    if (selectedAssignmentId === assignmentId) return true;
    if (!draggedItem) return false;
    if (draggedItem.id === assignmentId && draggedItem.type === 'assignment' && dropTarget?.type === 'team') return true;
    if (dropTarget?.id === assignmentId && draggedItem.type === 'team') return true;
    return false;
  };

  // Filter teams to only show those with "Staged" status
  const stagedTeams = teams.filter(t => t.status === 'Staged');

  // Filter assignments to show unassigned or available assignments
  const availableAssignments = assignments.filter(asn => {
    const isUnassigned = asn.team_id === null || asn.team_id === undefined;
    return asn.op_period_id === operationalPeriodId && 
           isUnassigned && 
           !asn.is_orphaned;
  });

  // Get the currently selected team details
  const selectedTeam = stagedTeams.find(t => t.team_id === selectedTeamId);

  // Get the currently selected assignment details
  const selectedAssignment = availableAssignments.find(
    a => a.assignment_id === selectedAssignmentId
  );

  // Get responder details for the team leader
  const getResponderName = (responderId) => {
    const responder = responders.find(r => r.responder_id === responderId);
    return responder ? responder.name : 'Unknown';
  };

  // Show responders who are Staged (available) OR already part of the team being edited
  const stagedResponders = responders.filter(r => {
    const isStaged = r.status === 'Staged';
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
      sartopo_color_hex: '#007bff',
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
      division: defaultNewAssignmentDivision,
      name: defaultNewAssignmentName,
      assignment_type: defaultNewAssignmentType,
      assignment_size: defaultNewAssignmentSize,
      tac_channel: '',
      description_narrative: '',
      status: 'Planned',
    });
    setShowAssignmentForm(true);
  };

  const openEditAssignmentForm = (assignment) => {
    setAssignmentForm({
      ...assignment
    });
    setShowAssignmentForm(true);
  };

  const openEditTeamForm = (team) => {
    setTeamForm({
      ...team,
      equipment: team.equipment || [],
      responder_ids: team.current_responders?.map(r => r.responder_id) || [],
    });
    setShowTeamForm(true);
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
    const msg = `Are you sure you want to release "${team.team_name_number}"? This will return all members to Staged status and delete the team record.`;
    if (!window.confirm(msg)) return;

    try {
      setLoading(true);
      if (deleteTeam) {
        await deleteTeam(team.team_id);
        
        // Clear selection if the released team was selected
        if (selectedTeamId === team.team_id) {
          setSelectedTeamId(null);
        }
        
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
    if (!window.confirm(`Are you sure you want to delete assignment "${assignment.name}"? This action cannot be undone.`)) return;

    try {
      setLoading(true);
      if (deleteAssignment) {
        await deleteAssignment(assignment.assignment_id);
        
        // Clear selection if the deleted assignment was selected
        if (selectedAssignmentId === assignment.assignment_id) {
          setSelectedAssignmentId(null);
        }
        
        setSuccessMessage(`Assignment "${assignment.name}" deleted`);
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
      
      // Ensure leader is included in responder_ids for consistency
      const currentResponders = formData.responder_ids || [];
      const finalResponderIds = (formData.leader_responder_id && !currentResponders.includes(formData.leader_responder_id))
        ? [...currentResponders, formData.leader_responder_id]
        : currentResponders;

      if (formData.team_id && updateTeam) {
        // 1. Update core team details
        await updateTeam(formData.team_id, {
          team_name_number: formData.team_name_number,
          sartopo_color_hex: formData.sartopo_color_hex,
          type: formData.type,
          status: formData.status,
          leader_responder_id: formData.leader_responder_id,
          equipment: formData.equipment,
        });

        // 2. Reconcile responder attachments
        const originalIds = formData.current_responders?.map(r => r.responder_id) || [];
        const toAdd = finalResponderIds.filter(id => !originalIds.includes(id));
        const toRemove = originalIds.filter(id => !finalResponderIds.includes(id));

        if (toAdd.length > 0 || toRemove.length > 0) {
          await Promise.all([
            ...toAdd.map(id => attachResponderToTeam?.(id, formData.team_id)),
            ...toRemove.map(id => detachResponderFromTeam?.(id, formData.team_id))
          ]);
        }

        setSuccessMessage('Team updated');
      } else if (createTeam) {
        await createTeam({ ...formData, responder_ids: finalResponderIds });
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
      if (formData.assignment_id && updateAssignment) {
        await updateAssignment(formData.assignment_id, formData);
        setSuccessMessage('Assignment updated');
      } else if (createAssignment) {
        if (createAssignment) {
          await createAssignment(formData);
          setSuccessMessage('Assignment created');
        }
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

  /**
   * Handle team-to-assignment mapping
   */
  const handleAssignTeam = async () => {
    if (!selectedTeamId || !selectedAssignmentId) {
      setError('Please select both a team and an assignment');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Call the onTeamAssigned callback with mapping details
      if (onTeamAssigned) {
        await onTeamAssigned({
          teamId: selectedTeamId,
          assignmentId: selectedAssignmentId,
          team: selectedTeam,
          assignment: selectedAssignment
        });
      }

      // Clear selections and show success message
      setSelectedTeamId(null);
      setSelectedAssignmentId(null);
      setSuccessMessage(
        `Team "${selectedTeam.team_name_number}" assigned to "${selectedAssignment.name}"`
      );

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to assign team to assignment');
      console.error('Assignment error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset selection and clear messages
   */
  const handleReset = () => {
    setSelectedTeamId(null);
    setSelectedAssignmentId(null);
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="planning-dashboard" data-dragging={!!draggedItem}>
      <h1>Planning Dashboard - Team Assignment</h1>

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

      <div className="dashboard-container">
        {/* Staged Teams Section */}
        <div className="section teams-section">
          <div className="section-header">
            <h2>Staged Teams ({stagedTeams.length})</h2>
            <div>
              <button className="btn btn-primary btn-sm" onClick={openNewTeamForm}>New Team</button>
            </div>
          </div>

          {stagedTeams.length === 0 ? (
            <div className="empty-state">
              <p>No staged teams available in this operational period</p>
            </div>
          ) : (
            <div className="team-list">
              {stagedTeams.map(team => (
                <div
                  key={team.team_id}
                  className={`team-card ${isTeamHighlighted(team.team_id) ? 'selected' : ''}`}
                  onClick={() => setSelectedTeamId(team.team_id)}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, team.team_id, 'team')}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, 'team')}
                  onDragEnter={(e) => handleDragEnter(e, team.team_id, 'team')}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDrop(e, team.team_id, 'team')}
                  role="option"
                  aria-selected={selectedTeamId === team.team_id}
                  tabIndex={0}
                >
                  <div className="team-header" style={{ gap: '8px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    <div className="team-color-indicator" 
                         style={{ backgroundColor: team.sartopo_color_hex }}
                         title={`Color: ${team.sartopo_color_hex}`}
                    />
                    <div className="team-name" style={{ marginRight: '4px' }}>{team.team_name_number}</div>
                    <div className={`team-type ${team.type.replace(/\s+/g, '-').toLowerCase()}`}>
                      {team.type}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Size: {getTeamMemberCount(team)}</span>
                    <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>Ldr: {getResponderName(team.leader_responder_id)}</span>
                  </div>

                  {team.equipment && team.equipment.length > 0 && (
                    <div className="team-details" style={{ marginTop: '4px' }}>
                      <div className="detail-row">
                        <span className="detail-label">Equipment:</span>
                        <span className="detail-value">{team.equipment.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  <div className="team-actions" style={{ marginTop: '4px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openEditTeamForm(team); }}>Edit</button>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={(e) => { e.stopPropagation(); handleReleaseTeam(team); }}
                      style={{ color: '#dc2626' }}
                    >
                      Release
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assignments Section */}
        <div className="section assignments-section">
          <div className="section-header">
            <h2>Available Assignments ({availableAssignments.length})</h2>
            <div>
              <button className="btn btn-primary btn-sm" onClick={openNewAssignmentForm}>New Assignment</button>
            </div>
          </div>

          {availableAssignments.length === 0 ? (
            <div className="empty-state">
              <p>No available assignments in this operational period</p>
            </div>
          ) : (
            <div className="assignment-list">
              {availableAssignments.map(assignment => (
                <div
                  key={assignment.assignment_id}
                  className={`assignment-card ${isAssignmentHighlighted(assignment.assignment_id) ? 'selected' : ''}`}
                  onClick={() => setSelectedAssignmentId(assignment.assignment_id)}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, assignment.assignment_id, 'assignment')}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, 'assignment')}
                  onDragEnter={(e) => handleDragEnter(e, assignment.assignment_id, 'assignment')}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDrop(e, assignment.assignment_id, 'assignment')}
                  role="option"
                  aria-selected={selectedAssignmentId === assignment.assignment_id}
                  tabIndex={0}
                >
                  <div className="assignment-header" style={{ gap: '8px', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="assignment-name" style={{ marginRight: '4px' }}>{assignment.name}</div>
                    {assignment.assignment_type && <div className="team-type" style={{ background: '#f1f5f9', color: '#475569' }}>{assignment.assignment_type}</div>}
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Size: {assignment.assignment_size}</span>
                    <div className={`assignment-status ${assignment.status.toLowerCase()}`}>
                      {assignment.status}
                    </div>
                  </div>

                  {assignment.description_narrative && (
                    <div className="assignment-details" style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
                        {assignment.description_narrative}
                      </div>
                    </div>
                  )}

                  <div className="team-actions" style={{ marginTop: '6px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openEditAssignmentForm(assignment); }}>Edit</button>
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

      {/* Members Modal */}
      {showMembersModal && activeTeam && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Manage Members — {activeTeam.team_name_number}</h3>
            <div className="members-list">
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

      {/* Selection Summary and Action Buttons */}
      <div className="action-panel">
        <div className="selection-summary">
          <div className="summary-item">
            <span className="summary-label">Selected Team:</span>
            <span className="summary-value">
              {selectedTeam ? selectedTeam.team_name_number : '—'}
            </span>
          </div>

          <div className="summary-item">
            <span className="summary-label">Selected Assignment:</span>
            <span className="summary-value">
              {selectedAssignment ? selectedAssignment.name : '—'}
            </span>
          </div>
        </div>

        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={handleAssignTeam}
            disabled={!selectedTeamId || !selectedAssignmentId || loading}
            aria-busy={loading}
          >
            {loading ? 'Assigning...' : 'Assign Team to Assignment'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={loading}
          >
            Clear Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanningDashboard;
