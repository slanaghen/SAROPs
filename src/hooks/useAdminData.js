import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useAdminData = () => {
  const [data, setData] = useState({
    users: [],
    incidents: [],
    responders: [],
    vehicles: [], // Add vehicles to initial state
    teams: [],
    assignments: [],
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (table) => {
    setLoading(true);
    try {
      const target = table === 'responders' ? 'full_responder_profiles' : table;
      const { data, error } = await supabase.from(target).select('*');
      if (error) console.error(`[useAdminData] Error fetching ${target}:`, error);
      setData(prev => ({ ...prev, [table]: data || [] }));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    return Promise.all([
      refresh('users'),
      refresh('incidents'),
      refresh('responders'),
      refresh('vehicles'), // Add vehicles to refreshAll
      refresh('teams'),
      refresh('assignments')
    ]);
  }, [refresh]);

  return { ...data, loading, refresh, refreshAll };
};