-- SAROps PostgreSQL Schema for Supabase
-- Generated from sarops-types.d.ts

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
  'Ground Search',
  'Vehicle Search',
  'Aerial Search',
  'Water Search',
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

DROP TYPE IF EXISTS access_level CASCADE;
CREATE TYPE access_level AS ENUM (
  'responder',
  'command staff',
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
DROP TABLE IF EXISTS ics_assignments CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
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
  status responder_status NOT NULL DEFAULT 'Staged',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT responder_device_unique UNIQUE (device_id)
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
WHERE type = 'Staff';

-- Table: assignments
-- Tasks or objectives assigned to teams
CREATE TABLE assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
  sartopo_id TEXT,
  name TEXT NOT NULL,
  status assignment_status NOT NULL DEFAULT 'Planned',
  division TEXT,
  assignment_type TEXT,
  assignment_size INTEGER,
  tac_channel TEXT,
  description_narrative TEXT,
  pod INTEGER,
  debrief_narrative TEXT,
  is_orphaned BOOLEAN NOT NULL DEFAULT FALSE,
  team_id UUID REFERENCES teams(team_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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

-- Table: ics_assignments
-- Stores assignments for ICS roles for a given incident
CREATE TABLE ics_assignments (
  ics_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  position TEXT NOT NULL, -- e.g., 'ic', 'safety', 'ops'
  responder_id UUID REFERENCES responders(responder_id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_ics_position_per_incident UNIQUE (incident_id, position)
);

-- Table: admin_users
-- Simple table-based auth for system administrators (managed via Admin page)
CREATE TABLE admin_users (
  email TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL, -- In a real app, use Supabase Auth; this matches AdminPage.jsx logic
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

CREATE INDEX idx_team_messages_team_id ON team_messages(team_id);

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
CREATE VIEW incident_summary AS
SELECT
  i.incident_id,
  i.name,
  i.number,
  i.start_datetime,
  i.end_datetime,
  COUNT(DISTINCT op.op_period_id) as operational_period_count,
  COUNT(DISTINCT t.team_id) as team_count,
  COUNT(DISTINCT r.responder_id) as responder_count,
  COUNT(DISTINCT c.clue_id) as clue_count
FROM incidents i
LEFT JOIN operational_periods op ON i.incident_id = op.incident_id
LEFT JOIN teams t ON op.op_period_id = t.op_period_id
LEFT JOIN team_responders tr ON t.team_id = tr.team_id
LEFT JOIN responders r ON tr.responder_id = r.responder_id
LEFT JOIN clues c ON i.incident_id = c.incident_id
GROUP BY i.incident_id, i.name, i.number, i.start_datetime, i.end_datetime;

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
BEGIN
    INSERT INTO teams (op_period_id, team_name_number, sartopo_color_hex, type, status)
    VALUES (NEW.op_period_id, 'Staff', '#0000FF', 'Staff', 'Assigned')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to synchronize responder access level based on team membership and ICS assignments
CREATE OR REPLACE FUNCTION sync_responder_access_level()
RETURNS TRIGGER AS $func$
DECLARE
    _responder_id UUID;
    is_command_staff_team_member BOOLEAN;
    has_ics_assignment BOOLEAN;
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

    -- Check if the responder has any ICS assignment
    SELECT EXISTS (
        SELECT 1
        FROM ics_assignments
        WHERE responder_id = _responder_id
    ) INTO has_ics_assignment;

    -- Determine the target access level
    IF is_command_staff_team_member OR has_ics_assignment THEN
        target_access_level := 'command staff';
    ELSE
        target_access_level := 'responder';
    END IF;

    -- Update the responder's access_level and status if they are different
    -- Ensure staff members are marked as 'Assigned' if their team is 'Assigned'
    UPDATE responders
    SET access_level = target_access_level,
        status = CASE 
            WHEN is_command_staff_team_member AND staff_team_status = 'Assigned' THEN 'Assigned'::responder_status 
            ELSE status 
        END
    WHERE responder_id = _responder_id
      AND (
        access_level IS DISTINCT FROM target_access_level 
        OR (is_command_staff_team_member AND staff_team_status = 'Assigned' AND status IS DISTINCT FROM 'Assigned')
      );

  RETURN NULL;
END;
$func$ LANGUAGE plpgsql;

-- Function to update responder statuses when a Staff team status changes to Assigned
CREATE OR REPLACE FUNCTION sync_staff_members_on_status_change()
RETURNS TRIGGER AS $func$
BEGIN
    -- If a Staff team status changes to 'Assigned'
    IF NEW.type = 'Staff' AND NEW.status = 'Assigned' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE responders
        SET status = 'Assigned'
        WHERE responder_id IN (
            SELECT responder_id FROM team_responders WHERE team_id = NEW.team_id
        )
        AND status IS DISTINCT FROM 'Assigned';
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
CREATE TRIGGER sync_staff_status_on_team_update
AFTER INSERT OR UPDATE OF status ON teams
FOR EACH ROW EXECUTE FUNCTION sync_staff_members_on_status_change();

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

-- Trigger for ics_assignments changes (replaces old trigger)
DROP TRIGGER IF EXISTS update_responders_access_level_on_ics_assign ON ics_assignments;
CREATE TRIGGER sync_access_level_on_ics_assignments
AFTER INSERT OR UPDATE OR DELETE ON ics_assignments
FOR EACH ROW EXECUTE FUNCTION sync_responder_access_level();

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
ALTER TABLE ics_assignments ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an anonymous responder
CREATE OR REPLACE FUNCTION is_anonymous_responder()
RETURNS BOOLEAN AS $func$
  SELECT (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE;
$func$ LANGUAGE sql STABLE;

-- Helper function to check if the current user is an admin or command staff
CREATE OR REPLACE FUNCTION is_admin_or_command_staff()
RETURNS BOOLEAN AS $func$
  SELECT (auth.jwt() ->> 'is_anonymous')::boolean IS FALSE;
$func$ LANGUAGE sql STABLE;

-- NEW HELPER: Check if user is staff based on their actual Responder record
-- SECURITY DEFINER is required to prevent recursion in RLS
CREATE OR REPLACE FUNCTION check_is_operational_staff() 
RETURNS BOOLEAN AS $func$
BEGIN
  RETURN (
    (auth.jwt() ->> 'is_anonymous')::boolean IS FALSE -- True Admin
    OR EXISTS (
      SELECT 1 FROM responders 
      WHERE auth_uid = auth.uid() 
      AND access_level IN ('command staff', 'admin')
    )
  );
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- RPC for Admin Login
CREATE OR REPLACE FUNCTION verify_admin_login(p_email TEXT, p_password TEXT)
RETURNS SETOF admin_users AS $func$
BEGIN
  RETURN QUERY
  SELECT * FROM admin_users
  WHERE email = LOWER(p_email) AND password = p_password;
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
  FOR INSERT TO authenticated WITH CHECK (auth_uid = auth.uid() AND is_anonymous_responder());
CREATE POLICY "Allow anonymous to view their own record" ON responders
  FOR SELECT TO authenticated USING (auth_uid = auth.uid() AND is_anonymous_responder());
CREATE POLICY "Allow anonymous to update their own record" ON responders
  FOR UPDATE TO authenticated USING (auth_uid = auth.uid() AND is_anonymous_responder()) WITH CHECK (auth_uid = auth.uid() AND is_anonymous_responder());
-- REVISED: Admins/Staff can view all responders (no need to filter by incident_id for them, as they are staff)
CREATE POLICY "Admins/Staff can view all responders" ON responders
  FOR SELECT TO authenticated USING (is_admin_or_command_staff());
CREATE POLICY "Admins/Staff can manage all responders" ON responders
  FOR ALL TO authenticated USING (is_admin_or_command_staff()) WITH CHECK (is_admin_or_command_staff());

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
  FOR SELECT TO authenticated USING (op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL)));
CREATE POLICY "Admins/Staff can manage all teams" ON teams
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());
-- Allow anonymous to update Staff team leader if they are setting themselves as leader
CREATE POLICY "Allow anonymous to update Staff team leader" ON teams
  FOR UPDATE TO authenticated
  USING (
    is_anonymous_responder() AND
    type = 'Staff' AND
    (leader_responder_id IS NULL OR leader_responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid()))
  )
  WITH CHECK (
    is_anonymous_responder() AND
    type = 'Staff' AND
    leader_responder_id = (SELECT responder_id FROM responders WHERE auth_uid = auth.uid())
  );

-- Policies for `assignments`
-- REVISED: Allow any authenticated user to view assignments if their parent incident is active.
CREATE POLICY "Allow authenticated to view active assignments" ON assignments
  FOR SELECT TO authenticated USING (op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL)));
