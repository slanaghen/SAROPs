import { SupabaseClient } from '@supabase/supabase-js';
import { Responder, ResponderStatus } from '../types/sarops-types';

/**
 * Responder Service
 * 
 * Handles all responder-related operations with Supabase
 */

/**
 * Check in a responder
 */
export const checkInResponder = async (
  supabaseClient: SupabaseClient,
  responder: Responder
): Promise<Responder> => {
  const { data, error } = await supabaseClient
    .from('responders')
    .insert([responder])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to check in responder: ${error.message}`);
  }

  if (!data) {
    throw new Error('No responder data returned from database');
  }

  return data as Responder;
};

/**
 * Check out a responder
 */
export const checkOutResponder = async (
  supabaseClient: SupabaseClient,
  responderId: string
): Promise<Responder> => {
  const checkoutTime = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from('responders')
    .update({
      checkout_datetime: checkoutTime,
      status: 'CheckedOut' as ResponderStatus,
    })
    .eq('responder_id', responderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to check out responder: ${error.message}`);
  }

  if (!data) {
    throw new Error('No responder data returned from database');
  }

  return data as Responder;
};

/**
 * Update responder status
 */
export const updateResponderStatus = async (
  supabaseClient: SupabaseClient,
  responderId: string,
  newStatus: ResponderStatus
): Promise<Responder> => {
  const { data, error } = await supabaseClient
    .from('responders')
    .update({ status: newStatus })
    .eq('responder_id', responderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update responder status: ${error.message}`);
  }

  if (!data) {
    throw new Error('No responder data returned from database');
  }

  return data as Responder;
};

/**
 * Get responder by ID
 */
export const getResponder = async (
  supabaseClient: SupabaseClient,
  responderId: string
): Promise<Responder | null> => {
  const { data, error } = await supabaseClient
    .from('responders')
    .select('*')
    .eq('responder_id', responderId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "no rows" error, which is fine
    throw new Error(`Failed to fetch responder: ${error.message}`);
  }

  return (data as Responder) || null;
};

/**
 * Get all responders currently checked in
 */
export const getCheckedInResponders = async (
  supabaseClient: SupabaseClient
): Promise<Responder[]> => {
  const { data, error } = await supabaseClient
    .from('responders')
    .select('*')
    .is('checkout_datetime', null)
    .order('checkin_datetime', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch checked-in responders: ${error.message}`);
  }

  return (data as Responder[]) || [];
};

/**
 * Get all responders by status
 */
export const getRespondersByStatus = async (
  supabaseClient: SupabaseClient,
  status: ResponderStatus
): Promise<Responder[]> => {
  const { data, error } = await supabaseClient
    .from('responders')
    .select('*')
    .eq('status', status)
    .order('checkin_datetime', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch responders: ${error.message}`);
  }

  return (data as Responder[]) || [];
};

/**
 * Assign responder to team
 */
export const assignResponderToTeam = async (
  supabaseClient: SupabaseClient,
  responderId: string,
  teamId: string
): Promise<void> => {
  // Add to team
  const { error: insertError } = await supabaseClient
    .from('team_responders')
    .insert({
      team_id: teamId,
      responder_id: responderId,
    });

  if (insertError) {
    throw new Error(`Failed to add responder to team: ${insertError.message}`);
  }

  // Update responder status
  await updateResponderStatus(supabaseClient, responderId, 'Attached');

  // Log in responder team history
  const { error: historyError } = await supabaseClient
    .from('responder_team_history')
    .insert({
      responder_id: responderId,
      team_id: teamId,
      attached_datetime: new Date().toISOString(),
    });

  if (historyError) {
    console.error('Failed to log responder team history:', historyError);
  }
};

/**
 * Remove responder from team
 */
export const removeResponderFromTeam = async (
  supabaseClient: SupabaseClient,
  responderId: string,
  teamId: string
): Promise<void> => {
  // Remove from team
  const { error: deleteError } = await supabaseClient
    .from('team_responders')
    .delete()
    .eq('team_id', teamId)
    .eq('responder_id', responderId);

  if (deleteError) {
    throw new Error(`Failed to remove responder from team: ${deleteError.message}`);
  }

  // Update responder status back to Staged
  await updateResponderStatus(supabaseClient, responderId, 'Staged');

  // Log detachment in responder team history
  const { data: historyData, error: historyFetchError } = await supabaseClient
    .from('responder_team_history')
    .select('*')
    .eq('responder_id', responderId)
    .eq('team_id', teamId)
    .is('detached_datetime', null)
    .single();

  if (!historyFetchError && historyData) {
    await supabaseClient
      .from('responder_team_history')
      .update({
        detached_datetime: new Date().toISOString(),
      })
      .eq('history_id', historyData.history_id);
  }
};

/**
 * Get responder's team history
 */
export const getResponderTeamHistory = async (
  supabaseClient: SupabaseClient,
  responderId: string
): Promise<any[]> => {
  const { data, error } = await supabaseClient
    .from('responder_team_history')
    .select('*, teams(team_name_number, type)')
    .eq('responder_id', responderId)
    .order('attached_datetime', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch team history: ${error.message}`);
  }

  return data || [];
};

