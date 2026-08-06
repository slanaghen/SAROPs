-- Enable pgcrypto for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ENUM TYPES
DROP TYPE IF EXISTS assignment_status CASCADE;
CREATE TYPE assignment_status AS ENUM (
  'Planned', 'Assigned', 'Deployed', 'Completed', 'Incomplete'
);

DROP TYPE IF EXISTS assignment_origin CASCADE;
CREATE TYPE assignment_origin AS ENUM (
  'SAROps', 'SARTopo'
);

DROP TYPE IF EXISTS team_status CASCADE;
CREATE TYPE team_status AS ENUM (
  'Staged', 'Assigned', 'Deployed', 'Disbanded'
);

DROP TYPE IF EXISTS team_type CASCADE;
CREATE TYPE team_type AS ENUM (
  'Hasty', 'Ground', 'Vehicle', 'UAS', 'Water', 'Tracking', 'Dog', 'Avalanche', 'Transport', 'Helicopter', 'Medical', 'Staff', 'Other'
);

DROP TYPE IF EXISTS responder_status CASCADE;
CREATE TYPE responder_status AS ENUM (
  'Staged', 'Attached', 'Assigned', 'Deployed', 'CheckedOut'
);

DROP TYPE IF EXISTS responder_type CASCADE;
CREATE TYPE responder_type AS ENUM (
  'SAR', 'Fire', 'Law', 'Medical', 'Other'
);

DROP TYPE IF EXISTS display_density CASCADE;
CREATE TYPE display_density AS ENUM (
  'compact', 'comfortable'
);

DROP TYPE IF EXISTS access_level CASCADE;
CREATE TYPE access_level AS ENUM (
  'responder', 'staff', 'admin'
);-- Table: incidents
DROP TABLE IF EXISTS incidents CASCADE;
CREATE TABLE incidents (
  incident_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  sartopo_id TEXT,
  sartopo_sync_enabled BOOLEAN DEFAULT FALSE,
  sartopo_last_fetch_at BIGINT DEFAULT 0,
  sartopo_last_upload_at BIGINT DEFAULT 0,
  sartopo_synced_titles TEXT[] DEFAULT '{}'::TEXT[],
  sartopo_map_data JSONB,
  notes TEXT,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: operational_periods
DROP TABLE IF EXISTS operational_periods CASCADE;
CREATE TABLE operational_periods (
  op_period_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  op_number INTEGER NOT NULL,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE,
  situation_narrative TEXT,
  situational_awareness_narrative TEXT,
  par_check_interval INTEGER DEFAULT 60,
  sarstream_enabled BOOLEAN DEFAULT FALSE,
  sarstream_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_op_number_per_incident UNIQUE (incident_id, op_number)
);-- Table: users (System Admin access)
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  access_level access_level NOT NULL DEFAULT 'responder',
  name TEXT,
  agency TEXT,
  identifier TEXT,
  cell_phone TEXT,
  responder_type responder_type,
  special_skills TEXT,
  vehicles TEXT,
  display_density display_density DEFAULT 'comfortable',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: responders
DROP TABLE IF EXISTS responders CASCADE;
CREATE TABLE responders (
  responder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  agency TEXT NOT NULL,
  auth_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  identifier TEXT NOT NULL,
  cell_phone TEXT,
  device_id TEXT NOT NULL,
  vehicles TEXT,
  special_skills TEXT,
  access_level access_level NOT NULL DEFAULT 'responder',
  responder_type responder_type,
  status responder_status NOT NULL DEFAULT 'Staged',
  checkin_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  checkout_datetime TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT responder_device_unique UNIQUE (device_id),
  CONSTRAINT check_checkout_date_presence CHECK (status != 'CheckedOut' OR checkout_datetime IS NOT NULL)
);

-- Table: teams
DROP TABLE IF EXISTS teams CASCADE;
CREATE TABLE teams (
  team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
  team_name_number TEXT NOT NULL,
  sartopo_color_hex TEXT NOT NULL,
  type team_type NOT NULL,
  status team_status NOT NULL DEFAULT 'Staged',
  leader_responder_id UUID REFERENCES responders(responder_id) ON DELETE SET NULL,
  equipment JSONB DEFAULT '[]'::jsonb,
  last_par_check TIMESTAMP WITH TIME ZONE,
  par_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: vehicles
DROP TABLE IF EXISTS vehicles CASCADE;
CREATE TABLE vehicles (
  vehicle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  responder_id UUID REFERENCES responders(responder_id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  type TEXT,
  team_id UUID REFERENCES teams(team_id) ON DELETE SET NULL,
  status responder_status NOT NULL DEFAULT 'Staged',
  checkin_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  checkout_datetime TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT vehicle_incident_designation_unique UNIQUE (incident_id, designation),
  CONSTRAINT check_vehicle_checkout_date_presence CHECK (status != 'CheckedOut' OR checkout_datetime IS NOT NULL)
);-- Table: assignments
DROP TABLE IF EXISTS assignments CASCADE;
CREATE TABLE assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
  sartopo_id TEXT,
  status assignment_status NOT NULL DEFAULT 'Planned',
  segment TEXT,
  resource_type TEXT,
  team_size INTEGER,
  frequency_primary TEXT,
  description TEXT,
  debrief_narrative TEXT,
  probability_of_detection INTEGER,
  priority TEXT,
  transportation TEXT,
  time_allocated TEXT,
  hazards TEXT,
  prepared_by TEXT,
  title TEXT NOT NULL,
  is_orphaned BOOLEAN NOT NULL DEFAULT FALSE,
  team_id UUID REFERENCES teams(team_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  origin assignment_origin NOT NULL DEFAULT 'SAROps',
  CONSTRAINT check_team_size_positive CHECK (team_size >= 0),
  CONSTRAINT check_pod_range CHECK (probability_of_detection >= 0 AND probability_of_detection <= 100),
  CONSTRAINT assignment_sartopo_unique UNIQUE (op_period_id, sartopo_id)
);

-- Table: clues
DROP TABLE IF EXISTS clues CASCADE;
CREATE TABLE clues (
  clue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  sartopo_marker_id TEXT,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  description TEXT,
  photo_url TEXT,
  discovered_by_team_id UUID REFERENCES teams(team_id) ON DELETE SET NULL,
  discovered_by_responder_id UUID REFERENCES responders(responder_id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: responder_team_history
DROP TABLE IF EXISTS responder_team_history CASCADE;
CREATE TABLE responder_team_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id UUID NOT NULL REFERENCES responders(responder_id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  attached_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  detached_datetime TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT responder_team_history_valid_dates CHECK (detached_datetime IS NULL OR detached_datetime >= attached_datetime)
);

-- Junction: team_responders
DROP TABLE IF EXISTS team_responders CASCADE;
CREATE TABLE team_responders (
  team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES responders(responder_id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (team_id, responder_id)
);

-- Table: action_logs
DROP TABLE IF EXISTS action_logs CASCADE;
CREATE TABLE action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  action TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: team_messages
DROP TABLE IF EXISTS team_messages CASCADE;
CREATE TABLE team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);-- /db/03a_schema_mods.sql
-- This file contains schema modifications (ALTER TABLE) that are applied
-- after the initial tables are created but before functions and RLS policies
-- that may depend on these new columns.

-- Add the column to store a historical snapshot of a team when an assignment is completed.
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS completed_team_snapshot JSONB;-- Secondary Indexes for Operational Periods
CREATE INDEX idx_operational_periods_start_datetime ON operational_periods(start_datetime);

-- Secondary Indexes for Teams
CREATE INDEX idx_teams_leader_responder_id ON teams(leader_responder_id);

-- Partial unique index to enforce one active Staff team per OP
CREATE UNIQUE INDEX idx_one_staff_per_op 
ON teams (op_period_id) 
WHERE type = 'Staff' AND status != 'Disbanded';

CREATE INDEX idx_teams_status ON teams(status);

-- Secondary Indexes for Assignments
CREATE INDEX idx_assignments_team_id ON assignments(team_id);
CREATE INDEX idx_assignments_status ON assignments(status);

-- Unique index for manual assignments to support upsert and prevent duplicates in the same OP
CREATE UNIQUE INDEX idx_assignment_title_per_op 
ON assignments (op_period_id, title) 
WHERE (sartopo_id IS NULL);

-- Secondary Indexes for History and Audit
CREATE INDEX idx_responder_team_history_responder_id ON responder_team_history(responder_id);
CREATE INDEX idx_responder_team_history_team_id ON responder_team_history(team_id);
CREATE INDEX idx_action_logs_incident_id ON action_logs(incident_id);

-- Secondary Indexes for Clues
CREATE INDEX idx_clues_discovered_by_team_id ON clues(discovered_by_team_id);
CREATE INDEX idx_clues_discovered_by_responder_id ON clues(discovered_by_responder_id);
CREATE INDEX idx_clues_coordinates ON clues(latitude, longitude);

-- Secondary Indexes for Logistics
CREATE INDEX idx_responders_device_id ON responders(device_id);
CREATE INDEX idx_responders_access_level ON responders(access_level);
CREATE INDEX idx_vehicles_status ON vehicles(status);

-- Messaging Performance
CREATE INDEX idx_team_messages_composite ON team_messages(team_id, created_at);-- View: team_current_responders
CREATE OR REPLACE VIEW team_current_responders WITH (security_invoker = on) AS
SELECT
  t.*,
  r.name AS leader_name,
  r.identifier AS leader_identifier,
  (SELECT COUNT(*) FROM team_responders tr_count WHERE tr_count.team_id = t.team_id) AS member_count,
  i.name AS incident_name,
  i.number AS incident_number,
  i.incident_id,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'responder_id', r.responder_id,
          'name', r.name,
          'agency', r.agency,
          'status', r.status,
          'role', tr.role
        )
      )
      FROM team_responders tr
      JOIN responders r ON tr.responder_id = r.responder_id
      WHERE tr.team_id = t.team_id
    ),
    '[]'::json
  ) AS current_responders,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'vehicle_id', v.vehicle_id,
          'designation', v.designation,
          'type', v.type,
          'status', v.status
        )
      )
      FROM vehicles v
      WHERE v.team_id = t.team_id
    ),
    '[]'::json
  ) AS current_vehicles
