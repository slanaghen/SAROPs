import { useState, useEffect, useCallback } from 'react';

// Global shared state to deduplicate simultaneous requests and share data across hook instances
const queryCache = new Map(); // responderId -> { team, assignment, responderRecord, loading, error }
const inflight = new Map();  // responderId -> Promise
const listeners = new Map(); // responderId -> Set of React state setters
const channels = new Map();  // responderId -> SupabaseRealtimeChannel
const subscriberCount = new Map(); // responderId -> count

/**
 * Updates the shared state for a responder and notifies all active hook instances.
 */
const updateGlobalState = (id, patch) => {
  const current = queryCache.get(id) || {
    team: null,
    assignment: null,
    responderRecord: null,
    loading: true,
    error: null
  };
  const newState = { ...current, ...patch };
  queryCache.set(id, newState);
  
  const set = listeners.get(id);
  if (set) {
    set.forEach(setState => setState(newState));
  }
};

/**
 * useResponderTeamAndAssignment
 * 
 * Custom hook to fetch and synchronize a responder's current team membership 
 * and assigned task. Implements a caching strategy to deduplicate concurrent requests.
 */
const useResponderTeamAndAssignment = (supabase, responderId) => {
  const [state, setState] = useState(() => queryCache.get(responderId) || {
    team: null,
    assignment: null,
    responderRecord: null,
    loading: true,
    error: null
  });

  const fetchData = useCallback(async (force = false) => {
    if (!responderId) {
      updateGlobalState(responderId, { loading: false, team: null, assignment: null, responderRecord: null });
      return;
    }

    if (!force && inflight.has(responderId)) return inflight.get(responderId);

    const promise = (async () => {
    try {
      updateGlobalState(responderId, { loading: true, error: null });

      // 1. Fetch core responder status and access level
      const { data: resp, error: respError } = await supabase
        .from('responders')
        .select('status, access_level')
        .eq('responder_id', responderId)
        .maybeSingle();
      
      if (respError) throw respError;

      // 2. Fetch current team membership and nested assignment data
      // We include last_par_check and created_at to avoid supplemental fetches in the UI
      const { data, error: fetchError } = await supabase
        .from('team_responders')
        .select(`
          team_id,
          teams!inner (
            team_id,
            team_name_number,
            type,
            status,
            leader_responder_id,
            equipment,
            last_par_check,
            created_at,
            assignments (
              assignment_id,
              title,
              status,
              segment,
              resource_type,
              team_size,
              frequency_primary,
              description,
              probability_of_detection,
              debrief_narrative
            )
          )
        `)
        .eq('responder_id', responderId)
        .neq('teams.status', 'Disbanded')
        .maybeSingle();

      if (fetchError) throw fetchError;

      let teamData = null;
      let activeAsn = null;

      if (data && data.teams && data.teams.status !== 'Disbanded') {
        teamData = data.teams;
        // Assignments is an array due to the 1:1 relationship in DB vs join logic
        activeAsn = Array.isArray(teamData.assignments) ? teamData.assignments[0] : teamData.assignments;
      }

      const result = {
        responderRecord: resp || null,
        team: teamData,
        assignment: activeAsn || null,
        loading: false,
        error: null
      };

      updateGlobalState(responderId, result);
      return result;
    } catch (err) {
      updateGlobalState(responderId, { loading: false, error: err?.message || 'Database error' });
    } finally {
      inflight.delete(responderId);
    }
    })();

    inflight.set(responderId, promise);
    return promise;
  }, [supabase, responderId]);

  useEffect(() => {
    if (!responderId) return;

    // Register this instance's state setter to the global listener set
    if (!listeners.has(responderId)) listeners.set(responderId, new Set());
    listeners.get(responderId).add(setState);

    // Manage subscriber counts to prevent redundant network resources
    const count = subscriberCount.get(responderId) || 0;
    subscriberCount.set(responderId, count + 1);

    // Refresh on focus to handle sleep/wake issues
    const onFocus = () => fetchData(true);
    window.addEventListener('focus', onFocus);

    if (count === 0) {
      // First instance: perform initial load and establish one shared realtime channel
      fetchData();

      const channel = supabase
        .channel(`responder-context-${responderId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_responders', filter: `responder_id=eq.${responderId}` }, () => fetchData(true))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'responders', filter: `responder_id=eq.${responderId}` }, () => fetchData(true))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, () => fetchData(true))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignments' }, () => fetchData(true))
        .subscribe();

      channels.set(responderId, channel);
    } else {
      // Subsequent instances: inherit current state from the cache immediately
      const cached = queryCache.get(responderId);
      if (cached) setState(cached);
    }

    return () => {
      window.removeEventListener('focus', onFocus);
      
      const set = listeners.get(responderId);
      if (set) set.delete(setState);

      const currentCount = subscriberCount.get(responderId) || 1;
      if (currentCount <= 1) {
        // Clean up global resources if this was the last instance
        subscriberCount.delete(responderId);
        listeners.delete(responderId);
        const chan = channels.get(responderId);
        if (chan) {
          supabase.removeChannel(chan);
          channels.delete(responderId);
        }
        queryCache.delete(responderId);
        inflight.delete(responderId); // Clear hanging promises on final unmount to prevent test state leakage
      } else {
        subscriberCount.set(responderId, currentCount - 1);
      }
    };
  }, [responderId, fetchData, supabase]);

  return { ...state, refetch: () => fetchData(true) };
};

export default useResponderTeamAndAssignment;