import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useIncident } from './context/IncidentContext';
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
    responderStatus, 
    accessLevel, 
    currentTeamStatus,
    currentAssignmentStatus,
    logout 
  } = useIncident();

  // Request notification permission on first load if checked in
  useEffect(() => {
    if (isActive && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isActive]);

  // Audio and browser notification for status changes (responder, team, assignment)
  const prevStatusRef = useRef(responderStatus);
  const prevTeamStatusRef = useRef(currentTeamStatus);
  const prevAssignmentStatusRef = useRef(currentAssignmentStatus);

  useEffect(() => {
    const triggerNotification = (title, body) => {
      // 1. Play Sound
      if (typeof Audio !== 'undefined') {
        try {
          // Using a clear notification sound
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => console.debug('Audio blocked: interaction required'));
        } catch (e) {
          console.debug('Audio playback failed');
        }
      }
      // 2. Browser Notification (if permitted)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body: body,
          icon: logo,
          tag: 'status-change'
        });
      }
    };

    if (isActive) {
      if (prevStatusRef.current && responderStatus && prevStatusRef.current !== responderStatus) {
        triggerNotification("SAROps: Your Status Changed", `Your operational status has changed to: ${responderStatus}`);
      }
      if (prevTeamStatusRef.current && currentTeamStatus && prevTeamStatusRef.current !== currentTeamStatus) {
        triggerNotification("SAROps: Team Status Changed", `Your team's status has changed to: ${currentTeamStatus}`);
      }
      if (prevAssignmentStatusRef.current && currentAssignmentStatus && prevAssignmentStatusRef.current !== currentAssignmentStatus) {
        triggerNotification("SAROps: Assignment Status Changed", `Your team's assignment status has changed to: ${currentAssignmentStatus}`);
      }
    }
    prevStatusRef.current = responderStatus;
    prevTeamStatusRef.current = currentTeamStatus;
    prevAssignmentStatusRef.current = currentAssignmentStatus;
  }, [responderStatus, isActive]);

  // Navigation Guard: Redirect to check-in if trying to access operational pages without a session
  useEffect(() => {
    const publicPaths = ['/', '/checkin', '/admin'];
    if (!isActive && !isAdmin && !publicPaths.includes(location.pathname)) {
      navigate('/checkin');
    }
  }, [isActive, isAdmin, location.pathname, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    logout();
    setMenuOpen(false);
    navigate('/checkin');
  };

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
                  ({accessLevel === 'command staff' ? 'Staff' : 'Responder'})
                </span>
              </>
            ) : (user?.email || 'Guest')}
          </div>
          {(responderStatus || user) && (
            <span className={`status-indicator ${(responderStatus || 'online').toLowerCase()}`}>
              {responderStatus || 'Authenticated'}
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
                  <Link to="/responder-dashboard" onClick={() => setMenuOpen(false)}>My Dashboard</Link>
                  <Link to="/operations" onClick={() => setMenuOpen(false)}>Operations</Link>
                  <Link to="/planning" onClick={() => setMenuOpen(false)}>Planning</Link>
                  <Link to="/checkin" onClick={() => setMenuOpen(false)}>Check-in</Link>
                  <Link to="/incident-edit" onClick={() => setMenuOpen(false)}>Incident</Link>
                  <Link to="/admin" onClick={() => setMenuOpen(false)}>Administration</Link>
                  <Link to="/action-log" onClick={() => setMenuOpen(false)}>Action Log</Link>
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