FROM teams t
LEFT JOIN responders r ON t.leader_responder_id = r.responder_id
JOIN operational_periods op ON t.op_period_id = op.op_period_id
JOIN incidents i ON op.incident_id = i.incident_id;

-- View: dashboard_assignments
CREATE OR REPLACE VIEW dashboard_assignments WITH (security_invoker = on) AS
SELECT
  a.*,
  t.team_name_number AS team_name,
  t.status AS team_status,
  t.type AS team_type,
  t.leader_name,
  t.leader_identifier,
  t.leader_responder_id,
  t.member_count,
  t.last_par_check,
  i.name AS incident_name,
  i.number AS incident_number,
  i.incident_id
FROM assignments a
LEFT JOIN team_current_responders t ON a.team_id = t.team_id
JOIN operational_periods op ON a.op_period_id = op.op_period_id
JOIN incidents i ON op.incident_id = i.incident_id;

-- View: incident_summary
CREATE OR REPLACE VIEW incident_summary WITH (security_invoker = on) AS
SELECT
  i.incident_id, i.name, i.number, i.start_datetime, i.end_datetime,
  (SELECT COUNT(*) FROM operational_periods op WHERE op.incident_id = i.incident_id) as operational_period_count,
  (SELECT COUNT(DISTINCT t.team_id) FROM teams t JOIN operational_periods op ON t.op_period_id = op.op_period_id WHERE op.incident_id = i.incident_id) as team_count,
  (SELECT COUNT(*) FROM responders r WHERE r.incident_id = i.incident_id) as responder_count,
  (SELECT COUNT(*) FROM clues c WHERE c.incident_id = i.incident_id) as clue_count
FROM incidents i;-- Authorization: Check if the current user has operational staff privileges
-- This function is the cornerstone of RLS policies for creating and managing incidents.
-- It robustly checks the user's role from the users table, rather than relying on
-- potentially absent JWT claims, which is critical when creating a new incident
-- where no incident-specific context exists yet.
CREATE OR REPLACE FUNCTION check_is_operational_staff()
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    -- Allow if the user has an explicit staff/admin session via Auth metadata or custom claims
    SELECT 1 WHERE (auth.jwt() ->> 'access_level') IN ('staff', 'admin')
    UNION ALL
    -- Use auth.uid to join against auth.users for a reliable system user check
    SELECT 1 FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND access_level IN ('staff', 'admin')
    UNION ALL
    -- Check against the specific responder record for this incident
    SELECT 1 FROM responders WHERE auth_uid = auth.uid() AND access_level IN ('staff', 'admin')
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- ICS Automation: Staffing
CREATE OR REPLACE FUNCTION create_staff_team_for_op()
RETURNS TRIGGER AS $func$
-- This function creates the 'Staff' team and a corresponding 'Command Staff'
-- assignment for each new operational period. It does NOT pre-populate roles
-- like 'Planning Section Chief' or 'Mapper'. Those roles are text labels assigned
-- to responders when they are manually added to the Staff team.
DECLARE
    _team_id UUID;
BEGIN
    INSERT INTO teams (op_period_id, team_name_number, sartopo_color_hex, type, status, last_par_check)
    VALUES (NEW.op_period_id, 'Staff', '#0000FF', 'Staff', 'Deployed', CURRENT_TIMESTAMP)
    ON CONFLICT (op_period_id) WHERE (type = 'Staff' AND status != 'Disbanded')
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING team_id INTO _team_id;

    INSERT INTO assignments (op_period_id, title, resource_type, status, team_id)
    VALUES (NEW.op_period_id, 'Command Staff', 'Staff', 'Deployed', _team_id)
    ON CONFLICT (op_period_id, title) WHERE (sartopo_id IS NULL)
    DO UPDATE SET team_id = EXCLUDED.team_id, updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ICS Automation: First Responder IC
CREATE OR REPLACE FUNCTION auto_assign_first_responder_as_ic()
RETURNS TRIGGER AS $func$
DECLARE
    _staff_team_id UUID;
BEGIN
    -- This logic should only apply to standard responders, not staff/admins
    -- who might be checking in just to manage the incident.
    IF NEW.access_level = 'responder' THEN
        SELECT t.team_id INTO _staff_team_id FROM teams t
        JOIN operational_periods op ON t.op_period_id = op.op_period_id
        WHERE op.incident_id = NEW.incident_id AND t.type = 'Staff' AND t.leader_responder_id IS NULL
        ORDER BY op.op_number ASC LIMIT 1;

        IF _staff_team_id IS NOT NULL THEN
            INSERT INTO team_responders (team_id, responder_id, role)
            VALUES (_staff_team_id, NEW.responder_id, 'Incident Commander') ON CONFLICT DO NOTHING;

            UPDATE teams SET leader_responder_id = NEW.responder_id WHERE team_id = _staff_team_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Status Synchronization: Responder Access and State
CREATE OR REPLACE FUNCTION sync_responder_on_membership_change()
RETURNS TRIGGER AS $func$
DECLARE
    _responder_id UUID;
    _team_id UUID;
    _team_status team_status;
    is_staff BOOLEAN;
    target_access access_level;
    target_status responder_status;
BEGIN
    _responder_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.responder_id ELSE NEW.responder_id END;
    
    SELECT tr.team_id, t.status, (t.type = 'Staff') INTO _team_id, _team_status, is_staff
    FROM team_responders tr JOIN teams t ON tr.team_id = t.team_id
    WHERE tr.responder_id = _responder_id AND t.status != 'Disbanded'
    ORDER BY (t.type = 'Staff') ASC -- Prioritize tactical teams over the Staff team for status
    LIMIT 1;

    is_staff := COALESCE(is_staff, false);
    target_access := CASE WHEN is_staff THEN 'staff'::access_level ELSE 'responder'::access_level END;

    IF _team_id IS NOT NULL THEN
        target_status := CASE 
            WHEN is_staff THEN 'Deployed'::responder_status
            WHEN _team_status = 'Staged' THEN 'Attached'::responder_status
            WHEN _team_status = 'Assigned' THEN 'Assigned'::responder_status
            WHEN _team_status = 'Deployed' THEN 'Deployed'::responder_status
            ELSE 'Staged'::responder_status
        END;
    ELSE
        target_status := 'Staged'::responder_status;
    END IF;

    UPDATE responders SET 
        access_level = CASE WHEN access_level = 'admin' THEN 'admin'::access_level ELSE target_access END,
        status = target_status
    WHERE responder_id = _responder_id AND (access_level IS DISTINCT FROM target_access OR status IS DISTINCT FROM target_status);
    RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Status Synchronization: Vehicles
CREATE OR REPLACE FUNCTION sync_vehicle_status_on_team_link()
RETURNS TRIGGER AS $func$
DECLARE
    _team_status team_status;
BEGIN
    IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
        SELECT status INTO _team_status FROM teams WHERE team_id = NEW.team_id;
        NEW.status := CASE 
            WHEN _team_status = 'Staged' THEN 'Attached'::responder_status
            WHEN _team_status = 'Assigned' THEN 'Assigned'::responder_status
            WHEN _team_status = 'Deployed' THEN 'Deployed'::responder_status
            ELSE NEW.status END;
    ELSIF NEW.team_id IS NULL AND OLD.team_id IS NOT NULL THEN
        NEW.status := 'Staged'::responder_status;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lifecycle Cleanup: Incident End
CREATE OR REPLACE FUNCTION cleanup_resources_on_incident_end()
RETURNS TRIGGER AS $func$
BEGIN
    IF NEW.end_datetime IS NOT NULL AND OLD.end_datetime IS NULL THEN
        UPDATE operational_periods SET end_datetime = NEW.end_datetime WHERE incident_id = NEW.incident_id AND end_datetime IS NULL;
        UPDATE assignments SET status = 'Incomplete', team_id = NULL WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id) AND status = 'Deployed';
        UPDATE assignments SET status = 'Planned', team_id = NULL WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id) AND status = 'Assigned';
        UPDATE teams SET status = 'Disbanded', last_par_check = NULL WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id) AND status != 'Disbanded';
        UPDATE responders SET status = 'CheckedOut', checkout_datetime = NEW.end_datetime WHERE incident_id = NEW.incident_id AND checkout_datetime IS NULL;
        UPDATE vehicles SET status = 'CheckedOut', checkout_datetime = NEW.end_datetime WHERE incident_id = NEW.incident_id AND checkout_datetime IS NULL;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Membership Validation
