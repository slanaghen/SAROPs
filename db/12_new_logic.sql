-- /db/12_new_logic.sql
-- This file implements the one-to-many relationship between Teams and Assignments.

-- 1. Drop the old trigger that enforces a 1:1 status sync.
-- This logic is now replaced by an aggregate status calculation.
DROP TRIGGER IF EXISTS trigger_sync_team_status_from_assignment ON public.assignments;

-- 2. A team may be linked to any number of assignments (e.g. a queue of
-- Planned/Assigned tasks), but at most one of those assignments may be
-- Deployed at a time -- a team can only be actively executing one task.
-- This is a partial unique index (not a plain UNIQUE on team_id) so many
-- non-Deployed assignments can still share a team_id freely.
DROP INDEX IF EXISTS public.one_deployed_assignment_per_team;
CREATE UNIQUE INDEX one_deployed_assignment_per_team
ON public.assignments (team_id)
WHERE status = 'Deployed' AND team_id IS NOT NULL;

-- 3. Create a function to calculate and update a team's aggregate status based on its assignments.
CREATE OR REPLACE FUNCTION public.update_team_status_from_assignments(_team_id UUID)
RETURNS void AS $$
DECLARE
    _new_status public.team_status;
BEGIN
    IF _team_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        CASE
            WHEN EXISTS (SELECT 1 FROM public.assignments WHERE team_id = _team_id AND status = 'Deployed') THEN 'Deployed'::public.team_status
            WHEN EXISTS (SELECT 1 FROM public.assignments WHERE team_id = _team_id AND status = 'Assigned') THEN 'Assigned'::public.team_status
            ELSE 'Staged'::public.team_status
        END
    INTO _new_status;

    UPDATE public.teams
    SET status = _new_status
    WHERE team_id = _team_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a trigger to call the status update function whenever an assignment changes.
CREATE OR REPLACE FUNCTION public.handle_assignment_change_for_team_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When an assignment is created, updated, or deleted, we need to recalculate
    -- the status for both the old team (if it exists) and the new team (if it exists).
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.update_team_status_from_assignments(OLD.team_id);
    ELSIF (TG_OP = 'INSERT') THEN
        PERFORM public.update_team_status_from_assignments(NEW.team_id);
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If team assignment changed or status changed
        IF OLD.team_id IS DISTINCT FROM NEW.team_id OR OLD.status IS DISTINCT FROM NEW.status THEN
            PERFORM public.update_team_status_from_assignments(OLD.team_id);
            PERFORM public.update_team_status_from_assignments(NEW.team_id);
        END IF;
    END IF;
    RETURN NULL; -- The result is ignored since this is an AFTER trigger
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_team_status_on_assignment_change
AFTER INSERT OR UPDATE OR DELETE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.handle_assignment_change_for_team_status();

-- 5. Create a trigger to unassign a team from all assignments when it is disbanded.
CREATE OR REPLACE FUNCTION public.unassign_team_on_disband()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Disbanded' AND OLD.status != 'Disbanded' THEN
        UPDATE public.assignments
        SET team_id = NULL
        WHERE team_id = NEW.team_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_unassign_on_disband
AFTER UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.unassign_team_on_disband();

-- Drop the old signature (p_equipment was TEXT[]) to avoid "function name not
-- unique" ambiguity now that it has been changed to JSONB to match teams.equipment.
DROP FUNCTION IF EXISTS create_team_with_resources(UUID, TEXT, TEXT, public.team_type, UUID, TEXT[], TEXT, UUID[], JSONB, UUID[]);

-- This function atomically creates a team and attaches its resources
-- to prevent race conditions inherent in a client-side "read-modify-write" pattern.
CREATE OR REPLACE FUNCTION create_team_with_resources(
    p_op_period_id UUID,
    p_incident_id TEXT,
    p_team_name_number TEXT,
    p_type public.team_type,
    p_leader_responder_id UUID,
    p_equipment JSONB,
    p_sartopo_color_hex TEXT,
    p_responder_ids UUID[],
    p_responder_roles JSONB,
    p_vehicle_ids UUID[]
)
RETURNS teams AS $$
DECLARE
    _new_team teams;
    _existing_team_id UUID;
    current_responder_id UUID;
    new_role TEXT;
