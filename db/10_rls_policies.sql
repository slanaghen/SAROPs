--
-- RLS Policies for Incident Management
--

-- This policy allows users with 'staff' or 'admin' roles to create new incidents.
-- It uses a SECURITY DEFINER function to check the user's role from the users table,
-- which is necessary because JWT claims may not exist during incident creation.

-- First, enable RLS on the table if it's not already.
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Drop existing insert policy if it exists, to avoid conflicts.
DROP POLICY IF EXISTS "Allow staff/admin to create incidents" ON public.incidents;

-- Create the new, correct policy.
CREATE POLICY "Allow staff/admin to create incidents"
ON public.incidents
FOR INSERT
TO authenticated
WITH CHECK (check_is_operational_staff());