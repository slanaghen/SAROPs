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
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_team_history ENABLE ROW LEVEL SECURITY;

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
    SELECT 1 FROM public.users WHERE email = (auth.jwt() ->> 'email') AND access_level IN ('staff', 'admin')
    UNION ALL
    SELECT 1 FROM public.responders WHERE auth_uid = auth.uid() AND access_level IN ('staff', 'admin')
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public; -- Already correct

CREATE OR REPLACE FUNCTION is_admin_or_command_staff()
RETURNS BOOLEAN AS $func$
  SELECT check_is_operational_staff();
$func$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_my_responder_id() 
RETURNS UUID AS $func$
  SELECT responder_id FROM public.responders WHERE auth_uid = auth.uid() ORDER BY checkin_datetime DESC LIMIT 1;
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public; -- Already correct

CREATE OR REPLACE FUNCTION is_leader_of_team(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE team_id = _team_id AND leader_responder_id = get_my_responder_id());
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_member_of_team(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM public.team_responders WHERE team_id = _team_id AND responder_id = get_my_responder_id());
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_member_of_assignment(_assignment_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.team_responders tr ON a.team_id = tr.team_id
    WHERE a.assignment_id = _assignment_id 
      AND tr.responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_leader_of_assignment(_assignment_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.teams t ON a.team_id = t.team_id
    WHERE a.assignment_id = _assignment_id 
      AND t.leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_leader_of_member(_member_responder_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.team_responders tr
    JOIN public.teams t ON tr.team_id = t.team_id
    WHERE tr.responder_id = _member_responder_id 
      AND t.leader_responder_id = get_my_responder_id()
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_incident_active(_incident_id TEXT)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM public.incidents WHERE incident_id = _incident_id AND end_datetime IS NULL);
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_active_op_period(_op_period_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.operational_periods op JOIN public.incidents i ON op.incident_id = i.incident_id
    WHERE op.op_period_id = _op_period_id AND i.end_datetime IS NULL
  );
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_team_active(_team_id UUID)
RETURNS BOOLEAN AS $func$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE team_id = _team_id AND is_active_op_period(op_period_id));
$func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- POLICIES: Incidents
DROP POLICY IF EXISTS "Visible to all" ON incidents;
CREATE POLICY "Visible to all" ON incidents FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Allow authenticated to start incidents" ON incidents;
CREATE POLICY "Allow authenticated to start incidents" ON incidents FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Allow authenticated to setup incidents" ON incidents;
CREATE POLICY "Allow authenticated to setup incidents" ON incidents FOR UPDATE TO authenticated USING (end_datetime IS NULL);
DROP POLICY IF EXISTS "Staff manage incidents" ON incidents;
CREATE POLICY "Staff manage incidents" ON incidents FOR ALL TO authenticated USING (check_is_operational_staff());
DROP POLICY IF EXISTS "Staff update incidents" ON incidents;
CREATE POLICY "Staff update incidents" ON incidents FOR UPDATE TO authenticated USING (check_is_operational_staff());
DROP POLICY IF EXISTS "Staff delete incidents" ON incidents;
CREATE POLICY "Staff delete incidents" ON incidents FOR DELETE TO authenticated USING (check_is_operational_staff());

-- POLICIES: Operational Periods
DROP POLICY IF EXISTS "Visible to all" ON operational_periods;
CREATE POLICY "Visible to all" ON operational_periods FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Allow authenticated to create op periods" ON operational_periods;
CREATE POLICY "Allow authenticated to create op periods" ON operational_periods FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Staff manage op periods" ON operational_periods;
CREATE POLICY "Staff manage op periods" ON operational_periods FOR ALL TO authenticated USING (check_is_operational_staff());
DROP POLICY IF EXISTS "Allow authenticated to setup op periods" ON operational_periods;
CREATE POLICY "Allow authenticated to setup op periods" ON operational_periods FOR UPDATE TO authenticated USING (is_active_op_period(op_period_id));
DROP POLICY IF EXISTS "Staff update op periods" ON operational_periods;
CREATE POLICY "Staff update op periods" ON operational_periods FOR UPDATE TO authenticated USING (check_is_operational_staff());
DROP POLICY IF EXISTS "Staff delete op periods" ON operational_periods;
CREATE POLICY "Staff delete op periods" ON operational_periods FOR DELETE TO authenticated USING (check_is_operational_staff());

-- POLICIES: Vehicles
DROP POLICY IF EXISTS "Visible to all authenticated" ON vehicles;
CREATE POLICY "Visible to all authenticated" ON vehicles FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Admins/Staff manage vehicles" ON vehicles;
CREATE POLICY "Admins/Staff manage vehicles" ON vehicles FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Responders
DROP POLICY IF EXISTS "View active responders" ON responders;
CREATE POLICY "View active responders" ON responders FOR SELECT TO authenticated
  USING (auth_uid = auth.uid() OR check_is_operational_staff() OR incident_id IN (SELECT incident_id FROM incidents WHERE end_datetime IS NULL));
DROP POLICY IF EXISTS "Staff manage responders" ON responders;
CREATE POLICY "Staff manage responders" ON responders FOR ALL TO authenticated USING (check_is_operational_staff());
DROP POLICY IF EXISTS "Update own record" ON responders;
CREATE POLICY "Update own record" ON responders FOR UPDATE TO authenticated USING (auth_uid = auth.uid());

-- POLICIES: Teams
DROP POLICY IF EXISTS "View active teams" ON teams;
CREATE POLICY "View active teams" ON teams FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));
DROP POLICY IF EXISTS "Staff manage teams" ON teams;
CREATE POLICY "Staff manage teams" ON teams FOR ALL TO authenticated USING (check_is_operational_staff());
DROP POLICY IF EXISTS "Leaders update teams" ON teams;
CREATE POLICY "Leaders update teams" ON teams FOR UPDATE TO authenticated USING (is_leader_of_team(team_id) OR check_is_operational_staff());

