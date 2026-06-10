import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Incident, Responder, Team, ResponderStatus } from '../types/sarops-types';
import ResponderCheckin from '../components/ResponderCheckin';
import { useResponderCheckin } from '../hooks/useResponderCheckin';
import { useIncident } from '../context/IncidentContext';
import '../styles/FormElements.css';
import '../styles/ActionButtons.css';

/**
 * ResponderCheckinPage
 * 
 * Full integration example of the ResponderCheckin component
 * with Supabase and team assignment
 */

interface ResponderCheckinPageProps {
  incidentId?: string;
  operationalPeriodId?: string;
  onResponderCheckedIn?: (responder: Responder) => void;
}

// Add useLocation hook
const ResponderCheckinPage: React.FC<ResponderCheckinPageProps> = ({
  incidentId,
  operationalPeriodId,
  onResponderCheckedIn,
}) => {
  const navigate = useNavigate();
  const location = useLocation(); // Use useLocation to access state
  const { 
    incidentId: contextIncidentId, 
    incidentData, 
    startIncident, 
    responderName,
    responderStatus,
    accessLevel,
    setResponderId,
    setResponderName, // This is already set in the context
    setAccessLevel,
    setResponderStatus,
    isAdmin, // Get isAdmin from context
    isActive 
  } = useIncident();
  const {
    checkedInResponder,
    isCheckedIn,
    loading,
    error,
    checkIn,
  } = useResponderCheckin(supabase);

  // Ensure an anonymous session exists before fetching data or allowing navigation
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [displayDensity, setDisplayDensity] = useState('comfortable');

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
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.debug('No active session. Establishing temporary anonymous access...');
          const { error: authError } = await supabase.auth.signInAnonymously();
          if (authError) throw authError;
        }
      } catch (err) {
        console.error('Initial authentication failed:', err);
        setSessionError('Failed to establish a secure session. Please check your connection and refresh.');
      } finally {
        setIsAuthenticating(false);
      }
    };

    initSession();
    
    // Listen for auth state changes
    const authRes = supabase.auth.onAuthStateChange(() => {});
    return () => authRes?.data?.subscription?.unsubscribe();
  }, []);

  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isAssigningTeam, setIsAssigningTeam] = useState(false);
  const [checkInInProgress, setCheckInInProgress] = useState(false);
  const [icsRole, setIcsRole] = useState<string | null>(null);

  // Centralized definition of staff-level access
  const isStaff = useMemo(() => 
    isAdmin && (accessLevel === 'staff' || accessLevel === 'admin'), 
    [accessLevel]
  );

  // Guard: If the user navigates here but is already checked in, send them back
  useEffect(() => {
    const shouldRedirect = location.pathname === '/checkin' && isActive && responderName && responderStatus !== 'CheckedOut';

    if (shouldRedirect && !checkInInProgress && !showTeamSelection && !loading) {
      const target = isStaff ? '/operations' : '/responder';
      
      console.info(`Active session detected, redirecting to ${target}`);
      navigate(target);
    }
   }, [isActive, responderName, responderStatus, checkInInProgress, showTeamSelection, loading, navigate, incidentData, isStaff, location.pathname]);

  // Incident selection state (moved from LoginPage)
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  // op_period_id is a UUID. Incident IDs are now TEXT (incident numbers).
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const effectiveOpId = (operationalPeriodId && uuidRegex.test(operationalPeriodId)) 
    ? operationalPeriodId 
    : incidentData?.opPeriodId;

  // Fetch active incidents for the dropdown and synchronize with real-time updates
  useEffect(() => {
    if (isAuthenticating) return;

    const fetchActiveIncidents = async () => {
      setLoadingIncidents(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('incidents')
          .select(`
            incident_id, 
            name, 
            number,
            operational_periods (
              op_period_id,
              op_number,
              start_datetime
            )
          `)
          .is('end_datetime', null) // Filter for active incidents
          .order('start_datetime', { ascending: false });

        if (fetchError) throw fetchError;
        setIncidents(data || []);
        
        if (data && data.length > 0) {
          const incidentFromState = location.state?.newIncidentId;
          if (incidentFromState && data.some(inc => inc.incident_id === incidentFromState)) {
            setSelectedIncidentId(incidentFromState);
          } else if (contextIncidentId && data.some(inc => inc.incident_id === contextIncidentId)) {
            setSelectedIncidentId(contextIncidentId);
          } else {
            setSelectedIncidentId(data[0].incident_id);
          }
        }
      } catch (err) {
        console.error('Failed to load active incidents:', err);
        setIncidentError('Failed to load active incidents. Please check your connection.');
      } finally {
        setLoadingIncidents(false);
      }
    };

    fetchActiveIncidents();

    // Set up real-time listener to ensure incidents that end are removed from the list immediately
    const channel = supabase
      .channel('public:incidents-checkin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        fetchActiveIncidents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticating, contextIncidentId, location.state?.newIncidentId]);

  /**
   * Handles navigation after check-in or team assignment is complete
   */
  const completeCheckInFlow = async (responder: Responder) => {
    console.group('🏁 Completing Check-In Flow');
    
    // Determine role based on the responder object's access_level
    const role = (responder.access_level || 'responder').toLowerCase();

    console.debug('Check-in complete. Routing as:', role);

    // Update context one last time to be sure
    setResponderName(responder.name);
    setResponderStatus(responder.status);
    if (setAccessLevel) setAccessLevel(responder.access_level);

    if (onResponderCheckedIn) {
      onResponderCheckedIn(responder);
    } else {
      if (role === 'staff' || role === 'admin') {
        console.log('Navigating to Operations Dashboard');
        navigate('/operations');
      } else {
        console.log('Navigating to Responder Dashboard');
        navigate('/responder');
      }
    }
    console.groupEnd();
  };

  const handleIncidentSelected = (id: string) => {
    setSelectedIncidentId(id);
  };

  const handleCreateIncident = (formData: any) => navigate('/incident', { state: { responderData: formData } });

  /**
   * Handle responder check-in
   */
  const handleCheckIn = async (
    responder: Responder
  ) => {
    setCheckInInProgress(true);

    try {
      const targetIncidentId = selectedIncidentId;
      let activeIncident = incidents.find(inc => inc.incident_id === targetIncidentId);

      // If not in local state (e.g. just created), fetch from DB to ensure context can start
      // and the first responder logic can find the operational period and staff team.
      if (!activeIncident && targetIncidentId) {
        const { data: freshInc } = await supabase
          .from('incidents')
          .select('incident_id, name, number, operational_periods(op_period_id, op_number, start_datetime)')
          .eq('incident_id', targetIncidentId)
          .is('end_datetime', null)
          .maybeSingle();
        
        if (freshInc) {
          activeIncident = freshInc as any;
        }
      }

      if (!activeIncident) {
        throw new Error('Could not retrieve incident details. Please refresh the page.');
      }

      const targetIncidentName = activeIncident.name;
      const latestOp = activeIncident.operational_periods?.sort((a: any, b: any) => 
        new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime()
      )[0];

      const targetOpNumber = latestOp?.op_number || '1';
      const targetOpId = latestOp?.op_period_id;

      // Session should already exist from the initial mount
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Authentication required to complete check-in.');
      const auth_uid = session.user.id;

      // Use the secure check-in RPC to establish operational identity and handle vehicle records.
      // Direct table insertion via the hook's checkIn method is avoided to prevent schema cache 
      // errors regarding the non-existent 'vehicles' column on the responders table.
      const { data: rpcData, error: rpcError } = await supabase.rpc('checkin_responder_securely', {
        p_incident_id: targetIncidentId,
        p_auth_uid: auth_uid,
        p_name: responder.name,
        p_agency: responder.agency,
        p_identifier: responder.identifier,
        p_cell_phone: responder.cell_phone,
        p_responder_type: responder.responder_type || 'SAR',
        p_special_skills: responder.special_skills,
        p_vehicles: (responder as any).vehicles,
        p_access_level: responder.access_level,
        p_status: responder.status,
        p_device_id: responder.device_id
      }).maybeSingle();

      if (rpcError) throw rpcError;

      // The RPC returns the created/updated responder record which is already sanitized (no 'vehicles' property).
      // We pass this to the hook's checkIn method to ensure internal React state is correctly updated.
      let finalResponder = (Array.isArray(rpcData) ? rpcData[0] : rpcData) || responder;
      await checkIn({ ...finalResponder, auth_uid });

      // Set responder email and incident in context after successful check-in
      if (setResponderId) setResponderId(finalResponder.responder_id);
      setResponderName(finalResponder.name);
      setResponderStatus(finalResponder.status);

      if (targetIncidentId && targetIncidentName) {
        console.log('✅ Setting active incident context:', { name: targetIncidentName, op: targetOpNumber });
        startIncident(targetIncidentId, targetIncidentName, targetOpNumber, targetOpId || '');
      } else {
        console.warn('⚠️ Could not set active incident context: missing ID or Name', { targetIncidentId, targetIncidentName });
      }

      // Check if this is the first responder for this incident and assign to Staff team
      if (targetIncidentId && targetOpId) {
        const { data: staffTeam, error: staffTeamError } = await supabase
          .from('teams')
          .select('team_id, leader_responder_id')
          .eq('op_period_id', targetOpId)
          .eq('type', 'Staff')
          .maybeSingle();

        if (staffTeam && !staffTeam.leader_responder_id) {
          console.log('First responder detected. Auto-assigning to Staff team as leader.');
          
          // 1. Assign responder to Staff team
          await supabase.from('team_responders').insert({
            team_id: staffTeam.team_id,
            responder_id: finalResponder.responder_id,
            role: 'Incident Commander'
          });

          // 2. Set responder as leader of the Staff team
          await supabase.from('teams')
            .update({ leader_responder_id: finalResponder.responder_id })
            .eq('team_id', staffTeam.team_id);

          // 3. Re-fetch responder to get updated access_level from trigger
          const { data: reFetchedResp } = await supabase
            .from('responders')
            .select(`
              responder_id, name, incident_id, agency, auth_uid, identifier, 
              cell_phone, device_id, special_skills, access_level, 
              responder_type, status, checkin_datetime, checkout_datetime,
              created_at, updated_at
            `)
            .eq('responder_id', finalResponder.responder_id)
            .maybeSingle();
          
          finalResponder = reFetchedResp || finalResponder;
          await completeCheckInFlow(finalResponder);
          setCheckInInProgress(false);
          return;
        }
      }

      // If operational period provided, show team assignment or staff confirmation
      // Only allow staff/admin confirmation flows if the user is logged in
      const isStaffCheck = isAdmin && (finalResponder.access_level === 'staff' || finalResponder.access_level === 'admin');

      if (isStaffCheck && targetIncidentId) {
        const { data: roleData } = await supabase
          .from('team_responders')
          .select('role, teams!inner(type)')
          .eq('teams.type', 'Staff')
          .eq('responder_id', finalResponder.responder_id)
          .maybeSingle();

        if (roleData) {
          setIcsRole(roleData.role);
        }
      }

      if (effectiveOpId && uuidRegex.test(effectiveOpId) && supabase) {
        // Fetch available teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('team_id, team_name_number, type')
          .eq('op_period_id', effectiveOpId)
          .in('status', ['Staged', 'Assigned']);

        if (!teamsError && teamsData && (isStaffCheck || teamsData.length > 0)) {
          setTeams(teamsData);
          setShowTeamSelection(true);
        } else {
          // No team selection needed
          completeCheckInFlow(finalResponder);
        }
      } else {
        // No operational period or no Supabase client, just complete checkin
        completeCheckInFlow(finalResponder);
      }
    } catch (err) {
      console.error('Check-in error:', err);
      setCheckInInProgress(false);
    }
  };

  /**
   * Handle team assignment after check-in
   */
  const handleAssignTeam = async () => {
    if (!checkedInResponder || !selectedTeamId) return;

    setIsAssigningTeam(true);

    try {
      if (!supabase) {
        onResponderCheckedIn?.(checkedInResponder);
        return;
      }

      // Add responder to team
      const { error: assignError } = await supabase
        .from('team_responders')
        .insert({
          team_id: selectedTeamId,
          responder_id: checkedInResponder.responder_id,
        });

      if (assignError) throw assignError;

      // Update responder status to Attached
      const { error: statusError } = await supabase
        .from('responders')
        .update({
          status: 'Attached',
        })
        .eq('responder_id', checkedInResponder.responder_id);

      if (statusError) throw statusError;

      // Log in responder team history
      const { error: historyError } = await supabase
        .from('responder_team_history')
        .insert({
          responder_id: checkedInResponder.responder_id,
          team_id: selectedTeamId,
          attached_datetime: new Date().toISOString(),
        });

      if (historyError) throw historyError;

      // Re-fetch to ensure the Command Staff team trigger updated the access_level correctly
      const { data: updatedResp } = await supabase
        .from('responders')
        .select('*')
        .eq('responder_id', checkedInResponder.responder_id)
        .maybeSingle();

      const finalResponder = updatedResp || { ...checkedInResponder, status: 'Attached' as ResponderStatus };

      completeCheckInFlow(finalResponder);

      // Close team selection
      setShowTeamSelection(false);
    } catch (err) {
      console.error('Error assigning team:', err);
    } finally {
      setIsAssigningTeam(false);
    }
  };

  /**
   * Skip team assignment
   */
  const handleSkipTeamAssignment = () => {
    if (checkedInResponder) {
      completeCheckInFlow(checkedInResponder);
      setShowTeamSelection(false);
    }
  };

  // Show team assignment screen
  if (isCheckedIn && showTeamSelection && checkedInResponder) {
    const isStaff = checkedInResponder.access_level === 'staff' || checkedInResponder.access_level === 'admin';

    return (
      <div className="responder-team-assignment">
        <div className="assignment-container">
          <div className="assignment-header">
            <h1>{isStaff ? 'Command Staff Check-In' : 'Assign to Team'}</h1>
          </div>

          {isStaff ? (
            <div className="staff-status-card" style={{ padding: '32px', background: '#f0f9ff', borderRadius: '16px', border: '1px solid #bae6fd', textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
              <h3 style={{ color: '#0369a1', marginBottom: '8px' }}>{icsRole ? icsRole.toUpperCase() : 'Staff Access Granted'}</h3>
              <p style={{ color: '#0c4a6e', marginBottom: '24px' }}>
                {icsRole ? `You are checked in as the ${icsRole} for this incident.` : 'Your account is recognized as command staff.'}
                {" "}You can now proceed to the operations dashboard to manage assignments and teams.
              </p>
              <button className="btn btn-primary btn-large" style={{ width: '100%' }} onClick={() => completeCheckInFlow(checkedInResponder)}>
                Continue to Operations Dashboard
              </button>
            </div>
          ) : teams.length === 0 ? (
            <div className="no-teams">
              <p>No teams available at this moment.</p>
              <button
                className="btn btn-primary"
                onClick={handleSkipTeamAssignment}
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="team-selection-form">
              <div className="team-list">
                {teams.map(team => (
                  <div
                    key={team.team_id}
                    className={`team-option ${selectedTeamId === team.team_id ? 'selected' : ''}`}
                    onClick={() => setSelectedTeamId(team.team_id)}
                    role="radio"
                    aria-checked={selectedTeamId === team.team_id}
                    tabIndex={0}
                  >
                    <div className="team-radio">
                      {selectedTeamId === team.team_id && <div className="radio-checked" />}
                    </div>
                    <div className="team-info">
                      <div className="team-name">{team.team_name_number}</div>
                      <div className="team-type">{team.type}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="assignment-actions">
                <button
                  className="btn btn-secondary"
                  onClick={handleSkipTeamAssignment}
                  disabled={isAssigningTeam}
                >
                  Skip for Now
                </button>

                <button
                  className="btn btn-primary btn-large"
                  onClick={handleAssignTeam}
                  disabled={!selectedTeamId || isAssigningTeam}
                  aria-busy={isAssigningTeam}
                >
                  {isAssigningTeam ? 'Assigning...' : 'Assign to Team'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If checked in but not doing team assignment, show a transition state
  // to prevent the registration form from reappearing before navigation completes
  if (isCheckedIn && !showTeamSelection) {
    return (
      <div className="responder-checkin">
        <div className="checkin-container" style={{ textAlign: 'center', padding: '30px 24px' }}>
          <div className="loading-spinner" style={{ fontSize: '40px', marginBottom: '20px' }}>⏳</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Finalizing check-in...</h2>
          <p style={{ color: '#64748b' }}>Establishing your incident session and redirecting to your dashboard.</p>
        </div>
      </div>
    );
  }

  // Show check-in form
  return (
    <div className={`responder-checkin density-${displayDensity}`} style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-lg)' }}>
      {isAuthenticating ? (
        <div className="checkin-container" style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <div className="checkin-transition">
            <div className="loading-spinner" style={{ fontSize: '40px', marginBottom: '20px' }}>⏳</div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Initializing Session</h2>
            <p style={{ color: '#64748b' }}>Establishing secure temporary access...</p>
          </div>
        </div>
      ) : (
        <ResponderCheckin
          onCheckIn={handleCheckIn}
          isLoading={loading}
          error={sessionError || error}
          incidents={incidents} // Pass active incidents
          loadingIncidents={loadingIncidents}
          incidentError={incidentError}
          onIncidentSelected={handleIncidentSelected}
          onCreateIncident={handleCreateIncident}
          isAdmin={isAdmin} // Pass isAdmin to ResponderCheckin
          selectedIncidentId={selectedIncidentId}
          initialData={location.state?.responderData}
        />
      )}
    </div>
  );
};

export default ResponderCheckinPage;

/**
 * USAGE
 * 
 * import ResponderCheckinPage from './pages/ResponderCheckinPage';
 * 
 * export default function App() {
 *   return (
 *     <ResponderCheckinPage 
 *       incidentId="incident-uuid"
 *       operationalPeriodId="op-period-uuid"
 *       onResponderCheckedIn={(responder) => {
 *         console.log('Responder checked in:', responder);
 *         // Navigate to next screen
 *       }}
 *     />
 *   );
 * }
 */
