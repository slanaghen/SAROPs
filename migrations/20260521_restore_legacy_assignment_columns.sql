-- Rollback migration: Re-add legacy `assignments` columns and backfill from SARTopo fields
-- Run this if you need to restore legacy columns after a drop.
-- Safe to run multiple times (uses IF NOT EXISTS and COALESCE to preserve existing values).

BEGIN;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS division TEXT,
  ADD COLUMN IF NOT EXISTS assignment_type TEXT,
  ADD COLUMN IF NOT EXISTS assignment_size INTEGER,
  ADD COLUMN IF NOT EXISTS tac_channel TEXT,
  ADD COLUMN IF NOT EXISTS description_narrative TEXT,
  ADD COLUMN IF NOT EXISTS pod INTEGER,
  ADD COLUMN IF NOT EXISTS debrief_narrative TEXT;

-- Backfill legacy columns from SARTopo fields where legacy columns are NULL
UPDATE assignments
SET
  name = COALESCE(name, title),
  division = COALESCE(division, segment),
  assignment_type = COALESCE(assignment_type, resource_type),
  assignment_size = COALESCE(assignment_size, team_size),
  tac_channel = COALESCE(tac_channel, frequency_primary),
  description_narrative = COALESCE(description_narrative, description),
  pod = COALESCE(pod, probability_of_detection),
  debrief_narrative = COALESCE(debrief_narrative, '')
WHERE true;

COMMIT;
