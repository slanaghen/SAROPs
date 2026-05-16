-- SAROps PostgreSQL Schema for Supabase
-- Generated from sarops-types.d.ts

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE assignment_status AS ENUM (
  'Draft',
  'Planned',
  'Assigned',
  'Deployed',
  'Completed'
);

CREATE TYPE team_status AS ENUM (
  'Draft',
  'Staged',
  'Assigned',
  'Deployed',
  'Demobilized'
);

CREATE TYPE team_type AS ENUM (
  'Ground Search',
  'UAS Search',
  'Dog Air',
  'Dog Track',
  'Transport',
  'Helicopter',
  'Other'
);

CREATE TYPE responder_status AS ENUM (
  'Staged',
  'Attached',
  'Assigned',
  'Briefed',
  'Deployed',
  'Debriefed',
  'CheckedOut'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Table: incidents
-- Root entity for a search and rescue incident
CREATE TABLE incidents (
  incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  number TEXT NOT NULL,
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
  agency TEXT NOT NULL,
  identifier TEXT NOT NULL,
  cell_phone TEXT,
  device_id TEXT NOT NULL,
  checkin_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  checkout_datetime TIMESTAMP WITH TIME ZONE,
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
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  situation_narrative TEXT,
  situational_awareness_narrative TEXT,
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
  status team_status NOT NULL DEFAULT 'Draft',
  leader_responder_id UUID NOT NULL REFERENCES responders(responder_id) ON DELETE RESTRICT,
  equipment JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: assignments
-- Tasks or objectives assigned to teams
CREATE TABLE assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
  sartopo_id TEXT,
  name TEXT NOT NULL,
  status assignment_status NOT NULL DEFAULT 'Draft',
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

-- Table: incident_clues
-- Many-to-many relationship between incidents and clues
-- (clues are stored at incident level per spec)
CREATE TABLE incident_clues (
  incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  clue_id UUID NOT NULL REFERENCES clues(clue_id) ON DELETE CASCADE,
  PRIMARY KEY (incident_id, clue_id)
);

-- Table: operational_period_teams
-- Many-to-many relationship for teams active in operational periods
CREATE TABLE operational_period_teams (
  op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  PRIMARY KEY (op_period_id, team_id)
);

-- Table: operational_period_assignments
-- Many-to-many relationship for assignments active in operational periods
CREATE TABLE operational_period_assignments (
  op_period_id UUID NOT NULL REFERENCES operational_periods(op_period_id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
  PRIMARY KEY (op_period_id, assignment_id)
);

-- Table: team_responders
-- Many-to-many relationship for current responders attached to teams
CREATE TABLE team_responders (
  team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES responders(responder_id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, responder_id)
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

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: team_current_responders
-- Denormalized view of teams with their current responders for dashboard use
CREATE VIEW team_current_responders AS
SELECT
  t.team_id,
  t.op_period_id,
  t.team_name_number,
  t.status,
  json_agg(
    json_build_object(
      'responder_id', r.responder_id,
      'name', r.name,
      'agency', r.agency,
      'status', r.status
    )
  ) as responders
FROM teams t
LEFT JOIN team_responders tr ON t.team_id = tr.team_id
LEFT JOIN responders r ON tr.responder_id = r.responder_id
GROUP BY t.team_id, t.op_period_id, t.team_name_number, t.status;

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