CREATE POLICY "Admins/Staff can manage all assignments" ON assignments
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- Policies for `responder_team_history`
CREATE POLICY "Allow authenticated to view their own team history" ON responder_team_history
  FOR SELECT TO authenticated USING (responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid()));
-- Allow anonymous to insert their own record into team_responders for a Staff team
CREATE POLICY "Allow anonymous to attach to Staff team" ON team_responders
  FOR INSERT TO authenticated
  WITH CHECK (
    is_anonymous_responder() AND
    responder_id = (SELECT responder_id FROM responders WHERE auth_uid = auth.uid()) AND
    team_id IN (SELECT team_id FROM teams WHERE type = 'Staff')
  );
CREATE POLICY "Admins/Staff can manage all team history" ON responder_team_history
  FOR ALL TO authenticated USING (is_admin_or_command_staff()) WITH CHECK (is_admin_or_command_staff());

-- Policies for `clues`
CREATE POLICY "Allow authenticated to view clues in their incident" ON clues
  FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));
CREATE POLICY "Admins/Staff can manage all clues" ON clues
  FOR ALL TO authenticated USING (is_admin_or_command_staff()) WITH CHECK (is_admin_or_command_staff());

-- Policies for `team_responders` (junction table)
CREATE POLICY "Allow authenticated to view their team membership" ON team_responders
  FOR SELECT TO authenticated USING (responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid()));
