import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useAdminData = () => {
  const [data, setData] = useState({
    users: [],
    incidents: [],
    responders: [],
    teams: [],
    assignments: []
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (table) => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.from(table).select('*');
      if (error) console.error(`[useAdminData] Error fetching ${table}:`, error);
      setData(prev => ({ ...prev, [table]: result || [] }));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    return Promise.all([
      refresh('users'),
      refresh('incidents'),
      refresh('responders'),
      refresh('teams'),
      refresh('assignments')
    ]);
  }, [refresh]);

  return { ...data, loading, refresh, refreshAll };
};