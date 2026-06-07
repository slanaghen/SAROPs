-- Table: incidents
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
);