CREATE POLICY "Admins/Staff can manage all team memberships" ON team_responders
  FOR ALL TO authenticated USING (is_admin_or_command_staff()) WITH CHECK (is_admin_or_command_staff());

-- Policies for `action_logs`
CREATE POLICY "Allow authenticated to view action logs in their incident" ON action_logs
  FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));
CREATE POLICY "Admins/Staff can manage all action logs" ON action_logs
  FOR ALL TO authenticated USING (is_admin_or_command_staff()) WITH CHECK (is_admin_or_command_staff());

-- Policies for `team_messages`
CREATE POLICY "Allow authenticated to view messages for their team" ON team_messages
  FOR SELECT TO authenticated USING (team_id IN (SELECT team_id FROM team_responders WHERE responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid())));
CREATE POLICY "Allow authenticated to insert messages for their team" ON team_messages
  FOR INSERT TO authenticated WITH CHECK (team_id IN (SELECT team_id FROM team_responders WHERE responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid())));
CREATE POLICY "Admins/Staff can manage all team messages" ON team_messages
  FOR ALL TO authenticated USING (is_admin_or_command_staff()) WITH CHECK (is_admin_or_command_staff());

-- Policies for `ics_assignments`
CREATE POLICY "Allow authenticated to view ICS assignments in their incident" ON ics_assignments
  FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));
CREATE POLICY "Admins/Staff can manage all ICS assignments" ON ics_assignments
  FOR ALL TO authenticated USING (is_admin_or_command_staff()) WITH CHECK (is_admin_or_command_staff());
