import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import '../../styles/ActionButtons.css';
import '../../styles/FormElements.css';

const Login = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('login'); // 'login', 'register', 'verify'
  const [otpToken, setOtpToken] = useState(''); 
  const [vehicles, setVehicles] = useState('');
  const [displayDensity, setDisplayDensity] = useState('comfortable');

  // Fetch display density for local component styling
  useEffect(() => {
    const fetchDensity = async () => {
      const userEmail = localStorage.getItem('sarops_user_email');
      if (!userEmail) return;
      const { data } = await supabase.from('users').select('display_density').eq('email', userEmail).maybeSingle();
      if (data?.display_density) setDisplayDensity(data.display_density);
    };
    fetchDensity();
  }, []);

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
      const { data: sessionRes } = await supabase.auth.getSession();
      let currentAuthUid = sessionRes?.session?.user?.id;

      if (!currentAuthUid) {
        try {
          const { data: signInRes } = await supabase.auth.signInAnonymously();
          currentAuthUid = signInRes?.user?.id;
        } catch (authErr) {
          console.warn('Anonymous sign-in not available. Attempting direct login.', authErr);
        }
      }

      const { data, error: queryError } = await supabase
        .rpc('verify_user_login', { 
          p_email: email.trim().toLowerCase(), 
          p_password: password 
        })
        .maybeSingle();

      if (queryError) throw new Error(`Authentication Service Error: ${queryError.message}`);
      if (!data) throw new Error('Invalid email or password');

      if (!selectedIncidentId && data.access_level !== 'admin') {
        throw new Error("You must select an incident to proceed.");
      }
      if (data.access_level === 'responder' && selectedIncidentId === 'NEW_INCIDENT') {
        throw new Error("You do not have permission to create incidents.");
      }

      let responderRecord = null;
      if (selectedIncidentId && selectedIncidentId !== 'NEW_INCIDENT') {
        const { data: upsertData, error: checkinError } = await supabase
          .rpc('checkin_responder_securely', {
            p_incident_id: selectedIncidentId,
            p_auth_uid: currentAuthUid,
            p_name: data.name || data.username,
            p_agency: data.agency || 'Unknown',
            p_identifier: data.identifier || data.username,
            p_cell_phone: data.cell_phone || null,
            p_responder_type: data.responder_type || 'SAR',
            p_special_skills: data.special_skills || null,
            p_vehicles: vehicles || null,
            p_access_level: data.access_level,
            p_status: 'Staged',
            p_device_id: `admin_${data.email}_${selectedIncidentId}`
          })
          .maybeSingle();

        if (checkinError) console.error('Check-in failed:', checkinError);
        else {
          responderRecord = upsertData;

          // Log responder check-in
          const checkinUser = data.name || data.username;
          await supabase.from('action_logs').insert({
            incident_id: selectedIncidentId,
            action: `Responder checked in (Login): ${checkinUser} (${data.agency || 'Unknown'})`,
            user_name: checkinUser
          });
        }
      }

      // Pass the form-entered vehicles separately. The user profile and responder records no longer contain vehicle associations.
      onLoginSuccess(selectedIncidentId, data, responderRecord, vehicles || '');
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
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', emailVal)
        .maybeSingle();
        
      if (existingUser) throw new Error("This email is already registered.");

      const { error: otpError } = await supabase.auth.signInWithOtp({ 
        email: emailVal,
        options: { 
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/login`
        }
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
        type: 'email'
      });
      if (verifyError) throw verifyError;

      // After successful OTP verification, the user is authenticated.
      // Now, create the user record in the 'users' table with default responder access.
      const { error: rpcError } = await supabase.rpc('admin_add_user', {
        p_email: email.trim().toLowerCase(),
        p_username: email.trim().toLowerCase(),
        p_password: null, // No password provided by OTP, admin_add_user will handle default or leave blank
        p_access_level: 'responder'
      });
      if (rpcError) throw rpcError;

      // Redirect to settings page for the new user to complete their profile
      navigate('/settings', { state: { newRegistrationEmail: email.trim().toLowerCase(), isNewRegistration: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`incident-edit-page density-${displayDensity}`}>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1>
          {view === 'login' ? 'SAROPs Login' : (view === 'register' ? 'Register Account' : 'Verify Email')}
        </h1>
        <p className="subtitle">
          {view === 'login' && 'Please authenticate to proceed'}
          {view === 'register' && 'Join the mission and set up your responder profile'}
          {view === 'verify' && 'Check your email for a magic link or enter the 6-digit code below.'}
        </p>
      </div>

      <div className="section-card" style={{ maxWidth: '400px', margin: 'var(--space-lg) auto' }}>
        {view === 'login' && (
          <form onSubmit={handleAdminLogin}>
            <div className="form-field">
              <label className="form-label">Username</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-field">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="form-field">
              <label className="form-label">Check Into Incident</label>
              <select className="form-select" value={selectedIncidentId} onChange={(e) => setSelectedIncidentId(e.target.value)} data-lpignore="true">
                <option value="">— Don't check in —</option>
                <option value="NEW_INCIDENT">+ Start New Incident</option>
                {incidents.map((inc) => (
                  <option key={inc.incident_id} value={inc.incident_id}>{inc.name} ({inc.number})</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Checking in with Vehicle(s)?</label>
              <input type="text" className="form-input" value={vehicles} onChange={(e) => setVehicles(e.target.value)} data-lpignore="true" placeholder="e.g. 3121, UTV, Boat" />
              <small className="form-hint" style={{ color: '#64748b', fontSize: 'var(--text-xs)', display: 'block', marginTop: 'var(--space-xs)' }}>Optional: List vehicle designations separated by commas.</small>
            </div>
            <button type="submit" className="action-btn action-btn-primary action-btn-full" disabled={loading} style={{ marginTop: 'var(--space-lg)' }}>Login</button>
            <button type="button" onClick={() => setView('register')} className="action-btn action-btn-secondary action-btn-full" style={{ marginTop: 'var(--space-md)' }}>Register</button>
            <button type="button" onClick={() => navigate('/checkin')} className="action-btn action-btn-secondary action-btn-full" style={{ marginTop: 'var(--space-md)' }}>Check-in without Account</button>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-field">
              <label className="form-label">
                Email Address
              </label>
              <input 
                type="email" 
                className="form-input"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="you@example.com"
                required 
              />
            </div>
            <button type="submit" className="action-btn action-btn-primary action-btn-full" disabled={loading} style={{ marginTop: 'var(--space-lg)' }}>
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
            <button type="button" onClick={() => setView('login')} className="action-btn action-btn-secondary action-btn-full" style={{ marginTop: 'var(--space-md)' }}>
              Back to Login
            </button>
          </form>
        )}

        {view === 'verify' && (
          <form onSubmit={handleVerifyOtp}>
            <div className="form-field">
              <label className="form-label">
                6-Digit Code
              </label>
              <input 
                type="text" 
                className="form-input"
                value={otpToken} 
                onChange={(e) => setOtpToken(e.target.value)} 
                placeholder="123456"
                maxLength={6}
                required 
              />
            </div>
            <button type="submit" className="action-btn action-btn-primary action-btn-full" disabled={loading} style={{ marginTop: 'var(--space-lg)' }}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button type="button" onClick={() => setView('register')} className="action-btn action-btn-secondary action-btn-full" style={{ marginTop: 'var(--space-md)' }}>
              Back
            </button>
          </form>
        )}

        {error && <p className="alert alert-error">{error}</p>}
      </div>
    </div>
  );
};

export default Login;