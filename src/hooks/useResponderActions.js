import { useCallback } from 'react';

/**
 * useResponderActions Hook
 * Logic for updating responder details and checking them out.
 */
export const useResponderActions = ({
  supabaseClient,
  recordAction,
  fetchDashboardData,
  setLoading,
  setError
}) => {
  const updateResponder = useCallback(async (responderId, updates) => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient.from('responders').update(updates).eq('responder_id', responderId).select().single();
      if (error) throw error;
      await recordAction(`Updated details for responder "${updates.name || 'Responder'}".`);
      await fetchDashboardData();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction, fetchDashboardData, setLoading, setError]);

  const checkOutResponder = useCallback(async (responderId, name) => {
    try {
      setLoading(true);
      await supabaseClient.from('team_responders').delete().eq('responder_id', responderId);
      await supabaseClient.from('teams').update({ leader_responder_id: null }).eq('leader_responder_id', responderId);
      const { data, error } = await supabaseClient.from('responders').update({ status: 'CheckedOut', checkout_datetime: new Date().toISOString() }).eq('responder_id', responderId).select().single();
      if (error) throw error;
      await recordAction(`Checked out responder: ${name}`);
      await fetchDashboardData();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, recordAction, fetchDashboardData, setLoading, setError]);

  return { updateResponder, checkOutResponder };
};