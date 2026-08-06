-- /db/03a_schema_mods.sql
-- This file contains schema modifications (ALTER TABLE) that are applied
-- after the initial tables are created but before functions and RLS policies
-- that may depend on these new columns.

-- Add the column to store a historical snapshot of a team when an assignment is completed.
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS completed_team_snapshot JSONB;