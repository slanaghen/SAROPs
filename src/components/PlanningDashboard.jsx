import React, { useState, useEffect } from 'react';
import '../styles/PlanningDashboard.css';

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
  onTeamAssigned,
  createTeam,
  createAssignment,
  updateTeam,
  attachResponderToTeam,
  detachResponderFromTeam,
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

  const stagedResponders = responders.filter(r => r.status === 'Staged');

  // Get team member count
  const getTeamMemberCount = (team) => {
    return team.current_responders?.length || 0;
  };

  const openNewTeamForm = () => {
    setTeamForm({
      op_period_id: operationalPeriodId,
      team_name_number: '',
      sartopo_color_hex: '#007bff',
      type: 'Other',
      status: 'Draft',
      leader_responder_id: null,
      equipment: [],
      responder_ids: [],
    });
    setShowTeamForm(true);
  };

  const openNewAssignmentForm = () => {
    setAssignmentForm({
      op_period_id: operationalPeriodId,
      division: '',
      name: '',
      assignment_type: '',
      assignment_size: '',
      tac_channel: '',
      description_narrative: '',
      status: 'Draft',
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

  const handleSaveTeam = async () => {
    try {
      setLoading(true);
      if (teamForm.team_id && updateTeam) {
        await updateTeam(teamForm.team_id, {
          team_name_number: teamForm.team_name_number,
          sartopo_color_hex: teamForm.sartopo_color_hex,
          type: teamForm.type,
          status: teamForm.status,
          leader_responder_id: teamForm.leader_responder_id,
          equipment: teamForm.equipment,
        });
        setSuccessMessage('Team updated');
      } else if (createTeam) {
        await createTeam(teamForm);
        setSuccessMessage('Team created');
      }
      setShowTeamForm(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignment = async () => {
    try {
      setLoading(true);
      if (createAssignment) {
        await createAssignment(assignmentForm);
        setSuccessMessage('Assignment created');
      }
      setShowAssignmentForm(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save assignment');
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
      setError(err.message || 'Failed to update team members');
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
    <div className="planning-dashboard">
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
                  className={`team-card ${selectedTeamId === team.team_id ? 'selected' : ''}`}
                  onClick={() => setSelectedTeamId(team.team_id)}
                  role="option"
                  aria-selected={selectedTeamId === team.team_id}
                  tabIndex={0}
                >
                  <div className="team-header">
                    <div className="team-color-indicator" 
                         style={{ backgroundColor: team.sartopo_color_hex }}
                         title={`Color: ${team.sartopo_color_hex}`}
                    />
                    <div className="team-name">{team.team_name_number}</div>
                    <div className={`team-type ${team.type.replace(/\s+/g, '-').toLowerCase()}`}>
                      {team.type}
                    </div>
                  </div>

                  <div className="team-details">
                    <div className="detail-row">
                      <span className="detail-label">Leader:</span>
                      <span className="detail-value">
                        {getResponderName(team.leader_responder_id)}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Members:</span>
                      <span className="detail-value">
                        {getTeamMemberCount(team)}
                      </span>
                    </div>

                    {team.equipment && team.equipment.length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">Equipment:</span>
                        <span className="detail-value">
                          {team.equipment.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="team-actions">
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openEditTeamForm(team); }}>Edit</button>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openMembersModal(team); }}>Members</button>
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
                  className={`assignment-card ${selectedAssignmentId === assignment.assignment_id ? 'selected' : ''}`}
                  onClick={() => setSelectedAssignmentId(assignment.assignment_id)}
                  role="option"
                  aria-selected={selectedAssignmentId === assignment.assignment_id}
                  tabIndex={0}
                >
                  <div className="assignment-header">
                    <div className="assignment-name">{assignment.name}</div>
                    <div className={`assignment-status ${assignment.status.toLowerCase()}`}>
                      {assignment.status}
                    </div>
                  </div>

                  <div className="assignment-details">
                    <div className="detail-row">
                      <span className="detail-label">Assignment ID:</span>
                      <span className="detail-value monospace">
                        {assignment.assignment_id.substring(0, 8)}...
                      </span>
                    </div>

                    {assignment.assignment_type && (
                      <div className="detail-row">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value">
                          {assignment.assignment_type}
                        </span>
                      </div>
                    )}

                    {assignment.division && (
                      <div className="detail-row">
                        <span className="detail-label">Division:</span>
                        <span className="detail-value">
                          {assignment.division}
                        </span>
                      </div>
                    )}

                    {assignment.tac_channel && (
                      <div className="detail-row">
                        <span className="detail-label">TAC Channel:</span>
                        <span className="detail-value">
                          {assignment.tac_channel}
                        </span>
                      </div>
                    )}

                    {assignment.sartopo_id && (
                      <div className="detail-row">
                        <span className="detail-label">SARTopo ID:</span>
                        <span className="detail-value monospace">
                          {assignment.sartopo_id}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Form Modal */}
      {showTeamForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{teamForm.team_id ? 'Edit Team' : 'New Team'}</h3>

            <div className="form-row">
              <label>Team Name</label>
              <input value={teamForm.team_name_number || ''} onChange={e => setTeamForm({ ...teamForm, team_name_number: e.target.value })} />
            </div>

            <div className="form-row">
              <label>Type</label>
              <select value={teamForm.type} onChange={e => setTeamForm({ ...teamForm, type: e.target.value })}>
                <option>Ground Search</option>
                <option>UAS Search</option>
                <option>Dog Air</option>
                <option>Dog Track</option>
                <option>Transport</option>
                <option>Helicopter</option>
                <option>Other</option>
              </select>
            </div>

            <div className="form-row">
              <label>Status</label>
              <select value={teamForm.status} onChange={e => setTeamForm({ ...teamForm, status: e.target.value })}>
                <option>Draft</option>
                <option>Staged</option>
                <option>Assigned</option>
                <option>Deployed</option>
                <option>Demobilized</option>
              </select>
            </div>

            <div className="form-row">
              <label>Leader</label>
              <select value={teamForm.leader_responder_id || ''} onChange={e => setTeamForm({ ...teamForm, leader_responder_id: e.target.value || null })}>
                <option value="">— none —</option>
                {responders.map(r => (
                  <option key={r.responder_id} value={r.responder_id}>{r.name}</option>
                ))}
              </select>
            </div>

            {!teamForm.team_id && (
              <div className="form-row responders-selector">
                <label>Attach Responders</label>
                <div className="responders-list">
                  {stagedResponders.length === 0 ? (
                    <p className="helper-text">No checked in/staged responders available</p>
                  ) : (
                    stagedResponders.map(r => {
                      const isSelected = (teamForm.responder_ids || []).includes(r.responder_id);
                      return (
                        <button
                          key={r.responder_id}
                          type="button"
                          className={`responder-chip ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleNewTeamResponder(r.responder_id)}
                        >
                          <span>{r.name}</span>
                          <small>{r.agency || ''}</small>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="form-row">
              <label>Equipment (comma separated)</label>
              <input value={(teamForm.equipment || []).join(', ')} onChange={e => setTeamForm({ ...teamForm, equipment: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSaveTeam} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
              <button className="btn btn-secondary" onClick={() => setShowTeamForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Form Modal */}
      {showAssignmentForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>New Assignment</h3>

            <div className="form-row">
              <label>Division</label>
              <input
                type="text"
                value={assignmentForm.division}
                onChange={e => setAssignmentForm({ ...assignmentForm, division: e.target.value })}
                placeholder="Assignment division"
              />
            </div>

            <div className="form-row">
              <label>Assignment Name</label>
              <input
                type="text"
                value={assignmentForm.name}
                onChange={e => setAssignmentForm({ ...assignmentForm, name: e.target.value })}
                placeholder="Assignment name"
              />
            </div>

            <div className="form-row">
              <label>Assignment Type</label>
              <input
                type="text"
                value={assignmentForm.assignment_type}
                onChange={e => setAssignmentForm({ ...assignmentForm, assignment_type: e.target.value })}
                placeholder="Assignment type"
              />
            </div>

            <div className="form-row">
              <label>Assignment Size</label>
              <input
                type="text"
                value={assignmentForm.assignment_size}
                onChange={e => setAssignmentForm({ ...assignmentForm, assignment_size: e.target.value })}
                placeholder="Assignment size"
              />
            </div>

            <div className="form-row">
              <label>TAC Channel</label>
              <input
                type="text"
                value={assignmentForm.tac_channel}
                onChange={e => setAssignmentForm({ ...assignmentForm, tac_channel: e.target.value })}
                placeholder="TAC channel"
              />
            </div>

            <div className="form-row">
              <label>Description Narrative</label>
              <textarea
                value={assignmentForm.description_narrative}
                onChange={e => setAssignmentForm({ ...assignmentForm, description_narrative: e.target.value })}
                placeholder="Assignment narrative"
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSaveAssignment} disabled={loading}>
                {loading ? 'Saving...' : 'Save Assignment'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAssignmentForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
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