-- POLICIES: Team Responders (Junction)
DROP POLICY IF EXISTS "Visible to authenticated" ON team_responders;
CREATE POLICY "Visible to authenticated" ON team_responders FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Staff manage team responders" ON team_responders;
CREATE POLICY "Staff manage team responders" ON team_responders FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Assignments
DROP POLICY IF EXISTS "View active assignments" ON assignments;
CREATE POLICY "View active assignments" ON assignments FOR SELECT TO authenticated
  USING (op_period_id IN (SELECT op_period_id FROM operational_periods op JOIN incidents i ON op.incident_id = i.incident_id WHERE i.end_datetime IS NULL));
DROP POLICY IF EXISTS "Staff manage assignments" ON assignments;
CREATE POLICY "Staff manage assignments" ON assignments FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Messaging
DROP POLICY IF EXISTS "View relevant messages" ON team_messages;
CREATE POLICY "View relevant messages" ON team_messages FOR SELECT TO authenticated 
  USING (team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id()) OR check_is_operational_staff());
DROP POLICY IF EXISTS "Staff/Members send messages" ON team_messages;
CREATE POLICY "Staff/Members send messages" ON team_messages FOR INSERT TO authenticated 
  WITH CHECK (team_id IN (SELECT team_id FROM team_responders WHERE responder_id = get_my_responder_id()) OR check_is_operational_staff());

-- POLICIES: Users (Staff Only)
DROP POLICY IF EXISTS "Staff view users" ON users;
CREATE POLICY "Staff view users" ON users FOR SELECT TO authenticated USING (check_is_operational_staff());
DROP POLICY IF EXISTS "Users view own profile" ON users;
CREATE POLICY "Users view own profile" ON users FOR SELECT TO authenticated 
  USING (email = (auth.jwt() ->> 'email'));

-- POLICIES: Responder Team History
DROP POLICY IF EXISTS "Staff view all team history" ON responder_team_history;
CREATE POLICY "Staff view all team history" ON responder_team_history FOR SELECT TO authenticated USING (check_is_operational_staff());
DROP POLICY IF EXISTS "Responders view own team history" ON responder_team_history;
CREATE POLICY "Responders view own team history" ON responder_team_history FOR SELECT TO authenticated USING (responder_id = get_my_responder_id());
DROP POLICY IF EXISTS "Staff manage team history" ON responder_team_history;
CREATE POLICY "Staff manage team history" ON responder_team_history FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Clues
DROP POLICY IF EXISTS "View clues in incident" ON clues;
CREATE POLICY "View clues in incident" ON clues FOR SELECT TO authenticated USING (incident_id IN (SELECT incident_id FROM responders WHERE auth_uid = auth.uid()));
DROP POLICY IF EXISTS "Staff manage clues" ON clues;
CREATE POLICY "Staff manage clues" ON clues FOR ALL TO authenticated USING (check_is_operational_staff());

-- POLICIES: Action Logs
DROP POLICY IF EXISTS "View logs" ON action_logs;
CREATE POLICY "View logs" ON action_logs FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Staff/System log actions" ON action_logs;
CREATE POLICY "Staff/System log actions" ON action_logs FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Staff manage logs" ON action_logs;
CREATE POLICY "Staff manage logs" ON action_logs FOR ALL TO authenticated USING (check_is_operational_staff());