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
  'Ground Search',
  'UAS Search',
  'Dog Air',
  'Dog Track',
  'Transport',
  'Helicopter',
  'Command Staff',
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
  'command staff'
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
DROP VIEW IF EXISTS team_current_responders CASCADE;
DROP VIEW IF EXISTS incident_summary CASCADE;

-- Table: incidents
-- Root entity for a search and rescue incident
CREATE TABLE incidents (
  incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  agency TEXT NOT NULL,
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
  incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
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

-- Ensure only one Command Staff team per operational period
CREATE UNIQUE INDEX idx_one_command_staff_per_op 
ON teams (op_period_id) 
WHERE type = 'Command Staff';

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
  poa INTEGER,
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
  incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
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
  incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
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
  incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  position TEXT NOT NULL, -- e.g., 'ic', 'safety', 'ops'
  responder_id UUID REFERENCES responders(responder_id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_ics_position_per_incident UNIQUE (incident_id, position)
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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to synchronize responder access level based on team membership and ICS assignments
CREATE OR REPLACE FUNCTION sync_responder_access_level()
RETURNS TRIGGER AS $$
DECLARE
    _responder_id UUID;
    is_command_staff_team_member BOOLEAN;
    has_ics_assignment BOOLEAN;
    target_access_level access_level;
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

    -- Check if the responder is a member of any 'Command Staff' team
    SELECT EXISTS (
        SELECT 1
        FROM team_responders tr
        JOIN teams t ON tr.team_id = t.team_id
        WHERE tr.responder_id = _responder_id
          AND t.type = 'Command Staff'
    ) INTO is_command_staff_team_member;

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

    -- Update the responder's access_level if it's different
    UPDATE responders
    SET access_level = target_access_level
    WHERE responder_id = _responder_id
      AND access_level IS DISTINCT FROM target_access_level;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operational_periods_updated_at BEFORE UPDATE ON operational_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
