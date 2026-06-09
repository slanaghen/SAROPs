-- SAROps Data Reset Script
-- This script clears all operational data (Incidents, Teams, Responders, etc.)
-- while preserving the 'users' table (System Admin/Staff accounts).

CREATE OR REPLACE FUNCTION public.clear_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions to bypass RLS for data clearing
AS $$
BEGIN
-- Temporarily disable triggers to allow for a clean bulk truncation.
-- This prevents sync triggers from attempting to update related rows that are being deleted.
SET session_replication_role = 'replica';

  TRUNCATE TABLE 
      team_messages,
      action_logs,
      team_responders,
      clues,
      responder_team_history,
      assignments,
      vehicles,
      teams,
      operational_periods,
      responders,
      incidents
  RESTART IDENTITY CASCADE;

-- Restore trigger behavior
SET session_replication_role = 'origin';
END;
$$;

-- Grant access to authenticated users to execute this function
GRANT EXECUTE ON FUNCTION public.clear_data() TO authenticated;