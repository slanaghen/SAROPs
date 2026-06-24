-- Enable RLS on all tables
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_team_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS HELPERS
CREATE OR REPLACE FUNCTION is_anonymous_responder()
RETURNS BOOLEAN AS $func$
  SELECT (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE;
$func$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION check_is_operational_staff()
RETURNS BOOLEAN AS $func$
  -- Requirement: Only staff and admin users can manage operational entities.
  -- We use OR logic to ensure that if the user qualifies via any mechanism, they are granted access.
  SELECT (
    COALESCE((auth.jwt() ->> 'access_level') IN ('staff', 'admin'), FALSE) -- Fastest: Direct JWT claim check
    OR EXISTS (
      -- Fallback: Check against the system 'users' table for staff/admin email using auth.email()
      SELECT 1 FROM users u
      WHERE u.email = auth.email() AND u.access_level IN ('staff', 'admin')
    )
    OR EXISTS (
      -- Fallback: Check against the 'responders' table for any staff/admin responder record (active or not)
      SELECT 1 FROM responders r
      WHERE r.auth_uid = auth.uid() AND r.access_level IN ('staff', 'admin')
    )
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_command_staff()
RETURNS BOOLEAN AS $func$
  SELECT check_is_operational_staff();
$func$ LANGUAGE sql STABLE;

-- Optimized version to ensure we get the *active* responder
CREATE OR REPLACE FUNCTION get_my_responder_id() 
RETURNS UUID AS $func$
  SELECT responder_id
  FROM responders
  WHERE auth_uid = auth.uid()
    AND checkout_datetime IS NULL -- Only consider currently checked-in responders
  ORDER BY checkin_datetime DESC -- If multiple active (shouldn't happen, but as a fallback)
  LIMIT 1;
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_leader_of_team(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM teams WHERE team_id = _team_id AND leader_responder_id = get_my_responder_id());
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_member_of_team(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM team_responders WHERE team_id = _team_id AND responder_id = get_my_responder_id());
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_member_of_assignment(_assignment_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    JOIN team_responders tr ON a.team_id = tr.team_id
    WHERE a.assignment_id = _assignment_id 
      AND tr.responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_leader_of_assignment(_assignment_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    JOIN teams t ON a.team_id = t.team_id
    WHERE a.assignment_id = _assignment_id 
      AND t.leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_leader_of_member(_member_responder_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM team_responders tr
    JOIN teams t ON tr.team_id = t.team_id
    WHERE tr.responder_id = _member_responder_id 
      AND t.leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_incident_active(_incident_id TEXT)
RETURNS BOOLEAN AS $func$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM incidents 
    WHERE incident_id = _incident_id AND end_datetime IS NULL
  );
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_active_op_period(_op_period_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id
    WHERE op.op_period_id = _op_period_id AND i.end_datetime IS NULL
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_team_active(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM teams WHERE team_id = _team_id AND is_active_op_period(op_period_id));
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

-- POLICIES: Incidents
CREATE POLICY "Visible to everyone" ON incidents FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Admins manage incidents" ON incidents FOR ALL TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Allow all authenticated to start an incident" ON incidents FOR INSERT TO authenticated WITH CHECK (check_is_operational_staff());

-- POLICIES: Operational Periods
CREATE POLICY "Visible to everyone" ON operational_periods FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Admins manage OPs" ON operational_periods FOR ALL TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Allow all authenticated to create OPs" ON operational_periods FOR INSERT TO authenticated WITH CHECK (check_is_operational_staff());

-- POLICIES: Vehicles
CREATE POLICY "Visible to all authenticated" ON vehicles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins/Staff manage vehicles" ON vehicles FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Responders
CREATE POLICY "View active responders" ON responders FOR SELECT TO authenticated
  USING (auth_uid = auth.uid() OR check_is_operational_staff() OR incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));
CREATE POLICY "Update own record" ON responders FOR UPDATE TO authenticated USING (auth_uid = auth.uid());
CREATE POLICY "Allow authenticated to check in" ON responders FOR INSERT TO authenticated WITH CHECK (auth_uid = auth.uid());
-- Allow Team Leaders to update their members' status
CREATE POLICY "Allow team leaders to update their members" ON responders
  FOR UPDATE TO authenticated
  USING (is_leader_of_member(responder_id) OR check_is_operational_staff())
  WITH CHECK (is_leader_of_member(responder_id) OR check_is_operational_staff());

-- POLICIES: Teams
CREATE POLICY "View active teams" ON teams FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));
CREATE POLICY "Admins/Staff manage teams" ON teams FOR ALL TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Leaders update teams" ON teams FOR UPDATE TO authenticated USING (is_leader_of_team(team_id) OR check_is_operational_staff());
CREATE POLICY "Allow authenticated to create teams" ON teams FOR INSERT TO authenticated WITH CHECK (is_active_op_period(op_period_id) AND check_is_operational_staff());

-- Allow team members to view their own team, regardless of operational period activity status
CREATE POLICY "Allow team members to view their own team" ON teams
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_responders tr WHERE tr.team_id = teams.team_id AND tr.responder_id = get_my_responder_id()));

-- Allow anonymous to update Staff team leader if they are setting themselves as leader (Auto-IC Logic)
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

-- POLICIES: Assignments
CREATE POLICY "View active assignments" ON assignments FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));
CREATE POLICY "Admins/Staff manage assignments" ON assignments FOR ALL TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Allow authenticated to create assignments" ON assignments FOR INSERT TO authenticated WITH CHECK (is_active_op_period(op_period_id) AND check_is_operational_staff());

