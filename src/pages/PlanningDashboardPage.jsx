import React, { useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import PlanningDashboard from '../components/PlanningDashboard';
import { usePlanningDashboard } from '../hooks/usePlanningDashboard';
import { useIncident } from '../context/IncidentContext';

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
  const { incidentData } = useIncident();
  const operationalPeriodId = propOpId || incidentData?.opPeriodId;

  // Use the custom hook to manage dashboard state and operations
  const {
    teams,
    assignments,
    responders,
    loading,
    stats,
    error: hookError,
    fetchDashboardData,
    assignTeamToAssignment,
    createTeam,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    updateResponder,
    checkOutResponder,
    updateTeam,
    attachResponderToTeam,
    detachResponderFromTeam,
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

  // Load data when component mounts or when operational period changes
  useEffect(() => {
    fetchDashboardData();
  }, [operationalPeriodId, fetchDashboardData]);

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
            defaultNewTeamName=""
            defaultNewTeamType="Ground Search"
            defaultNewAssignmentDivision="A"
            defaultNewAssignmentName={getNextAssignmentName("A")}
            defaultNewAssignmentType="Ground"
            defaultNewAssignmentSize={2}
            onTeamAssigned={handleTeamAssigned}
            createTeam={createTeam}
            createAssignment={createAssignment}
            updateAssignment={updateAssignment}
            deleteAssignment={deleteAssignment}
            updateResponder={updateResponder}
            checkOutResponder={checkOutResponder}
            updateTeam={updateTeam}
            attachResponderToTeam={attachResponderToTeam}
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
