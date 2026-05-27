-- SAROps PostgreSQL Schema for Supabase
-- Generated from sarops-types.d.ts

-- Enable pgcrypto for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DROP TYPE IF EXISTS assignment_status CASCADE;
CREATE TYPE assignment_status AS ENUM (
  'Planned',
  'Assigned',
  'Deployed',
  'Completed',
  'Incomplete'
);

DROP TYPE IF EXISTS assignment_origin CASCADE;
CREATE TYPE assignment_origin AS ENUM (
  'SAROps',
  'SARTopo'
);

DROP TYPE IF EXISTS team_status CASCADE;
CREATE TYPE team_status AS ENUM (
  'Staged',
  'Assigned',
  'Deployed',
  'Disbanded'
);

DROP TYPE IF EXISTS team_type CASCADE;
CREATE TYPE team_type AS ENUM (
  'Hasty',
  'Ground',
  'Vehicle',
  'UAS',
  'Water',
  'Tracking',
  'Dog',
  'Avalanche',
  'Transport',
  'Helicopter',
  'Medical',
  'Staff',
  'Other'
);

DROP TYPE IF EXISTS responder_status CASCADE;
CREATE TYPE responder_status AS ENUM (
  'Staged',
  'Attached',
  'Assigned',
  'Deployed',
  'CheckedOut'
);

DROP TYPE IF EXISTS responder_type CASCADE;
CREATE TYPE responder_type AS ENUM (
  'SAR',
  'Fire',
  'Law',
  'Medical'
);

DROP TYPE IF EXISTS access_level CASCADE;
CREATE TYPE access_level AS ENUM (
  'responder',
  'staff',
  'admin'
);

-- ============================================================================
-- TABLES
-- ============================================================================

DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS responders CASCADE;
DROP TABLE IF EXISTS operational_periods CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS responder_team_history CASCADE;
DROP TABLE IF EXISTS clues CASCADE;
DROP TABLE IF EXISTS team_responders CASCADE;
DROP TABLE IF EXISTS action_logs CASCADE;
DROP TABLE IF EXISTS team_messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP VIEW IF EXISTS team_current_responders CASCADE;
DROP VIEW IF EXISTS incident_summary CASCADE;

-- Table: incidents
-- Root entity for a search and rescue incident
CREATE TABLE incidents (
  incident_id TEXT PRIMARY KEY, -- Primary key based on the incident number
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  sartopo_id TEXT,
  notes TEXT,
  show_map BOOLEAN DEFAULT FALSE,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: responders
-- Individual search and rescue personnel
CREATE TABLE responders (
  responder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  agency TEXT NOT NULL,
  auth_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to Supabase Auth user
  identifier TEXT NOT NULL,
  cell_phone TEXT,
  device_id TEXT NOT NULL,
  special_skills TEXT,
  checkin_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  checkout_datetime TIMESTAMP WITH TIME ZONE,
  access_level access_level NOT NULL DEFAULT 'responder',
  responder_type responder_type,
  status responder_status NOT NULL DEFAULT 'Staged',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT responder_device_unique UNIQUE (device_id),
  CONSTRAINT check_checkout_date_presence CHECK (status != 'CheckedOut' OR checkout_datetime IS NOT NULL)
);

-- Table: operational_periods
-- Time-based operational divisions within an incident
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
);

-- Table: teams
-- Search and rescue teams assigned to operational periods
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

-- Ensure only one Staff team per operational period
CREATE UNIQUE INDEX idx_one_staff_per_op 
ON teams (op_period_id) 
WHERE type = 'Staff' AND status != 'Disbanded';

-- Table: assignments
-- Tasks or objectives assigned to teams
CREATE TABLE assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
  sartopo_id TEXT,
  status assignment_status NOT NULL DEFAULT 'Planned',
  -- SARTopo-aligned fields
  segment TEXT,
  resource_type TEXT,
  team_size INTEGER,
  frequency_primary TEXT,
  description TEXT,
  debrief_narrative TEXT,
  probability_of_detection INTEGER,
  -- Additional metadata from SARTopo
  priority TEXT,
  transportation TEXT,
  time_allocated TEXT,
  hazards TEXT,
  prepared_by TEXT,
  title TEXT NOT NULL,
  is_orphaned BOOLEAN NOT NULL DEFAULT FALSE,
  team_id UUID REFERENCES teams(team_id) ON DELETE SET NULL,
  CONSTRAINT check_team_size_positive CHECK (team_size >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  origin assignment_origin NOT NULL DEFAULT 'SAROps',
  CONSTRAINT assignment_sartopo_unique UNIQUE (op_period_id, sartopo_id)
);

-- Table: responder_team_history
-- Audit trail of responder attachments to teams
CREATE TABLE responder_team_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id UUID NOT NULL REFERENCES responders(responder_id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  attached_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  detached_datetime TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT responder_team_history_valid_dates CHECK (detached_datetime IS NULL OR detached_datetime >= attached_datetime)
);

-- Ensure a responder can only be attached to one team at a time in the history log
CREATE UNIQUE INDEX idx_responder_active_team 
ON responder_team_history (responder_id) 
WHERE (detached_datetime IS NULL);

-- Table: clues
-- Evidence and findings discovered during the incident
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

-- ============================================================================
-- JUNCTION TABLES FOR MANY-TO-MANY RELATIONSHIPS
-- ============================================================================

-- Table: team_responders
-- Many-to-many relationship for current responders attached to teams
CREATE TABLE team_responders (
  team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES responders(responder_id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (team_id, responder_id)
);

-- Table: action_logs
-- Audit log of significant actions taken during an incident
CREATE TABLE action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  action TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: team_messages
-- Messaging log between team leaders and incident command
CREATE TABLE team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: users
-- Simple table-based auth for system users (managed via Admin page)
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL, -- Store as crypt(password, gen_salt('bf'))
  access_level access_level NOT NULL DEFAULT 'responder',
  name TEXT,
  agency TEXT,
  identifier TEXT,
  cell_phone TEXT,
  responder_type responder_type,
  special_skills TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_operational_periods_incident_id ON operational_periods(incident_id);
CREATE INDEX idx_operational_periods_start_datetime ON operational_periods(start_datetime);

CREATE INDEX idx_teams_op_period_id ON teams(op_period_id);
CREATE INDEX idx_teams_leader_responder_id ON teams(leader_responder_id);
CREATE INDEX idx_teams_status ON teams(status);

CREATE INDEX idx_assignments_op_period_id ON assignments(op_period_id);
CREATE INDEX idx_assignments_team_id ON assignments(team_id);
CREATE INDEX idx_assignments_status ON assignments(status);

CREATE INDEX idx_responder_team_history_responder_id ON responder_team_history(responder_id);
CREATE INDEX idx_responder_team_history_team_id ON responder_team_history(team_id);

CREATE INDEX idx_clues_incident_id ON clues(incident_id);
CREATE INDEX idx_clues_discovered_by_team_id ON clues(discovered_by_team_id);
CREATE INDEX idx_clues_discovered_by_responder_id ON clues(discovered_by_responder_id);
CREATE INDEX idx_clues_coordinates ON clues(latitude, longitude);

CREATE INDEX idx_responders_status ON responders(status);
CREATE INDEX idx_responders_device_id ON responders(device_id);
CREATE INDEX idx_responders_access_level ON responders(access_level);

CREATE INDEX idx_action_logs_incident_id ON action_logs(incident_id);
CREATE INDEX idx_team_messages_composite ON team_messages(team_id, created_at);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: team_current_responders
-- Denormalized view of teams with their current responders for dashboard use
CREATE OR REPLACE VIEW team_current_responders AS
SELECT
  t.team_id,
  t.op_period_id,
  t.team_name_number,
  t.status,
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
  ) AS responders
