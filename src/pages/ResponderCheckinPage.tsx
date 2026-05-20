import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Incident, Responder, Team, ResponderStatus } from '../types/sarops-types';
import ResponderCheckin from '../components/ResponderCheckin';
import { useResponderCheckin } from '../hooks/useResponderCheckin';
import { useIncident } from '../context/IncidentContext';

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

const ResponderCheckinPage: React.FC<ResponderCheckinPageProps> = ({
  incidentId,
  operationalPeriodId,
  onResponderCheckedIn,
}) => {
  const navigate = useNavigate();
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
    isActive 
  } = useIncident();
  const {
    checkedInResponder,
    isCheckedIn,
    loading,
    error,
    checkIn,
  } = useResponderCheckin(supabase);

  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isAssigningTeam, setIsAssigningTeam] = useState(false);
  const [checkInInProgress, setCheckInInProgress] = useState(false);
  const [icsRole, setIcsRole] = useState<string | null>(null);

  // Guard: If the user navigates here but is already checked in, send them back
  useEffect(() => {
    // Only guard against accidental navigation if we have a confirmed responder in context
    if (isActive && responderName && responderStatus !== 'CheckedOut' && !checkInInProgress && !showTeamSelection && !loading) {
      const isStaff = accessLevel === 'command staff' || (incidentData && incidentData.name && accessLevel === 'admin');
      const target = isStaff ? '/operations' : '/responder-dashboard';
      
      console.info(`Active session detected, redirecting to ${target}`);
      navigate(target);
    }
  }, [isActive, responderName, responderStatus, checkInInProgress, showTeamSelection, loading, navigate, incidentData, accessLevel]);

  // Incident selection state (moved from LoginPage)
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  const effectiveIncidentId = incidentId || contextIncidentId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const effectiveOpId = (operationalPeriodId && uuidRegex.test(operationalPeriodId)) 
    ? operationalPeriodId 
    : incidentData?.opPeriodId;

  // Fetch active incidents for the dropdown (moved from LoginPage)
  useEffect(() => {
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
              op_number
            )
          `)
          .is('end_datetime', null)
          .order('start_datetime', { ascending: false });

        if (fetchError) throw fetchError;
        setIncidents(data || []);
        if (data && data.length > 0) {
          setSelectedIncidentId(data[0].incident_id); // Auto-select first incident
        } else if (data && data.length === 0) {
          // Log that we are in initial setup mode, but don't force redirect
          console.info('No active incidents found. System is in initial setup mode.');
        }
      } catch (err) {
        console.error('Failed to load active incidents:', err);
      } finally {
        setLoadingIncidents(false);
      }
    };

    fetchActiveIncidents();
  }, [isActive, navigate]);

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
      if (role === 'command staff' || role === 'admin') {
        console.log('Navigating to Operations Dashboard');
        navigate('/operations');
      } else {
        console.log('Navigating to Responder Dashboard');
        navigate('/responder-dashboard');
      }
    }
    console.groupEnd();
  };

  const handleIncidentSelected = (id: string) => {
    setSelectedIncidentId(id);
  };

  const handleCreateIncident = () => navigate('/incident-edit');

  /**
   * Handle responder check-in
   */
  const handleCheckIn = async (
    responder: Responder
  ) => {
    setCheckInInProgress(true);

    try {
      const targetIncidentId = selectedIncidentId;
      const activeIncident = incidents.find(inc => inc.incident_id === targetIncidentId);
      const targetIncidentName = activeIncident?.name;
      const latestOp = (activeIncident as any)?.operational_periods?.[0];
      const targetOpNumber = latestOp?.op_number || '1';
      const targetOpId = latestOp?.op_period_id;

      await checkIn(responder);

      // Fetch the latest responder record to catch trigger-updated access_level
      const { data: updatedResp } = await supabase
        .from('responders')
        .select('*')
        .eq('responder_id', responder.responder_id)
        .single();

      const finalResponder = updatedResp || responder;

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

      // If operational period provided, show team assignment or staff confirmation
      const isStaff = (finalResponder.access_level === 'command staff');

      if (isStaff && targetIncidentId) {
        const { data: roleData } = await supabase
          .from('ics_assignments')
          .select('position')
          .eq('incident_id', targetIncidentId)
          .eq('responder_id', finalResponder.responder_id)
          .maybeSingle();

        if (roleData) {
          setIcsRole(roleData.position);
        }
      }

      if (effectiveOpId && uuidRegex.test(effectiveOpId) && supabase) {
        // Fetch available teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('team_id, team_name_number, type')
          .eq('op_period_id', effectiveOpId)
          .in('status', ['Staged', 'Assigned']);

        if (!teamsError && teamsData && (isStaff || teamsData.length > 0)) {
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
        .single();

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
    const isStaff = checkedInResponder.access_level === 'command staff' || checkedInResponder.access_level === 'admin';

    return (
      <div className="responder-team-assignment">
        <div className="assignment-container">
          <div className="assignment-header">
            <h1>{isStaff ? 'Command Staff Check-In' : 'Assign to Team'}</h1>
            <p>Welcome {checkedInResponder.name}! {isStaff ? 'You are successfully checked in.' : 'Would you like to join a team?'}</p>
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
        <div className="checkin-container" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div className="loading-spinner" style={{ fontSize: '40px', marginBottom: '20px' }}>⏳</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Finalizing check-in...</h2>
          <p style={{ color: '#64748b' }}>Establishing your incident session and redirecting to your dashboard.</p>
        </div>
      </div>
    );
  }

  // Show check-in form
  return (
    <div className="responder-checkin" style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
      <div className="checkin-container" style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
        <ResponderCheckin
          onCheckIn={handleCheckIn}
          isLoading={loading}
          error={error}
          incidents={incidents} // Pass active incidents
          loadingIncidents={loadingIncidents}
          incidentError={incidentError}
          onIncidentSelected={handleIncidentSelected}
          onCreateIncident={handleCreateIncident}
          selectedIncidentId={selectedIncidentId}
        />
      </div>
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