-- Allow Team Members to update their assigned assignment status
CREATE POLICY "Allow team members to update their assignment" ON assignments
  FOR UPDATE TO authenticated
  USING (is_member_of_assignment(assignment_id) OR check_is_operational_staff())
  WITH CHECK (team_id IS NULL OR is_member_of_team(team_id) OR check_is_operational_staff());

-- POLICIES: Messaging
CREATE POLICY "View relevant messages" ON team_messages FOR SELECT TO authenticated 
  USING (team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id()) OR check_is_operational_staff());
CREATE POLICY "Allow all authenticated to insert messages to their team or staff" ON team_messages
  FOR INSERT TO authenticated 
  WITH CHECK (
    is_member_of_team(team_id) 
    OR EXISTS (SELECT 1 FROM teams WHERE team_id = team_messages.team_id AND type = 'Staff') 
    OR check_is_operational_staff()
  );
CREATE POLICY "Admins/Staff can manage all team messages" ON team_messages
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- POLICIES: Action Logs
CREATE POLICY "Visible to relevant responders" ON action_logs FOR SELECT TO authenticated
  USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()) OR check_is_operational_staff());

-- Allow all authenticated to record action logs in active incidents
CREATE POLICY "Allow all authenticated to record action logs in active incidents" ON action_logs
  FOR INSERT TO authenticated 
  WITH CHECK (is_incident_active(incident_id));

-- POLICIES: Users (Staff Only)
-- Allow users to view their own profile, and staff/admins to view all users
CREATE POLICY "Allow authenticated to view own profile" ON users FOR SELECT TO authenticated USING (auth.jwt() ->> 'email' = users.email OR check_is_operational_staff());
CREATE POLICY "Admins can manage all users" ON users FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- POLICIES: Clues
CREATE POLICY "View clues in incident" ON clues 
  FOR SELECT TO authenticated 
  USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));

CREATE POLICY "Allow anonymous to insert clues" ON clues
  FOR INSERT TO authenticated 
  WITH CHECK (is_anonymous_responder());

CREATE POLICY "Allow authenticated to view their own team history" ON responder_team_history
  FOR SELECT TO authenticated 
  USING (responder_id IN (SELECT responder_id FROM responders WHERE auth_uid = auth.uid()));
CREATE POLICY "Admins/Staff can manage all team history" ON responder_team_history
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- POLICIES: Team Responders (Junction Table)
CREATE POLICY "Allow authenticated to view active team memberships" ON team_responders
  FOR SELECT TO authenticated USING (is_team_active(team_id));
CREATE POLICY "Allow all authenticated to insert memberships in active incidents" ON team_responders
  FOR INSERT TO authenticated WITH CHECK ((responder_id = get_my_responder_id() AND is_team_active(team_id)) OR check_is_operational_staff());