CREATE OR REPLACE FUNCTION validate_responder_active_membership()
RETURNS TRIGGER AS $func$
BEGIN
    IF EXISTS (
        SELECT 1 FROM team_responders tr JOIN teams t ON tr.team_id = t.team_id
        WHERE tr.responder_id = NEW.responder_id AND tr.team_id != NEW.team_id AND t.status != 'Disbanded'
    ) THEN
        RAISE EXCEPTION 'Responder is already a member of another active team.';
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assignment Metrics
CREATE OR REPLACE FUNCTION sync_assignment_team_size()
RETURNS TRIGGER AS $func$
BEGIN
    IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id)) THEN
        NEW.team_size := (SELECT COUNT(*) FROM team_responders WHERE team_id = NEW.team_id);
    ELSIF TG_OP = 'UPDATE' AND NEW.team_id IS NULL THEN
        NEW.team_size := 0;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_assignment_size_on_membership_change()
RETURNS TRIGGER AS $func$
DECLARE
    _team_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END;
BEGIN
    UPDATE assignments SET team_size = (SELECT COUNT(*) FROM team_responders WHERE team_id = _team_id)
    WHERE team_id = _team_id;
    RETURN NULL;
END;
$func$ LANGUAGE plpgsql;

-- Assignment Status Synchronization
CREATE OR REPLACE FUNCTION sync_team_status_on_assignment_update()
RETURNS TRIGGER AS $func$
DECLARE
    _target_team_status team_status;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.team_id IS NOT NULL AND NEW.team_id IS NULL THEN
        UPDATE teams SET status = 'Staged'::team_status WHERE team_id = OLD.team_id AND status != 'Disbanded';
    END IF;

    IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
        _target_team_status := CASE
            WHEN NEW.status = 'Planned' THEN 'Staged'::team_status
            WHEN NEW.status = 'Assigned' THEN 'Assigned'::team_status
            WHEN NEW.status = 'Deployed' THEN 'Deployed'::team_status
            WHEN NEW.status = 'Completed' OR NEW.status = 'Incomplete' THEN 'Disbanded'::team_status
            ELSE NULL
        END;

        IF _target_team_status IS NOT NULL THEN
            UPDATE teams SET status = _target_team_status,
                last_par_check = CASE WHEN _target_team_status = 'Deployed' THEN CURRENT_TIMESTAMP ELSE last_par_check END
            WHERE team_id = NEW.team_id AND status IS DISTINCT FROM _target_team_status;
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Operational Control Logic: Start the next operational period
-- Closes the current period and carries over active teams and assignments.
CREATE OR REPLACE FUNCTION start_next_operational_period(p_incident_id TEXT, p_current_op_period_id UUID)
RETURNS UUID AS $func$
DECLARE
    _new_op_period_id UUID := gen_random_uuid();
    _current_op_number INTEGER;
    _team_id_map JSONB := '{}'::jsonb;
    _old_team RECORD;
    _new_team_id UUID;
    _old_asn RECORD;
    _new_staff_team_id UUID;
BEGIN
    -- 1. Get current OP info
    SELECT op_number INTO _current_op_number
    FROM operational_periods
    WHERE op_period_id = p_current_op_period_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Current operational period not found.';
    END IF;

    -- 2. Create the new OP
    INSERT INTO operational_periods (op_period_id, incident_id, op_number, start_datetime)
    VALUES (_new_op_period_id, p_incident_id, _current_op_number + 1, CURRENT_TIMESTAMP);

    -- 3. Close the old OP
    UPDATE operational_periods
    SET end_datetime = CURRENT_TIMESTAMP
    WHERE op_period_id = p_current_op_period_id;

    -- 4. Find the auto-created Staff team in the new OP (created via trigger)
    SELECT team_id INTO _new_staff_team_id
    FROM teams
    WHERE op_period_id = _new_op_period_id AND type = 'Staff' AND status != 'Disbanded'
    LIMIT 1;

    -- 5. Transition Teams
    FOR _old_team IN (
        SELECT * FROM teams 
        WHERE op_period_id = p_current_op_period_id 
          AND status != 'Disbanded'
    ) LOOP
        IF _old_team.type = 'Staff' AND _new_staff_team_id IS NOT NULL THEN
            UPDATE teams SET
                leader_responder_id = _old_team.leader_responder_id,
                equipment = _old_team.equipment,
                sartopo_color_hex = _old_team.sartopo_color_hex
            WHERE team_id = _new_staff_team_id;
            _new_team_id := _new_staff_team_id;
        ELSE
            _new_team_id := gen_random_uuid();
            INSERT INTO teams (team_id, op_period_id, team_name_number, sartopo_color_hex, type, status, leader_responder_id, equipment, last_par_check)
            VALUES (_new_team_id, _new_op_period_id, _old_team.team_name_number, _old_team.sartopo_color_hex, _old_team.type, _old_team.status, _old_team.leader_responder_id, _old_team.equipment, _old_team.last_par_check);
        END IF;

        _team_id_map := _team_id_map || jsonb_build_object(_old_team.team_id::TEXT, _new_team_id::TEXT);
        INSERT INTO team_responders (team_id, responder_id, role)
        SELECT _new_team_id, responder_id, role FROM team_responders WHERE team_id = _old_team.team_id ON CONFLICT DO NOTHING;

        -- Transition Vehicles (Requirement: Ensure vehicle attachments carry over to the new OP)
        UPDATE vehicles SET team_id = _new_team_id WHERE team_id = _old_team.team_id;
    END LOOP;

    -- 6. Transition Assignments
    FOR _old_asn IN (
        SELECT * FROM assignments 
        WHERE op_period_id = p_current_op_period_id 
          AND status NOT IN ('Completed', 'Incomplete')
    ) LOOP
        IF _old_asn.title = 'Command Staff' THEN
            UPDATE assignments SET 
                status = _old_asn.status, segment = _old_asn.segment, resource_type = _old_asn.resource_type, team_size = _old_asn.team_size, frequency_primary = _old_asn.frequency_primary, description = _old_asn.description, debrief_narrative = _old_asn.debrief_narrative, probability_of_detection = _old_asn.probability_of_detection, priority = _old_asn.priority, transportation = _old_asn.transportation, time_allocated = _old_asn.time_allocated, hazards = _old_asn.hazards, prepared_by = _old_asn.prepared_by, team_id = _new_staff_team_id, origin = _old_asn.origin
            WHERE op_period_id = _new_op_period_id AND title = 'Command Staff';
        ELSE
            INSERT INTO assignments (op_period_id, sartopo_id, status, segment, resource_type, team_size, frequency_primary, description, debrief_narrative, probability_of_detection, priority, transportation, time_allocated, hazards, prepared_by, title, is_orphaned, team_id, origin)
            VALUES (_new_op_period_id, _old_asn.sartopo_id, _old_asn.status, _old_asn.segment, _old_asn.resource_type, _old_asn.team_size, _old_asn.frequency_primary, _old_asn.description, _old_asn.debrief_narrative, _old_asn.probability_of_detection, _old_asn.priority, _old_asn.transportation, _old_asn.time_allocated, _old_asn.hazards, _old_asn.prepared_by, _old_asn.title, _old_asn.is_orphaned, (_team_id_map->>(_old_asn.team_id::TEXT))::UUID, _old_asn.origin);
        END IF;
    END LOOP;

    RETURN _new_op_period_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update responder statuses and assignment status when a team status changes
CREATE OR REPLACE FUNCTION sync_team_members_on_status_change()
RETURNS TRIGGER AS $func$
DECLARE
    _target_responder_status responder_status;
    _target_assignment_status assignment_status;
BEGIN
    _target_responder_status := CASE
        WHEN NEW.status = 'Staged' THEN 'Attached'::responder_status
        WHEN NEW.status = 'Assigned' THEN 'Assigned'::responder_status
        WHEN NEW.status = 'Deployed' THEN 'Deployed'::responder_status
        WHEN NEW.status = 'Disbanded' THEN 'Staged'::responder_status
        ELSE NULL
    END;

    IF _target_responder_status IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE responders
        SET status = _target_responder_status
        WHERE responder_id IN (SELECT responder_id FROM team_responders WHERE team_id = NEW.team_id)
          AND status IS DISTINCT FROM _target_responder_status;

        UPDATE vehicles
        SET status = _target_responder_status
        WHERE team_id = NEW.team_id
          AND status IS DISTINCT FROM _target_responder_status;
    END IF;

    IF NEW.status = 'Disbanded' AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE responder_team_history
        SET detached_datetime = CURRENT_TIMESTAMP
        WHERE team_id = NEW.team_id AND detached_datetime IS NULL;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate team reactivation