BEGIN
    -- 1. Uniqueness Check (within the entire incident)
    SELECT t.team_id INTO _existing_team_id
    FROM teams t
    JOIN operational_periods op ON t.op_period_id = op.op_period_id
    WHERE op.incident_id = p_incident_id AND t.team_name_number = p_team_name_number;

    IF _existing_team_id IS NOT NULL THEN
        RAISE EXCEPTION 'A team named "%" already exists in this incident.', p_team_name_number;
    END IF;

    -- 2. Insert the new team
    INSERT INTO teams (op_period_id, team_name_number, type, leader_responder_id, equipment, sartopo_color_hex, status)
    VALUES (p_op_period_id, p_team_name_number, p_type, p_leader_responder_id, p_equipment, p_sartopo_color_hex, 'Staged')
    RETURNING * INTO _new_team;

    -- 3. Attach vehicles
    IF array_length(p_vehicle_ids, 1) > 0 THEN
        UPDATE vehicles SET team_id = _new_team.team_id, status = 'Attached' WHERE vehicle_id = ANY(p_vehicle_ids);
    END IF;

    RETURN _new_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_team_with_resources(UUID, TEXT, TEXT, public.team_type, UUID, JSONB, TEXT, UUID[], JSONB, UUID[]) TO authenticated;

-- This function reconciles a team's membership and vehicle assignments to match
-- a desired list. It is called by teamService.js's updateTeam() whenever a team
-- is edited (e.g. adding a new member).
--
-- NOTE: This function previously existed only as an ad-hoc addition directly on
-- the remote database and was never checked into these schema files. Its DELETE
-- treated p_responder_ids as the complete desired roster, but the client
-- (TeamFormModal.jsx) always excludes the team leader/IC from that list, since
-- the leader is tracked separately via teams.leader_responder_id. The result:
-- every reconciliation deleted the leader's own team_responders row, which is
-- why the Incident Commander disappeared from the ICS chart as soon as a second
-- member was added. The fix is to always preserve the current leader's row,
-- regardless of whether they appear in p_responder_ids.
CREATE OR REPLACE FUNCTION reconcile_team_resources(
    p_team_id UUID,
    p_responder_ids UUID[],
    p_responder_roles JSONB,
    p_vehicle_ids UUID[]
)
RETURNS void AS $$
DECLARE
    current_responder_id UUID;
    new_role TEXT;
    _leader_id UUID;
BEGIN
    SELECT leader_responder_id INTO _leader_id FROM teams WHERE team_id = p_team_id;

    -- 1. Reconcile Responders
    -- Remove responders who are no longer on the team, but never the team leader/IC.
    DELETE FROM team_responders
    WHERE team_id = p_team_id
      AND responder_id NOT IN (SELECT unnest(p_responder_ids))
      AND responder_id IS DISTINCT FROM _leader_id;

    -- Upsert current members to add new ones or update roles
    FOREACH current_responder_id IN ARRAY p_responder_ids
    LOOP
        new_role := p_responder_roles->>current_responder_id::TEXT;
        INSERT INTO team_responders (team_id, responder_id, role)
        VALUES (p_team_id, current_responder_id, new_role)
        ON CONFLICT (team_id, responder_id) DO UPDATE
        SET role = EXCLUDED.role;
    END LOOP;

    -- 2. Reconcile Vehicles
    -- Detach vehicles that are no longer assigned to this team
    UPDATE vehicles SET team_id = NULL WHERE team_id = p_team_id AND vehicle_id NOT IN (SELECT unnest(p_vehicle_ids));
    -- Attach new vehicles to this team
    UPDATE vehicles SET team_id = p_team_id WHERE vehicle_id = ANY(p_vehicle_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION reconcile_team_resources(UUID, UUID[], JSONB, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reconcile_team_resources(UUID, UUID[], JSONB, UUID[]) TO authenticated;
