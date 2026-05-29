import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const AdminLogin = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('login'); // 'login', 'register', 'verify'
  const [otpToken, setOtpToken] = useState('');

  useEffect(() => {
    const fetchActiveIncidents = async () => {
      const { data, error: fetchError } = await supabase
        .from('incidents')
        .select('incident_id, name, number')
        .is('end_datetime', null)
        .order('start_datetime', { ascending: false });

      if (!fetchError && data) {
        setIncidents(data);
      }
    };
    fetchActiveIncidents();
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Ensure an active Auth session exists to provide a valid auth_uid for RLS.
      // This allows the user to manage their own status on the dashboard later.
      const { data: sessionRes } = await supabase.auth.getSession();
      let currentAuthUid = sessionRes?.session?.user?.id;

      if (!currentAuthUid) {
        const { data: signInRes } = await supabase.auth.signInAnonymously();
        currentAuthUid = signInRes?.user?.id;
      }

      // Use the secure RPC function for admin authentication
      const { data, error: queryError } = await supabase
        .rpc('verify_user_login', { 
          p_email: email.trim().toLowerCase(), 
          p_password: password 
        })
        .maybeSingle();

      if (queryError) {
        console.error('RPC Error during login:', queryError);
        throw new Error(`Authentication Service Error: ${queryError.message}`);
      }

      if (!data) throw new Error('Invalid email or password');

      // Permission check: Non-admins must select an incident to proceed
      if (!selectedIncidentId && data.access_level !== 'admin') {
        throw new Error("You must select an incident to proceed.");
      }
      if (data.access_level === 'responder' && selectedIncidentId === 'NEW_INCIDENT') {
        throw new Error("You do not have permission to create incidents. Please select an existing incident to check in.");
      }

      // If an incident is selected, "check in" the user to that incident
      let responderRecord = null;
      if (selectedIncidentId && selectedIncidentId !== 'NEW_INCIDENT') {
        const { data: upsertData, error: checkinError } = await supabase
          .from('responders')
          .upsert({
            incident_id: selectedIncidentId,
            auth_uid: currentAuthUid,
            name: data.name || data.username,
            agency: data.agency || 'Unknown', // Use user agency or default if blank
            identifier: data.identifier || data.username,
            cell_phone: data.cell_phone,
            responder_type: data.responder_type || 'SAR',
            special_skills: data.special_skills,
            access_level: data.access_level,
            status: 'Staged',
            device_id: `admin_${data.email}_${selectedIncidentId}`,
            checkin_datetime: new Date().toISOString()
          }, { onConflict: 'device_id' })
          .select()
          .maybeSingle();

        if (checkinError) {
          console.error('Check-in failed during login:', checkinError);
        } else {
          responderRecord = upsertData;
        }
      }

      console.log('Admin login successful', selectedIncidentId ? `checked into incident ${selectedIncidentId}` : '');
      onLoginSuccess(selectedIncidentId, data, responderRecord);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const emailVal = email.trim().toLowerCase();
    if (!emailVal) return;
    
    setLoading(true);
    setError(null);
    try {
      // Check if user already exists in the system users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', emailVal)
        .maybeSingle();
        
      if (existingUser) {
        throw new Error("This email is already registered. Please login.");
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({ 
        email: emailVal,
        options: { shouldCreateUser: true }
      });
      if (otpError) throw otpError;
      setView('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpToken,
        type: 'signup'
      });
      if (verifyError) throw verifyError;

      // Create system user record with Responder access level via secure RPC
      const { error: rpcError } = await supabase.rpc('admin_add_user', {
        p_email: email.trim().toLowerCase(),
        p_username: email.trim().toLowerCase(),
        p_password: Math.random().toString(36).slice(-12), // Temporary placeholder password
        p_access_level: 'responder'
      });
      if (rpcError) throw rpcError;

      // Fetch the generated user record to initialize global context
      const { data: userRecord } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      onLoginSuccess('', userRecord, null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="incident-edit-page">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1>
          {view === 'login' ? 'SAROPs Login' : (view === 'register' ? 'Register Account' : 'Verify Email')}
        </h1>
        <p className="subtitle">
          {view === 'login' ? 'Please authenticate to proceed' : 
           (view === 'register' ? 'Join the mission and setup your responder profile' : 
           'Enter the 6-digit code sent to your email')}
        </p>
      </div>

      <div className="section-card" style={{ maxWidth: '400px', margin: '40px auto' }}>
        {view === 'login' && (
          <form onSubmit={handleAdminLogin} id="admin-login-form">
            <label>
              Username
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
            <label style={{ marginTop: '12px' }}>
              Check Into Incident
              <select
                value={selectedIncidentId}
                onChange={(e) => setSelectedIncidentId(e.target.value)}
                style={{ width: '100%', marginTop: '8px' }}
                disabled={loading}
              >
                <option value="">— Don't check in —</option>
                <option value="NEW_INCIDENT">+ Start New Incident</option>
                {incidents.map((inc) => (
                  <option key={inc.incident_id} value={inc.incident_id}>
                    {inc.name} ({inc.number})
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '20px' }}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px' }}>
              <span style={{ color: '#64748b' }}>Need an account? </span>
              <button 
                type="button" 
                onClick={() => setView('register')} 
                style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: 0 }}
              >
                Register
              </button>
            </div>
            {error && <p className="alert alert-error" style={{ marginTop: '16px' }}>{error}</p>}
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister}>
            <label>
              Email Address
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="your@email.com" 
                required 
                autoFocus 
              />
            </label>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} disabled={loading}>
              {loading ? 'Sending code...' : 'Send Verification Code'}
            </button>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button 
                type="button" 
                onClick={() => setView('login')} 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}
              >
                Back to Login
              </button>
            </div>
            {error && <p className="alert alert-error" style={{ marginTop: '16px' }}>{error}</p>}
          </form>
        )}

        {view === 'verify' && (
          <form onSubmit={handleVerifyOtp}>
            <label>
              Verification Code
              <input 
                type="text" 
                value={otpToken} 
                onChange={e => setOtpToken(e.target.value)} 
                placeholder="123456" 
                required 
                autoFocus 
              />
            </label>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button 
                type="button" 
                onClick={() => setView('register')} 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}
              >
                Change Email
              </button>
            </div>
            {error && <p className="alert alert-error" style={{ marginTop: '16px' }}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;