FROM teams t;

-- View: incident_summary
-- Summary view for incident dashboard
CREATE OR REPLACE VIEW incident_summary AS
SELECT
  i.incident_id,
  i.name,
  i.number,
  i.start_datetime,
  i.end_datetime,
  (SELECT COUNT(*) FROM operational_periods op WHERE op.incident_id = i.incident_id) as operational_period_count,
  (SELECT COUNT(DISTINCT t.team_id) FROM teams t JOIN operational_periods op ON t.op_period_id = op.op_period_id WHERE op.incident_id = i.incident_id) as team_count,
  (SELECT COUNT(*) FROM responders r WHERE r.incident_id = i.incident_id) as responder_count,
  (SELECT COUNT(*) FROM clues c WHERE c.incident_id = i.incident_id) as clue_count
FROM incidents i;

-- ============================================================================
-- TRIGGERS (Optional - for audit trail and updated_at timestamps)
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Function to automatically create a Staff team for a new operational period.
-- SECURITY DEFINER allows this to bypass RLS during incident initialization.
CREATE OR REPLACE FUNCTION create_staff_team_for_op()
RETURNS TRIGGER AS $func$
DECLARE
    _team_id UUID;
BEGIN
    -- Create the Staff team and capture the ID
    INSERT INTO teams (op_period_id, team_name_number, sartopo_color_hex, type, status, last_par_check)
    VALUES (NEW.op_period_id, 'Staff', '#0000FF', 'Staff', 'Deployed', CURRENT_TIMESTAMP)
    ON CONFLICT DO NOTHING
    RETURNING team_id INTO _team_id;

    -- Automatically create a "Command Staff" assignment and link it to the staff team
    IF _team_id IS NOT NULL THEN
        INSERT INTO assignments (op_period_id, title, resource_type, status, team_id)
        VALUES (NEW.op_period_id, 'Command Staff', 'Staff', 'Deployed', _team_id);
    END IF;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to synchronize responder access level based on team membership and ICS assignments
CREATE OR REPLACE FUNCTION sync_responder_access_level()
RETURNS TRIGGER AS $func$
DECLARE
    _responder_id UUID;
    is_command_staff_team_member BOOLEAN;
    target_access_level access_level;
    staff_team_status team_status;
BEGIN
    -- Determine the responder_id relevant to the trigger event
    IF TG_OP = 'DELETE' THEN
        _responder_id := OLD.responder_id;
    ELSE
        _responder_id := NEW.responder_id;
    END IF;

    -- If no responder_id, nothing to do
    IF _responder_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Check if the responder is a member of any 'Command Staff' team and capture status
    SELECT t.status INTO staff_team_status
    FROM team_responders tr
    JOIN teams t ON tr.team_id = t.team_id
    WHERE tr.responder_id = _responder_id
      AND t.type = 'Staff'
    LIMIT 1;

    is_command_staff_team_member := (staff_team_status IS NOT NULL);

    -- Determine the target access level
    IF is_command_staff_team_member THEN
        target_access_level := 'staff';
    ELSE
        target_access_level := 'responder';
    END IF;

    -- Update the responder's access_level and status if they are different
    -- Ensure staff members are marked as 'Assigned' if their team is 'Assigned'.
    -- Critical: Preserve 'admin' level if it already exists.
    UPDATE responders
    SET access_level = CASE WHEN access_level = 'admin' THEN 'admin'::access_level ELSE target_access_level END,
        status = CASE 
            WHEN is_command_staff_team_member AND staff_team_status = 'Assigned' THEN 'Assigned'::responder_status 
            WHEN is_command_staff_team_member AND staff_team_status = 'Deployed' THEN 'Deployed'::responder_status
            ELSE status 
        END
    WHERE responder_id = _responder_id
      AND (
        (access_level != 'admin' AND access_level IS DISTINCT FROM target_access_level)
        OR (is_command_staff_team_member AND staff_team_status = 'Assigned' AND status IS DISTINCT FROM 'Assigned')
        OR (is_command_staff_team_member AND staff_team_status = 'Deployed' AND status IS DISTINCT FROM 'Deployed')
      );

  RETURN NULL;
END;
$func$ LANGUAGE plpgsql;

-- Function to update responder statuses when a Staff team status changes to Assigned
-- Function to update responder statuses and assignment status when a team status changes
CREATE OR REPLACE FUNCTION sync_team_members_on_status_change()
RETURNS TRIGGER AS $func$
DECLARE
    _target_responder_status responder_status;
    _target_assignment_status assignment_status;
BEGIN
    -- 1. Determine target responder status based on new team status
    _target_responder_status := CASE 
        WHEN NEW.status = 'Staged' THEN 'Attached'::responder_status
        WHEN NEW.status = 'Assigned' THEN 'Assigned'::responder_status
        WHEN NEW.status = 'Deployed' THEN 'Deployed'::responder_status
        WHEN NEW.status = 'Disbanded' THEN 'Staged'::responder_status
        ELSE NULL
    END;

    -- Update responders if status changed or it's a new team
    IF _target_responder_status IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE responders
        SET status = _target_responder_status
        WHERE responder_id IN (
            SELECT responder_id FROM team_responders WHERE team_id = NEW.team_id
        )
        AND status IS DISTINCT FROM _target_responder_status;
    END IF;

    -- 2. Automatically close team history logs on disbandment
    IF NEW.status = 'Disbanded' AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE responder_team_history
        SET detached_datetime = CURRENT_TIMESTAMP
        WHERE team_id = NEW.team_id
          AND detached_datetime IS NULL;
    END IF;

    -- 3. Sync Assignment status if team moves to active state (Bi-directional)
    _target_assignment_status := CASE
        WHEN NEW.status = 'Assigned' THEN 'Assigned'::assignment_status
        WHEN NEW.status = 'Deployed' THEN 'Deployed'::assignment_status
        ELSE NULL
    END;

    IF _target_assignment_status IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE assignments
        SET status = _target_assignment_status
        WHERE team_id = NEW.team_id
          AND status IS DISTINCT FROM _target_assignment_status;
    END IF;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to ensure Staff team always exists for every operational period
CREATE TRIGGER ensure_staff_team_on_new_op
AFTER INSERT ON operational_periods
FOR EACH ROW EXECUTE FUNCTION create_staff_team_for_op();

-- Triggers for updated_at
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operational_periods_updated_at BEFORE UPDATE ON operational_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for status changes on the teams table
-- Trigger for status changes on the teams table (Cascades to members and assignments)
CREATE TRIGGER sync_team_status_on_team_update
AFTER INSERT OR UPDATE OF status ON teams
FOR EACH ROW EXECUTE FUNCTION sync_team_members_on_status_change();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_responders_updated_at BEFORE UPDATE ON responders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clues_updated_at BEFORE UPDATE ON clues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for team_responders changes
CREATE TRIGGER sync_access_level_on_team_responders
AFTER INSERT OR UPDATE OR DELETE ON team_responders
FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();

