-- Table: assignments
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
);