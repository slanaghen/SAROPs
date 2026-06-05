import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useIncident } from './context/IncidentContext';
import useResponderTeamAndAssignment from './hooks/useResponderTeamAndAssignment';
import { useRealTimeNotifications } from './hooks/useRealTimeNotifications';
import logo from './assets/logo.png';
import './styles.css';

function App() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [user, setUser] = useState(null);
  const [displayDensity, setDisplayDensity] = useState('comfortable');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async (response) => {
      const session = response?.data?.session;
      setUser(session?.user ?? null);
      
      if (session?.user?.email) {
        const { data } = await supabase.from('users')
          .select('display_density')
          .eq('email', session.user.email)
          .maybeSingle();
        
        if (data) {
          setDisplayDensity(data.display_density || 'comfortable');
        }

        // Subscribe to profile changes for real-time reactive UI updates
        const channel = supabase
          .channel(`user-profile-sync-${session.user.email}`)
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'users', 
            filter: `email=eq.${session.user.email}` 
          }, payload => {
            if (payload.new.display_density !== undefined) setDisplayDensity(payload.new.display_density);
          })
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    });

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { 
    isActive, 
    isAdmin, 
    incidentId,
    incidentData, 
    responderName, 
    responderId,
    responderStatus, 
    setResponderStatus,
    accessLevel, 
    setAccessLevel,
    currentTeamStatus,
    setCurrentTeamStatus,
    currentAssignmentStatus,
    setCurrentAssignmentStatus,
    logout
  } = useIncident();

  // Centralized Real-time Session Sync
  // Uses the shared operational hook to ensure the banner and global context
  // are perfectly synchronized with the database state at all times.
  const { team, assignment, responderRecord, loading: hookLoading, refetch } = useResponderTeamAndAssignment(supabase, responderId);

  // Re-synchronize session when window gains focus (e.g. returning to tab)
  useEffect(() => {
    const handleFocus = () => {
      if (isActive && responderId && refetch) {
        refetch();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isActive, responderId, refetch]);

  const handleSignOut = async () => {
    // Perform operational checkout if responder is still active
    if (responderId && responderStatus !== 'CheckedOut') {
      try {
        const { error: teamErr } = await supabase
          .from('teams')
          .update({ leader_responder_id: null })
          .eq('leader_responder_id', responderId);
        if (teamErr) console.error('Sign-out: Failed to clear leader status', teamErr);

        const { error: respErr } = await supabase
          .from('responders')
          .update({ status: 'CheckedOut', checkout_datetime: new Date().toISOString() })
          .eq('responder_id', responderId);
        if (respErr) console.error('Sign-out: Failed to update responder status', respErr);

        // Log responder check-out for the audit trail
        if (!respErr && incidentId) {
          await supabase.from('action_logs').insert({
            incident_id: incidentId,
            action: `Responder checked out: ${responderName}`,
            user_name: responderName
          });
        }

        // Remove responder from any teams they were attached to
        const { error: trErr } = await supabase
          .from('team_responders')
          .delete()
          .eq('responder_id', responderId);
        if (trErr) console.error('Sign-out: Failed to remove responder from teams', trErr);
      } catch (err) {
        console.error('Sign-out: Unexpected error during operational checkout', err);
      }
    }

    await supabase.auth.signOut();
    localStorage.removeItem('sarops_user_email');
    logout();
    setMenuOpen(false);
    navigate('/checkin');
  };

  useEffect(() => {
    if (!isActive || !responderId || hookLoading) return;

    if (responderRecord) {
      setResponderStatus(responderRecord.status);
      if (setAccessLevel) setAccessLevel(responderRecord.access_level);

      // Requirement: If check-out occurs (even remotely), synchronize the session state
      if (responderRecord.status === 'CheckedOut') {
        handleSignOut();
      }
    }

    if (team && team.status !== 'Disbanded') {
      setCurrentTeamStatus(team.status);
      setCurrentAssignmentStatus(assignment?.status || null);
    } else {
      setCurrentTeamStatus(null);
      setCurrentAssignmentStatus(null);
    }
  }, [
    isActive, responderId, responderRecord, team, assignment, hookLoading,
    setResponderStatus, setAccessLevel, setCurrentTeamStatus, setCurrentAssignmentStatus
  ]);

  // Centralized Notifications
  const { permission: notificationPermission } = useRealTimeNotifications(isActive, responderStatus, currentTeamStatus, currentAssignmentStatus);

  // Navigation Guard: Redirect to check-in if trying to access operational pages without a session
  useEffect(() => {
    const publicPaths = ['/', '/checkin', '/admin', '/incident', '/qrcodes', '/login'];
    
    const isStaffOrAdmin = accessLevel === 'staff' || accessLevel === 'admin';
    const responderOnlyPaths = ['/', '/checkin', '/login', '/responder', '/settings', '/qrcodes', '/ics', '/checkout'];

    if (!isActive && !isAdmin && !publicPaths.includes(location.pathname)) {
      console.warn(`[App Guard] Unauthorized access attempt to ${location.pathname}. Redirecting to /checkin.`, {
        isActive,
        isAdmin
      });
      navigate('/checkin');
    } else if (isAdmin && accessLevel === 'responder' && !responderOnlyPaths.includes(location.pathname)) {
      // Enforce: Responders cannot access Operations, Planning, SARTopo, Action Log, or Google ICS
      console.warn(`[App Guard] Responder attempted to access staff-only page: ${location.pathname}`);
      navigate('/responder');
    } else if (isAdmin && accessLevel === 'staff' && location.pathname === '/admin') {
      // Enforce: Staff cannot access Admin
      console.warn(`[App Guard] Staff attempted to access admin page.`);
      navigate('/operations');
    }
  }, [isActive, isAdmin, accessLevel, location.pathname, navigate]);

  return (
    <div className={`app-shell ${displayDensity === 'compact' ? 'compact-mode' : ''}`}>
      <div className="incident-banner">
        <div className="banner-left">
          <div className="banner-logo-container">
            <img src={logo} alt="SAROps Logo" className="banner-logo" />
            <span className="banner-brand">SAROps</span>
          </div>
          {isActive && (
            <>
              <div className="banner-item">{incidentData?.name || '—'}</div>
              <div className="banner-item">{incidentData?.opNumber || '—'}</div>
            </>
          )}
        </div>

        <div className="banner-right">
          <div className="banner-item">
            {responderName ? (
              <>
                {responderName}
                {isActive && (
                  <span style={{ fontSize: '0.9em', opacity: 0.8, marginLeft: '4px' }}>
                    ({accessLevel === 'admin' ? 'Admin' : (accessLevel === 'staff' ? 'Staff' : 'Responder')})
                  </span>
                )}
              </>
            ) : (user?.email || 'Guest')}
          </div>
          {isActive && (responderStatus || currentTeamStatus) && (
            <span className={`status-indicator ${(
              (currentTeamStatus && currentTeamStatus !== 'Disbanded') ? currentTeamStatus : (responderStatus || 'Staged')
            ).toLowerCase()}`}>
              {(currentTeamStatus && currentTeamStatus !== 'Disbanded') ? currentTeamStatus : (responderStatus || 'Staged')}
            </span>
          )}
          {isActive && notificationPermission === 'denied' && (
            <div 
              className="connection-dot offline" 
              title="System notifications are blocked. Visual alerts disabled; audio only. Check browser settings." 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '9px', color: 'white', cursor: 'help', width: '12px', height: '12px', fontWeight: 900 
              }}
            >!</div>
          )}
          <div className={`connection-dot ${offline ? 'offline' : 'online'}`} title={offline ? 'Offline' : 'Online'}></div>
          {(user || isActive) && (
            <div className="banner-menu-container">
              <button onClick={() => setMenuOpen(!menuOpen)} className="hamburger-btn" title="Menu">
                <div className="hamburger-line"></div>
                <div className="hamburger-line"></div>
                <div className="hamburger-line"></div>
              </button>
              {menuOpen && (
                <div className="banner-dropdown">
                  {isActive && <Link to="/responder" onClick={() => setMenuOpen(false)}>My Dashboard</Link>}
                  {user && <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>}
                  {isActive && <Link to="/ics" onClick={() => setMenuOpen(false)}>ICS Chart</Link>}
                  {isActive && <Link to="/qrcodes" onClick={() => setMenuOpen(false)}>QR Codes</Link>}
                  {(accessLevel === 'staff' || accessLevel === 'admin') && (
                    <>
                      <div className="dropdown-divider"></div>
                      {isActive && <Link to="/operations" onClick={() => setMenuOpen(false)}>Operations</Link>}
                      {isActive && <Link to="/planning" onClick={() => setMenuOpen(false)}>Planning</Link>}
                      <Link to="/incident" onClick={() => setMenuOpen(false)}>Incident</Link>
                      {isActive && <Link to="/action-log" onClick={() => setMenuOpen(false)}>Action Log</Link>}
                      {isActive && <Link to="/sartopo" onClick={() => setMenuOpen(false)}>SARTopo</Link>}
                      {isActive && <Link to="/google-ics" onClick={() => setMenuOpen(false)}>Google Forms</Link>}
                    </>
                  )}
                  {accessLevel === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)}>Administration</Link>}
                  <div className="dropdown-divider"></div>
                  <Link to="/checkout" onClick={() => setMenuOpen(false)} className="dropdown-item">Check Out</Link>
                  <button onClick={handleSignOut} className="dropdown-item checkout">Sign Out / Clear All</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default App;