CREATE POLICY "Allow authenticated to update their own membership" ON team_responders
  FOR UPDATE TO authenticated USING (responder_id = get_my_responder_id() OR check_is_operational_staff()) WITH CHECK (responder_id = get_my_responder_id() OR check_is_operational_staff());
CREATE POLICY "Allow authenticated to leave teams" ON team_responders
  FOR DELETE TO authenticated USING (responder_id = get_my_responder_id() OR check_is_operational_staff());
CREATE POLICY "Admins/Staff can manage all team memberships" ON team_responders
  FOR ALL TO authenticated USING (check_is_operational_staff()) WITH CHECK (check_is_operational_staff());

-- RPC: Secure Responder Check-in
-- Hardened to prevent access level escalation and enforce incident activation rules.
CREATE OR REPLACE FUNCTION checkin_responder_securely(
  p_incident_id TEXT,
  p_auth_uid UUID,
  p_name TEXT,
  p_agency TEXT,
  p_identifier TEXT,
  p_cell_phone TEXT,
  p_responder_type TEXT,
  p_special_skills TEXT[],
  p_vehicles JSONB DEFAULT '[]'::jsonb,
  p_status TEXT DEFAULT 'Staged',
  p_device_id TEXT DEFAULT NULL,
  p_access_level TEXT DEFAULT 'responder'
) RETURNS SETOF responders
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
  v_caller_is_staff BOOLEAN;
  v_final_access_level TEXT;
  v_new_responder_id UUID;
  v_veh RECORD;
BEGIN
  -- 1. Determine if the caller has authority to set elevated access levels
  v_caller_is_staff := check_is_operational_staff();
  
  -- 2. Prevent Access Level Escalation
  -- Only existing staff can grant staff/admin levels. Standard check-ins default to 'responder'.
  IF v_caller_is_staff THEN
    v_final_access_level := COALESCE(p_access_level, 'responder');
  ELSE
    v_final_access_level := 'responder';
  END IF;

  -- 3. Verify the incident is active
  IF NOT EXISTS (SELECT 1 FROM incidents WHERE incident_id = p_incident_id AND end_datetime IS NULL) THEN
    RAISE EXCEPTION 'Check-in blocked: Incident is closed or does not exist.';
  END IF;

  -- 4. Upsert Responder Record
  INSERT INTO responders (
    incident_id, auth_uid, name, agency, identifier, 
    cell_phone, responder_type, special_skills, 
    status, device_id, access_level, checkin_datetime
  )
  VALUES (
    p_incident_id, p_auth_uid, p_name, p_agency, p_identifier,
    p_cell_phone, p_responder_type, p_special_skills,
    p_status, p_device_id, v_final_access_level, NOW()
  )
  ON CONFLICT (incident_id, auth_uid) 
  DO UPDATE SET
    name = EXCLUDED.name,
    agency = EXCLUDED.agency,
    identifier = EXCLUDED.identifier,
    cell_phone = EXCLUDED.cell_phone,
    responder_type = EXCLUDED.responder_type,
    special_skills = EXCLUDED.special_skills,
    access_level = CASE WHEN v_caller_is_staff THEN EXCLUDED.access_level ELSE responders.access_level END,
    checkout_datetime = NULL
  RETURNING responder_id INTO v_new_responder_id;

  -- 5. Process Vehicles
  IF p_vehicles IS NOT NULL AND jsonb_array_length(p_vehicles) > 0 THEN
    FOR v_veh IN SELECT * FROM jsonb_to_recordset(p_vehicles) AS x(designation TEXT, type TEXT) LOOP
      INSERT INTO vehicles (incident_id, responder_id, designation, type, status, checkin_datetime)
      VALUES (p_incident_id, v_new_responder_id, v_veh.designation, v_veh.type, 'Staged', NOW())
      ON CONFLICT (incident_id, designation) DO UPDATE SET
        checkout_datetime = NULL;
    END LOOP;
  END IF;

  RETURN QUERY SELECT * FROM responders WHERE responder_id = v_new_responder_id;
END;
$$;