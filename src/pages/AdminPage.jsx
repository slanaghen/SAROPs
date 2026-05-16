import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/IncidentEditPage.css'; // Reusing form styles for consistency

const AdminPage = () => {
  const [admins, setAdmins] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // New state to track authentication status

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('admin_users')
        .select('email, created_at')
        .order('email');

      if (fetchError) throw fetchError;
      setAdmins(data || []);
    } catch (err) {
      setError('Failed to load administrator list');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();

    // Listen for auth state changes to re-fetch if user logs in/out while on this page
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAuthenticated(true);
        fetchAdmins(); // Re-fetch if session becomes active
      } else {
        setIsAuthenticated(false);
        setAdmins([]); // Clear admins if logged out
        setError('You have been logged out. Please log in to manage administrators.');
      }
    });
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newEmail.trim()) return;

    // Ensure authenticated before attempting to add
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be logged in to add administrators.');
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert([{ email: newEmail.trim().toLowerCase() }]);

      if (insertError) throw insertError;

      setSuccess(`Added ${newEmail} to administrators.`);
      setNewEmail('');
      fetchAdmins();
    } catch (err) {
      setError(err.code === '23505' ? 'This email is already an admin.' : (err.message || 'Failed to add administrator'));
      console.error('Admin management error:', err);
    }
  };

  const handleRemoveAdmin = async (email) => {
    if (!window.confirm(`Remove ${email} from administrators?`)) return;

    // Ensure authenticated before attempting to remove
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be logged in to remove administrators.');
      return;
    }

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

  if (loading && !isAuthenticated && !error) { // Initial loading state before auth check
    return (
      <div className="incident-edit-page">
        <div className="page-header">
          <h1>System Administration</h1>
          <p className="subtitle">Loading authentication status...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="incident-edit-page">
        <div className="page-header">
          <h1>System Administration</h1>
          <p className="subtitle">Manage users with administrative access to SAROps.</p>
        </div>
        <div className="alert alert-error" style={{ margin: '16px' }}>
          <p>{error || 'You must be logged in to manage administrators.'}</p>
          <button className="btn btn-primary" onClick={() => window.location.href = '/login'}>Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="incident-edit-page">
      <div className="page-header">
        <h1>System Administration</h1>
        <p className="subtitle">Manage users with administrative access to SAROps.</p>
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <h2>Add New Administrator</h2>
        <form onSubmit={handleAddAdmin} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
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
          <button type="submit" className="btn btn-primary" disabled={loading || !isAuthenticated}>
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
                <span>{admin.email}</span>
                <button onClick={() => handleRemoveAdmin(admin.email)} className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}>Remove</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;