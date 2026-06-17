import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase, SAROPS_DB_INSTANCE } from './lib/supabase';
import { useIncident } from './context/IncidentContext';
import useResponderTeamAndAssignment from './hooks/useResponderTeamAndAssignment';
import { useRealTimeNotifications } from './hooks/useRealTimeNotifications';
import { useToast } from './context/ToastContext';
import logo from './assets/logo.png';
import './styles.css';

function App() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [user, setUser] = useState(null);
  const [displayDensity, setDisplayDensity] = useState('comfortable');
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [incidentMetadata, setIncidentMetadata] = useState(null);
  const { addToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Reactive Profile & Display Density Synchronization
  useEffect(() => {
    let channel = null;
    
    const syncProfile = async (email) => {
      const normalizedEmail = email.toLowerCase().trim();
      if (!normalizedEmail) return;
      
      // Fetch initial user settings
      const { data } = await supabase.from('users')
        .select('display_density, access_level, name, agency, identifier, cell_phone, responder_type, special_skills, vehicles')
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
      setDisplayDensity('comfortable'); // Reset to default on logout
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user?.email]);

  useEffect(() => {
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

  // Reactive Incident Metadata Synchronization
  // Ensures sarstream status and URLs are live across all connected clients.
  useEffect(() => {
    if (!isActive || !incidentId) {
      setIncidentMetadata(null);
      return;
    }

    const syncMetadata = async () => {
      const { data } = await supabase
        .from('incidents')
        .select('sarstream, sarstream_data, sartopo_id')
        .eq('incident_id', incidentId)
        .maybeSingle();
      if (data) setIncidentMetadata(data);
    };

    syncMetadata();

    const channel = supabase
      .channel(`incident-metadata-sync-${incidentId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'incidents', 
        filter: `incident_id=eq.${incidentId}` 
      }, payload => {
        // Update local metadata state with new DB values
        setIncidentMetadata(payload.new);
      })
      .subscribe();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [isActive, incidentId]);

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
      // Fetch messages since last read that are either for the user's team 
      // OR for the Staff team (acting as a broadcast) in the current operational period.
      let queryOrConditions = [];
      if (team?.team_id) {
        queryOrConditions.push(`team_id.eq.${team.team_id}`);
      }
      queryOrConditions.push(`and(teams.type.eq.Staff,teams.op_period_id.eq.${incidentData.opPeriodId})`);

      const { data: recentMsgs } = await supabase
        .from('team_messages')
        .select('*, teams!inner(type, op_period_id)')
        .gt('created_at', lastRead)
        .or(queryOrConditions.join(','));

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
    } else if (!hookLoading && isActive && responderId) {
      // If we are active but the record is missing (e.g. database was reinitialized), clear context
      console.warn('[App] Active responder record not found in database. Clearing session.');
      localStorage.removeItem('sarops_user_email');
      if (logout) logout();
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
    const responderAllowedPaths = ['/', '/checkin', '/login', '/responder', '/settings', '/qrcodes', '/ics', '/checkout'];

    // Combined check for system-level staff or operational-level staff
    const hasStaffPrivileges = isAdmin || isStaffOrAdmin;

    // Navigation Guard: Allow system staff access even without active incident context
    if (!isActive && !hasStaffPrivileges && !user && !hookLoading && !publicPaths.includes(location.pathname)) {
      console.warn(`[App Guard] Unauthorized access attempt to ${location.pathname}. Redirecting to /checkin.`);
      navigate('/checkin');
    } else if (!hasStaffPrivileges && !responderAllowedPaths.includes(location.pathname)) {
      // Enforce: Standard field responders are restricted to the responder dashboard
      console.warn(`[App Guard] Access denied for non-staff responder: ${location.pathname}`);
      navigate('/responder');
    } else if (isAdmin && accessLevel === 'staff' && location.pathname === '/admin') {
      // Enforce: Staff cannot access Admin
      console.warn(`[App Guard] Staff attempted to access admin page.`);
      navigate('/operations');
    }
  }, [isActive, isAdmin, accessLevel, location.pathname, navigate]);

  // Simplified status determination logic: prioritizing active field status over staging
  const effectiveStatus = (responderStatus && responderStatus !== 'Staged') 
    ? responderStatus 
    : (currentTeamStatus || responderStatus || 'Staged');

  return (
    <div className={`app-shell density-${displayDensity} ${displayDensity === 'compact' ? 'compact-mode' : ''}`}>
      <div className="incident-banner">
        <div className="banner-left">
          <div className="banner-logo-container">
            <img src={logo} alt="SAROps Logo" className="banner-logo" />
            <span className="banner-brand">SAROps</span>
              {SAROPS_DB_INSTANCE === 'LOCAL' && (
                <span style={{ 
                  fontSize: '9px', fontWeight: 800, padding: '2px 5px', borderRadius: '4px', marginLeft: '6px',
                  background: '#f1f5f9', // Consistent light background for LOCAL
                  color: '#475569',      // Consistent dark text for LOCAL
                  border: `1px solid #cbd5e1` // Consistent border for LOCAL
                }}>{SAROPS_DB_INSTANCE}</span>
              )}
            </div>
          </div>
          {isActive && (
            <>
              <div className="banner-item">{incidentData?.name || '—'}</div>
              <div className="banner-item">{incidentData?.opNumber || '—'}</div>
            </>
          )}
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
            <span className={`status-indicator ${effectiveStatus.toLowerCase()}`}>
              {effectiveStatus}
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
          {hasUnreadMessages && (
            <div 
              className="unread-indicator" 
              title="New unread message received"
              onClick={() => navigate('/responder')}
              style={{
                width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%',
                marginLeft: '8px', cursor: 'pointer', border: '2px solid white', boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
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
                  {isActive && <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>}
                  {isActive && <Link to="/ics" onClick={() => setMenuOpen(false)}>ICS Chart</Link>}
                  {isActive && <Link to="/qrcodes" onClick={() => setMenuOpen(false)}>QR Codes</Link>}
                  {isActive && <Link to="/checkout" onClick={() => setMenuOpen(false)}>Check Out</Link>}
                  
                  {/* Use incidentMetadata for real-time sarstream reactivity */}
                  {isActive && (incidentMetadata?.sarstream || incidentData?.sarstream) && 
                    (incidentMetadata?.sarstream_data?.url || incidentMetadata?.sarstream_data?.view_url || 
                     incidentData?.sarstream_data?.url || incidentData?.sarstream_data?.view_url) && (
                    <a 
                      href={incidentMetadata?.sarstream_data?.url || incidentMetadata?.sarstream_data?.view_url || 
                            incidentData?.sarstream_data?.url || incidentData?.sarstream_data?.view_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      onClick={() => setMenuOpen(false)}
                    >Live Feed</a>
                  )}
                  {(isAdmin || accessLevel === 'staff' || accessLevel === 'admin') && (
                    <>
                      <div className="dropdown-divider"></div>
                      <Link to="/operations" onClick={() => setMenuOpen(false)}>Operations</Link>
                      <Link to="/planning" onClick={() => setMenuOpen(false)}>Planning</Link>
                      <Link to="/incident" onClick={() => setMenuOpen(false)}>Incident</Link>
                      <Link to="/action-log" onClick={() => setMenuOpen(false)}>Action Log</Link>
                      <Link to="/sartopo" onClick={() => setMenuOpen(false)}>SARTopo</Link>
                      <Link to="/google-ics" onClick={() => setMenuOpen(false)}>Google Forms</Link>
                    </>
                  )}
                  {accessLevel === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)}>Administration</Link>}
                  <div className="dropdown-divider"></div>
                  <a href="#" onClick={(e) => { e.preventDefault(); handleToggleDb(); }}>
                    {SAROPS_DB_INSTANCE}: Switch to { SAROPS_DB_INSTANCE === 'LOCAL' ? 'Remote' : 'Local' } DB
                  </a>
                  <a href="#" onClick={(e) => { e.preventDefault(); handleSignOut(); }}>Sign Out</a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Outlet />
    </div>
  );
}

export default App;