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
  'SAR', 'Fire', 'Law', 'Medical'
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
  incident_id TEXT PRIMARY KEY,
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
  special_skills TEXT,
  vehicles TEXT,
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
  designation TEXT NOT NULL,
  type TEXT,
  team_id UUID REFERENCES teams(team_id) ON DELETE SET NULL,
  status responder_status NOT NULL DEFAULT 'Staged',
  checkin_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  checkout_datetime TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT vehicle_incident_designation_unique UNIQUE (incident_id, designation)
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
);-- Secondary Indexes for Operational Periods
CREATE INDEX idx_operational_periods_start_datetime ON operational_periods(start_datetime);

-- Secondary Indexes for Teams
CREATE INDEX idx_teams_leader_responder_id ON teams(leader_responder_id);
CREATE INDEX idx_teams_status ON teams(status);

-- Secondary Indexes for Assignments
CREATE INDEX idx_assignments_team_id ON assignments(team_id);
CREATE INDEX idx_assignments_status ON assignments(status);

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
FROM incidents i;-- Function to update updated_at timestamp
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
DECLARE
    _team_id UUID;
BEGIN
    INSERT INTO teams (op_period_id, team_name_number, sartopo_color_hex, type, status, last_par_check)
    VALUES (NEW.op_period_id, 'Staff', '#0000FF', 'Staff', 'Deployed', CURRENT_TIMESTAMP)
    ON CONFLICT (op_period_id) WHERE type = 'Staff' AND status != 'Disbanded'
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING team_id INTO _team_id;

    INSERT INTO assignments (op_period_id, title, resource_type, status, team_id)
    VALUES (NEW.op_period_id, 'Command Staff', 'Staff', 'Deployed', _team_id)
    ON CONFLICT (op_period_id, sartopo_id) DO UPDATE SET team_id = EXCLUDED.team_id;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ICS Automation: First Responder IC
CREATE OR REPLACE FUNCTION auto_assign_first_responder_as_ic()
RETURNS TRIGGER AS $func$
DECLARE
    _staff_team_id UUID;
BEGIN
    SELECT t.team_id INTO _staff_team_id FROM teams t
    JOIN operational_periods op ON t.op_period_id = op.op_period_id
    WHERE op.incident_id = NEW.incident_id AND t.type = 'Staff' AND t.leader_responder_id IS NULL
    ORDER BY op.op_number ASC LIMIT 1;

    IF _staff_team_id IS NOT NULL THEN
        INSERT INTO team_responders (team_id, responder_id, role)
        VALUES (_staff_team_id, NEW.responder_id, 'Incident Commander') ON CONFLICT DO NOTHING;

        UPDATE teams SET leader_responder_id = NEW.responder_id WHERE team_id = _staff_team_id;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Status Synchronization: Responder Access and State
CREATE OR REPLACE FUNCTION sync_responder_access_level()
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
    WHERE tr.responder_id = _responder_id AND t.status != 'Disbanded' LIMIT 1;

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

    _target_assignment_status := CASE
        WHEN NEW.status = 'Assigned' THEN 'Assigned'::assignment_status
        WHEN NEW.status = 'Deployed' THEN 'Deployed'::assignment_status
        ELSE NULL
    END;

    IF _target_assignment_status IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE assignments
        SET status = _target_assignment_status
        WHERE team_id = NEW.team_id AND status IS DISTINCT FROM _target_assignment_status;
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
CREATE TRIGGER trigger_sync_team_status_from_assignment AFTER INSERT OR UPDATE OF status ON assignments FOR EACH ROW EXECUTE FUNCTION sync_team_status_on_assignment_update();

-- Status Synchronization
CREATE TRIGGER trigger_sync_vehicle_status_on_team_link BEFORE UPDATE OF team_id ON vehicles FOR EACH ROW EXECUTE FUNCTION sync_vehicle_status_on_team_link();
CREATE TRIGGER sync_team_status_on_team_update AFTER INSERT OR UPDATE OF status ON teams FOR EACH ROW EXECUTE FUNCTION sync_team_members_on_status_change();
CREATE TRIGGER sync_responder_status_on_responder_update AFTER INSERT OR UPDATE OF auth_uid, incident_id ON responders FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();
CREATE TRIGGER sync_access_level_on_team_responders AFTER INSERT OR UPDATE OR DELETE ON team_responders FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();

-- Lifecycle Cleanup
CREATE TRIGGER trigger_incident_cleanup_on_end AFTER UPDATE OF end_datetime ON incidents FOR EACH ROW EXECUTE FUNCTION cleanup_resources_on_incident_end();

-- Membership Validation
CREATE TRIGGER trigger_check_responder_membership
BEFORE INSERT OR UPDATE ON team_responders FOR EACH ROW EXECUTE FUNCTION validate_responder_active_membership();

CREATE TRIGGER trigger_check_team_activation
BEFORE UPDATE OF status ON teams FOR EACH ROW EXECUTE FUNCTION validate_team_activation();

CREATE TRIGGER trigger_check_team_leader_membership
BEFORE INSERT OR UPDATE OF leader_responder_id ON teams FOR EACH ROW EXECUTE FUNCTION validate_team_leader_membership();-- Enable RLS on all tables
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

