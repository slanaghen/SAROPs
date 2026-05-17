import React, { useEffect } from 'react';
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
    deleteTeam,
  } = usePlanningDashboard(supabase, operationalPeriodId);

  // Helper to calculate the next available Assignment name based on division
  const getNextAssignmentName = (division) => {
    if (!assignments || assignments.length === 0) return `${division}A`;
    
    const divisionAssignments = assignments.filter(a => a.division === division);
    const sequenceCodes = divisionAssignments
      .map(a => {
        // Look for names starting with the division followed by a single uppercase letter
        if (a.name && a.name.startsWith(division)) {
          const suffix = a.name.slice(division.length);
          return suffix.length === 1 ? suffix.charCodeAt(0) : null;
        }
        return null;
      })
      .filter(code => code !== null && code >= 65 && code <= 90); // Only A-Z

    const maxCode = sequenceCodes.length > 0 ? Math.max(...sequenceCodes) : 64; // 64 is @, so next is 65 (A)
    return `${division}${String.fromCharCode(maxCode + 1)}`;
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
        <div style={{ padding: '16px', color: '#721c24', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', margin: '16px', textAlign: 'center' }}>
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
          updateTeam={updateTeam}
          attachResponderToTeam={attachResponderToTeam}
          detachResponderFromTeam={detachResponderFromTeam}
          deleteTeam={deleteTeam}
        />
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
