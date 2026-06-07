import React, { useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import PlanningDashboard from '../components/PlanningDashboard';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import { useIncident } from '../context/IncidentContext';
import { v4 as uuidv4 } from 'uuid';

/**
 * PlanningDashboardPage
 * 
 * Example page component showing how to integrate:
 * - Supabase client
 * - usePlanningDashboard hook
 * - PlanningDashboard component
 * 
 * This would typically be integrated into your main app routing.
 */

const PlanningDashboardPage = ({ operationalPeriodId: propOpId }) => {
  const { incidentData, incidentId, responderName } = useIncident();
  const operationalPeriodId = propOpId || incidentData?.opPeriodId;

  // Use the custom hook to manage dashboard state and operations
  const {
    teams,
    assignments,
    responders,
    vehicles,
    loading,
    stats,
    refresh: fetchTable,
    error: hookError,
    fetchDashboardData,
    assignTeamToAssignment,
    createTeam,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    updateTeam,
    attachResponderToTeam,
    detachResponderFromTeam,
    attachVehicleToTeam,
    deleteTeam,
  } = usePlanningDashboard(supabase, operationalPeriodId);

  // Helper to calculate the next available Assignment name based on division
  const getNextAssignmentName = (division) => {
    if (!assignments || assignments.length === 0) return `${division}A`;
    
    const segmentAssignments = assignments.filter(a => a.segment === division);
    const usedSuffixes = new Set(
      segmentAssignments
        .map(a => {
          if (a.title && a.title.startsWith(division) && a.title.length === division.length + 1) {
            return a.title.slice(division.length);
          }
          return null;
        })
        .filter(Boolean)
    );

    for (let i = 65; i <= 90; i++) {
      const suffix = String.fromCharCode(i);
      if (!usedSuffixes.has(suffix)) {
        return `${division}${suffix}`;
      }
    }

    return `${division}A`; // Wrap around if A-Z are all used
  };

  /**
   * Persist a new responder to the database.
   * Required because the Planning hook focuses on OP-specific resources.
   */
  const createResponder = async (responderData) => {
    if (!incidentId) throw new Error("No active incident context.");
    
    // Use the secure check-in RPC to handle vehicle parsing and driver designation automatically
    const { error } = await supabase.rpc('checkin_responder_securely', {
      p_incident_id: incidentId,
      p_auth_uid: null, // Manually created from dashboard
      p_name: responderData.name,
      p_agency: responderData.agency,
      p_identifier: responderData.identifier,
      p_cell_phone: responderData.cell_phone,
      p_responder_type: responderData.responder_type || 'SAR',
      p_special_skills: responderData.special_skills,
      p_vehicles: responderData.vehicles,
      p_access_level: responderData.access_level || 'responder',
      p_status: 'Staged',
      p_device_id: `dashboard_created_${uuidv4()}`
    });

    if (error) throw error;
    await supabase.auth.refreshSession();
    // Admin-page logic: Fire fetches sequentially to resolve timing issues 
    // where staged logistical resources (incident-wide) appear missing 
    // due to aggregate dashboard filtering or state overwrite race conditions.
    // Broader tactical data must be awaited first, followed by specific 
    // logistical source-of-truth refreshes.
    await fetchDashboardData();
    if (fetchTable) await fetchTable('responders');
  };

  /**
   * Persist a new vehicle to the database.
   */
  const createVehicle = async (vehicleData) => {
    if (!incidentId) throw new Error("No active incident context.");
    
    const { error } = await supabase
      .from('vehicles')
      .upsert({
        ...vehicleData,
        responder_id: vehicleData.responder_id || null, // Convert empty string from form to null for UUID type
        incident_id: incidentId,
        checkin_datetime: new Date().toISOString(),
      }, { onConflict: 'incident_id, designation' });

    if (error) throw error;
    await supabase.auth.refreshSession();
    // Requirement: Ensure incident-wide equipment pool is updated immediately.
    await fetchDashboardData();
    if (fetchTable) await fetchTable('vehicles');
  };

  /**
   * Update an existing vehicle record.
   */
  const updateVehicle = async (id, vehicleData) => {
    const { error } = await supabase
      .from('vehicles')
      .update({
        ...vehicleData,
        responder_id: vehicleData.responder_id || null // Convert empty string from form to null for UUID type
      })
      .eq('vehicle_id', id);
    if (error) throw error;
    await supabase.auth.refreshSession();
    await fetchDashboardData();
    if (fetchTable) await fetchTable('vehicles');
  };

  /**
   * Update an existing responder record.
   */
  const updateResponder = async (id, responderData) => {
    const { error } = await supabase
      .from('responders')
      .update(responderData)
      .eq('responder_id', id);

    if (error) throw error;
    await supabase.auth.refreshSession();
    await fetchDashboardData();
    if (fetchTable) await fetchTable('responders');
  };

  /**
   * Mark a responder as checked out.
   */
  const checkOutResponder = async (id, name) => {
    const { error } = await supabase
      .from('responders')
      .update({ 
        status: 'CheckedOut', 
        checkout_datetime: new Date().toISOString() 
      })
      .eq('responder_id', id);

    if (error) throw error;
    await supabase.auth.refreshSession();
    await fetchDashboardData();
    if (fetchTable) await fetchTable('responders');
  };

  /**
   * Trigger data synchronization when the mission context or operational period stabilizes.
   */
  const lastFetchedIncidentId = useRef(null);
  const lastFetchedOpId = useRef(null);

  useEffect(() => {
    const initFetch = async () => {
      // Requirement: Resolve timing issues and race conditions during page initialization. 
      // Logic from AdminPage: specifically trigger a fetch as soon as incidentId is available. 
      // Staged logistical resources (vehicles/responders) are incident-wide assets and 
      // should appear even if the specific operational period is still hydrating or null.
      const isNewContext = lastFetchedIncidentId.current !== incidentId || 
                           lastFetchedOpId.current !== operationalPeriodId;

      if (incidentId && fetchDashboardData && isNewContext) {
        console.debug(`[Planning] Context detected (Inc: ${incidentId}, OP: ${operationalPeriodId}). Synchronizing session claims...`);
        
        // Mark the current context as fetched immediately to prevent concurrent duplicate 
        // requests while the async session refresh is in progress.
        lastFetchedIncidentId.current = incidentId;
        lastFetchedOpId.current = operationalPeriodId;
        
        // Explicitly refresh the session to ensure JWT claims (like incident_id) 
        // are propagated for RLS verification before the initial fetch.
        await supabase.auth.refreshSession();

        // Sequential synchronization: broader tactical data first, 
        // followed by the specific incident-wide logistical pool refreshes.
        await fetchDashboardData();

        if (fetchTable) {
          await fetchTable('vehicles');
          await fetchTable('responders');
        }
      }
    };

    initFetch();
  }, [incidentId, operationalPeriodId, fetchDashboardData, fetchTable]);

  /**
   * Handle team assignment
   * Called when user clicks the "Assign Team to Assignment" button
   */
  const handleTeamAssigned = async (mappingData) => {
    const { teamId, assignmentId } = mappingData;

    try {
      await assignTeamToAssignment(teamId, assignmentId);
      
      // Optional: Show toast/notification to user
      console.log('Team assigned successfully:', mappingData);
    } catch (err) {
      console.error('Error assigning team:', err);
      // Error is already set in hook state
    }
  };

  if (!operationalPeriodId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>Please select an operational period to view the planning dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      {hookError && (
        <div className="alert alert-error" style={{ margin: '16px' }}>
          <p><strong>Error:</strong> {hookError}</p>
          <button onClick={() => fetchDashboardData()}>Retry Load</button>
        </div>
      )}

      {loading && (
        <div style={{ 
          padding: '24px', 
          textAlign: 'center', 
          color: '#666' 
        }}>
          <p>Loading dashboard data...</p>
        </div>
      )}

      {!loading && (
        <>
          <PlanningDashboard
            operationalPeriodId={operationalPeriodId}
            teams={teams}
            assignments={assignments}
            responders={responders}
            vehicles={vehicles}
            defaultNewTeamName=""
            defaultNewTeamType="Ground"
            defaultNewAssignmentDivision="A"
            defaultNewAssignmentName={getNextAssignmentName("A")}
            defaultNewAssignmentType="Ground"
            defaultNewAssignmentSize={2}
            onTeamAssigned={handleTeamAssigned}
            createTeam={createTeam}
            createAssignment={createAssignment}
            createResponder={createResponder}
            createVehicle={createVehicle}
            updateVehicle={updateVehicle}
            updateAssignment={updateAssignment}
            deleteAssignment={deleteAssignment}
            updateResponder={updateResponder}
            checkOutResponder={checkOutResponder}
            updateTeam={updateTeam}
            attachResponderToTeam={attachResponderToTeam}
            attachVehicleToTeam={attachVehicleToTeam}
            detachResponderFromTeam={detachResponderFromTeam}
            deleteTeam={deleteTeam}
          />

          <div className="operations-stats-footer" style={{ 
            marginTop: '24px',
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap',
            padding: '8px 20px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            alignItems: 'center'
          }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Teams</strong>
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Staged: {stats.teams.staged}, Assigned: {stats.teams.assigned}, Deployed: {stats.teams.deployed}, Total: {stats.teams.total}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Assignments</strong>
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Planned: {stats.assignments.planned}, Assigned: {stats.assignments.assigned}, Deployed: {stats.assignments.deployed}, 
                Complete: {stats.assignments.complete}, Incomplete: {stats.assignments.incomplete}, Total: {stats.assignments.total}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Responders</strong>
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Staged: {stats.responders.staged}, Attached: {stats.responders.attached}, Assigned: {stats.responders.assigned}, 
                Deployed: {stats.responders.deployed}, Total: {stats.responders.total}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ color: '#1e293b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Vehicles</strong>
              <div style={{ fontSize: '12px', color: '#475569' }}>
                {/* Requirement: Use robust status checking for statistics to handle potential nulls or casing variations */}
                Staged: {(vehicles || []).filter(v => String(v.status || '').toLowerCase() === 'staged').length}, 
                Attached: {(vehicles || []).filter(v => String(v.status || '').toLowerCase() === 'attached').length}, 
                Active: {(vehicles || []).filter(v => ['assigned', 'deployed'].includes(String(v.status || '').toLowerCase())).length}, Total: {(vehicles || []).length}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PlanningDashboardPage;

/**
 * USAGE INSTRUCTIONS
 * 
 * 1. Environment Variables
 *    Set in your .env file:
 *    REACT_APP_SUPABASE_URL=https://your-project.supabase.co
 *    REACT_APP_SUPABASE_ANON_KEY=your-anon-key
 * 
 * 2. Install Supabase Client
 *    npm install @supabase/supabase-js
 * 
 * 3. Integrate into your App Router
 *    Example with React Router:
 *    
 *    import PlanningDashboardPage from './pages/PlanningDashboardPage';
 *    
 *    <Route
 *      path="/planning/:operationalPeriodId"
 *      element={<PlanningDashboardPage />}
 *    />
 * 
 * 4. Database Permissions (RLS)
 *    Ensure your Supabase project has Row Level Security (RLS) enabled
 *    with appropriate policies for teams, assignments, and responders tables.
 *    
 *    Example policy for authenticated users:
 *    CREATE POLICY "Users can view their incident data"
 *    ON teams FOR SELECT
 *    USING (auth.uid() IS NOT NULL);
 * 
 * 5. Real-time Updates (Optional)
 *    Add subscriptions for live updates:
 *    
 *    useEffect(() => {
 *      const subscription = supabase
 *        .from('assignments')
 *        .on('*', payload => {
 *          console.log('Assignment changed:', payload);
 *          // Refresh dashboard data
 *          fetchDashboardData();
 *        })
 *        .subscribe();
 *      
 *      return () => {
 *        supabase.removeSubscription(subscription);
 *      };
 *    }, [fetchDashboardData]);
 */
