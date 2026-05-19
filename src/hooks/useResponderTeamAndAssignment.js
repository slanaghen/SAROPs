import { useState, useEffect, useCallback } from 'react';

export const useResponderTeamAndAssignment = (supabaseClient, responderId) => {
  const [team, setTeam] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchResponderData = useCallback(async () => {
    if (!supabaseClient || !responderId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setTeam(null);
    setAssignment(null);

    try {
      // 1. Get the responder's current team details
      // This assumes 'team_responders' links responders to teams,
      // and we want to fetch the team details through this join.
      const { data: teamResponderEntry, error: teamResponderError } = await supabaseClient
        .from('team_responders')
        .select(`
          team_id,
          teams (
            team_id,
            team_name_number,
            type,
            status,
            leader_responder_id,
            equipment
          )
        `)
        .eq('responder_id', responderId)
        .single();

      if (teamResponderError && teamResponderError.code !== 'PGRST116') { // PGRST116 is "no rows found"
        throw teamResponderError;
      }

      const currentTeam = teamResponderEntry ? teamResponderEntry.teams : null;
      setTeam(currentTeam);

      if (currentTeam && currentTeam.team_id) {
        // 2. Get the assignment for that team
        const { data: teamAssignment, error: assignmentError } = await supabaseClient
          .from('assignments')
          .select('*')
          .eq('team_id', currentTeam.team_id)
          .maybeSingle();

        if (assignmentError && assignmentError.code !== 'PGRST116') {
          throw assignmentError;
        }
        setAssignment(teamAssignment);
      }
    } catch (err) {
      console.error('Error fetching responder team and assignment:', err);
      setError(err.message || 'Failed to load responder dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, responderId]);

  useEffect(() => {
    fetchResponderData();
  }, [fetchResponderData]);

  return { team, assignment, loading, error, refetch: fetchResponderData };
};

export default useResponderTeamAndAssignment;