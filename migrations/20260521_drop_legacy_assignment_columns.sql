-- Migration: Drop legacy assignment columns now that SARTopo fields are primary
-- Run this after verifying application uses SARTopo fields and data has been migrated.

BEGIN;

ALTER TABLE assignments
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS division,
  DROP COLUMN IF EXISTS assignment_type,
  DROP COLUMN IF EXISTS assignment_size,
  DROP COLUMN IF EXISTS tac_channel,
  DROP COLUMN IF EXISTS description_narrative,
  DROP COLUMN IF EXISTS pod,
  DROP COLUMN IF EXISTS debrief_narrative;

COMMIT;
