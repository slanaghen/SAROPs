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
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then((response) => {
      const session = response?.data?.session;
      setUser(session?.user ?? null);
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

  // Request notification permission on first load if checked in
  useEffect(() => {
    if (isActive && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isActive]);

  // Centralized Real-time Session Sync
  // Uses the shared operational hook to ensure the banner and global context
  // are perfectly synchronized with the database state at all times.
  const { team, assignment, responderRecord, loading: hookLoading } = useResponderTeamAndAssignment(supabase, responderId);

  const handleSignOut = async () => {
    if (responderId && responderStatus !== 'CheckedOut') {
      // Synchronize logout with operational check-out
      try {
        await supabase.from('teams').update({ leader_responder_id: null }).eq('leader_responder_id', responderId);
        await supabase.from('responders')
          .update({ status: 'CheckedOut', checkout_datetime: new Date().toISOString() })
          .eq('responder_id', responderId);
      } catch (err) {
        console.error('Failed to perform operational check-out during sign-out:', err);
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
      const activeAsn = Array.isArray(team.assignments) ? team.assignments[0] : team.assignments;
      setCurrentAssignmentStatus(activeAsn?.status || null);
    } else {
      setCurrentTeamStatus(null);
      setCurrentAssignmentStatus(null);
    }
  }, [
    isActive, responderId, responderRecord, team, assignment, hookLoading,
    setResponderStatus, setAccessLevel, setCurrentTeamStatus, setCurrentAssignmentStatus
  ]);

  // Centralized Notifications
  useRealTimeNotifications(isActive, responderStatus, currentTeamStatus, currentAssignmentStatus);

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
      // Enforce: Responders cannot access Operations, Planning, SARTopo, PDFs, Action Log, or Google ICS
      console.warn(`[App Guard] Responder attempted to access staff-only page: ${location.pathname}`);
      navigate('/responder');
    } else if (isAdmin && accessLevel === 'staff' && location.pathname === '/admin') {
      // Enforce: Staff cannot access Admin
      console.warn(`[App Guard] Staff attempted to access admin page.`);
      navigate('/operations');
    }
  }, [isActive, isAdmin, accessLevel, location.pathname, navigate]);

  return (
    <div className="app-shell">
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
                <span style={{ fontSize: '0.9em', opacity: 0.8, marginLeft: '4px' }}>
                  ({(accessLevel === 'staff' || isAdmin) ? 'Staff' : 'Responder'})
                </span>
              </>
            ) : (user?.email || 'Guest')}
          </div>
          {(responderStatus || currentTeamStatus || user) && (
            <span className={`status-indicator ${(
              (currentTeamStatus && currentTeamStatus !== 'Disbanded') ? currentTeamStatus : (responderStatus || 'online')
            ).toLowerCase()}`}>
              {(currentTeamStatus && currentTeamStatus !== 'Disbanded') ? currentTeamStatus : (responderStatus || 'Authenticated')}
            </span>
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
                  <Link to="/checkin" onClick={() => setMenuOpen(false)}>Check-in</Link>
                  {user && <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>}
                  {isActive && <Link to="/ics" onClick={() => setMenuOpen(false)}>ICS Chart</Link>}
                  {isActive && <Link to="/qrcodes" onClick={() => setMenuOpen(false)}>QR Codes</Link>}
                  {(accessLevel === 'staff' || accessLevel === 'admin') && (
                    <>
                      <div className="dropdown-divider"></div>
                      <Link to="/operations" onClick={() => setMenuOpen(false)}>Operations</Link>
                      <Link to="/planning" onClick={() => setMenuOpen(false)}>Planning</Link>
                      <Link to="/incident" onClick={() => setMenuOpen(false)}>Incident</Link>
                      <Link to="/action-log" onClick={() => setMenuOpen(false)}>Action Log</Link>
                      <Link to="/sartopo" onClick={() => setMenuOpen(false)}>SARTopo Data</Link>
                      <Link to="/pdfs" onClick={() => setMenuOpen(false)}>PDFs</Link>
                      <Link to="/google-ics" onClick={() => setMenuOpen(false)}>Google ICS Forms</Link>
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
