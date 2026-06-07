-- View: team_current_responders
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
FROM incidents i;