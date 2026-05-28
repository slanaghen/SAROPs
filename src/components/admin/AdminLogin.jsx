import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

const AdminLogin = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Use the secure RPC function for admin authentication
      const { data, error: queryError } = await supabase
        .rpc('verify_admin_login', { 
          p_email: email.trim().toLowerCase(), 
          p_password: password 
        })
        .maybeSingle();

      if (queryError) throw queryError;
      if (!data) throw new Error('Invalid email or password');

      console.log('Admin login successful');
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="incident-edit-page">
      <div className="page-header">
        <h1>System Administration</h1>
        <p className="subtitle">Please authenticate to manage system administrators.</p>
      </div>

      <div className="section-card" style={{ maxWidth: '400px', margin: '40px auto' }}>
        <form onSubmit={handleAdminLogin} id="admin-login-form">
          <label>
            Admin Username (Email)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@agency.gov"
              required
              autoFocus
            />
          </label>
          <label style={{ marginTop: '12px' }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
};

export default AdminLogin;