CREATE OR REPLACE FUNCTION validate_team_activation()
RETURNS TRIGGER AS $func$
BEGIN
    IF OLD.status = 'Disbanded' AND NEW.status != 'Disbanded' THEN
        IF EXISTS (
            SELECT 1 FROM team_responders tr JOIN team_responders tr2 ON tr.responder_id = tr2.responder_id
            JOIN teams t2 ON tr2.team_id = t2.team_id
            WHERE tr.team_id = NEW.team_id AND tr2.team_id != NEW.team_id AND t2.status != 'Disbanded'
        ) THEN RAISE EXCEPTION 'One or more members of this team are already assigned to other active teams.';
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate team leader assignments
CREATE OR REPLACE FUNCTION validate_team_leader_membership()
RETURNS TRIGGER AS $func$
BEGIN
    IF NEW.leader_responder_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.leader_responder_id IS DISTINCT FROM NEW.leader_responder_id) THEN
        IF EXISTS (
            SELECT 1 FROM team_responders tr JOIN teams t ON tr.team_id = t.team_id
            WHERE tr.responder_id = NEW.leader_responder_id AND tr.team_id != NEW.team_id AND t.status != 'Disbanded'
        ) THEN RAISE EXCEPTION 'Responder is already assigned as a member or leader of another active team.';
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ensure the team leader is always a member of the team
CREATE OR REPLACE FUNCTION ensure_leader_is_member()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.leader_responder_id IS NOT NULL THEN
        INSERT INTO team_responders (team_id, responder_id, role)
        VALUES (NEW.team_id, NEW.leader_responder_id, CASE WHEN NEW.type = 'Staff' THEN 'Incident Commander' ELSE 'Team Leader' END)
        ON CONFLICT (team_id, responder_id) DO UPDATE SET role = EXCLUDED.role;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent a team leader from being removed from their team
CREATE OR REPLACE FUNCTION prevent_leader_leaving_team()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the responder being removed is the leader of the team
    IF EXISTS (
        SELECT 1 FROM teams
        WHERE teams.team_id = OLD.team_id
          AND teams.leader_responder_id = OLD.responder_id
    ) THEN
        RAISE EXCEPTION 'A team leader cannot leave their team. Please designate a new leader first.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Logging: Team Membership
CREATE OR REPLACE FUNCTION trigger_log_team_membership_change()
RETURNS TRIGGER AS $func$
DECLARE
    _incident_id TEXT;
    _responder_name TEXT;
    _team_name TEXT;
    _user_name TEXT;
BEGIN  
    -- Get context and names
    SELECT op.incident_id, t.team_name_number INTO _incident_id, _team_name
    FROM teams t JOIN operational_periods op ON t.op_period_id = op.op_period_id
    WHERE t.team_id = COALESCE(NEW.team_id, OLD.team_id);

    SELECT name INTO _responder_name FROM responders WHERE responder_id = COALESCE(NEW.responder_id, OLD.responder_id);
    
    SELECT COALESCE(name, username, 'System') INTO _user_name FROM users 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid());

    IF TG_OP = 'INSERT' THEN
        INSERT INTO action_logs (incident_id, action, user_name)
        VALUES (_incident_id, format('Responder "%s" joined team "%s" (Role: %s)', _responder_name, _team_name, COALESCE(NEW.role, 'Member')), COALESCE(_user_name, 'System'));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO action_logs (incident_id, action, user_name)
        VALUES (_incident_id, format('Responder "%s" left team "%s"', _responder_name, _team_name), COALESCE(_user_name, 'System'));
    END IF;
    RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Logging: Vehicle Assignments
CREATE OR REPLACE FUNCTION trigger_log_vehicle_team_change()
RETURNS TRIGGER AS $func$
DECLARE
    _team_name TEXT;
    _user_name TEXT;
BEGIN
    SELECT COALESCE(name, username, 'System') INTO _user_name FROM users 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid());

    IF (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id) OR (TG_OP = 'INSERT' AND NEW.team_id IS NOT NULL) THEN
        IF NEW.team_id IS NOT NULL THEN
            SELECT team_name_number INTO _team_name FROM teams WHERE team_id = NEW.team_id;
            INSERT INTO action_logs (incident_id, action, user_name)
            VALUES (NEW.incident_id, format('Vehicle "%s" attached to team "%s"', NEW.designation, _team_name), COALESCE(_user_name, 'System'));
        ELSIF OLD.team_id IS NOT NULL THEN
            SELECT team_name_number INTO _team_name FROM teams WHERE team_id = OLD.team_id;
            INSERT INTO action_logs (incident_id, action, user_name)
            VALUES (NEW.incident_id, format('Vehicle "%s" detached from team "%s"', NEW.designation, _team_name), COALESCE(_user_name, 'System'));
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Logging: Team Tasking
CREATE OR REPLACE FUNCTION trigger_log_assignment_team_change()
RETURNS TRIGGER AS $func$
DECLARE
    _incident_id TEXT;
    _team_name TEXT;
    _user_name TEXT;
BEGIN
    SELECT incident_id INTO _incident_id FROM operational_periods WHERE op_period_id = NEW.op_period_id;
    
    SELECT COALESCE(name, username, 'System') INTO _user_name FROM users 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid());

    IF (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id) OR (TG_OP = 'INSERT' AND NEW.team_id IS NOT NULL) THEN
        IF NEW.team_id IS NOT NULL THEN
            SELECT team_name_number INTO _team_name FROM teams WHERE team_id = NEW.team_id;
            INSERT INTO action_logs (incident_id, action, user_name)
            VALUES (_incident_id, format('Team "%s" tasked to assignment "%s"', _team_name, NEW.title), COALESCE(_user_name, 'System'));
        ELSIF OLD.team_id IS NOT NULL THEN
            SELECT team_name_number INTO _team_name FROM teams WHERE team_id = OLD.team_id;
            INSERT INTO action_logs (incident_id, action, user_name)
            VALUES (_incident_id, format('Team "%s" unassigned from "%s"', _team_name, NEW.title), COALESCE(_user_name, 'System'));
        END IF;
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO action_logs (incident_id, action, user_name)
        VALUES (_incident_id, format('Assignment "%s" status changed to %s', NEW.title, NEW.status), COALESCE(_user_name, 'System'));
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;-- Updated At
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_operational_periods_updated_at BEFORE UPDATE ON operational_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_responders_updated_at BEFORE UPDATE ON responders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ICS Automation
CREATE TRIGGER ensure_staff_team_on_new_op AFTER INSERT ON operational_periods FOR EACH ROW EXECUTE FUNCTION create_staff_team_for_op();
CREATE TRIGGER trigger_first_responder_ic_check AFTER INSERT ON responders FOR EACH ROW EXECUTE FUNCTION auto_assign_first_responder_as_ic();
CREATE TRIGGER trigger_sync_assignment_team_size BEFORE INSERT OR UPDATE OF team_id ON assignments FOR EACH ROW EXECUTE FUNCTION sync_assignment_team_size();
CREATE TRIGGER trigger_sync_assignment_size_from_membership AFTER INSERT OR UPDATE OR DELETE ON team_responders FOR EACH ROW EXECUTE FUNCTION sync_assignment_size_on_membership_change();
CREATE TRIGGER trigger_sync_team_status_from_assignment AFTER INSERT OR UPDATE OF status, team_id ON assignments FOR EACH ROW EXECUTE FUNCTION sync_team_status_on_assignment_update();

-- Status Synchronization
CREATE TRIGGER trigger_sync_vehicle_status_on_team_link BEFORE UPDATE OF team_id ON vehicles FOR EACH ROW EXECUTE FUNCTION sync_vehicle_status_on_team_link();
CREATE TRIGGER sync_team_status_on_team_update AFTER INSERT OR UPDATE OF status ON teams FOR EACH ROW EXECUTE FUNCTION sync_team_members_on_status_change();
CREATE TRIGGER sync_responder_status_on_responder_update AFTER INSERT OR UPDATE OF auth_uid, incident_id ON responders FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();
CREATE TRIGGER sync_access_level_on_team_responders AFTER INSERT OR UPDATE OR DELETE ON team_responders FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();

-- Lifecycle Cleanup
CREATE TRIGGER trigger_incident_cleanup_on_end AFTER UPDATE OF end_datetime ON incidents FOR EACH ROW EXECUTE FUNCTION cleanup_resources_on_incident_end();

-- Logging
CREATE TRIGGER trigger_log_team_membership
AFTER INSERT OR DELETE ON team_responders FOR EACH ROW EXECUTE FUNCTION trigger_log_team_membership_change();

CREATE TRIGGER trigger_log_vehicle_assignment 
AFTER INSERT OR UPDATE OF team_id ON vehicles FOR EACH ROW EXECUTE FUNCTION trigger_log_vehicle_team_change();

CREATE TRIGGER trigger_log_assignment_changes 
AFTER INSERT OR UPDATE OF team_id, status ON assignments FOR EACH ROW EXECUTE FUNCTION trigger_log_assignment_team_change();

-- Membership Validation
CREATE TRIGGER trigger_check_responder_membership
BEFORE INSERT OR UPDATE ON team_responders FOR EACH ROW EXECUTE FUNCTION validate_responder_active_membership();

CREATE TRIGGER trigger_check_team_activation
BEFORE UPDATE OF status ON teams FOR EACH ROW EXECUTE FUNCTION validate_team_activation();

CREATE TRIGGER trigger_check_team_leader_membership
BEFORE INSERT OR UPDATE OF leader_responder_id ON teams FOR EACH ROW EXECUTE FUNCTION validate_team_leader_membership();