-- Function to sync team status and PAR timer when assignment status changes
CREATE OR REPLACE FUNCTION sync_team_status_on_assignment_update()
RETURNS TRIGGER AS $func$
DECLARE
    _target_team_status team_status;
BEGIN
    -- Only sync if team_id is present and status changed
    IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        _target_team_status := CASE
            WHEN NEW.status = 'Planned' THEN 'Staged'::team_status
            WHEN NEW.status = 'Assigned' THEN 'Assigned'::team_status
            WHEN NEW.status = 'Deployed' THEN 'Deployed'::team_status
            WHEN NEW.status = 'Completed' OR NEW.status = 'Incomplete' THEN 'Disbanded'::team_status
            ELSE NULL
        END;

        IF _target_team_status IS NOT NULL THEN
            UPDATE teams
            SET status = _target_team_status,
                last_par_check = CASE WHEN _target_team_status = 'Deployed' THEN CURRENT_TIMESTAMP ELSE last_par_check END
            WHERE team_id = NEW.team_id
              AND status IS DISTINCT FROM _target_team_status;
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sync_team_status_from_assignment
AFTER INSERT OR UPDATE OF status ON assignments
FOR EACH ROW EXECUTE FUNCTION sync_team_status_on_assignment_update();

-- Function to perform bulk cleanup when an incident is ended.
-- Automates closure of OPs, cleanup of assignments/teams, and responder checkout.
CREATE OR REPLACE FUNCTION cleanup_resources_on_incident_end()
RETURNS TRIGGER AS $func$
BEGIN
    -- Only run cleanup when end_datetime is set for the first time
    IF NEW.end_datetime IS NOT NULL AND OLD.end_datetime IS NULL THEN
        
        -- 1. Close all active operational periods for this incident
        UPDATE operational_periods
        SET end_datetime = NEW.end_datetime
        WHERE incident_id = NEW.incident_id AND end_datetime IS NULL;

        -- 2. Cleanup Assignments (set Deployed to Incomplete, Assigned to Planned)
        UPDATE assignments
        SET status = 'Incomplete', team_id = NULL
        WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id)
          AND status = 'Deployed';

        UPDATE assignments
        SET status = 'Planned', team_id = NULL
        WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id)
          AND status = 'Assigned';

        -- 3. Disband all teams associated with this incident's OPs
        UPDATE teams
        SET status = 'Disbanded', last_par_check = NULL
        WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id)
          AND status != 'Disbanded';

        -- 4. Check out all responders currently active in this incident
        UPDATE responders
        SET status = 'CheckedOut', checkout_datetime = NEW.end_datetime
        WHERE incident_id = NEW.incident_id AND checkout_datetime IS NULL;

    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_incident_cleanup_on_end
AFTER UPDATE OF end_datetime ON incidents
FOR EACH ROW EXECUTE FUNCTION cleanup_resources_on_incident_end();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all relevant tables
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_team_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an anonymous responder
CREATE OR REPLACE FUNCTION is_anonymous_responder()
RETURNS BOOLEAN AS $func$
  SELECT (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE;
$func$ LANGUAGE sql STABLE;

-- Helper function to check if the current user is an admin or command staff
CREATE OR REPLACE FUNCTION is_admin_or_command_staff()
RETURNS BOOLEAN AS $func$
  SELECT check_is_operational_staff();
$func$ LANGUAGE sql STABLE;

-- Helper to safely get the responder_id for the current session
-- SECURITY DEFINER breaks RLS recursion
CREATE OR REPLACE FUNCTION get_my_responder_id() 
RETURNS UUID AS $func$
  SELECT responder_id FROM responders
  WHERE auth_uid = auth.uid() 
  ORDER BY checkin_datetime DESC LIMIT 1;
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper to check if user is the leader of a specific team
CREATE OR REPLACE FUNCTION is_leader_of_team(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM teams 
    WHERE team_id = _team_id 
      AND leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper to check if user is the leader of the team assigned to an assignment
CREATE OR REPLACE FUNCTION is_leader_of_assignment(_assignment_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    JOIN teams t ON a.team_id = t.team_id
    WHERE a.assignment_id = _assignment_id 
      AND t.leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper to check if user is the leader of a team that a specific responder belongs to
CREATE OR REPLACE FUNCTION is_leader_of_member(_member_responder_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM team_responders tr
    JOIN teams t ON tr.team_id = t.team_id
    WHERE tr.responder_id = _member_responder_id 
      AND t.leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

-- NEW HELPER: Check if user is staff based on their actual Responder record
-- SECURITY DEFINER is required to prevent recursion in RLS
CREATE OR REPLACE FUNCTION check_is_operational_staff() 
RETURNS BOOLEAN AS $func$
BEGIN
  RETURN (
    COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) IS FALSE -- True Admin (Email login)
    OR EXISTS (
      SELECT 1 FROM responders 
      WHERE auth_uid = auth.uid() 
      AND access_level IN ('staff', 'admin')
    )
  );
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper to check if an incident is active
CREATE OR REPLACE FUNCTION is_incident_active(_incident_id TEXT)
RETURNS BOOLEAN AS $func$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM incidents i
    WHERE i.incident_id = _incident_id
      AND i.end_datetime IS NULL
  );
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper to check if an operational period belongs to an active incident
CREATE OR REPLACE FUNCTION is_active_op_period(_op_period_id UUID)
RETURNS BOOLEAN AS $func$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM operational_periods op
    JOIN incidents i ON op.incident_id = i.incident_id
    WHERE op.op_period_id = _op_period_id
      AND i.end_datetime IS NULL
  );
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper to check if a team belongs to an active operational period
CREATE OR REPLACE FUNCTION is_team_active(_team_id UUID)
RETURNS BOOLEAN AS $func$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams t
    WHERE t.team_id = _team_id
      AND is_active_op_period(t.op_period_id)
  );
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- RPC for User Login
CREATE OR REPLACE FUNCTION verify_user_login(p_email TEXT, p_password TEXT)
RETURNS SETOF users AS $func$
BEGIN
  RETURN QUERY
  SELECT * FROM users
  WHERE email = LOWER(p_email) 
    AND (password = p_password OR password = crypt(p_password, password));
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for `incidents`
CREATE POLICY "Allow all authenticated to view active incidents" ON incidents 
  FOR SELECT TO authenticated USING (end_datetime IS NULL);
CREATE POLICY "Admins can manage all incidents" ON incidents 
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());
CREATE POLICY "Allow anonymous to start an incident" ON incidents
  FOR INSERT TO authenticated WITH CHECK (is_anonymous_responder());

-- Policies for `responders`
CREATE POLICY "Allow anonymous to insert their own record" ON responders
  FOR INSERT TO authenticated WITH CHECK (auth_uid = auth.uid());
CREATE POLICY "Allow authenticated to view active responders" ON responders
  FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));
CREATE POLICY "Allow anonymous to update their own record" ON responders
  FOR UPDATE TO authenticated USING (auth_uid = auth.uid()) WITH CHECK (auth_uid = auth.uid());
-- Allow Team Leaders to update their members' status (via helper)
CREATE POLICY "Allow team leaders to update their members" ON responders
  FOR UPDATE TO authenticated
  USING (is_leader_of_member(responder_id) OR check_is_operational_staff())
  WITH CHECK (is_leader_of_member(responder_id) OR check_is_operational_staff());