/**
 * Get responder's current team
 */
export const getResponderCurrentTeam = async (
  supabaseClient: SupabaseClient,
  responderId: string
): Promise<any | null> => {
  const { data, error } = await supabaseClient
    .from('team_responders')
    .select('*, teams(*)')
    .eq('responder_id', responderId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch current team: ${error.message}`);
  }

  return data || null;
};

/**
 * Get all responders for a team
 */
export const getTeamResponders = async (
  supabaseClient: SupabaseClient,
  teamId: string
): Promise<Responder[]> => {
  const { data, error } = await supabaseClient
    .from('team_responders')
    .select('responders(*)')
    .eq('team_id', teamId);

  if (error) {
    throw new Error(`Failed to fetch team responders: ${error.message}`);
  }

  return data?.map(r => r.responders) || [];
};

/**
 * Search responders by name or identifier
 */
export const searchResponders = async (
  supabaseClient: SupabaseClient,
  query: string
): Promise<Responder[]> => {
  const { data, error } = await supabaseClient
    .from('responders')
    .select('*')
    .or(`name.ilike.%${query}%,identifier.ilike.%${query}%`)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to search responders: ${error.message}`);
  }

  return (data as Responder[]) || [];
};

/**
 * Get responders by agency
 */
export const getRespondersByAgency = async (
  supabaseClient: SupabaseClient,
  agency: string
): Promise<Responder[]> => {
  const { data, error } = await supabaseClient
    .from('responders')
    .select('*')
    .eq('agency', agency)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch responders by agency: ${error.message}`);
  }

  return (data as Responder[]) || [];
};

/**
 * Get responders by device ID (for offline tracking)
 */
export const getRespondersByDeviceId = async (
  supabaseClient: SupabaseClient,
  deviceId: string
): Promise<Responder | null> => {
  const { data, error } = await supabaseClient
    .from('responders')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch responder: ${error.message}`);
  }

  return (data as Responder) || null;
};

/**
 * Get responder statistics
 */
export const getResponderStats = async (
  supabaseClient: SupabaseClient
): Promise<{
  total: number;
  checkedIn: number;
  deployed: number;
  debriefed: number;
}> => {
  try {
    const [
      { data: allData },
      { data: checkedInData },
      { data: deployedData },
      { data: debriefedData },
    ] = await Promise.all([
      supabaseClient.from('responders').select('*'),
      supabaseClient
        .from('responders')
        .select('*')
        .is('checkout_datetime', null),
      supabaseClient
        .from('responders')
        .select('*')
        .eq('status', 'Deployed'),
      supabaseClient
        .from('responders')
        .select('*')
        .eq('status', 'Debriefed'),
    ]);

    return {
      total: allData?.length || 0,
      checkedIn: checkedInData?.length || 0,
      deployed: deployedData?.length || 0,
      debriefed: debriefedData?.length || 0,
    };
  } catch (err) {
    throw new Error(
      `Failed to fetch responder stats: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
};

/**
 * Bulk update responder status
 */
export const bulkUpdateResponderStatus = async (
  supabaseClient: SupabaseClient,
  responderIds: string[],
  newStatus: ResponderStatus
): Promise<number> => {
  const { count, error } = await supabaseClient
    .from('responders')
    .update({ status: newStatus })
    .in('responder_id', responderIds);

  if (error) {
    throw new Error(`Failed to update responders: ${error.message}`);
  }

  return count || 0;
};