CREATE TRIGGER trigger_ensure_leader_is_member
AFTER INSERT OR UPDATE OF leader_responder_id ON teams FOR EACH ROW EXECUTE FUNCTION ensure_leader_is_member();-- Enable RLS on all tables
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_team_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS HELPERS
CREATE OR REPLACE FUNCTION is_anonymous_responder()
RETURNS BOOLEAN AS $func$
  SELECT (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE;
$func$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION check_is_operational_staff()
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    -- Allow if the user has an explicit staff/admin session via Auth metadata or custom claims
    SELECT 1 WHERE (auth.jwt() ->> 'access_level') IN ('staff', 'admin')
    UNION ALL
    -- Use auth.uid to join against auth.users for a reliable system user check
    SELECT 1 FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND access_level IN ('staff', 'admin')
    UNION ALL
    -- Check against the specific responder record for this incident
    SELECT 1 FROM responders WHERE auth_uid = auth.uid() AND access_level IN ('staff', 'admin')
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_command_staff()
RETURNS BOOLEAN AS $func$
  SELECT check_is_operational_staff();
$func$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_my_responder_id() 
RETURNS UUID AS $func$
  SELECT responder_id FROM responders WHERE auth_uid = auth.uid() ORDER BY checkin_datetime DESC LIMIT 1;
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_leader_of_team(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM teams WHERE team_id = _team_id AND leader_responder_id = get_my_responder_id());
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_member_of_team(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM team_responders WHERE team_id = _team_id AND responder_id = get_my_responder_id());
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_member_of_assignment(_assignment_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    -- Check live assignment membership
    SELECT 1 FROM assignments a
    JOIN team_responders tr ON a.team_id = tr.team_id
    WHERE a.assignment_id = _assignment_id
      AND tr.responder_id = get_my_responder_id()
  ) OR EXISTS (
    -- Check historical assignment membership via snapshot
    SELECT 1 FROM assignments a
    WHERE a.assignment_id = _assignment_id
      AND a.completed_team_snapshot -> 'current_responders' @> jsonb_build_array(jsonb_build_object('responder_id', get_my_responder_id()))
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_leader_of_assignment(_assignment_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    JOIN teams t ON a.team_id = t.team_id
    WHERE a.assignment_id = _assignment_id 
      AND t.leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_leader_of_member(_member_responder_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM team_responders tr
    JOIN teams t ON tr.team_id = t.team_id
    WHERE tr.responder_id = _member_responder_id 
      AND t.leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_incident_active(_incident_id TEXT)
RETURNS BOOLEAN AS $func$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM incidents 
    WHERE incident_id = _incident_id AND end_datetime IS NULL
  );
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_active_op_period(_op_period_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id
    WHERE op.op_period_id = _op_period_id AND i.end_datetime IS NULL
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_team_active(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM teams WHERE team_id = _team_id AND is_active_op_period(op_period_id));
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

-- POLICIES: Incidents
CREATE POLICY "Visible to everyone" ON incidents FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Admins manage incidents" ON incidents FOR ALL TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Allow all authenticated to start an incident" ON incidents FOR INSERT TO authenticated WITH CHECK (TRUE);

-- POLICIES: Operational Periods
CREATE POLICY "Visible to everyone" ON operational_periods FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Admins manage OPs" ON operational_periods FOR ALL TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Allow all authenticated to create OPs" ON operational_periods FOR INSERT TO authenticated WITH CHECK (TRUE);

-- POLICIES: Vehicles
CREATE POLICY "Visible to all authenticated" ON vehicles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins/Staff manage vehicles" ON vehicles FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Responders
CREATE POLICY "View active responders" ON responders FOR SELECT TO authenticated
  USING (auth_uid = auth.uid() OR check_is_operational_staff() OR incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));
CREATE POLICY "Update own record" ON responders FOR UPDATE TO authenticated USING (auth_uid = auth.uid());
CREATE POLICY "Allow authenticated to check in" ON responders FOR INSERT TO authenticated WITH CHECK (auth_uid = auth.uid());
-- Allow Team Leaders to update their members' status
CREATE POLICY "Allow team leaders to update their members" ON responders
  FOR UPDATE TO authenticated
  USING (is_leader_of_member(responder_id) OR check_is_operational_staff())
  WITH CHECK (is_leader_of_member(responder_id) OR check_is_operational_staff());

-- POLICIES: Teams
CREATE POLICY "View active teams" ON teams FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));
CREATE POLICY "Leaders update teams" ON teams FOR UPDATE TO authenticated USING (is_leader_of_team(team_id) OR check_is_operational_staff());
CREATE POLICY "Allow authenticated to create teams" ON teams FOR INSERT TO authenticated WITH CHECK (is_active_op_period(op_period_id));

-- Allow team members to view their own team, regardless of operational period activity status
CREATE POLICY "Allow team members to view their own team" ON teams
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_responders tr WHERE tr.team_id = teams.team_id AND tr.responder_id = get_my_responder_id()));

-- Allow anonymous to update Staff team leader if they are setting themselves as leader (Auto-IC Logic)
CREATE POLICY "Allow anonymous to update Staff team leader" ON teams
  FOR UPDATE TO authenticated
  USING (
    is_anonymous_responder() AND
    type = 'Staff' AND
    (leader_responder_id IS NULL OR EXISTS (SELECT 1 FROM responders r WHERE r.responder_id = leader_responder_id AND r.auth_uid = auth.uid()))
  )
  WITH CHECK (
    is_anonymous_responder() AND
    type = 'Staff' AND
    EXISTS (SELECT 1 FROM responders r WHERE r.responder_id = leader_responder_id AND r.auth_uid = auth.uid())
  );

-- POLICIES: Assignments
CREATE POLICY "View active assignments" ON assignments FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));
CREATE POLICY "Allow authenticated to create assignments" ON assignments FOR INSERT TO authenticated WITH CHECK (is_active_op_period(op_period_id));

-- Allow Team Members to update their assigned assignment status
CREATE POLICY "Allow team members to update their assignment" ON assignments
  FOR UPDATE TO authenticated USING (
    is_member_of_assignment(assignment_id) OR check_is_operational_staff()
  ) WITH CHECK (
    team_id IS NULL OR is_member_of_team(team_id) OR check_is_operational_staff()
  );

-- Allow users to view completed assignments they were a part of via the snapshot
CREATE POLICY "Allow members to view their completed assignments via snapshot" ON assignments
  FOR SELECT TO authenticated
  USING (
    (completed_team_snapshot -> 'current_responders' @> jsonb_build_array(jsonb_build_object('responder_id', get_my_responder_id())))
  );
-- POLICIES: Messaging
CREATE POLICY "View relevant messages" ON team_messages FOR SELECT TO authenticated 
  USING (team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id()) OR check_is_operational_staff());
CREATE POLICY "Allow all authenticated to insert messages to their team or staff" ON team_messages
  FOR INSERT TO authenticated 
  WITH CHECK (
    is_member_of_team(team_id) 
    OR EXISTS (SELECT 1 FROM teams WHERE team_id = team_messages.team_id AND type = 'Staff') 
    OR check_is_operational_staff()
  );
CREATE POLICY "Admins/Staff can manage all team messages" ON team_messages
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- POLICIES: Action Logs
CREATE POLICY "Visible to relevant responders" ON action_logs FOR SELECT TO authenticated
  USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()) OR check_is_operational_staff());

-- Allow all authenticated to record action logs in active incidents
CREATE POLICY "Allow all authenticated to record action logs in active incidents" ON action_logs
  FOR INSERT TO authenticated 
  WITH CHECK (is_incident_active(incident_id));

-- POLICIES: Users (Staff Only)
-- Allow users to view their own profile, and staff/admins to view all users
CREATE POLICY "Allow authenticated to view own profile" ON users FOR SELECT TO authenticated USING (auth.jwt() ->> 'email' = users.email OR check_is_operational_staff());
CREATE POLICY "Admins can manage all users" ON users FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- POLICIES: Clues
CREATE POLICY "View clues in incident" ON clues 
  FOR SELECT TO authenticated 
  USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));

CREATE POLICY "Allow anonymous to insert clues" ON clues
  FOR INSERT TO authenticated 
  WITH CHECK (is_anonymous_responder());

CREATE POLICY "Allow authenticated to view their own team history" ON responder_team_history
  FOR SELECT TO authenticated 
  USING (responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid()));
CREATE POLICY "Admins/Staff can manage all team history" ON responder_team_history
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- POLICIES: Team Responders (Junction Table)
CREATE POLICY "Allow authenticated to view active team memberships" ON team_responders
  FOR SELECT TO authenticated USING (is_team_active(team_id));
CREATE POLICY "Allow all authenticated to insert memberships in active incidents" ON team_responders
  FOR INSERT TO authenticated WITH CHECK ((responder_id = get_my_responder_id() AND is_team_active(team_id)) OR check_is_operational_staff());
CREATE POLICY "Allow authenticated to update their own membership" ON team_responders
  FOR UPDATE TO authenticated USING (responder_id = get_my_responder_id() OR check_is_operational_staff()) WITH CHECK (responder_id = get_my_responder_id() OR check_is_operational_staff());
CREATE POLICY "Allow authenticated to leave teams" ON team_responders
  FOR DELETE TO authenticated USING (responder_id = get_my_responder_id() OR check_is_operational_staff());
CREATE POLICY "Admins/Staff can manage all team memberships" ON team_responders
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());-- Suppress "does not exist" notices during the cleanup phase
SET client_min_messages TO warning;

