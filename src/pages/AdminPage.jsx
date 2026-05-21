import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/IncidentEditPage.css'; // Reusing form styles for consistency

const AdminPage = () => {
  const navigate = useNavigate();
  const { isAdmin, setIsAdmin, incidentId, responderId, endIncident, logout } = useIncident();
  const [admins, setAdmins] = useState([]);
  const [allIncidents, setAllIncidents] = useState([]);
  const [allResponders, setAllResponders] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loginEmail, setAdminLoginEmail] = useState('');
  const [loginPassword, setAdminLoginPassword] = useState('');
  const [isRespondersExpanded, setIsRespondersExpanded] = useState(false);
  const [isTeamsExpanded, setIsTeamsExpanded] = useState(false);
  const [isAssignmentsExpanded, setIsAssignmentsExpanded] = useState(false);
  const [isIncidentsExpanded, setIsIncidentsExpanded] = useState(false);
  const [isAdminsExpanded, setIsAdminsExpanded] = useState(false);

  const fetchAdmins = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data: adminData, error: fetchError } = await supabase
        .from('admin_users')
        .select('email, username, created_at')
        .order('email');

      if (fetchError) throw fetchError;
      console.log('All admins info retrieved from table:', adminData);
      setAdmins(adminData || []);
    } catch (err) {
      setError('Failed to load administrator list');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllIncidents = async () => {
    if (!isAdmin) return;
    try {
      // Fetch incidents and join with operational periods to find the latest one
      const { data, error: fetchError } = await supabase
        .from('incidents')
        .select('*, operational_periods(op_number, start_datetime)')
        .order('start_datetime', { ascending: false });

      if (fetchError) throw fetchError;
      setAllIncidents(data || []);
    } catch (err) {
      console.error('Error fetching incident list:', err);
    }
  };

  const fetchAllResponders = async () => {
    if (!isAdmin) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('responders')
        .select('*')
        .order('checkin_datetime', { ascending: false });

      if (fetchError) throw fetchError;
      setAllResponders(data || []);
    } catch (err) {
      console.error('Error fetching responders list:', err);
    }
  };

  const fetchAllTeams = async () => {
    if (!isAdmin) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*, operational_periods(op_number, incidents(name, number))')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAllTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams list:', err);
    }
  };

  const fetchAllAssignments = async () => {
    if (!isAdmin) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('assignments')
        .select('*, operational_periods(op_period_id, op_number, incident_id)') // Fetch incident_id from op_periods
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAllAssignments(data || []);
    } catch (err) {
      console.error('Error fetching assignments list:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout(); // Use the global logout to clear everything
    navigate('/checkin');
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdmins();
      fetchAllIncidents();
      fetchAllResponders();
      fetchAllTeams();
      fetchAllAssignments();
    }
  }, [isAdmin]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Use the secure RPC function instead of a direct table query
      const { data, error: queryError } = await supabase
        .rpc('verify_admin_login', { 
          p_email: loginEmail.trim(), 
          p_password: loginPassword 
        })
        .maybeSingle();

      if (queryError) throw queryError;
      if (!data) throw new Error('Invalid email or password');

      console.log('Login successful, admin record found:', data);
      setIsAdmin(true);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!newEmail.trim() || !newUsername.trim() || !newPassword.trim()) {
      setError('All fields are required to add a new administrator.');
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert([{ 
          email: newEmail.trim().toLowerCase(), 
          username: newUsername.trim(),
          password: newPassword.trim()
        }]);

      if (insertError) throw insertError;

      setSuccess(`Added ${newEmail} to administrators.`);
      setNewEmail('');
      setNewUsername('');
      setNewPassword('');
      fetchAdmins();
    } catch (err) {
      setError(err.code === '23505' ? 'This email is already an admin.' : (err.message || 'Failed to add administrator'));
      console.error('Admin management error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOutResponder = async (id) => {
    if (!window.confirm('Mark this responder as checked out?')) return;

    try {
      const { error: updateError } = await supabase
        .from('responders')
        .update({ 
          status: 'CheckedOut',
          checkout_datetime: new Date().toISOString()
        })
        .eq('responder_id', id);

      if (updateError) throw updateError;

      // Update context if we checked out our own current responder session
      if (id === responderId) {
        logout();
      }

      setSuccess('Responder checked out.');
      fetchAllResponders();
    } catch (err) {
      setError('Failed to check out responder: ' + err.message);
    }
  };

  const handleDisbandTeam = async (id, name) => {
    if (!window.confirm(`Disband team "${name}"? Members will be released back to staging.`)) return;

    try {
      setLoading(true);
      // 1. Get members
      const { data: members } = await supabase.from('team_responders').select('responder_id').eq('team_id', id);
      const rIds = members?.map(m => m.responder_id) || [];
      
      // 2. Release responders
      if (rIds.length > 0) {
        await supabase.from('responders').update({ status: 'Staged' }).in('responder_id', rIds);
        await supabase.from('responder_team_history')
          .update({ detached_datetime: new Date().toISOString() })
          .eq('team_id', id)
          .is('detached_datetime', null);
      }

      // 3. Update team status
      const { error: updateError } = await supabase
        .from('teams')
        .update({ 
          status: 'Disbanded',
          last_par_check: new Date().toISOString()
        })
        .eq('team_id', id);

      if (updateError) throw updateError;

      setSuccess('Team disbanded.');
      fetchAllTeams();
      fetchAllResponders(); // Refresh responders as their status changed
    } catch (err) {
      setError('Failed to disband team: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (id, name) => {
    if (!window.confirm(`Permanently delete team "${name}"? This action cannot be undone and will remove all assignment links.`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('team_id', id);

      if (deleteError) throw deleteError;

      setSuccess('Team record deleted.');
      fetchAllTeams();
    } catch (err) {
      setError('Failed to delete team: ' + err.message);
    }
  };

  const handleDeleteAssignment = async (id, name) => {
    if (!window.confirm(`Permanently delete assignment "${name}"? This action cannot be undone.`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('assignment_id', id);

      if (deleteError) throw deleteError;

      setSuccess('Assignment record deleted.');
      fetchAllAssignments();
    } catch (err) {
      setError('Failed to delete assignment: ' + err.message);
    }
  };

  const handleDeleteResponder = async (id, name) => {
    if (!window.confirm(`Permanently delete responder "${name}"? This action cannot be undone.`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('responders')
        .delete()
        .eq('responder_id', id);

      if (deleteError) throw deleteError;

      // Update context if we deleted our own current responder session
      if (id === responderId) {
        logout();
      }

      setSuccess('Responder record deleted.');
      fetchAllResponders();
    } catch (err) {
      setError('Failed to delete responder: ' + err.message);
    }
  };

  const handleEndIncident = async (id) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get the latest operational period for this incident to clean up its resources
      const { data: opData } = await supabase
        .from('operational_periods')
        .select('op_period_id')
        .eq('incident_id', id)
        .is('end_datetime', null)
        .order('start_datetime', { ascending: false })
        .maybeSingle();

      const opId = opData?.op_period_id;

      // 2. Fetch counts for confirmation message
      const [asnRes, resRes] = await Promise.all([
        opId ? supabase.from('assignments')
          .select('assignment_id, status')
          .eq('op_period_id', opId)
          .in('status', ['Assigned', 'Deployed']) : Promise.resolve({ data: [] }),
        supabase.from('responders')
          .select('responder_id')
          .eq('incident_id', id)
          .is('checkout_datetime', null)
      ]);

      const activeAssignments = asnRes.data || [];
      const activeResponders = resRes.data || [];
      const deployedCount = activeAssignments.filter(a => a.status === 'Deployed').length;
      const assignedCount = activeAssignments.filter(a => a.status === 'Assigned').length;

      const confirmMsg = `Ending this incident will perform the following actions automatically:\n\n` +
        `- Mark ${deployedCount} Deployed assignments as Incomplete\n` +
        `- Mark ${assignedCount} Assigned assignments as Planned\n` +
        `- Disband all teams in the current operational period\n` +
        `- Check out all ${activeResponders.length} active responders\n` +
        `- Close the operational period and incident tracking\n\n` +
        `Continue?`;
      
      if (!window.confirm(confirmMsg)) {
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();

      // 3. Perform cleanup on the Operational Period if found
      if (opId) {
        if (deployedCount > 0) {
          await supabase.from('assignments').update({ status: 'Incomplete', team_id: null }).eq('op_period_id', opId).eq('status', 'Deployed');
        }
        if (assignedCount > 0) {
          await supabase.from('assignments').update({ status: 'Planned', team_id: null }).eq('op_period_id', opId).eq('status', 'Assigned');
        }

        await supabase.from('teams').update({ status: 'Disbanded', last_par_check: null }).eq('op_period_id', opId);
        await supabase.from('operational_periods').update({ end_datetime: now }).eq('op_period_id', opId);
      }

      // 4. Check out responders
      if (activeResponders.length > 0) {
        await supabase.from('responders')
            .update({ status: 'CheckedOut', checkout_datetime: now })
          .eq('incident_id', id)
          .is('checkout_datetime', null);
      }

      // 5. Finalize Incident closure
      const { error: updateError } = await supabase
        .from('incidents')
        .update({ end_datetime: now })
        .eq('incident_id', id);

      if (updateError) throw updateError;

      // Update context if we ended the current active incident session
      if (id === incidentId) {
        endIncident();
      }

      setSuccess('Incident ended and resources cleaned up.');
      // Refresh all management views
      fetchAllIncidents();
      fetchAllResponders();
      fetchAllTeams();
      fetchAllAssignments();
    } catch (err) {
      setError('Failed to end incident: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIncident = async (id) => {
    const message = 'Permanently delete this incident? This will remove all associated operational periods, assignments, teams, responders, and logs. This action cannot be undone.';
    if (!window.confirm(message)) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Delete responders associated with this incident
      // Note: Responders are checked out sessions tied to this specific incident ID.
      const { error: resError } = await supabase
        .from('responders')
        .delete()
        .eq('incident_id', id);
      
      if (resError) throw resError;

      // 2. Delete the incident record
      // This will automatically cascade through operational_periods, teams, 
      // assignments, action_logs, and clues due to PostgreSQL foreign key constraints.
      const { error: deleteError } = await supabase
        .from('incidents')
        .delete()
        .eq('incident_id', id);

      if (deleteError) throw deleteError;

      // 3. Update context if we deleted the current active session
      if (id === incidentId) {
        logout();
      }

      setSuccess('Incident and all associated data deleted.');
      
      // 4. Refresh all lists to ensure UI is in sync
      fetchAllIncidents();
      fetchAllResponders();
      fetchAllTeams();
      fetchAllAssignments();
    } catch (err) {
      setError('Failed to delete incident: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (email) => {
    const newPwd = window.prompt(`Enter new password for ${email}:`);
    if (!newPwd || !newPwd.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ password: newPwd.trim() })
        .eq('email', email);

      if (updateError) throw updateError;
      setSuccess(`Password updated for ${email}`);
    } catch (err) {
      setError('Failed to update password: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (email) => {
    setError(null);
    setSuccess(null);

    if (admins.length <= 1) {
      setError('Cannot remove the last administrator. At least one system administrator is required to maintain access.');
      return;
    }

    if (!window.confirm(`Remove ${email} from administrators?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('admin_users')
        .delete()
        .eq('email', email);

      if (deleteError) throw deleteError;
      fetchAdmins();
    } catch (err) {
      setError('Failed to remove administrator');
    }
  };

  // Show login form if not authenticated
  if (!isAdmin) {
    return (
      <div className="incident-edit-page">
        <div className="page-header">
          <h1>System Administration</h1>
          <p className="subtitle">Please authenticate to manage system administrators.</p>
        </div>

        <div className="section-card" style={{ maxWidth: '400px', margin: '40px auto' }}>
          <form onSubmit={handleAdminLogin}>
            <label>
              Admin Username (Email)
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setAdminLoginEmail(e.target.value)}
                placeholder="admin@agency.gov"
                required
                autoFocus
              />
            </label>
            <label style={{ marginTop: '12px' }}>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setAdminLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '20px' }}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && <p className="alert alert-error" style={{ marginTop: '16px' }}>{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="incident-edit-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>System Administration</h1>
          <p className="subtitle">Manage users with administrative access to SAROps.</p>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary">
          Sign Out Admin
        </button>
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <h2>Add New Administrator</h2>
        <form onSubmit={handleAddAdmin} style={{ display: 'grid', gap: '12px', gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'flex-end' }}>
          <label style={{ marginBottom: 0 }}>
            Username
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="CommandCenter1"
              required
            />
          </label>
          <label style={{ flex: 1, marginBottom: 0 }}>
            Email Address
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="admin@agency.gov"
              required
            />
          </label>
          <label style={{ flex: 1, marginBottom: 0 }}>
            Password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading || !isAdmin}>
            {loading ? 'Adding...' : 'Add Admin'}
          </button>
        </form>
        {error && <p className="alert alert-error" style={{ marginTop: '12px' }}>{error}</p>}
        {success && <p className="save-message" style={{ marginTop: '12px' }}>{success}</p>}
      </div>

      <div className="section-card">
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isAdminsExpanded ? '16px' : 0 }}
          onClick={() => setIsAdminsExpanded(!isAdminsExpanded)}
        >
          <h2 style={{ margin: 0 }}>Current Administrators ({admins.length})</h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
            {isAdminsExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
          </span>
        </div>

        {isAdminsExpanded && (
          <div className="admin-list">
            {loading ? (
              <p>Loading administrators...</p>
            ) : admins.length === 0 ? (
              <p>No administrators configured.</p>
            ) : (
              admins.map(admin => (
                <div key={admin.email} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                  <div>
                    <strong>{admin.username || 'No Username'}</strong>
                    <span style={{ marginLeft: '12px', color: '#64748b', fontSize: '0.9em' }}>({admin.email})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleChangePassword(admin.email)} className="btn btn-secondary btn-sm">Change Password</button>
                    <button onClick={() => handleRemoveAdmin(admin.email)} className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}>Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="section-card">
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isRespondersExpanded ? '16px' : 0 }}
          onClick={() => setIsRespondersExpanded(!isRespondersExpanded)}
        >
          <h2 style={{ margin: 0 }}>Responder Management ({allResponders.length})</h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
            {isRespondersExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
          </span>
        </div>

        {isRespondersExpanded && (
          <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Check-In Time</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allResponders.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-row">No responders found in database.</td>
                </tr>
              ) : (
                allResponders.map(res => {
                    const isCheckedOut = !!res.checkout_datetime;
                  return (
                    <tr key={res.responder_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{res.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {res.agency} • {res.identifier}
                        </div>
                      </td>
                      <td>{new Date(res.checkin_datetime).toLocaleString()}</td>
                      <td>
                        <span className={`status-indicator ${res.status.toLowerCase()}`}>
                          {res.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {!isCheckedOut && (
                            <button 
                              onClick={() => handleCheckOutResponder(res.responder_id)} 
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#f59e0b' }}
                            >
                              Check Out
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteResponder(res.responder_id, res.name)} 
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#dc2626' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <div className="section-card">
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isTeamsExpanded ? '16px' : 0 }}
          onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
        >
          <h2 style={{ margin: 0 }}>Team Management ({allTeams.length})</h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
            {isTeamsExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
          </span>
        </div>

        {isTeamsExpanded && (
          <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
            <table className="operations-table" style={{ minWidth: 'auto' }}>
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Type</th>
                  <th>Incident / OP</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allTeams.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">No teams found in database.</td>
                  </tr>
                ) : (
                  allTeams.map(team => {
                    const incident = team.operational_periods?.incidents;
                    const opNum = team.operational_periods?.op_number;
                    const isDisbanded = team.status === 'Disbanded';
                    
                    return (
                      <tr key={team.team_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{team.team_name_number}</div>
                        </td>
                        <td>{team.type}</td>
                        <td>
                          {incident ? (
                            <>
                              <div>{incident.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>OP #{opNum}</div>
                            </>
                          ) : '—'}
                        </td>
                        <td>
                          <span className={`status-indicator ${team.status.toLowerCase()}`}>
                            {team.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {!isDisbanded && (
                              <button onClick={() => handleDisbandTeam(team.team_id, team.team_name_number)} className="btn btn-secondary btn-sm" style={{ color: '#f59e0b' }}>Disband</button>
                            )}
                            <button onClick={() => handleDeleteTeam(team.team_id, team.team_name_number)} className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section-card">
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isAssignmentsExpanded ? '16px' : 0 }}
          onClick={() => setIsAssignmentsExpanded(!isAssignmentsExpanded)}
        >
          <h2 style={{ margin: 0 }}>Assignment Management ({allAssignments.length})</h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
            {isAssignmentsExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
          </span>
        </div>

        {isAssignmentsExpanded && (
          <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
            <table className="operations-table" style={{ minWidth: 'auto' }}>
              <thead>
                <tr>
                  <th>Assignment Name</th>
                  <th>Type</th>
                  <th>Incident / OP</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allAssignments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">No assignments found in database.</td>
                  </tr>
                ) : (
                  allAssignments.map(asn => {
                    const opPeriod = asn.operational_periods;
                    const opNum = opPeriod?.op_number;
                    
                    // Manually find incident details from the already fetched allIncidents list
                    // This makes the display more robust against broken nested FKs
                    const incident = opPeriod?.incident_id 
                      ? allIncidents.find(inc => inc.incident_id === opPeriod.incident_id)
                      : null;
                    
                    const incidentName = incident?.name;
                    const incidentNumber = incident?.number;
                    
                    return (
                      <tr key={asn.assignment_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{asn.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {asn.division ? `Div: ${asn.division}` : 'No Division'}
                          </div>
                        </td>
                        <td>{asn.assignment_type || '—'}</td>
                        <td>
                          {incidentName ? (
                            <>
                              <div>{incidentName}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>OP #{opNum} ({incidentNumber})</div>
                            </>
                          ) : '—'}
                        </td>
                        <td>
                          <span className={`status-indicator ${asn.status.toLowerCase()}`}>
                            {asn.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteAssignment(asn.assignment_id, asn.title || asn.name)} 
                            className="btn btn-secondary btn-sm" 
                            style={{ color: '#dc2626' }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section-card">
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isIncidentsExpanded ? '16px' : 0 }}
          onClick={() => setIsIncidentsExpanded(!isIncidentsExpanded)}
        >
          <h2 style={{ margin: 0 }}>Incident Management ({allIncidents.length})</h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
            {isIncidentsExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
          </span>
        </div>
        {isIncidentsExpanded && (
          <div className="operations-table-wrapper" style={{ boxShadow: 'none', border: '1px solid #eee' }}>
          <table className="operations-table" style={{ minWidth: 'auto' }}>
            <thead>
              <tr>
                <th>Incident Name</th>
                <th>Started</th>
                <th>Latest OP / Start</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allIncidents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-row">No incidents found in database.</td>
                </tr>
              ) : (
                allIncidents.map(inc => {
                  const isActive = !inc.end_datetime;
                  const latestOpObj = inc.operational_periods?.sort((a, b) => 
                    new Date(b.start_datetime) - new Date(a.start_datetime)
                  )[0];
                  const latestOpNumber = latestOpObj?.op_number || '—';
                  const latestOpStart = latestOpObj?.start_datetime ? new Date(latestOpObj.start_datetime).toLocaleString() : '';

                  return (
                    <tr key={inc.incident_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inc.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>#{inc.number}</div>
                      </td>
                      <td>{new Date(inc.start_datetime).toLocaleDateString()}</td>
                      <td>
                        <div>{latestOpNumber}</div>
                        {latestOpStart && <div style={{ fontSize: '12px', color: '#64748b' }}>{latestOpStart}</div>}
                      </td>
                      <td>
                        <span className={`status-indicator ${isActive ? 'active' : 'ended'}`}>
                          {isActive ? 'Active' : 'Ended'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isActive ? (
                          <button 
                            onClick={() => handleEndIncident(inc.incident_id)} 
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#f59e0b' }}
                          >
                            End Incident
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleDeleteIncident(inc.incident_id)} 
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#dc2626' }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;