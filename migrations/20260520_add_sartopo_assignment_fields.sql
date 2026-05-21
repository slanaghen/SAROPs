-- Migration: Add SARTopo-aligned fields to `assignments` and copy existing values
-- Date: 2026-05-20
-- This migration adds new columns used to align SAR Ops assignments with
-- SARTopo assignment objects, and copies existing legacy values into the new
-- columns to preserve data continuity.

BEGIN;

ALTER TABLE IF EXISTS assignments
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS segment TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS team_size INTEGER,
  ADD COLUMN IF NOT EXISTS frequency_primary TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS probability_of_detection INTEGER,
  ADD COLUMN IF NOT EXISTS team_name TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS transportation TEXT,
  ADD COLUMN IF NOT EXISTS time_allocated TEXT,
  ADD COLUMN IF NOT EXISTS segment_area TEXT,
  ADD COLUMN IF NOT EXISTS hazards TEXT,
  ADD COLUMN IF NOT EXISTS prepared_by TEXT,
  ADD COLUMN IF NOT EXISTS folder_id TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS stroke TEXT,
  ADD COLUMN IF NOT EXISTS fill TEXT,
  ADD COLUMN IF NOT EXISTS updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Copy legacy values into new SARTopo fields when those fields are empty
UPDATE assignments
SET
  title = COALESCE(title, name),
  segment = COALESCE(segment, division),
  resource_type = COALESCE(resource_type, assignment_type),
  team_size = COALESCE(team_size, assignment_size),
  frequency_primary = COALESCE(frequency_primary, tac_channel),
  description = COALESCE(description, description_narrative),
  probability_of_detection = COALESCE(probability_of_detection, pod),
  -- map updated timestamp to the new `updated` field if not already set
  updated = COALESCE(updated, updated_at);

COMMIT;

-- NOTE:
-- - This migration intentionally preserves legacy columns (`name`, `division`,
--   `assignment_type`, `assignment_size`, `tac_channel`, `description_narrative`, `pod`)
--   to maintain backward compatibility. After you have validated application
--   behavior and updated clients, consider a follow-up migration to remove
--   or deprecate legacy columns.
-- - Run this migration in a transaction and take a DB backup before applying
--   to production.
