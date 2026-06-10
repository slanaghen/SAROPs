-- Table: users (System Admin access)
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
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
  display_density display_density DEFAULT 'comfortable',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Force immediate schema reload for the users table
NOTIFY pgrst, 'reload schema';

-- Table: responders
DROP TABLE IF EXISTS responders CASCADE;
CREATE TABLE responders (
  responder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, -- Nullable: persistent info sourced from public.users via user_email link
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE ON UPDATE CASCADE,
  agency TEXT, -- Nullable: persistent info sourced from public.users via user_email link
  user_email TEXT REFERENCES users(email) ON DELETE SET NULL ON UPDATE CASCADE,
  auth_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  identifier TEXT, -- Nullable: persistent info sourced from public.users via user_email link
  cell_phone TEXT,
  device_id TEXT NOT NULL,
  special_skills TEXT,
  access_level access_level, -- Nullable: persistent info sourced from public.users via user_email link
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
);