-- Ensure a clean slate for checkin_responder_securely to avoid "function name not unique" errors
DROP FUNCTION IF EXISTS checkin_responder_securely(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- Old 12-parameter version (with p_vehicles)
DROP FUNCTION IF EXISTS checkin_responder_securely(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- Current 11-parameter version

-- RPC: Secure Check-in
CREATE OR REPLACE FUNCTION checkin_responder_securely(
  p_incident_id TEXT, p_auth_uid UUID, p_name TEXT, p_agency TEXT, p_identifier TEXT,
  p_cell_phone TEXT DEFAULT NULL, p_responder_type TEXT DEFAULT 'SAR',
  p_special_skills TEXT DEFAULT NULL, p_vehicles TEXT DEFAULT NULL,
  p_access_level TEXT DEFAULT 'responder', p_status TEXT DEFAULT 'Staged',
  p_device_id TEXT DEFAULT NULL
)
RETURNS SETOF responders AS $func$
DECLARE
    _responder_record responders;
    _team_id UUID;
    _v_text TEXT;
BEGIN
  -- Guard: Prevent check-in if no incident is selected. This is a server-side
  -- enforcement of the business rule that a responder record must be associated
  -- with a valid, active incident.
  IF p_incident_id IS NULL OR p_incident_id = '' THEN
    RAISE EXCEPTION 'An incident must be selected to complete the check-in process.';
  END IF;
  -- Resolve elevated status persistence
  IF p_access_level = 'responder' THEN
    SELECT access_level INTO p_access_level 
    FROM responders 
    WHERE device_id = p_device_id OR (auth_uid = p_auth_uid AND auth_uid IS NOT NULL) 
    LIMIT 1;
    p_access_level := COALESCE(p_access_level, 'responder');
  END IF;

  INSERT INTO responders (
    incident_id, auth_uid, name, agency, identifier, cell_phone, responder_type,
    special_skills, access_level, status, device_id, checkin_datetime
  )
  VALUES (
    p_incident_id, p_auth_uid, p_name, p_agency, p_identifier, p_cell_phone, 
    p_responder_type::responder_type, p_special_skills,
    p_access_level::access_level, p_status::responder_status, 
    COALESCE(p_device_id, 'web_' || p_auth_uid || '_' || p_incident_id),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (device_id) DO UPDATE SET
    incident_id = EXCLUDED.incident_id, name = EXCLUDED.name, agency = EXCLUDED.agency,
    identifier = EXCLUDED.identifier, cell_phone = EXCLUDED.cell_phone, 
    auth_uid = EXCLUDED.auth_uid, access_level = EXCLUDED.access_level, 
    checkin_datetime = EXCLUDED.checkin_datetime,
    updated_at = CURRENT_TIMESTAMP
  RETURNING * INTO _responder_record;

  -- Determine if this responder is already attached to an active team
  -- (This ensures vehicles follow the driver if they are already assigned)
  SELECT tr.team_id INTO _team_id
  FROM team_responders tr
  JOIN teams t ON tr.team_id = t.team_id
  WHERE tr.responder_id = _responder_record.responder_id
    AND t.status != 'Disbanded'
  LIMIT 1;

  -- Handle vehicles list if provided (Tactical resource creation, dissociated from responder)
  IF p_vehicles IS NOT NULL AND p_vehicles <> '' THEN
    FOR _v_text IN SELECT trim(s) FROM unnest(string_to_array(p_vehicles, ',')) s LOOP
      IF _v_text <> '' THEN
        INSERT INTO vehicles (incident_id, responder_id, designation, checkin_datetime, status, team_id)
        VALUES (p_incident_id, _responder_record.responder_id, _v_text, CURRENT_TIMESTAMP, 
                CASE WHEN _team_id IS NOT NULL THEN 'Attached'::responder_status ELSE p_status::responder_status END, 
                _team_id)
        ON CONFLICT (incident_id, designation) DO UPDATE SET 
          responder_id = EXCLUDED.responder_id,
          team_id = COALESCE(vehicles.team_id, EXCLUDED.team_id),
          status = CASE 
            WHEN vehicles.team_id IS NULL AND EXCLUDED.team_id IS NULL THEN EXCLUDED.status 
            ELSE vehicles.status 
          END,
          checkout_datetime = NULL,
          updated_at = CURRENT_TIMESTAMP;
      END IF;
    END LOOP;
  END IF;

  RETURN NEXT _responder_record;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure a clean slate for User Management RPCs to avoid "function name not unique"
-- errors during GRANTs caused by previous signature changes.
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- 10 params
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- 11 params
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- Old 12-parameter version

-- RPC: User Management
CREATE OR REPLACE FUNCTION admin_add_user(
  p_email TEXT, p_username TEXT, p_password TEXT, p_access_level TEXT,
  p_name TEXT DEFAULT NULL, p_agency TEXT DEFAULT NULL, p_identifier TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL, p_type TEXT DEFAULT NULL, p_skills TEXT DEFAULT NULL, p_vehicles TEXT DEFAULT NULL,
  p_display_density TEXT DEFAULT 'comfortable'
)
RETURNS VOID AS $func$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))) THEN
    UPDATE users SET
      username = p_username,
      password = CASE WHEN p_password IS NOT NULL AND TRIM(p_password) <> '' THEN crypt(p_password, gen_salt('bf')) ELSE password END, -- Only update if provided
      access_level = p_access_level::access_level,
      name = p_name,
      agency = p_agency,
      identifier = p_identifier,
      cell_phone = p_phone,
      responder_type = CASE WHEN p_type IS NOT NULL AND p_type <> '' THEN p_type::responder_type ELSE NULL END,
      special_skills = p_skills,
      vehicles = p_vehicles,
      display_density = p_display_density::display_density
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));
  ELSE
    INSERT INTO users (
      email, username, password, access_level, name, agency, identifier,
      cell_phone, responder_type, special_skills, vehicles, display_density
    )
    VALUES (
      LOWER(TRIM(p_email)), p_username, crypt(p_password, gen_salt('bf')), p_access_level::access_level,
      p_name, p_agency, p_identifier, p_phone,
      CASE WHEN p_type IS NOT NULL AND p_type <> '' THEN p_type::responder_type ELSE NULL END,
      p_skills, p_vehicles, p_display_density::display_density
    );
  END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Remove User
CREATE OR REPLACE FUNCTION admin_remove_user(p_email TEXT)
RETURNS VOID AS $func$
BEGIN
  DELETE FROM users WHERE email = LOWER(p_email);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Update User Password
CREATE OR REPLACE FUNCTION admin_update_password(p_email TEXT, p_password TEXT)
RETURNS VOID AS $func$
BEGIN
  UPDATE users SET password = crypt(p_password, gen_salt('bf')) WHERE email = LOWER(p_email);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Login Verification
CREATE OR REPLACE FUNCTION verify_user_login(p_email TEXT, p_password TEXT)
RETURNS SETOF users AS $func$
BEGIN
  RETURN QUERY SELECT *
  FROM users
  WHERE email = LOWER(p_email) AND (password = p_password OR password = crypt(p_password, password));
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- GRANTS
GRANT EXECUTE ON FUNCTION verify_user_login(TEXT, TEXT) TO anon, authenticated; -- Existing grant
GRANT EXECUTE ON FUNCTION checkin_responder_securely(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated; -- Updated signature (re-added vehicles)
GRANT EXECUTE ON FUNCTION admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated; -- Updated grant
GRANT EXECUTE ON FUNCTION admin_remove_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION start_next_operational_period(TEXT, UUID) TO authenticated;

-- Restore default message level for function creation and grants
RESET client_min_messages;-- ============================================================================
-- INITIAL DATA SEEDING (FOR DEVELOPMENT/FIRST-TIME SETUP)
-- ============================================================================
INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills) 
VALUES (
  'admin@gmail.com', 
  'admin@gmail.com', 
  crypt('password', gen_salt('bf')), 
  'admin', 
  'Steve Admin', 
  'SAROps', 
  'SL-001', 
  '303-555-1234', 
  'SAR', 
  ''
) ON CONFLICT (email) DO NOTHING;
INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills) 
VALUES (
  'staff@gmail.com', 
  'staff@gmail.com', 
  crypt('password', gen_salt('bf')), 
  'staff', 
  'Steve Staff', 
  'SAROps', 
  'SL-002', 
  '303-555-1234', 
  'SAR', 
  ''
) ON CONFLICT (email) DO NOTHING;
INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills) 
VALUES (
  'responder@gmail.com', 
  'responder@gmail.com', 
  crypt('password', gen_salt('bf')), 
  'responder', 
  'Steve Responder', 
  'SAROps', 
  'SL-003', 
  '303-555-1234', 
  'SAR', 
  'Swiftwater Rescue, Paramedic'
) ON CONFLICT (email) DO NOTHING;-- RPC to completely reinitialize the database schema.
-- This matches the administrative reset logic found in sarops-schema.sql.
CREATE OR REPLACE FUNCTION reinitialize_database()
RETURNS VOID AS $$
BEGIN
    -- Backup users to retain entries during re-initialization
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE TEMP TABLE users_temp_backup AS SELECT * FROM users;
    END IF;

    -- Logic to drop and recreate the schema is usually handled by reinit-db.sh 
    -- calling the combined SQL, but this function provides an in-database trigger.
    -- For modularity, we use this space to house the user restoration logic.

    IF EXISTS (SELECT FROM pg_class WHERE relname = 'users_temp_backup') THEN
        INSERT INTO users SELECT * FROM users_temp_backup ON CONFLICT (email) DO NOTHING;
        DROP TABLE users_temp_backup;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reinitialize_database TO authenticated;-- /db/12_new_logic.sql