CREATE POLICY "Admins/Staff can manage all responders" ON responders
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- Policies for `operational_periods`
-- REVISED: Allow any authenticated user to view operational periods if their parent incident is active.
-- This avoids the recursive subquery on 'responders' when fetching incidents and their nested operational periods.
CREATE POLICY "Allow authenticated to view active operational periods" ON operational_periods
  FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));
CREATE POLICY "Admins/Staff can manage all operational periods" ON operational_periods
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());
CREATE POLICY "Allow anonymous to create operational periods" ON operational_periods
  FOR INSERT TO authenticated WITH CHECK (is_anonymous_responder());

-- Policies for `teams`
-- REVISED: Allow any authenticated user to view teams if their parent incident is active.
-- This allows responders to see teams during check-in and breaks recursion.
CREATE POLICY "Allow authenticated to view active teams" ON teams
  FOR SELECT TO authenticated USING (is_active_op_period(op_period_id));
CREATE POLICY "Admins/Staff can manage all teams" ON teams
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());
-- Allow team members to view their own team, regardless of operational period activity status
CREATE POLICY "Allow team members to view their own team" ON teams
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_responders tr WHERE tr.team_id = teams.team_id AND tr.responder_id = get_my_responder_id()));
-- Allow Team Leaders to update their own team's status and last_par_check
CREATE POLICY "Allow team leaders to update their team" ON teams
  FOR UPDATE TO authenticated
  USING (is_leader_of_team(team_id) OR check_is_operational_staff())
  WITH CHECK (is_leader_of_team(team_id) OR check_is_operational_staff());
CREATE POLICY "Allow all authenticated to create teams in active incidents" ON teams
  FOR INSERT TO authenticated 
  WITH CHECK (is_active_op_period(op_period_id));
-- Allow anonymous to update Staff team leader if they are setting themselves as leader
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

-- Policies for `assignments`
-- REVISED: Allow any authenticated user to view assignments if their parent incident is active.
CREATE POLICY "Allow authenticated to view active assignments" ON assignments
  FOR SELECT TO authenticated USING (is_active_op_period(op_period_id));
CREATE POLICY "Admins/Staff can manage all assignments" ON assignments
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());
-- Allow Team Leaders to update their assigned assignment status
CREATE POLICY "Allow team leaders to update their assignment" ON assignments
  FOR UPDATE TO authenticated
  USING (is_leader_of_assignment(assignment_id) OR check_is_operational_staff())
  WITH CHECK (team_id IS NULL OR is_leader_of_team(team_id) OR check_is_operational_staff());
CREATE POLICY "Allow all authenticated to create assignments in active incidents" ON assignments
  FOR INSERT TO authenticated 
  WITH CHECK (is_active_op_period(op_period_id));

-- Policies for `responder_team_history`
CREATE POLICY "Allow authenticated to view their own team history" ON responder_team_history
  FOR SELECT TO authenticated USING (responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid()));

CREATE POLICY "Allow all authenticated to manage memberships in active incidents" ON team_responders
  FOR INSERT TO authenticated
  WITH CHECK (is_team_active(team_id));
CREATE POLICY "Admins/Staff can manage all team history" ON responder_team_history
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- Policies for `clues`
CREATE POLICY "Allow authenticated to view clues in their incident" ON clues
  FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));
CREATE POLICY "Admins/Staff can manage all clues" ON clues
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());
CREATE POLICY "Allow anonymous to insert clues" ON clues
  FOR INSERT TO authenticated WITH CHECK (is_anonymous_responder());

-- Policies for `team_responders` (junction table)
CREATE POLICY "Allow authenticated to view active team memberships" ON team_responders
  FOR SELECT TO authenticated USING (is_team_active(team_id));
CREATE POLICY "Admins/Staff can manage all team memberships" ON team_responders
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- Policies for `action_logs`
CREATE POLICY "Allow authenticated to view action logs in their incident" ON action_logs
  FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));
CREATE POLICY "Admins/Staff can manage all action logs" ON action_logs
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());
CREATE POLICY "Allow all authenticated to record action logs in active incidents" ON action_logs
  FOR INSERT TO authenticated 
  WITH CHECK (is_incident_active(incident_id));

-- Policies for `team_messages`
CREATE POLICY "Allow authenticated to view messages for their team or Staff team" ON team_messages
  FOR SELECT TO authenticated 
  USING (
    team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id())
    OR EXISTS (
      SELECT 1 FROM teams t
      JOIN operational_periods op ON t.op_period_id = op.op_period_id
      JOIN responders r ON op.incident_id = r.incident_id
      WHERE t.team_id = team_messages.team_id 
        AND t.type = 'Staff'
        AND r.responder_id = get_my_responder_id()
    )
  );

CREATE POLICY "Allow authenticated to insert messages for their team or Staff team" ON team_messages
  FOR INSERT TO authenticated 
  WITH CHECK (
    team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id())
    OR EXISTS (
      SELECT 1 FROM teams t
      JOIN operational_periods op ON t.op_period_id = op.op_period_id
      JOIN responders r ON op.incident_id = r.incident_id
      WHERE t.team_id = team_messages.team_id 
        AND t.type = 'Staff'
        AND r.responder_id = get_my_responder_id()
    )
  );
CREATE POLICY "Admins/Staff can manage all team messages" ON team_messages
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- Policies for users
-- Allow staff/admins to view the list of system users
CREATE POLICY "Allow staff to view user list" ON users
  FOR SELECT TO authenticated USING (check_is_operational_staff());

-- Secure RPCs for managing users
-- These functions use SECURITY DEFINER to bypass RLS and ensure 
-- passwords are encrypted correctly using pgcrypto.
CREATE OR REPLACE FUNCTION user_add(
  p_email TEXT, 
  p_username TEXT, 
  p_password TEXT, 
  p_access_level TEXT,
  p_name TEXT DEFAULT NULL,
  p_agency TEXT DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_skills TEXT DEFAULT NULL
)
RETURNS VOID AS $func$
BEGIN
  INSERT INTO users (
    email, username, password, access_level, 
    name, agency, identifier, cell_phone, responder_type, special_skills
  )
  VALUES (
    LOWER(p_email), p_username, crypt(p_password, gen_salt('bf')), p_access_level::access_level,
    p_name, p_agency, p_identifier, p_phone, p_type::responder_type, p_skills
  );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_remove(p_email TEXT)
RETURNS VOID AS $func$
BEGIN
  DELETE FROM users WHERE email = LOWER(p_email);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_update_password(p_email TEXT, p_password TEXT)
RETURNS VOID AS $func$
BEGIN
  UPDATE users 
  SET password = crypt(p_password, gen_salt('bf'))
  WHERE email = LOWER(p_email);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to completely reinitialize the database schema.
