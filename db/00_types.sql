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
);