-- This file implements the one-to-many relationship between Teams and Assignments.

-- 1. Drop the old trigger that enforces a 1:1 status sync.
-- This logic is now replaced by an aggregate status calculation.
DROP TRIGGER IF EXISTS trigger_sync_team_status_from_assignment ON public.assignments;

-- 2. A team may be linked to any number of assignments (e.g. a queue of
-- Planned/Assigned tasks), but at most one of those assignments may be
-- Deployed at a time -- a team can only be actively executing one task.
-- This is a partial unique index (not a plain UNIQUE on team_id) so many
-- non-Deployed assignments can still share a team_id freely.
DROP INDEX IF EXISTS public.one_deployed_assignment_per_team;
CREATE UNIQUE INDEX one_deployed_assignment_per_team
ON public.assignments (team_id)
WHERE status = 'Deployed' AND team_id IS NOT NULL;

-- 3. Create a function to calculate and update a team's aggregate status based on its assignments.
CREATE OR REPLACE FUNCTION public.update_team_status_from_assignments(_team_id UUID)
RETURNS void AS $$
DECLARE
    _new_status public.team_status;
BEGIN
    IF _team_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        CASE
            WHEN EXISTS (SELECT 1 FROM public.assignments WHERE team_id = _team_id AND status = 'Deployed') THEN 'Deployed'::public.team_status
            WHEN EXISTS (SELECT 1 FROM public.assignments WHERE team_id = _team_id AND status = 'Assigned') THEN 'Assigned'::public.team_status
            ELSE 'Staged'::public.team_status
        END
    INTO _new_status;

    UPDATE public.teams
    SET status = _new_status
    WHERE team_id = _team_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a trigger to call the status update function whenever an assignment changes.
CREATE OR REPLACE FUNCTION public.handle_assignment_change_for_team_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When an assignment is created, updated, or deleted, we need to recalculate
    -- the status for both the old team (if it exists) and the new team (if it exists).
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.update_team_status_from_assignments(OLD.team_id);
    ELSIF (TG_OP = 'INSERT') THEN
        PERFORM public.update_team_status_from_assignments(NEW.team_id);
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If team assignment changed or status changed
        IF OLD.team_id IS DISTINCT FROM NEW.team_id OR OLD.status IS DISTINCT FROM NEW.status THEN
            PERFORM public.update_team_status_from_assignments(OLD.team_id);
            PERFORM public.update_team_status_from_assignments(NEW.team_id);
        END IF;
    END IF;
    RETURN NULL; -- The result is ignored since this is an AFTER trigger
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_team_status_on_assignment_change
AFTER INSERT OR UPDATE OR DELETE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.handle_assignment_change_for_team_status();

-- 5. Create a trigger to unassign a team from all assignments when it is disbanded.
CREATE OR REPLACE FUNCTION public.unassign_team_on_disband()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Disbanded' AND OLD.status != 'Disbanded' THEN
        UPDATE public.assignments
        SET team_id = NULL
        WHERE team_id = NEW.team_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_unassign_on_disband
AFTER UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.unassign_team_on_disband();

-- Drop the old signature (p_equipment was TEXT[]) to avoid "function name not
-- unique" ambiguity now that it has been changed to JSONB to match teams.equipment.
DROP FUNCTION IF EXISTS create_team_with_resources(UUID, TEXT, TEXT, public.team_type, UUID, TEXT[], TEXT, UUID[], JSONB, UUID[]);

-- This function atomically creates a team and attaches its resources
-- to prevent race conditions inherent in a client-side "read-modify-write" pattern.
CREATE OR REPLACE FUNCTION create_team_with_resources(
    p_op_period_id UUID,
    p_incident_id TEXT,
    p_team_name_number TEXT,
    p_type public.team_type,
    p_leader_responder_id UUID,
    p_equipment JSONB,
    p_sartopo_color_hex TEXT,
    p_responder_ids UUID[],
    p_responder_roles JSONB,
    p_vehicle_ids UUID[]
)
RETURNS teams AS $$
DECLARE
    _new_team teams;
    _existing_team_id UUID;
    current_responder_id UUID;
    new_role TEXT;
BEGIN
    -- 1. Uniqueness Check (within the entire incident)
    SELECT t.team_id INTO _existing_team_id
    FROM teams t
    JOIN operational_periods op ON t.op_period_id = op.op_period_id
    WHERE op.incident_id = p_incident_id AND t.team_name_number = p_team_name_number;

    IF _existing_team_id IS NOT NULL THEN
        RAISE EXCEPTION 'A team named "%" already exists in this incident.', p_team_name_number;
    END IF;

    -- 2. Insert the new team
    INSERT INTO teams (op_period_id, team_name_number, type, leader_responder_id, equipment, sartopo_color_hex, status)
    VALUES (p_op_period_id, p_team_name_number, p_type, p_leader_responder_id, p_equipment, p_sartopo_color_hex, 'Staged')
    RETURNING * INTO _new_team;

    -- 3. Attach vehicles
    IF array_length(p_vehicle_ids, 1) > 0 THEN
        UPDATE vehicles SET team_id = _new_team.team_id, status = 'Attached' WHERE vehicle_id = ANY(p_vehicle_ids);
    END IF;

    RETURN _new_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_team_with_resources(UUID, TEXT, TEXT, public.team_type, UUID, JSONB, TEXT, UUID[], JSONB, UUID[]) TO authenticated;

-- This function reconciles a team's membership and vehicle assignments to match
-- a desired list. It is called by teamService.js's updateTeam() whenever a team
-- is edited (e.g. adding a new member).
--
-- NOTE: This function previously existed only as an ad-hoc addition directly on
-- the remote database and was never checked into these schema files. Its DELETE
-- treated p_responder_ids as the complete desired roster, but the client
-- (TeamFormModal.jsx) always excludes the team leader/IC from that list, since
-- the leader is tracked separately via teams.leader_responder_id. The result:
-- every reconciliation deleted the leader's own team_responders row, which is
-- why the Incident Commander disappeared from the ICS chart as soon as a second
-- member was added. The fix is to always preserve the current leader's row,
-- regardless of whether they appear in p_responder_ids.
CREATE OR REPLACE FUNCTION reconcile_team_resources(
    p_team_id UUID,
    p_responder_ids UUID[],
    p_responder_roles JSONB,
    p_vehicle_ids UUID[]
)
RETURNS void AS $$
DECLARE
    current_responder_id UUID;
    new_role TEXT;
    _leader_id UUID;
