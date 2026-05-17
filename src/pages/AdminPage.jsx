import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/IncidentEditPage.css'; // Reusing form styles for consistency

const AdminPage = () => {
  const navigate = useNavigate();
  const { isAdmin, setIsAdmin } = useIncident();
  const [admins, setAdmins] = useState([]);
  const [allIncidents, setAllIncidents] = useState([]);
  const [allResponders, setAllResponders] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loginEmail, setAdminLoginEmail] = useState('');
  const [loginPassword, setAdminLoginPassword] = useState('');

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
      setSuccess('Responder checked out.');
      fetchAllResponders();
    } catch (err) {
      setError('Failed to check out responder: ' + err.message);
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
      setSuccess('Responder record deleted.');
      fetchAllResponders();
    } catch (err) {
      setError('Failed to delete responder: ' + err.message);
    }
  };

  const handleEndIncident = async (id) => {
    if (!window.confirm('Mark this incident as ended? This will stop tracking for all responders.')) return;

    try {
      const { error: updateError } = await supabase
        .from('incidents')
        .update({ end_datetime: new Date().toISOString() })
        .eq('incident_id', id);

      if (updateError) throw updateError;
      setSuccess('Incident ended successfully.');
      fetchAllIncidents();
    } catch (err) {
      setError('Failed to end incident: ' + err.message);
    }
  };

  const handleDeleteIncident = async (id) => {
    const message = 'Deleting an incident is permanent and removes all associated operational periods, assignments, and responder history. Continue?';
    if (!window.confirm(message)) return;

    try {
      const { error: deleteError } = await supabase
        .from('incidents')
        .delete()
        .eq('incident_id', id);

      if (deleteError) throw deleteError;
      setSuccess('Incident deleted.');
      fetchAllIncidents();
    } catch (err) {
      setError('Failed to delete incident: ' + err.message);
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
        <h2>Current Administrators</h2>
        <div className="admin-list" style={{ marginTop: '16px' }}>
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
      </div>

      <div className="section-card">
        <h2>Responder Management</h2>
        <div className="operations-table-wrapper" style={{ marginTop: '16px', boxShadow: 'none', border: '1px solid #eee' }}>
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
                  const isCheckedOut = res.status === 'CheckedOut';
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
      </div>

      <div className="section-card">
        <h2>Incident Management</h2>
        <div className="operations-table-wrapper" style={{ marginTop: '16px', boxShadow: 'none', border: '1px solid #eee' }}>
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
                        <span className={`status-indicator ${isActive ? 'staged' : ''}`}>
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
      </div>
    </div>
  );
};

export default AdminPage;