-- RLS HELPERS
CREATE OR REPLACE FUNCTION is_anonymous_responder()
RETURNS BOOLEAN AS $func$
  SELECT (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE;
$func$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION check_is_operational_staff()
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 WHERE (auth.jwt() ->> 'access_level') IN ('staff', 'admin')
    UNION ALL
    SELECT 1 FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND access_level IN ('staff', 'admin')
    UNION ALL
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
    SELECT 1 FROM assignments a
    JOIN team_responders tr ON a.team_id = tr.team_id
    WHERE a.assignment_id = _assignment_id 
      AND tr.responder_id = get_my_responder_id()
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
  SELECT EXISTS (SELECT 1 FROM incidents WHERE incident_id = _incident_id AND end_datetime IS NULL);
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

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
CREATE POLICY "Visible to all authenticated" ON incidents FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage incidents" ON incidents FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Vehicles
CREATE POLICY "Visible to all authenticated" ON vehicles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins/Staff manage vehicles" ON vehicles FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Responders
CREATE POLICY "View active responders" ON responders FOR SELECT TO authenticated
  USING (auth_uid = auth.uid() OR check_is_operational_staff() OR incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));
CREATE POLICY "Update own record" ON responders FOR UPDATE TO authenticated USING (auth_uid = auth.uid());

-- POLICIES: Teams
CREATE POLICY "View active teams" ON teams FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));
CREATE POLICY "Leaders update teams" ON teams FOR UPDATE TO authenticated USING (is_leader_of_team(team_id) OR check_is_operational_staff());

-- POLICIES: Assignments
CREATE POLICY "View active assignments" ON assignments FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));

-- POLICIES: Messaging
CREATE POLICY "View relevant messages" ON team_messages FOR SELECT TO authenticated 
  USING (team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id()) OR check_is_operational_staff());

-- POLICIES: Users (Staff Only)
CREATE POLICY "Staff view users" ON users FOR SELECT TO authenticated USING (check_is_operational_staff());

-- POLICIES: Clues
CREATE POLICY "View clues in incident" ON clues FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));-- RPC: Secure Check-in
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
  INSERT INTO responders (
    incident_id, auth_uid, name, agency, identifier, cell_phone, responder_type, 
    special_skills, vehicles, access_level, status, device_id, checkin_datetime
  )
  VALUES (
    p_incident_id, p_auth_uid, p_name, p_agency, p_identifier, p_cell_phone, 
    p_responder_type::responder_type, p_special_skills, p_vehicles,
    p_access_level::access_level, p_status::responder_status, 
    COALESCE(p_device_id, 'web_' || p_auth_uid || '_' || p_incident_id),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (device_id) DO UPDATE SET
    incident_id = EXCLUDED.incident_id, name = EXCLUDED.name, agency = EXCLUDED.agency,
    identifier = EXCLUDED.identifier, cell_phone = EXCLUDED.cell_phone, 
    auth_uid = EXCLUDED.auth_uid, checkin_datetime = EXCLUDED.checkin_datetime,
    updated_at = CURRENT_TIMESTAMP
  RETURNING * INTO _responder_record;

  -- Determine if this responder is already attached to an active team (to link vehicles)
  SELECT tr.team_id INTO _team_id
  FROM team_responders tr
  JOIN teams t ON tr.team_id = t.team_id
  WHERE tr.responder_id = _responder_record.responder_id
    AND t.status != 'Disbanded'
  LIMIT 1;

  -- Handle vehicles list if provided
  IF p_vehicles IS NOT NULL AND p_vehicles <> '' THEN
    FOR _v_text IN SELECT trim(s) FROM unnest(string_to_array(p_vehicles, ',')) s LOOP
      IF _v_text <> '' THEN
        INSERT INTO vehicles (incident_id, designation, checkin_datetime, status, team_id)
        VALUES (p_incident_id, _v_text, CURRENT_TIMESTAMP,
                _responder_record.status, 
                _team_id)
        ON CONFLICT (incident_id, designation) DO UPDATE SET 
          team_id = COALESCE(vehicles.team_id, EXCLUDED.team_id),
          status = EXCLUDED.status,
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
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- RPC: User Management
CREATE OR REPLACE FUNCTION admin_add_user(
  p_email TEXT, p_username TEXT, p_password TEXT, p_access_level TEXT,
  p_name TEXT DEFAULT NULL, p_agency TEXT DEFAULT NULL, p_identifier TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL, p_type TEXT DEFAULT NULL, p_skills TEXT DEFAULT NULL,
  p_display_density TEXT DEFAULT 'comfortable',
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
      display_density = p_display_density::display_density
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));
  ELSE
    INSERT INTO users (
      email, username, password, access_level, name, agency, identifier, 
      cell_phone, responder_type, special_skills, display_density
    )
    VALUES (
      LOWER(TRIM(p_email)), p_username, crypt(p_password, gen_salt('bf')), p_access_level::access_level, 
      p_name, p_agency, p_identifier, p_phone,
      CASE WHEN p_type IS NOT NULL AND p_type <> '' THEN p_type::responder_type ELSE NULL END,
      p_skills, p_display_density::display_density
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
  RETURN QUERY SELECT * FROM users
  WHERE email = LOWER(p_email) AND (password = p_password OR password = crypt(p_password, password));
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- GRANTS
GRANT EXECUTE ON FUNCTION verify_user_login(TEXT, TEXT) TO anon, authenticated; -- Existing grant
GRANT EXECUTE ON FUNCTION checkin_responder_securely(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated; -- Existing grant
GRANT EXECUTE ON FUNCTION admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated; -- Updated grant
GRANT EXECUTE ON FUNCTION admin_remove_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_password TO authenticated;-- ============================================================================
-- INITIAL DATA SEEDING (FOR DEVELOPMENT/FIRST-TIME SETUP)
-- ============================================================================
INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills) 
VALUES (
  'admin@gmail.com', 
  'admin@gmail.com', 
  crypt('grigware', gen_salt('bf')), 
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
  crypt('grigware', gen_salt('bf')), 
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
  crypt('grigware', gen_salt('bf')), 
  'responder', 
  'Steve Responder', 
  'SAROps', 
  'SL-003', 
  '303-555-1234', 
  'SAR', 
  'Swiftwater Rescue, Paramedic'
) ON CONFLICT (email) DO NOTHING;