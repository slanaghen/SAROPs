import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/OperationsDashboard.css';
import '../styles/PlanningDashboard.css'; // Reusing form styles
import TeamFormModal from '../components/TeamFormModal';
import AssignmentFormModal from '../components/AssignmentFormModal';

const OperationsDashboardPage = ({ operationalPeriodId: propOpId }) => {
  const { incidentData, incidentId, responderName, user } = useIncident();
  const operationalPeriodId = propOpId || incidentData?.opPeriodId;

  const [assignments, setAssignments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({
    assignmentName: '',
    assignmentType: '',
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
  const [dropTarget, setDropTarget] = useState(null); // { id, type }

  const fetchSummary = useCallback(async () => {
    if (!operationalPeriodId) return;

    setLoading(true);
    setError(null);

    try {
      const [assignmentRes, teamRes, responderRes] = await Promise.all([
        supabase
          .from('assignments')
          .select('assignment_id,name,status,team_id,op_period_id,assignment_type,division,assignment_size,tac_channel,description_narrative')
          .eq('op_period_id', operationalPeriodId),
        supabase
          .from('teams')
          .select('team_id,team_name_number,type,leader_responder_id,op_period_id,status,equipment,sartopo_color_hex')
          .eq('op_period_id', operationalPeriodId),
        supabase.from('responders').select('*')
      ]);

      const { data: assignmentData, error: assignmentError } = assignmentRes;
      const { data: teamData, error: teamError } = teamRes;
      const { data: responderData, error: responderError } = responderRes;

      if (assignmentError) throw assignmentError;
      if (teamError) throw teamError;
      if (responderError) throw responderError;

      setAssignments(assignmentData || []);
      setTeams(teamData || []);
      setResponders(responderData || []);
    } catch (opsFetchErr) {
      setError(opsFetchErr?.message || 'Failed to load operations summary');
      console.error('OperationsDashboard fetch error:', opsFetchErr);
    } finally {
      setLoading(false);
    }
  }, [operationalPeriodId]);

  useEffect(() => {
    fetchSummary();
  }, [operationalPeriodId, fetchSummary]);

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
      setError(null);

      // 1. Update Assignment Status in Database
      const { error: asnError } = await supabase
        .from('assignments')
        .update({ status: newStatus })
        .eq('assignment_id', assignmentId);

      if (asnError) throw asnError;

      // 2. Sync Team Status if applicable
      if (teamId && teamId !== '') {
        let teamStatus = newStatus;
        if (newStatus === 'Completed' || newStatus === 'Planned') teamStatus = 'Staged';
        
        const { error: teamError } = await supabase
          .from('teams')
          .update({ status: teamStatus })
          .eq('team_id', teamId);

        if (teamError) throw teamError;
        
        const assignment = assignments.find(a => a.assignment_id === assignmentId);
        await recordAction(`Updated status of ${assignment?.name || 'Assignment'} to ${newStatus}`);

        setTeams(prevTeams => 
          prevTeams.map(t => 
            t.team_id === teamId ? { ...t, status: teamStatus } : t
          )
        );
      }

      setAssignments(prevAsns => 
        prevAsns.map(a => 
          a.assignment_id === assignmentId ? { ...a, status: newStatus } : a
        )
      );
    } catch (updateErr) {
      setError(updateErr?.message || 'Failed to update status');
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

    // Ensure we use the raw UUID by removing the 'asn-' prefix used for row keys
    const assignmentId = rawAssignmentId.startsWith('asn-') ? rawAssignmentId.slice(4) : rawAssignmentId;

    // Find existing names for the confirmation/success message
    const team = teams.find(t => t.team_id === teamId);
    const assignment = assignments.find(a => a.assignment_id === assignmentId);

    if (!team || !assignment) return;

    try {
      setLoading(true);
      
      // Update Database
      const updates = [
        supabase.from('assignments').update({ team_id: teamId, status: 'Assigned' }).eq('assignment_id', assignmentId),
        supabase.from('teams').update({ status: 'Assigned' }).eq('team_id', teamId)
      ];

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error).map(r => r.error.message);
      if (errors.length > 0) throw new Error(errors.join(', '));

      // Update Local State Functional
      setAssignments(prev => prev.map(a => a.assignment_id === assignmentId ? { ...a, team_id: teamId, status: 'Assigned' } : a));
      setTeams(prev => prev.map(t => t.team_id === teamId ? { ...t, status: 'Assigned' } : t));

      setDraggedItem(null);
      setDropTarget(null);

      const teamName = team?.team_name_number || 'Unknown Team';
      const asnName = assignment?.name || 'Unknown Assignment';
      await recordAction(`Assigned ${teamName} to ${asnName} via drag and drop`);

      // Re-fetch all data to ensure full synchronization with DB and triggers
      await fetchSummary();
    } catch (err) {
      setError(err.message || 'Failed to link resources');
      console.error('Drop link error:', err);
    } finally {
      setLoading(false);
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

  const handleSaveTeam = async (formData) => {
    try {
      setLoading(true);
      setError(null);
      const isUpdate = !!formData.team_id;
      const currentResponders = formData.responder_ids || [];
      const finalIds = (formData.leader_responder_id && !currentResponders.includes(formData.leader_responder_id))
        ? [...currentResponders, formData.leader_responder_id] : currentResponders;

      const payload = {
        op_period_id: operationalPeriodId,
        team_name_number: formData.team_name_number || '',
        type: formData.type || 'Other',
        status: formData.status || 'Staged',
        leader_responder_id: formData.leader_responder_id || null,
        equipment: formData.equipment || [],
        sartopo_color_hex: formData.sartopo_color_hex || '#007bff'
      };

      let saved;
      if (isUpdate) {
        const { data, error: upErr } = await supabase.from('teams').update(payload).eq('team_id', formData.team_id).select().single();
        if (upErr) throw upErr;
        saved = data;
        
        // Membership reconciliation logic
        const { data: currentMembers } = await supabase.from('team_responders').select('responder_id').eq('team_id', formData.team_id);
        const originalIds = currentMembers?.map(r => r.responder_id) || [];
        const toAdd = finalIds.filter(id => !originalIds.includes(id));
        const toRemove = originalIds.filter(id => !finalIds.includes(id));

        if (toAdd.length > 0) {
          await supabase.from('team_responders').insert(toAdd.map(rid => ({ team_id: formData.team_id, responder_id: rid })));
          await supabase.from('responders').update({ status: 'Attached' }).in('responder_id', toAdd);
          setResponders(prev => prev.map(r => toAdd.includes(r.responder_id) ? { ...r, status: 'Attached' } : r));
        }
        if (toRemove.length > 0) {
          await supabase.from('team_responders').delete().eq('team_id', formData.team_id).in('responder_id', toRemove);
          await supabase.from('responders').update({ status: 'Staged' }).in('responder_id', toRemove);
          setResponders(prev => prev.map(r => toRemove.includes(r.responder_id) ? { ...r, status: 'Staged' } : r));
        }
        setTeams(prev => prev.map(t => t.team_id === saved.team_id ? saved : t));
      } else {
        setPendingAssignmentId(null); // Clear immediately to avoid reuse
        const { data, error: insErr } = await supabase.from('teams').insert(payload).select().single();
        if (insErr) throw insErr;
        saved = data;
        if (finalIds.length > 0) {
          await supabase.from('team_responders').insert(finalIds.map(rid => ({ team_id: saved.team_id, responder_id: rid })));
          await supabase.from('responders').update({ status: 'Attached' }).in('responder_id', finalIds);
          setResponders(prev => prev.map(r => finalIds.includes(r.responder_id) ? { ...r, status: 'Attached' } : r));
        }

        // If created from an assignment row, link them
        if (pendingAssignmentId) {
          const { error: linkErr } = await supabase
            .from('assignments')
            .update({ team_id: saved.team_id, status: 'Assigned' })
            .eq('assignment_id', pendingAssignmentId);
          
          if (!linkErr) {
            setAssignments(prev => prev.map(a => 
              a.assignment_id === pendingAssignmentId 
                ? { ...a, team_id: saved.team_id, status: 'Assigned' } 
                : a
            ));
            // Update the team we just created to Assigned as well
            saved.status = 'Assigned';
          }
          setPendingAssignmentId(null);
        }

        setTeams(prev => [...prev, saved]);
      }
      setShowTeamForm(false);

      // Re-fetch all data to ensure full synchronization with DB and triggers
      await fetchSummary();
    } catch (err) {
      setError(err.message || 'Failed to save team');
      setPendingAssignmentId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignment = async (formData) => {
    try {
      setLoading(true);
      setError(null);
      const isUpdate = !!formData.assignment_id;
      
      // Determine the correct team ID: 
      // If creation with link, use pending. If update, preserve existing.
      const targetTeamId = isUpdate ? formData.team_id : (pendingTeamId || null);

      const payload = {
        op_period_id: operationalPeriodId,
        name: formData.name || '',
        status: pendingTeamId ? 'Assigned' : (formData.status || 'Planned'),
        division: formData.division || '',
        assignment_type: formData.assignment_type || '',
        assignment_size: formData.assignment_size ? parseInt(formData.assignment_size, 10) : null,
        tac_channel: formData.tac_channel || '',
        description_narrative: formData.description_narrative || '',
        team_id: targetTeamId,
        is_orphaned: formData.is_orphaned || false
      };

      if (isUpdate) {
        const { data, error } = await supabase.from('assignments').update(payload).eq('assignment_id', formData.assignment_id).select().single();
        if (error) throw error;
        setAssignments(prev => prev.map(a => a.assignment_id === data.assignment_id ? data : a));
      } else {
        setPendingTeamId(null); // Clear immediately to avoid reuse
        const { data, error } = await supabase.from('assignments').insert(payload).select().single();
        if (error) throw error;
        if (!data) throw new Error('No data returned from server');

        if (targetTeamId) {
          await supabase.from('teams').update({ status: 'Assigned' }).eq('team_id', targetTeamId);
          setTeams(prev => prev.map(t => t.team_id === targetTeamId ? { ...t, status: 'Assigned' } : t));
        }

        await recordAction(`Created new assignment: ${payload.name}`);
        setAssignments(prev => [...prev, data]);

        // Re-fetch all data to ensure full synchronization with DB and triggers
        await fetchSummary();
      }
      setShowAssignmentForm(false);
    } catch (err) {
      setError(err.message || 'Failed to save assignment');
      setPendingTeamId(null);
    } finally { 
      setLoading(false); 
    }
  };

  const handleUnassignTeam = async (assignmentId, teamId, assignmentName, teamName) => {
    if (!window.confirm(`Are you sure you want to unassign "${teamName || 'the team'}" from "${assignmentName || 'this assignment'}"?`)) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Update Database
      const { error: asnError } = await supabase
        .from('assignments')
        .update({ team_id: null, status: 'Planned' })
        .eq('assignment_id', assignmentId);
      
      if (asnError) throw asnError;

      if (teamId && teamId !== '') {
        const { error: teamError } = await supabase
          .from('teams')
          .update({ status: 'Staged' })
          .eq('team_id', teamId);
        if (teamError) throw teamError;
      }

      // 2. Log Action
      await recordAction(`Unassigned ${teamName || 'Team'} from ${assignmentName || 'Assignment'}`);

      // 3. Refresh UI
      await fetchSummary();
    } catch (err) {
      setError(err.message || 'Failed to unassign team');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId, assignmentName) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${assignmentName}"? This action cannot be undone.`)) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('assignments').delete().eq('assignment_id', assignmentId);
      if (error) throw error;

      await recordAction(`Deleted Assignment: ${assignmentName}`);
      await fetchSummary();
    } catch (err) {
      setError(err.message || 'Failed to delete assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseTeam = async (teamId, teamName) => {
    const msg = `Are you sure you want to release "${teamName}"? This will return all members to Staged status and delete the team record.`;
    if (!window.confirm(msg)) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Get the members of the team before deleting
      const { data: members, error: membersError } = await supabase
        .from('team_responders')
        .select('responder_id')
        .eq('team_id', teamId);

      if (membersError) throw membersError;
      const responderIds = members?.map(m => m.responder_id) || [];

      // 2. Set responders back to Staged status
      if (responderIds.length > 0) {
        const { error: respError } = await supabase
          .from('responders')
          .update({ status: 'Staged' })
          .in('responder_id', responderIds);

        if (respError) throw respError;
      }

      // 3. Delete the team record
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('team_id', teamId);

      if (deleteError) throw deleteError;

      await recordAction(`Released Team: ${teamName}`);

      // 4. Refresh UI
      await fetchSummary();
    } catch (err) {
      setError(err.message || 'Failed to release team');
      console.error('Release team error:', err);
    } finally {
      setLoading(false);
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
        assignmentId: asnItem.assignment_id,
        assignmentName: asnItem.name,
        assignmentType: asnItem.assignment_type || '—',
        assignmentStatus: asnItem.status,
        teamName: matchingTeam?.team_name_number || '',
        teamType: matchingTeam?.type || '',
        teamLeader: matchingTeam ? leaderById[matchingTeam.leader_responder_id] || 'Unknown' : '',
        hasBoth: !!matchingTeam,
        teamId: asnItem.team_id,
      };
    });

    const assignmentTeamSet = new Set();
    (assignments || []).forEach(a => { if (a.team_id) assignmentTeamSet.add(a.team_id); });

    const teamOnlyRows = (teams || [])
      .filter(tItem => !assignmentTeamSet.has(tItem.team_id))
      .map(tItem => {
      return {
          id: `team-${tItem.team_id}`, // Prefixed ID ensures React sees this as a new row type
          assignmentName: '',
          assignmentType: '',
          assignmentStatus: '',
          teamName: tItem.team_name_number,
          teamType: tItem.type,
          teamLeader: leaderById[tItem.leader_responder_id] || 'Unknown',
          hasBoth: false,
          teamId: tItem.team_id,
      };
    });

    let result = [...assignmentRows, ...teamOnlyRows];

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
        // Default sort: Rows with both first
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
  }, [assignments, teams, teamById, leaderById, filters, sortConfig]);

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
          <p>Summary of all assignments and teams in the current operational period.</p>
        </div>
        <div className="summary-pill">
          <span>{totalRows} total rows</span>
          <span>{totalAssignments} assignments</span>
          <span>{totalTeams} teams</span>
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
                  (row.assignmentStatus === 'Completed' && row.hasBoth) ? 'row-completed' : ''
                }>
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
                        onClick={() => {
                          const rawAsnId = row.id.startsWith('asn-') ? row.id.slice(4) : null;
                          if (rawAsnId) openEditAssignmentForm(assignmentById[rawAsnId]);
                        }}
                      >
                        {row.assignmentName}
                      </div>
                    ) : '—'}
                  </td>
                  <td>{row.assignmentType || '—'}</td>
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
                    <select 
                      className="status-update-select"
                      value=""
                      onChange={(e) => {
                        const action = e.target.value;
                        // Extract the full UUID by removing the 'asn-' or 'team-' prefix
                        const rawId = row.id.startsWith('asn-') ? row.id.slice(4) : row.id.slice(5);

                        if (action === 'edit-team') {
                          openEditTeamForm(teamById[row.teamId]);
                        } else if (action === 'edit-assignment') {
                          openEditAssignmentForm(assignmentById[rawId]);
                        } else if (action === 'unassign') {
                          handleUnassignTeam(rawId, row.teamId, row.assignmentName, row.teamName);
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
                          <option value="new-team">New Team</option>
                          <option value="new-assignment">New Assignment</option>
                        </>
                      ) : (
                        <>
                          <option value="edit">Edit</option>
                          <option value="new-team">New Team</option>
                          <option value="new-assignment">New Assignment</option>
                          {row.teamId ? (
                            <option value="release">Release Team</option>
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
    </div>
  );
};

export default OperationsDashboardPage;