-- This function executes the entire SAROps schema definition,
-- effectively dropping and recreating all tables, types, views,
-- triggers, and RLS policies.
-- This is a destructive operation and should be used with extreme caution.
CREATE OR REPLACE FUNCTION reinitialize_database()
RETURNS VOID AS $$
BEGIN
    -- Backup users if the table exists to retain entries during re-initialization
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE 'CREATE TEMP TABLE users_temp_backup AS SELECT * FROM users';
    END IF;

    -- ENUM TYPES
    EXECUTE 'DROP TYPE IF EXISTS assignment_status CASCADE;';
    EXECUTE 'CREATE TYPE assignment_status AS ENUM (''Planned'', ''Assigned'', ''Deployed'', ''Completed'', ''Incomplete'');';

    EXECUTE 'DROP TYPE IF EXISTS assignment_origin CASCADE;';
    EXECUTE 'CREATE TYPE assignment_origin AS ENUM (''SAROps'', ''SARTopo'');';

    EXECUTE 'DROP TYPE IF EXISTS team_status CASCADE;';
    EXECUTE 'CREATE TYPE team_status AS ENUM (''Staged'', ''Assigned'', ''Deployed'', ''Disbanded'');';

    EXECUTE 'DROP TYPE IF EXISTS team_type CASCADE;';
    EXECUTE 'CREATE TYPE team_type AS ENUM (''Hasty'', ''Ground'', ''Vehicle'', ''UAS'', ''Water'', ''Tracking'', ''Dog'', ''Avalanche'', ''Transport'', ''Helicopter'', ''Medical'', ''Staff'', ''Other'');';

    EXECUTE 'DROP TYPE IF EXISTS responder_status CASCADE;';
    EXECUTE 'CREATE TYPE responder_status AS ENUM (''Staged'', ''Attached'', ''Assigned'', ''Deployed'', ''CheckedOut'', ''Cleared'');';

    EXECUTE 'DROP TYPE IF EXISTS responder_type CASCADE;';
    EXECUTE 'CREATE TYPE responder_type AS ENUM (''SAR'', ''Fire'', ''Law'', ''Medical'');';

    EXECUTE 'DROP TYPE IF EXISTS access_level CASCADE;';
    EXECUTE 'CREATE TYPE access_level AS ENUM (''responder'', ''staff'', ''admin'');';

    -- TABLES
    EXECUTE 'DROP TABLE IF EXISTS incidents CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS responders CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS operational_periods CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS teams CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS assignments CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS responder_team_history CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS clues CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS team_responders CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS action_logs CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS team_messages CASCADE;';
    EXECUTE 'DROP TABLE IF EXISTS users CASCADE;';
    EXECUTE 'DROP VIEW IF EXISTS team_current_responders CASCADE;';
    EXECUTE 'DROP VIEW IF EXISTS incident_summary CASCADE;';

    EXECUTE 'CREATE TABLE incidents (
      incident_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      number TEXT NOT NULL,
      sartopo_id TEXT,
      notes TEXT,
      show_map BOOLEAN DEFAULT FALSE,
      start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
      end_datetime TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );';

    EXECUTE 'CREATE TABLE responders (
      responder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
      agency TEXT NOT NULL,
      auth_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      identifier TEXT NOT NULL,
      cell_phone TEXT,
      device_id TEXT NOT NULL,
      special_skills TEXT,
      checkin_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
      checkout_datetime TIMESTAMP WITH TIME ZONE,
      access_level access_level NOT NULL DEFAULT ''responder'',
      responder_type responder_type,
      status responder_status NOT NULL DEFAULT ''Staged'',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT responder_device_unique UNIQUE (device_id),
      CONSTRAINT check_checkout_date_presence CHECK (status != ''CheckedOut'' OR checkout_datetime IS NOT NULL)
    );';

    EXECUTE 'CREATE TABLE operational_periods (
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
    );';

    EXECUTE 'CREATE TABLE teams (
      team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
      team_name_number TEXT NOT NULL,
      sartopo_color_hex TEXT NOT NULL,
      type team_type NOT NULL,
      status team_status NOT NULL DEFAULT ''Staged'',
      leader_responder_id UUID REFERENCES responders(responder_id) ON DELETE SET NULL,
      equipment JSONB DEFAULT ''[]''::jsonb,
      last_par_check TIMESTAMP WITH TIME ZONE,
      par_status TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );';

    EXECUTE 'CREATE UNIQUE INDEX idx_one_staff_per_op
    ON teams (op_period_id)
    WHERE type = ''Staff'' AND status != ''Disbanded'';';

    EXECUTE 'CREATE TABLE assignments (
      assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
      sartopo_id TEXT,
      status assignment_status NOT NULL DEFAULT ''Planned'',
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
      CONSTRAINT check_team_size_positive CHECK (team_size >= 0),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      origin assignment_origin NOT NULL DEFAULT ''SAROps'',
      CONSTRAINT assignment_sartopo_unique UNIQUE (op_period_id, sartopo_id)
    );';

    EXECUTE 'CREATE TABLE responder_team_history (
      history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      responder_id UUID NOT NULL REFERENCES responders(responder_id) ON DELETE CASCADE,
      team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
      attached_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
      detached_datetime TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT responder_team_history_valid_dates CHECK (detached_datetime IS NULL OR detached_datetime >= attached_datetime)
    );';

    EXECUTE 'CREATE UNIQUE INDEX idx_responder_active_team
    ON responder_team_history (responder_id)
    WHERE (detached_datetime IS NULL);';

    EXECUTE 'CREATE TABLE clues (
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
    );';

    -- JUNCTION TABLES FOR MANY-TO-MANY RELATIONSHIPS
    EXECUTE 'CREATE TABLE team_responders (
      team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
      responder_id UUID NOT NULL REFERENCES responders(responder_id) ON DELETE CASCADE,
      role TEXT,
      PRIMARY KEY (team_id, responder_id)
    );';

    EXECUTE 'CREATE TABLE action_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
      action TEXT NOT NULL,
      user_name TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );';

    EXECUTE 'CREATE TABLE team_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
      sender_name TEXT NOT NULL,
      message_text TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );';

    EXECUTE 'CREATE TABLE users (
      email TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      access_level access_level NOT NULL DEFAULT ''responder'',
      name TEXT,
      agency TEXT,
      identifier TEXT,
      cell_phone TEXT,
      responder_type responder_type,
      special_skills TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );';

    -- INDEXES
    EXECUTE 'CREATE INDEX idx_operational_periods_incident_id ON operational_periods(incident_id);';
    EXECUTE 'CREATE INDEX idx_operational_periods_start_datetime ON operational_periods(start_datetime);';

    EXECUTE 'CREATE INDEX idx_teams_op_period_id ON teams(op_period_id);';
    EXECUTE 'CREATE INDEX idx_teams_leader_responder_id ON teams(leader_responder_id);';
    EXECUTE 'CREATE INDEX idx_teams_status ON teams(status);';

    EXECUTE 'CREATE INDEX idx_assignments_op_period_id ON assignments(op_period_id);';
    EXECUTE 'CREATE INDEX idx_assignments_team_id ON assignments(team_id);';
    EXECUTE 'CREATE INDEX idx_assignments_status ON assignments(status);';

    EXECUTE 'CREATE INDEX idx_responder_team_history_responder_id ON responder_team_history(responder_id);';
    EXECUTE 'CREATE INDEX idx_responder_team_history_team_id ON responder_team_history(team_id);';

    EXECUTE 'CREATE INDEX idx_clues_incident_id ON clues(incident_id);';
    EXECUTE 'CREATE INDEX idx_clues_discovered_by_team_id ON clues(discovered_by_team_id);';
    EXECUTE 'CREATE INDEX idx_clues_discovered_by_responder_id ON clues(discovered_by_responder_id);';
    EXECUTE 'CREATE INDEX idx_clues_coordinates ON clues(latitude, longitude);';

    EXECUTE 'CREATE INDEX idx_responders_status ON responders(status);';
    EXECUTE 'CREATE INDEX idx_responders_device_id ON responders(device_id);';
    EXECUTE 'CREATE INDEX idx_responders_access_level ON responders(access_level);';

    EXECUTE 'CREATE INDEX idx_action_logs_incident_id ON action_logs(incident_id);';
    EXECUTE 'CREATE INDEX idx_team_messages_composite ON team_messages(team_id, created_at);';

    -- VIEWS
    EXECUTE 'CREATE OR REPLACE VIEW team_current_responders AS
    SELECT
      t.team_id,
      t.op_period_id,
      t.team_name_number,
      t.status,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              ''responder_id'', r.responder_id,
              ''name'', r.name,
              ''agency'', r.agency,
              ''status'', r.status,
              ''role'', tr.role
            )
          )
          FROM team_responders tr
          JOIN responders r ON tr.responder_id = r.responder_id
          WHERE tr.team_id = t.team_id
        ),
        ''[]''::json
      ) AS responders
    FROM teams t;';

    EXECUTE 'CREATE OR REPLACE VIEW incident_summary AS
    SELECT
      i.incident_id,
      i.name,
      i.number,
      i.start_datetime,
      i.end_datetime,
      (SELECT COUNT(*) FROM operational_periods op WHERE op.incident_id = i.incident_id) as operational_period_count,
      (SELECT COUNT(DISTINCT t.team_id) FROM teams t JOIN operational_periods op ON t.op_period_id = op.op_period_id WHERE op.incident_id = i.incident_id) as team_count,
      (SELECT COUNT(*) FROM responders r WHERE r.incident_id = i.incident_id) as responder_count,
      (SELECT COUNT(*) FROM clues c WHERE c.incident_id = i.incident_id) as clue_count
    FROM incidents i;';

    -- TRIGGERS
    EXECUTE 'CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;';

    EXECUTE 'CREATE OR REPLACE FUNCTION create_staff_team_for_op()
    RETURNS TRIGGER AS $func$
    DECLARE
        _team_id UUID;
    BEGIN
        INSERT INTO teams (op_period_id, team_name_number, sartopo_color_hex, type, status, last_par_check)
        VALUES (NEW.op_period_id, ''Staff'', ''#0000FF'', ''Staff'', ''Deployed'', CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
        RETURNING team_id INTO _team_id;

        IF _team_id IS NOT NULL THEN
            INSERT INTO assignments (op_period_id, title, resource_type, status, team_id)
            VALUES (NEW.op_period_id, ''Command Staff'', ''Staff'', ''Deployed'', _team_id);
        END IF;

        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION sync_responder_access_level()
    RETURNS TRIGGER AS $func$
    DECLARE
        _responder_id UUID;
        is_command_staff_team_member BOOLEAN;
        target_access_level access_level;
        staff_team_status team_status;
    BEGIN
        IF TG_OP = ''DELETE'' THEN
            _responder_id := OLD.responder_id;
        ELSE
            _responder_id := NEW.responder_id;
        END IF;

        IF _responder_id IS NULL THEN
            RETURN NULL;
        END IF;

        SELECT t.status INTO staff_team_status
        FROM team_responders tr
        JOIN teams t ON tr.team_id = t.team_id
        WHERE tr.responder_id = _responder_id
          AND t.type = ''Staff''
        LIMIT 1;

        is_command_staff_team_member := (staff_team_status IS NOT NULL);

        IF is_command_staff_team_member THEN
            target_access_level := ''staff'';
        ELSE
            target_access_level := ''responder'';
        END IF;

        UPDATE responders
        SET access_level = CASE WHEN access_level = ''admin'' THEN ''admin''::access_level ELSE target_access_level END,
            status = CASE
                WHEN is_command_staff_team_member AND staff_team_status = ''Assigned'' THEN ''Assigned''::responder_status
                WHEN is_command_staff_team_member AND staff_team_status = ''Deployed'' THEN ''Deployed''::responder_status
                ELSE status
            END
        WHERE responder_id = _responder_id
          AND (
            (access_level != ''admin'' AND access_level IS DISTINCT FROM target_access_level)
            OR (is_command_staff_team_member AND staff_team_status = ''Assigned'' AND status IS DISTINCT FROM ''Assigned'')
            OR (is_command_staff_team_member AND staff_team_status = ''Deployed'' AND status IS DISTINCT FROM ''Deployed'')
          );

      RETURN NULL;
    END;
    $func$ LANGUAGE plpgsql;';

    EXECUTE 'CREATE OR REPLACE FUNCTION sync_team_members_on_status_change()
    RETURNS TRIGGER AS $func$
    DECLARE
        _target_responder_status responder_status;
        _target_assignment_status assignment_status;
    BEGIN
        _target_responder_status := CASE
            WHEN NEW.status = ''Staged'' THEN ''Attached''::responder_status
            WHEN NEW.status = ''Assigned'' THEN ''Assigned''::responder_status
            WHEN NEW.status = ''Deployed'' THEN ''Deployed''::responder_status
            WHEN NEW.status = ''Disbanded'' THEN ''Staged''::responder_status
            ELSE NULL
        END;

        IF _target_responder_status IS NOT NULL AND (TG_OP = ''INSERT'' OR OLD.status IS DISTINCT FROM NEW.status) THEN
            UPDATE responders
            SET status = _target_responder_status
            WHERE responder_id IN (
                SELECT responder_id FROM team_responders WHERE team_id = NEW.team_id
            )
            AND status IS DISTINCT FROM _target_responder_status;
        END IF;

        IF NEW.status = ''Disbanded'' AND OLD.status IS DISTINCT FROM NEW.status THEN
            UPDATE responder_team_history
            SET detached_datetime = CURRENT_TIMESTAMP
            WHERE team_id = NEW.team_id
              AND detached_datetime IS NULL;
        END IF;

        _target_assignment_status := CASE
            WHEN NEW.status = ''Assigned'' THEN ''Assigned''::assignment_status
            WHEN NEW.status = ''Deployed'' THEN ''Deployed''::assignment_status
            ELSE NULL
        END;

        IF _target_assignment_status IS NOT NULL AND (TG_OP = ''INSERT'' OR OLD.status IS DISTINCT FROM NEW.status) THEN
            UPDATE assignments
            SET status = _target_assignment_status
            WHERE team_id = NEW.team_id
              AND status IS DISTINCT FROM _target_assignment_status;
        END IF;

        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;';

    EXECUTE 'CREATE TRIGGER ensure_staff_team_on_new_op
    AFTER INSERT ON operational_periods
    FOR EACH ROW EXECUTE FUNCTION create_staff_team_for_op();';

    EXECUTE 'CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';

    EXECUTE 'CREATE TRIGGER update_operational_periods_updated_at BEFORE UPDATE ON operational_periods
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';

    EXECUTE 'CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';

    EXECUTE 'CREATE TRIGGER sync_team_status_on_team_update
    AFTER INSERT OR UPDATE OF status ON teams
    FOR EACH ROW EXECUTE FUNCTION sync_team_members_on_status_change();';

    EXECUTE 'CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';

    EXECUTE 'CREATE TRIGGER update_responders_updated_at BEFORE UPDATE ON responders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';

    EXECUTE 'CREATE TRIGGER update_clues_updated_at BEFORE UPDATE ON clues
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';

    EXECUTE 'CREATE TRIGGER sync_access_level_on_team_responders
    AFTER INSERT OR UPDATE OR DELETE ON team_responders
    FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();';

    EXECUTE 'CREATE OR REPLACE FUNCTION sync_team_status_on_assignment_update()
    RETURNS TRIGGER AS $func$
    DECLARE
        _target_team_status team_status;
    BEGIN
        IF NEW.team_id IS NOT NULL AND (TG_OP = ''INSERT'' OR OLD.status IS DISTINCT FROM NEW.status) THEN
            _target_team_status := CASE
                WHEN NEW.status = ''Planned'' THEN ''Staged''::team_status
                WHEN NEW.status = ''Assigned'' THEN ''Assigned''::team_status
                WHEN NEW.status = ''Deployed'' THEN ''Deployed''::team_status
                WHEN NEW.status = ''Completed'' OR NEW.status = ''Incomplete'' THEN ''Disbanded''::team_status
                ELSE NULL
            END;

            IF _target_team_status IS NOT NULL THEN
                UPDATE teams
                SET status = _target_team_status,
                    last_par_check = CASE WHEN _target_team_status = ''Deployed'' THEN CURRENT_TIMESTAMP ELSE last_par_check END
                WHERE team_id = NEW.team_id
                  AND status IS DISTINCT FROM _target_team_status;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;';

    EXECUTE 'CREATE TRIGGER trigger_sync_team_status_from_assignment
    AFTER INSERT OR UPDATE OF status ON assignments
    FOR EACH ROW EXECUTE FUNCTION sync_team_status_on_assignment_update();';

    EXECUTE 'CREATE OR REPLACE FUNCTION cleanup_resources_on_incident_end()
    RETURNS TRIGGER AS $func$
    BEGIN
        IF NEW.end_datetime IS NOT NULL AND OLD.end_datetime IS NULL THEN

            UPDATE operational_periods
            SET end_datetime = NEW.end_datetime
            WHERE incident_id = NEW.incident_id AND end_datetime IS NULL;

            UPDATE assignments
            SET status = ''Incomplete'', team_id = NULL
            WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id)
              AND status = ''Deployed'';

            UPDATE assignments
            SET status = ''Planned'', team_id = NULL
            WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id)
              AND status = ''Assigned'';

            UPDATE teams
            SET status = ''Disbanded'', last_par_check = NULL
            WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id)
              AND status != ''Disbanded'';

            UPDATE responders
            SET status = ''CheckedOut'', checkout_datetime = NEW.end_datetime
            WHERE incident_id = NEW.incident_id AND checkout_datetime IS NULL;

        END IF;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;';

    EXECUTE 'CREATE TRIGGER trigger_incident_cleanup_on_end
    AFTER UPDATE OF end_datetime ON incidents
    FOR EACH ROW EXECUTE FUNCTION cleanup_resources_on_incident_end();';

    -- ROW LEVEL SECURITY (RLS) POLICIES
    EXECUTE 'ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE responders ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE operational_periods ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE responder_team_history ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE clues ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE team_responders ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;';

    EXECUTE 'CREATE OR REPLACE FUNCTION is_anonymous_responder()
    RETURNS BOOLEAN AS $func$
      SELECT (auth.jwt() ->> ''is_anonymous'')::boolean IS TRUE;
    $func$ LANGUAGE sql STABLE;';

    EXECUTE 'CREATE OR REPLACE FUNCTION is_admin_or_command_staff()
    RETURNS BOOLEAN AS $func$
      SELECT check_is_operational_staff();
    $func$ LANGUAGE sql STABLE;';

    EXECUTE 'CREATE OR REPLACE FUNCTION get_my_responder_id()
    RETURNS UUID AS $func$
      SELECT responder_id FROM responders
      WHERE auth_uid = auth.uid()
      ORDER BY checkin_datetime DESC LIMIT 1;
    $func$ LANGUAGE sql STABLE SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION is_leader_of_team(_team_id UUID)
    RETURNS BOOLEAN AS $func$
      SELECT EXISTS (
        SELECT 1 FROM teams
        WHERE team_id = _team_id
          AND leader_responder_id = get_my_responder_id()
      );
    $func$ LANGUAGE sql STABLE SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION is_leader_of_assignment(_assignment_id UUID)
    RETURNS BOOLEAN AS $func$
      SELECT EXISTS (
        SELECT 1 FROM assignments a
        JOIN teams t ON a.team_id = t.team_id
        WHERE a.assignment_id = _assignment_id
          AND t.leader_responder_id = get_my_responder_id()
      );
    $func$ LANGUAGE sql STABLE SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION is_leader_of_member(_member_responder_id UUID)
    RETURNS BOOLEAN AS $func$
      SELECT EXISTS (
        SELECT 1 FROM team_responders tr
        JOIN teams t ON tr.team_id = t.team_id
        WHERE tr.responder_id = _member_responder_id
          AND t.leader_responder_id = get_my_responder_id()
      );
    $func$ LANGUAGE sql STABLE SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION check_is_operational_staff()
    RETURNS BOOLEAN AS $func$
    BEGIN
      RETURN (
        COALESCE((auth.jwt() ->> ''is_anonymous'')::boolean, false) IS FALSE
        OR EXISTS (
          SELECT 1 FROM responders
          WHERE auth_uid = auth.uid()
          AND access_level IN (''staff'', ''admin'')
        )
      );
    END;
    $func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION is_incident_active(_incident_id TEXT)
    RETURNS BOOLEAN AS $func$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM incidents i
        WHERE i.incident_id = _incident_id
          AND i.end_datetime IS NULL
      );
    END;
    $func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION is_active_op_period(_op_period_id UUID)
    RETURNS BOOLEAN AS $func$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM operational_periods op
        JOIN incidents i ON op.incident_id = i.incident_id
        WHERE op.op_period_id = _op_period_id
          AND i.end_datetime IS NULL
      );
    END;
    $func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION is_team_active(_team_id UUID)
    RETURNS BOOLEAN AS $func$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM teams t
        WHERE t.team_id = _team_id
          AND is_active_op_period(t.op_period_id)
      );
    END;
    $func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION verify_user_login(p_email TEXT, p_password TEXT)
    RETURNS SETOF users AS $func$
    BEGIN
      RETURN QUERY
      SELECT * FROM users
      WHERE email = LOWER(p_email)
        AND (password = p_password OR password = crypt(p_password, password));
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;';

    EXECUTE 'CREATE POLICY "Allow all authenticated to view active incidents" ON incidents
      FOR SELECT TO authenticated USING (end_datetime IS NULL);';
    EXECUTE 'CREATE POLICY "Admins can manage all incidents" ON incidents
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Allow anonymous to start an incident" ON incidents
      FOR INSERT TO authenticated WITH CHECK (is_anonymous_responder());';

    EXECUTE 'CREATE POLICY "Allow anonymous to insert their own record" ON responders
      FOR INSERT TO authenticated WITH CHECK (auth_uid = auth.uid());';
    EXECUTE 'CREATE POLICY "Allow authenticated to view active responders" ON responders
      FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));';
    EXECUTE 'CREATE POLICY "Allow anonymous to update their own record" ON responders
      FOR UPDATE TO authenticated USING (auth_uid = auth.uid()) WITH CHECK (auth_uid = auth.uid());';
    EXECUTE 'CREATE POLICY "Allow team leaders to update their members" ON responders
      FOR UPDATE TO authenticated
      USING (is_leader_of_member(responder_id) OR check_is_operational_staff())
      WITH CHECK (is_leader_of_member(responder_id) OR check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all responders" ON responders
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';

    EXECUTE 'CREATE POLICY "Allow authenticated to view active operational periods" ON operational_periods
      FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all operational periods" ON operational_periods
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Allow anonymous to create operational periods" ON operational_periods
      FOR INSERT TO authenticated WITH CHECK (is_anonymous_responder());';

    EXECUTE 'CREATE POLICY "Allow authenticated to view active teams" ON teams
      FOR SELECT TO authenticated USING (is_active_op_period(op_period_id));';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all teams" ON teams
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Allow team members to view their own team" ON teams
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM team_responders tr WHERE tr.team_id = teams.team_id AND tr.responder_id = get_my_responder_id()));';
    EXECUTE 'CREATE POLICY "Allow team leaders to update their team" ON teams
      FOR UPDATE TO authenticated
      USING (is_leader_of_team(team_id) OR check_is_operational_staff())
      WITH CHECK (is_leader_of_team(team_id) OR check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Allow all authenticated to create teams in active incidents" ON teams
      FOR INSERT TO authenticated
      WITH CHECK (is_active_op_period(op_period_id));';
    EXECUTE 'CREATE POLICY "Allow anonymous to update Staff team leader" ON teams
      FOR UPDATE TO authenticated
      USING (
        is_anonymous_responder() AND
        type = ''Staff'' AND
        (leader_responder_id IS NULL OR EXISTS (SELECT 1 FROM responders r WHERE r.responder_id = leader_responder_id AND r.auth_uid = auth.uid()))
      )
      WITH CHECK (
        is_anonymous_responder() AND
        type = ''Staff'' AND
        EXISTS (SELECT 1 FROM responders r WHERE r.responder_id = leader_responder_id AND r.auth_uid = auth.uid())
      );';

    EXECUTE 'CREATE POLICY "Allow authenticated to view active assignments" ON assignments
      FOR SELECT TO authenticated USING (is_active_op_period(op_period_id));';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all assignments" ON assignments
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Allow team leaders to update their assignment" ON assignments
      FOR UPDATE TO authenticated
      USING (is_leader_of_assignment(assignment_id) OR check_is_operational_staff())
      WITH CHECK (team_id IS NULL OR is_leader_of_team(team_id) OR check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Allow all authenticated to create assignments in active incidents" ON assignments
      FOR INSERT TO authenticated
      WITH CHECK (is_active_op_period(op_period_id));';

    EXECUTE 'CREATE POLICY "Allow authenticated to view their own team history" ON responder_team_history
      FOR SELECT TO authenticated USING (responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid()));';

    EXECUTE 'CREATE POLICY "Allow all authenticated to manage memberships in active incidents" ON team_responders
      FOR INSERT TO authenticated
      WITH CHECK (is_team_active(team_id));';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all team history" ON responder_team_history
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';

    EXECUTE 'CREATE POLICY "Allow authenticated to view clues in their incident" ON clues
      FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all clues" ON clues
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Allow anonymous to insert clues" ON clues
      FOR INSERT TO authenticated WITH CHECK (is_anonymous_responder());';

    EXECUTE 'CREATE POLICY "Allow authenticated to view active team memberships" ON team_responders
      FOR SELECT TO authenticated USING (is_team_active(team_id));';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all team memberships" ON team_responders
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';

    EXECUTE 'CREATE POLICY "Allow authenticated to view action logs in their incident" ON action_logs
      FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all action logs" ON action_logs
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';
    EXECUTE 'CREATE POLICY "Allow all authenticated to record action logs in active incidents" ON action_logs
      FOR INSERT TO authenticated
      WITH CHECK (is_incident_active(incident_id));';

    EXECUTE 'CREATE POLICY "Allow authenticated to view messages for their team or Staff team" ON team_messages
      FOR SELECT TO authenticated
      USING (
        team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id())
        OR EXISTS (
          SELECT 1 FROM teams t
          JOIN operational_periods op ON t.op_period_id = op.op_period_id
          JOIN responders r ON op.incident_id = r.incident_id
          WHERE t.team_id = team_messages.team_id
            AND t.type = ''Staff''
            AND r.responder_id = get_my_responder_id()
        )
      );';

    EXECUTE 'CREATE POLICY "Allow authenticated to insert messages for their team or Staff team" ON team_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id())
        OR EXISTS (
          SELECT 1 FROM teams t
          JOIN operational_periods op ON t.op_period_id = op.op_period_id
          JOIN responders r ON op.incident_id = r.incident_id
          WHERE t.team_id = team_messages.team_id
            AND t.type = ''Staff''
            AND r.responder_id = get_my_responder_id()
        )
      );';
    EXECUTE 'CREATE POLICY "Admins/Staff can manage all team messages" ON team_messages
      FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());';

    EXECUTE 'CREATE POLICY "Allow staff to view user list" ON users
      FOR SELECT TO authenticated USING (check_is_operational_staff());';

    EXECUTE 'CREATE OR REPLACE FUNCTION user_add(
      p_email TEXT, 
      p_username TEXT, 
      p_password TEXT, 
      p_access_level TEXT,
      p_name TEXT DEFAULT NULL,
      p_agency TEXT DEFAULT NULL,
      p_identifier TEXT DEFAULT NULL,
      p_phone TEXT DEFAULT NULL,
      p_type TEXT DEFAULT NULL,
      p_skills TEXT DEFAULT NULL
    )
    RETURNS VOID AS $func$
    BEGIN
      INSERT INTO users (
        email, username, password, access_level, 
        name, agency, identifier, cell_phone, responder_type, special_skills
      )
      VALUES (
        LOWER(p_email), p_username, crypt(p_password, gen_salt(''bf'')), p_access_level::access_level,
        p_name, p_agency, p_identifier, p_phone, p_type::responder_type, p_skills
      );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION user_remove(p_email TEXT)
    RETURNS VOID AS $func$
    BEGIN
      DELETE FROM users WHERE email = LOWER(p_email);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;';

    EXECUTE 'CREATE OR REPLACE FUNCTION user_update_password(p_email TEXT, p_password TEXT)
    RETURNS VOID AS $func$
    BEGIN
      UPDATE users
      SET password = crypt(p_password, gen_salt(''bf''))
      WHERE email = LOWER(p_email);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;';

    -- Restore users from backup
    IF EXISTS (SELECT FROM pg_class WHERE relname = 'users_temp_backup') THEN
        EXECUTE 'INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills, created_at) 
        SELECT email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills, created_at 
        FROM users_temp_backup ON CONFLICT (email) DO NOTHING';
        EXECUTE 'DROP TABLE users_temp_backup';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to ensure functions are visible to the API
GRANT EXECUTE ON FUNCTION user_add(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_remove(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_update_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_user_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reinitialize_database() TO authenticated;

-- ============================================================================
-- INITIAL DATA SEEDING (FOR DEVELOPMENT/FIRST-TIME SETUP)
-- ============================================================================
-- Add a default admin user for initial access
INSERT INTO users (email, username, password) VALUES ('slanaghen@gmail.com', 'slanaghen@gmail.com', crypt('grigware', gen_salt('bf'))) ON CONFLICT (email) DO NOTHING;
