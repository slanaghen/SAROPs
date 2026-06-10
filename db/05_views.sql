-- View: full_responder_profiles
-- The single source of truth for responder identity, merging persistent user
-- profiles with incident-specific responder records.
CREATE OR REPLACE VIEW full_responder_profiles WITH (security_invoker = on) AS
SELECT
  r.responder_id,
  r.incident_id,
  r.auth_uid,
  r.user_email,
  r.device_id,
  r.status, -- Operational status from responders table
  r.checkin_datetime,
  r.checkout_datetime,
  r.created_at,
  r.updated_at,
  COALESCE(u.name, r.name) AS name,
  COALESCE(u.agency, r.agency) AS agency,
  COALESCE(u.identifier, r.identifier) AS identifier,
  COALESCE(u.cell_phone, r.cell_phone) AS cell_phone,
  COALESCE(u.responder_type, r.responder_type) AS responder_type,
  COALESCE(u.special_skills, r.special_skills) AS special_skills,
  COALESCE(u.access_level, r.access_level) AS access_level
FROM responders r
LEFT JOIN users u ON r.user_email = u.email;

-- View: team_current_responders
CREATE OR REPLACE VIEW team_current_responders WITH (security_invoker = on) AS
SELECT
  t.*,
  fr.name AS leader_name,
  fr.identifier AS leader_identifier,
  (SELECT COUNT(*) FROM team_responders tr_count WHERE tr_count.team_id = t.team_id) AS member_count,
  i.name AS incident_name,
  i.number AS incident_number,
  i.incident_id,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'responder_id', fr_m.responder_id,
          'name', fr_m.name,
          'agency', fr_m.agency,
          'identifier', fr_m.identifier,
          'cell_phone', fr_m.cell_phone,
          'responder_type', fr_m.responder_type,
          'special_skills', fr_m.special_skills,
          'access_level', fr_m.access_level,
          'status', fr_m.status,
          'role', tr.role
        )
      )
      FROM team_responders tr
      JOIN full_responder_profiles fr_m ON tr.responder_id = fr_m.responder_id
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
LEFT JOIN full_responder_profiles fr ON t.leader_responder_id = fr.responder_id
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
FROM incidents i;