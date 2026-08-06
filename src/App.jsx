import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase, SAROPS_DB_INSTANCE } from './lib/supabase';
import { useIncident } from './context/IncidentContext';
import useResponderTeamAndAssignment from './hooks/useResponderTeamAndAssignment';
import { useRealTimeNotifications } from './hooks/useRealTimeNotifications';
import { useToast } from './context/ToastContext';
import BaseModal from './components/BaseModal';
import logo from './assets/logo.png';
import redSpeakerIcon from './assets/red-speaker.jpg';
import emailIcon from './assets/email-red-icon.png';
import './styles.css';

function App() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [user, setUser] = useState(null);
  const [displayDensity, setDisplayDensity] = useState('compact');
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [operationalPeriod, setOperationalPeriod] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const { addToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
    logout,
    startIncident,
    setResponderId,
    setResponderName,
  } = useIncident();

  // Reactive Profile & Display Density Synchronization
  useEffect(() => {
    let channel = null;
    
    const syncProfile = async (email) => {
      const normalizedEmail = email.toLowerCase().trim();
      if (!normalizedEmail) return;
      
      // Fetch initial user settings
      const { data } = await supabase.from('users')
        .select('display_density')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (data?.display_density) {
        setDisplayDensity(data.display_density);
      }

      // Listen for density updates (e.g. from the Settings page)
      if (channel) supabase.removeChannel(channel);
      channel = supabase
        .channel(`user-profile-sync-${normalizedEmail}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users', 
          filter: `email=eq.${normalizedEmail}` 
        }, payload => {
          if (payload.new.display_density) setDisplayDensity(payload.new.display_density);
        })
        .subscribe();
    };

    if (user?.email) {
      syncProfile(user.email);
    } else {
      setDisplayDensity('compact'); // Reset to default on logout
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user?.email]);

  useEffect(() => {
    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Mark that the initial authentication check has completed.
      setAuthResolved(true);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to restore session state from sessionStorage on initial load
  useEffect(() => {
    try {
      const savedSession = sessionStorage.getItem('sarops_active_session');
      if (savedSession) {
        const { incident, responder } = JSON.parse(savedSession);
        if (incident && incident.incidentId && !isActive) { // Prevent re-hydration if already active
          console.log('[App] Restoring active session from sessionStorage:', incident);
          startIncident(
            incident.incidentId,
            incident.incidentName,
            incident.opNumber,
            incident.opPeriodId,
            incident.sartopoId,
            incident.parInterval
          );
          if (responder && responder.responderId) {
            setResponderId(responder.responderId);
            setResponderName(responder.responderName);
            setAccessLevel(responder.accessLevel || 'responder'); // Restore access level
            setResponderStatus(responder.responderStatus);
          }
        }
      }
    } catch (e) {
      console.error('[App] Failed to parse or restore session from sessionStorage:', e);
      sessionStorage.removeItem('sarops_active_session');
    } finally {
      setIsIncidentContextHydrated(true); // Mark hydration as complete
    }
  }, []); // Run only once on mount

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

  // Centralized Real-time Session Sync
  // Uses the shared operational hook to ensure the banner and global context
  // are perfectly synchronized with the database state at all times.
  const { team, assignment, responderRecord, loading: hookLoading, refetch } = useResponderTeamAndAssignment(supabase, responderId);

  const prevResponderId = useRef(responderId);
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

  // Effect to persist session state to sessionStorage whenever it changes
  useEffect(() => {
    if (isActive && incidentId) {
      const sessionToSave = {
        incident: {
          incidentId: incidentId,
          incidentName: incidentData?.name,
          opNumber: incidentData?.opNumber,
          opPeriodId: incidentData?.opPeriodId,
          sartopoId: incidentData?.sartopoId,
          parInterval: incidentData?.parInterval,
        },
        responder: {
          responderId: responderId,
          responderName: responderName,
          accessLevel: accessLevel,
          responderStatus: responderStatus,
        }
      };
      sessionStorage.setItem('sarops_active_session', JSON.stringify(sessionToSave));
    }
  }, [isActive, incidentId, incidentData, responderId, responderName, accessLevel, responderStatus]);

  // Monitor for unread messages globally to alert the user via the banner
  useEffect(() => {
    if (location.pathname === '/responder') {
      setHasUnreadMessages(false);
      localStorage.setItem('sarops_last_read_messages', new Date().toISOString());
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isActive || !incidentId || !incidentData?.opPeriodId) return;

    const lastRead = localStorage.getItem('sarops_last_read_messages') || new Date(Date.now() - 86400000).toISOString();

    const isMessageRelevant = (msg) => {
      // Don't alert for messages sent by the current user
      if (msg.sender_name?.startsWith(responderName)) return false;

      // Relevant if it's for the user's specific team
      if (team?.team_id === msg.team_id) return true;

      return false;
    };

    // 1. Initial check for existing "pending" messages sent since last visit
    const fetchPending = async () => {
      // Find the Staff team ID for the current operational period to listen for broadcasts.
      const { data: staffTeam } = await supabase
        .from('teams')
        .select('team_id')
        .eq('op_period_id', incidentData.opPeriodId)
        .eq('type', 'Staff')
        .maybeSingle();

      const orFilterConditions = [];
      if (team?.team_id) {
        orFilterConditions.push(`team_id.eq.${team.team_id}`);
      }
      if (staffTeam?.team_id) {
        orFilterConditions.push(`team_id.eq.${staffTeam.team_id}`);
      }
      if (orFilterConditions.length === 0) return; // No teams to listen to.

      const { data: recentMsgs } = await supabase
        .from('team_messages')
        .select('*')
        .gt('created_at', lastRead)
        .or(orFilterConditions.join(','));

      if (recentMsgs?.some(m => !m.sender_name?.startsWith(responderName))) {
        setHasUnreadMessages(true);
      }
    };

    fetchPending();

    // 2. Real-time listener for incoming messages
    const channel = supabase
      .channel('global-message-monitor')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'team_messages' 
      }, async (payload) => {
        if (location.pathname === '/responder') return;
        
        const msg = payload.new;
        if (isMessageRelevant(msg)) {
          setHasUnreadMessages(true);
          addToast(`New message for ${team?.team_name_number || 'your team'}`, 'info');
        } else {
          // Check if it was a Staff broadcast
          const { data: teamInfo } = await supabase.from('teams').select('type, op_period_id').eq('team_id', msg.team_id).maybeSingle();
          if (teamInfo?.type === 'Staff' && teamInfo?.op_period_id === incidentData.opPeriodId && !msg.sender_name?.startsWith(responderName)) {
            setHasUnreadMessages(true);
            addToast(`Broadcast: ${msg.message_text.substring(0, 30)}...`, 'info');
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isActive, incidentId, incidentData?.opPeriodId, team?.team_id, team?.team_name_number, location.pathname, responderName, addToast]);

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

  const handleToggleDb = async () => {
    const currentDb = SAROPS_DB_INSTANCE;
    const nextDb = currentDb === 'LOCAL' ? 'REMOTE' : 'LOCAL';
    
    // Clear operational context and sign out of Supabase Auth before reload.
    // This prevents JWT collisions where a token from one instance (e.g. Remote)
    // is incorrectly sent to another (e.g. Local), resulting in 401 Unauthorized errors.
    if (logout) logout();
    await supabase.auth.signOut();
    localStorage.setItem('SAROPS_DB_INSTANCE', nextDb);
    window.location.reload();
  };

  const handleClearData = async () => {
    const confirmMsg = "Are you sure you want to clear all operational data? This will remove all incidents, teams, assignments, and responder records. System users will be preserved.";
    if (!window.confirm(confirmMsg)) return;

    try {
      const { error } = await supabase.rpc('clear_data');
      if (error) throw error;
      
      if (logout) logout();
      setMenuOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear operational data:', err);
    }
  };

  useEffect(() => {
    if (!isActive || !responderId || hookLoading) return;

    if (responderRecord) {
      setResponderStatus(responderRecord.status);
      if (setAccessLevel) setAccessLevel(responderRecord.access_level);

      // Requirement: If check-out occurs (even remotely), synchronize the session state
      if (responderRecord.status === 'CheckedOut') {
        if (accessLevel === 'responder') {
          handleSignOut();
        } else {
          // Staff/Admin keep their system session but lose operational context
          if (isActive && logout) logout();
        }
      }
    } else if (!hookLoading && isActive && responderId && responderId === prevResponderId.current) {
      // If we are active but the record is missing (e.g. database was reinitialized), clear context.
      // The check against prevResponderId prevents this from firing during the check-in race condition.
      console.warn('[App] Active responder record not found in database. Clearing session.', { responderId, prevResponderId: prevResponderId.current });
      if (logout) {
        localStorage.removeItem('sarops_user_email');
        logout();
      }
    }

    if (team && team.status !== 'Disbanded') {
      setCurrentTeamStatus(team.status);
      setCurrentAssignmentStatus(assignment?.status || null);
    } else {
      setCurrentTeamStatus(null);
      setCurrentAssignmentStatus(null);
    }

    // Update the ref after the effect has run
    prevResponderId.current = responderId;
  }, [
    isActive, responderId, responderRecord, team, assignment, hookLoading,
    setResponderStatus, setAccessLevel, setCurrentTeamStatus, setCurrentAssignmentStatus, logout
  ]);

  // Centralized Notifications
  const { permission: notificationPermission, requestPermission } = useRealTimeNotifications(isActive, responderStatus, currentTeamStatus, currentAssignmentStatus);

  // Navigation Guard: Centralized access control for all application routes.
  useEffect(() => {
    // Do not run navigation guards until the initial auth state has been resolved
    // AND the incident context has finished its initial loading/hydration.
    if (!authResolved || !isIncidentContextHydrated) return;

    // Define paths accessible without any active session or special privileges.
    const publicPaths = ['/', '/checkin', '/login'];
    
    // Define paths accessible to a standard field responder.
    const responderAllowedPaths = ['/', '/checkin', '/login', '/responder', '/settings', '/qrcodes', '/ics', '/checkout'];

    const isStaffOrAdmin = accessLevel === 'staff' || accessLevel === 'admin';
    // A user has staff privileges if they are an admin system user OR have been elevated to staff for an incident.
    const hasStaffPrivileges = isAdmin || isStaffOrAdmin;
    console.log(`[App Guard] Evaluating: isActive=${isActive}, isAdmin=${isAdmin}, accessLevel=${accessLevel}, path=${location.pathname}, authResolved=${authResolved}, isIncidentContextHydrated=${isIncidentContextHydrated}`);

    // Guard 1: The main gate for unauthenticated/unactivated users.
    // If the user is not in an active incident AND is not a system admin,
    // they should only be able to access the public pages.
    if (!isActive && !isAdmin) {
      if (!publicPaths.includes(location.pathname)) {
        console.warn(`[App Guard] Guest access denied for ${location.pathname}. Redirecting to /checkin.`);
        console.trace('Redirect triggered by Guard 1');
        navigate('/checkin');
        return;
      }
    }
    
    // Guards below apply only to users who are active in an incident or are system staff/admins.

    // Guard 2: Role enforcement for active responders.
    // If a user is active but NOT staff, restrict them to responder-level pages.
    if (isActive && !hasStaffPrivileges) {
      if (!responderAllowedPaths.includes(location.pathname)) {
        console.warn(`[App Guard] Responder access denied for staff page: ${location.pathname}. Redirecting to /responder.`);
        console.trace('Redirect triggered by Guard 2');
        navigate('/responder');
        return;
      }
    }

    // Guard 3: Prevent non-admins from accessing the admin page.
    if (accessLevel !== 'admin' && location.pathname === '/admin') {
      // Enforce: Staff cannot access Admin
      console.warn(`[App Guard] Non-admin attempted to access admin page.`);
      console.trace('Redirect triggered by Guard 3');
      navigate('/operations');
    }
  }, [isActive, isAdmin, accessLevel, location.pathname, navigate, authResolved, isIncidentContextHydrated]);

  // SARStream: Fetch operational period data to check for active stream
  useEffect(() => {
    const fetchOpPeriod = async () => {
      if (incidentData?.opPeriodId) {
        const { data, error } = await supabase
          .from('operational_periods')
          .select('sarstream_enabled, sarstream_data')
          .eq('op_period_id', incidentData.opPeriodId)
          .maybeSingle();
        
        if (error) console.error("SARStream: Error fetching OP data", error);
        else setOperationalPeriod(data);
      } else {
        setOperationalPeriod(null);
      }
    };
    fetchOpPeriod();

    if (!incidentData?.opPeriodId) return;

    const channel = supabase.channel(`op-period-sarstream-sync-${incidentData.opPeriodId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'operational_periods', filter: `op_period_id=eq.${incidentData.opPeriodId}` }, 
        (payload) => setOperationalPeriod(payload.new)
      ).subscribe();
    
    return () => supabase.removeChannel(channel);
  }, [incidentData?.opPeriodId]);

  // Display a global loading spinner if authentication or incident context is still resolving
  if (!authResolved || !isIncidentContextHydrated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: '#f8fafc' }}>
        <div className="loading-spinner" style={{ fontSize: '48px' }}>⏳</div>
        <p style={{ color: '#64748b', fontSize: '18px' }}>Loading application...</p>
      </div>
    );
  }

  const showLiveFeed = operationalPeriod?.sarstream_enabled && (operationalPeriod?.sarstream_data?.url || operationalPeriod?.sarstream_data?.view_url);
  const liveFeedUrl = operationalPeriod?.sarstream_data?.url || operationalPeriod?.sarstream_data?.view_url;

  return (
    <div className={`app-shell density-${displayDensity} ${displayDensity === 'compact' ? 'compact-mode' : ''}`}>
      <div className="incident-banner">
        <div className="banner-left">
          <div className="banner-logo-container">
            <img src={logo} alt="SAROps Logo" className="banner-logo" />
            <span className="banner-brand">SAROps</span>
            <button 
              onClick={handleToggleDb}
              title={`Switch to ${SAROPS_DB_INSTANCE === 'LOCAL' ? 'Remote' : 'Local'} DB`}
              style={{ 
                fontSize: '9px', fontWeight: 800, padding: '2px 5px', borderRadius: '4px', marginLeft: '6px',
                background: SAROPS_DB_INSTANCE === 'REMOTE' ? '#fef3c7' : '#f1f5f9',
                color: SAROPS_DB_INSTANCE === 'REMOTE' ? '#92400e' : '#475569',
                border: `1px solid ${SAROPS_DB_INSTANCE === 'REMOTE' ? '#f59e0b' : '#cbd5e1'}`,
                cursor: 'pointer'
              }}
            >
              {SAROPS_DB_INSTANCE}
            </button>
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
                {accessLevel && (
                  <span style={{ fontSize: '0.9em', opacity: 0.8, marginLeft: '4px' }}>
                    ({accessLevel === 'admin' ? 'Admin' : (accessLevel === 'staff' ? 'Staff' : 'Responder')})
                  </span>
                )}
              </>
            ) : (user?.email || 'Guest')}
          </div>
          {(isActive || responderStatus === 'CheckedOut') && (responderStatus || currentTeamStatus) && (
            <span className={`status-indicator ${(
              (responderStatus && responderStatus !== 'Staged') ? responderStatus : (currentTeamStatus || responderStatus || 'Staged')
            ).toLowerCase()}`}>
              {(responderStatus && responderStatus !== 'Staged') ? responderStatus : (currentTeamStatus || responderStatus || 'Staged')}
            </span>
          )}
          {isActive && notificationPermission === 'denied' && (
            <img
              src={redSpeakerIcon}
              alt="Notifications Blocked"
              onClick={() => setShowNotificationModal(true)}
              title="System notifications are blocked. Click to manage settings."
              style={{ 
                width: '16px', height: '16px',
                marginLeft: '8px', cursor: 'pointer',
                filter: 'drop-shadow(0 0 2px rgba(239, 68, 68, 0.5))' // Add a subtle glow
              }}
            >
              {/* The image itself is the icon, no text needed */}
            </img>
          )}
          <div className={`connection-dot ${offline ? 'offline' : 'online'}`} title={offline ? 'Offline' : 'Online'}></div>
          {hasUnreadMessages && (
            <img
              src={emailIcon}
              alt="Unread Messages"
              className="unread-indicator" 
              title="New unread message received"
              onClick={() => navigate('/responder')}
              style={{
                width: '16px', height: '16px',
                marginLeft: '8px', cursor: 'pointer'
              }}
            />
          )}
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
                  {showLiveFeed && <a href={liveFeedUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>SARStream Feed</a>}
                  {isActive && <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>}
                  {(isAdmin || accessLevel === 'staff' || accessLevel === 'admin') && (
                    <>
                      <div className="dropdown-divider"></div>
                      {accessLevel === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)}>Administration</Link>}
                      <Link to="/operations" onClick={() => setMenuOpen(false)}>Operations</Link>
                      <Link to="/planning" onClick={() => setMenuOpen(false)}>Planning</Link>
                      <Link to="/incident" onClick={() => setMenuOpen(false)}>Incident</Link>
                      <Link to="/action-log" onClick={() => setMenuOpen(false)}>Action Log</Link>
                      <Link to="/sartopo" onClick={() => setMenuOpen(false)}>SARTopo (Draft)</Link>
                      <Link to="/google-ics" onClick={() => setMenuOpen(false)}>Google Forms (Draft)</Link>
                    </>
                  )}
                  {isActive && <Link to="/ics" onClick={() => setMenuOpen(false)}>ICS Chart</Link>}
                  {isActive && <Link to="/qrcodes" onClick={() => setMenuOpen(false)}>QR Codes</Link>}
                  {isActive && <Link to="/checkout" onClick={() => setMenuOpen(false)}>Check Out</Link>}
                  <div className="dropdown-divider"></div>
                  <a href="#" onClick={(e) => { e.preventDefault(); handleSignOut(); }}>Sign Out</a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Outlet />

      {showNotificationModal && (
        <BaseModal
          isOpen={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
          title="Notification Settings"
        >
          <p style={{ marginTop: 0, color: '#475569' }}>
            Enable browser notifications to receive real-time alerts for important events like new messages and PAR checks.
          </p>
          
          <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label className="form-label" htmlFor="notif-toggle" style={{ marginBottom: 0 }}>Browser Notifications</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="notif-toggle"
                checked={notificationPermission === 'granted'}
                onChange={async () => {
                  if (notificationPermission === 'default' && requestPermission) {
                    await requestPermission();
                    setShowNotificationModal(false); // Close modal after user interacts with browser prompt
                  }
                }}
                disabled={notificationPermission === 'denied'}
              />
              <label htmlFor="notif-toggle"></label>
            </div>
          </div>

          {notificationPermission === 'denied' && (
            <p className="form-hint" style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>
              Notifications are blocked by your browser. You must change this in your browser's site settings to enable them.
            </p>
          )}
        </BaseModal>
      )}
    </div>
  );
}

export default App;