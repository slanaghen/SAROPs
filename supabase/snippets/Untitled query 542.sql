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

-- RLS HELPERS
CREATE OR REPLACE FUNCTION is_anonymous_responder()
RETURNS BOOLEAN AS $func$
  SELECT (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE;
$func$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION check_is_operational_staff()
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 WHERE (auth.jwt() ->> 'access_level') IN ('staff', 'admin')
    UNION ALL
    SELECT 1 FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND access_level IN ('staff', 'admin')
    UNION ALL
    SELECT 1 FROM responders WHERE auth_uid = auth.uid() AND access_level IN ('staff', 'admin')
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_command_staff()
RETURNS BOOLEAN AS $func$
  SELECT check_is_operational_staff();
$func$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_my_responder_id() 
RETURNS UUID AS $func$
  SELECT responder_id FROM responders WHERE auth_uid = auth.uid() ORDER BY checkin_datetime DESC LIMIT 1;
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
  SELECT EXISTS (SELECT 1 FROM incidents WHERE incident_id = _incident_id AND end_datetime IS NULL);
$func$ LANGUAGE sql STABLE SECURITY DEFINER;

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
CREATE POLICY "Visible to all" ON incidents FOR SELECT USING (TRUE);
CREATE POLICY "Allow authenticated to start incidents" ON incidents FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Allow authenticated to setup incidents" ON incidents FOR UPDATE TO authenticated USING (end_datetime IS NULL);
CREATE POLICY "Staff update incidents" ON incidents FOR UPDATE TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Staff delete incidents" ON incidents FOR DELETE TO authenticated USING (check_is_operational_staff());

-- POLICIES: Operational Periods
CREATE POLICY "Visible to all" ON operational_periods FOR SELECT USING (TRUE);
CREATE POLICY "Allow authenticated to create op periods" ON operational_periods FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Allow authenticated to setup op periods" ON operational_periods FOR UPDATE TO authenticated USING (is_active_op_period(op_period_id));
CREATE POLICY "Staff update op periods" ON operational_periods FOR UPDATE TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Staff delete op periods" ON operational_periods FOR DELETE TO authenticated USING (check_is_operational_staff());

-- POLICIES: Vehicles
CREATE POLICY "Visible to all authenticated" ON vehicles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins/Staff manage vehicles" ON vehicles FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Responders
CREATE POLICY "View active responders" ON responders FOR SELECT TO authenticated
  USING (auth_uid = auth.uid() OR check_is_operational_staff() OR incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));
CREATE POLICY "Update own record" ON responders FOR UPDATE TO authenticated USING (auth_uid = auth.uid());

-- POLICIES: Teams
CREATE POLICY "View active teams" ON teams FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));
CREATE POLICY "Leaders update teams" ON teams FOR UPDATE TO authenticated USING (is_leader_of_team(team_id) OR check_is_operational_staff());

-- POLICIES: Assignments
CREATE POLICY "View active assignments" ON assignments FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));

-- POLICIES: Messaging
CREATE POLICY "View relevant messages" ON team_messages FOR SELECT TO authenticated 
  USING (team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id()) OR check_is_operational_staff());

-- POLICIES: Users (Staff Only)
CREATE POLICY "Staff view users" ON users FOR SELECT TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Users view own profile" ON users FOR SELECT TO authenticated 
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- POLICIES: Responder Team History
CREATE POLICY "Staff view all team history" ON responder_team_history FOR SELECT TO authenticated USING (check_is_operational_staff());
CREATE POLICY "Responders view own team history" ON responder_team_history FOR SELECT TO authenticated USING (responder_id = get_my_responder_id());
CREATE POLICY "Staff manage team history" ON responder_team_history FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Clues
CREATE POLICY "View clues in incident" ON clues FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));