BEGIN
    SELECT leader_responder_id INTO _leader_id FROM teams WHERE team_id = p_team_id;

    -- 1. Reconcile Responders
    -- Remove responders who are no longer on the team, but never the team leader/IC.
    DELETE FROM team_responders
    WHERE team_id = p_team_id
      AND responder_id NOT IN (SELECT unnest(p_responder_ids))
      AND responder_id IS DISTINCT FROM _leader_id;

    -- Upsert current members to add new ones or update roles
    FOREACH current_responder_id IN ARRAY p_responder_ids
    LOOP
        new_role := p_responder_roles->>current_responder_id::TEXT;
        INSERT INTO team_responders (team_id, responder_id, role)
        VALUES (p_team_id, current_responder_id, new_role)
        ON CONFLICT (team_id, responder_id) DO UPDATE
        SET role = EXCLUDED.role;
    END LOOP;

    -- 2. Reconcile Vehicles
    -- Detach vehicles that are no longer assigned to this team
    UPDATE vehicles SET team_id = NULL WHERE team_id = p_team_id AND vehicle_id NOT IN (SELECT unnest(p_vehicle_ids));
    -- Attach new vehicles to this team
    UPDATE vehicles SET team_id = p_team_id WHERE vehicle_id = ANY(p_vehicle_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION reconcile_team_resources(UUID, UUID[], JSONB, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reconcile_team_resources(UUID, UUID[], JSONB, UUID[]) TO authenticated;
-- /db/13_assignment_logic.sql

-- This function atomically creates an assignment, generating a sequential name
-- if one is not provided. This prevents race conditions inherent in a
-- client-side "read-modify-write" pattern for name generation.
CREATE OR REPLACE FUNCTION create_assignment_atomic(
    p_op_period_id UUID,
    p_incident_id TEXT,
    p_title TEXT,
    p_segment TEXT,
    p_resource_type TEXT,
    p_team_size INT,
    p_frequency_primary TEXT,
    p_description TEXT,
    p_priority TEXT,
    p_transportation TEXT,
    p_time_allocated TEXT,
    p_hazards TEXT,
    p_prepared_by TEXT
)
RETURNS assignments AS $$
DECLARE
    _final_title TEXT;
    _used_suffixes TEXT[];
    _next_suffix CHAR(1);
    _new_assignment assignments;
BEGIN
    IF p_title IS NOT NULL AND p_title <> '' THEN
        _final_title := p_title;
        -- Uniqueness check
        IF EXISTS (
            SELECT 1 FROM assignments a
            JOIN operational_periods op ON a.op_period_id = op.op_period_id
            WHERE op.incident_id = p_incident_id AND a.title = _final_title
        ) THEN
            RAISE EXCEPTION 'An assignment named "%" already exists in this incident.', _final_title;
        END IF;
    ELSE
        -- Logic to generate the next available name
        SELECT array_agg(SUBSTRING(title FROM (LENGTH(p_segment) + 1) FOR 1))
        INTO _used_suffixes
        FROM assignments
        WHERE op_period_id = p_op_period_id AND segment = p_segment AND title ~ ('^' || p_segment || '[A-Z]$');

        _used_suffixes := COALESCE(_used_suffixes, '{}');

        _next_suffix := (SELECT chr(s.i) FROM generate_series(65, 90) AS s(i) WHERE chr(s.i) <> ALL(_used_suffixes) ORDER BY s.i LIMIT 1);
        _final_title := p_segment || COALESCE(_next_suffix, 'A');
    END IF;

    -- Insert the new assignment
    INSERT INTO assignments (op_period_id, title, segment, resource_type, team_size, frequency_primary, description, priority, transportation, time_allocated, hazards, prepared_by, status, origin)
    VALUES (p_op_period_id, _final_title, p_segment, p_resource_type, p_team_size, p_frequency_primary, p_description, p_priority, p_transportation, p_time_allocated, p_hazards, p_prepared_by, 'Planned', 'SAROps')
    RETURNING * INTO _new_assignment;

    RETURN _new_assignment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_assignment_atomic(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;CREATE OR REPLACE FUNCTION public.seed_data_specific()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions to bypass RLS for development seeding
AS $$
DECLARE
    latest_incident_id TEXT;
    latest_op_id UUID;
    incident_start_time TIMESTAMP WITH TIME ZONE;
    assigned_responder_auth_uid UUID;
BEGIN
    -- 1. Identify the most recently created incident and operational period
    SELECT incident_id, start_datetime INTO latest_incident_id, incident_start_time
    FROM incidents
    ORDER BY created_at DESC
    LIMIT 1;

    -- 1a. Fallback: Create a default incident and OP if none exist
    IF latest_incident_id IS NULL THEN
        latest_incident_id := 'DEV-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI');
        incident_start_time := NOW();
        INSERT INTO incidents (incident_id, name, number, start_datetime)
        VALUES (latest_incident_id, 'Development Seed Incident', latest_incident_id, incident_start_time)
        ON CONFLICT (incident_id) DO NOTHING;
    END IF;

    -- Update the latest incident with the specified SARTopo ID
    UPDATE incidents
    SET sartopo_id = 'CVJP9L4', sartopo_sync_enabled = true
    WHERE incident_id = latest_incident_id;

    SELECT op_period_id INTO latest_op_id
    FROM operational_periods
    WHERE incident_id = latest_incident_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF latest_op_id IS NULL THEN
        latest_op_id := gen_random_uuid();
        INSERT INTO operational_periods (op_period_id, incident_id, op_number, start_datetime)
        VALUES (latest_op_id, latest_incident_id, 1, incident_start_time)
        ON CONFLICT (incident_id, op_number) DO NOTHING;
    END IF;

    -- 2. Identify the auth_uid for testing (Current user or latest Assigned responder)
    assigned_responder_auth_uid := auth.uid();

    IF assigned_responder_auth_uid IS NULL THEN
    SELECT auth_uid INTO assigned_responder_auth_uid
    FROM responders
    WHERE status = 'Assigned' AND auth_uid IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
    END IF;

    -- Clean up previous seed data for this incident to ensure idempotency
    DELETE FROM vehicles WHERE incident_id = latest_incident_id AND designation IN ('Rescue 1', 'Rescue 2', 'Rescue 3', 'Snow 1', 'UTV 1');
    DELETE FROM assignments WHERE op_period_id = latest_op_id AND title = 'Medical Standby';
    DELETE FROM responders WHERE incident_id = latest_incident_id AND (
        identifier LIKE 'ID-10%' OR identifier = 'K9-302' OR identifier = 'PILOT-14'
    );

    -- 3. Create 15 assignments with descriptions, types, and TAC channels
    INSERT INTO assignments (op_period_id, title, description, resource_type, frequency_primary, status, origin)
    VALUES
    --(latest_op_id, 'Hasty 1', 'Rapid sweep of primary trail corridor', 'Hasty', 'TAC 1', 'Planned', 'SAROps'),
    --(latest_op_id, 'Hasty 2', 'Rapid sweep of north creek bed', 'Hasty', 'TAC 1', 'Planned', 'SAROps'),
    --(latest_op_id, 'Grid Alpha', 'Thorough grid search of Sector 1', 'Ground', 'TAC 2', 'Planned', 'SAROps'),
    --(latest_op_id, 'Grid Beta', 'Thorough grid search of Sector 2', 'Ground', 'TAC 2', 'Planned', 'SAROps'),
    --(latest_op_id, 'Grid Gamma', 'Thorough grid search of Sector 3', 'Ground', 'TAC 2', 'Planned', 'SAROps'),
    --(latest_op_id, 'K9 Block A', 'Area search of high-probability block A', 'Dog', 'TAC 3', 'Planned', 'SAROps'),
    --(latest_op_id, 'K9 Block B', 'Area search of high-probability block B', 'Dog', 'TAC 3', 'Planned', 'SAROps'),
    --(latest_op_id, 'UAS Recon 1', 'Thermal scan of ridge line and cliffs', 'Other', 'UAV-DATA', 'Planned', 'SAROps'),
    --(latest_op_id, 'Road Patrol North', 'Vehicle patrol of Hwy 40 North', 'Vehicle', 'ROAD-BASE', 'Planned', 'SAROps'),
    --(latest_op_id, 'Road Patrol South', 'Vehicle patrol of Hwy 40 South', 'Vehicle', 'ROAD-BASE', 'Planned', 'SAROps'),
    --(latest_op_id, 'Water Recon', 'Shoreline inspection of reservoir', 'Water', 'MARINE 1', 'Planned', 'SAROps'),
    --(latest_op_id, 'Tracking 1', 'Sign cutting at Last Known Point', 'Tracking', 'TAC 4', 'Planned', 'SAROps'),
    --(latest_op_id, 'Summit Relay', 'Establish radio relay at Peak 10', 'Other', 'TAC 5', 'Planned', 'SAROps'),
    --(latest_op_id, 'LZ Preparation', 'Clear and mark helicopter landing zone Alpha', 'Helicopter', 'AIR-GUARD', 'Planned', 'SAROps'),
    (latest_op_id, 'Medical Standby', 'Medical and logistics support at Base', 'Medical', 'EMS-LINK', 'Planned', 'SAROps');

    -- Add 5 vehicles
    INSERT INTO vehicles (incident_id, designation, type, status, checkin_datetime)
    VALUES
        (latest_incident_id, 'Rescue 1', '4x4', 'Staged', incident_start_time),
        (latest_incident_id, 'Rescue 2', 'Rescue', 'Staged', incident_start_time),
        (latest_incident_id, 'Rescue 3', 'Rescue', 'Staged', incident_start_time),
        (latest_incident_id, 'Snow 1', 'Snowmobile', 'Staged', incident_start_time),
        (latest_incident_id, 'UTV 1', 'UTV', 'Staged', incident_start_time)
    ON CONFLICT (incident_id, designation) DO NOTHING;

    -- 4. Create 31 responders (1 Dog, 1 UAS, 29 general)
    -- All associated with the most recently created incident and sharing the same auth_uid.

    -- Dog Handler
    -- This is idempotent and will not error on subsequent runs
    INSERT INTO responders (name, incident_id, agency, identifier, device_id, special_skills, checkin_datetime, status, auth_uid)
    VALUES (
        'Sarah Miller (K9)',
        latest_incident_id,
        'K9 Search Unit',
        'K9-302',
        'dev_k9_' || latest_incident_id || '_' || substr(md5(random()::text), 1, 4),
        'Air Scent Dog',
        incident_start_time,
        'Staged',
        assigned_responder_auth_uid
    )
    ON CONFLICT (device_id) DO NOTHING;

    -- UAS Pilot
    INSERT INTO responders (name, incident_id, agency, identifier, device_id, special_skills, checkin_datetime, status, auth_uid)
    VALUES (
        'James Chen (UAS)',
        latest_incident_id,
        'UAS Response',
        'PILOT-14',
        'dev_uas_' || latest_incident_id || '_' || substr(md5(random()::text), 1, 4),
        'UAS',
        incident_start_time,
        'Staged',
        assigned_responder_auth_uid
    )
    ON CONFLICT (device_id) DO NOTHING;

    -- 29 General Responders
    FOR i IN 1..29 LOOP
        INSERT INTO responders (name, incident_id, agency, identifier, device_id, checkin_datetime, status, auth_uid)
        VALUES (
            'Responder ' || i,
            latest_incident_id,
            'County SAR',
            'ID-' || (1000 + i),
            'dev_res_' || i || '_' || latest_incident_id || '_' || substr(md5(random()::text), 1, 4),
            incident_start_time,
            'Staged',
            assigned_responder_auth_uid
        )
        ON CONFLICT (device_id) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Success: Seeded 15 assignments, 31 responders, and 5 vehicles for Incident % (OP %).', latest_incident_id, latest_op_id;
END;
$$;

-- Grant access to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.seed_data_specific() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_data_specific() TO anon;-- SAROps Data Reset Script
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