-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- ICS Automation: Staffing
CREATE OR REPLACE FUNCTION create_staff_team_for_op()
RETURNS TRIGGER AS $func$
DECLARE
    _team_id UUID;
BEGIN
    INSERT INTO teams (op_period_id, team_name_number, sartopo_color_hex, type, status, last_par_check)
    VALUES (NEW.op_period_id, 'Staff', '#0000FF', 'Staff', 'Deployed', CURRENT_TIMESTAMP)
    ON CONFLICT (op_period_id) WHERE type = 'Staff' AND status != 'Disbanded'
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING team_id INTO _team_id;

    INSERT INTO assignments (op_period_id, title, resource_type, status, team_id)
    VALUES (NEW.op_period_id, 'Command Staff', 'Staff', 'Deployed', _team_id)
    ON CONFLICT (op_period_id, sartopo_id) DO UPDATE SET team_id = EXCLUDED.team_id;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ICS Automation: First Responder IC
CREATE OR REPLACE FUNCTION auto_assign_first_responder_as_ic()
RETURNS TRIGGER AS $func$
DECLARE
    _staff_team_id UUID;
BEGIN
    SELECT t.team_id INTO _staff_team_id FROM teams t
    JOIN operational_periods op ON t.op_period_id = op.op_period_id
    WHERE op.incident_id = NEW.incident_id AND t.type = 'Staff' AND t.leader_responder_id IS NULL
    ORDER BY op.op_number ASC LIMIT 1;

    IF _staff_team_id IS NOT NULL THEN
        INSERT INTO team_responders (team_id, responder_id, role)
        VALUES (_staff_team_id, NEW.responder_id, 'Incident Commander') ON CONFLICT DO NOTHING;

        UPDATE teams SET leader_responder_id = NEW.responder_id WHERE team_id = _staff_team_id;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Status Synchronization: Responder Access and State
CREATE OR REPLACE FUNCTION sync_responder_access_level()
RETURNS TRIGGER AS $func$
DECLARE
    _responder_id UUID;
    _team_id UUID;
    _team_status team_status;
    is_staff BOOLEAN;
    target_access access_level;
    target_status responder_status;
BEGIN
    _responder_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.responder_id ELSE NEW.responder_id END;
    
    SELECT tr.team_id, t.status, (t.type = 'Staff') INTO _team_id, _team_status, is_staff
    FROM team_responders tr JOIN teams t ON tr.team_id = t.team_id
    WHERE tr.responder_id = _responder_id AND t.status != 'Disbanded' LIMIT 1;

    is_staff := COALESCE(is_staff, false);
    target_access := CASE WHEN is_staff THEN 'staff'::access_level ELSE 'responder'::access_level END;

    IF _team_id IS NOT NULL THEN
        target_status := CASE 
            WHEN is_staff THEN 'Deployed'::responder_status
            WHEN _team_status = 'Staged' THEN 'Attached'::responder_status
            WHEN _team_status = 'Assigned' THEN 'Assigned'::responder_status
            WHEN _team_status = 'Deployed' THEN 'Deployed'::responder_status
            ELSE 'Staged'::responder_status
        END;
    ELSE
        target_status := 'Staged'::responder_status;
    END IF;

    UPDATE responders SET 
        access_level = CASE WHEN access_level = 'admin' THEN 'admin'::access_level ELSE target_access END,
        status = target_status
    WHERE responder_id = _responder_id AND (access_level IS DISTINCT FROM target_access OR status IS DISTINCT FROM target_status);
    RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Status Synchronization: Vehicles
CREATE OR REPLACE FUNCTION sync_vehicle_status_on_team_link()
RETURNS TRIGGER AS $func$
DECLARE
    _team_status team_status;
BEGIN
    IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
        SELECT status INTO _team_status FROM teams WHERE team_id = NEW.team_id;
        NEW.status := CASE 
            WHEN _team_status = 'Staged' THEN 'Attached'::responder_status
            WHEN _team_status = 'Assigned' THEN 'Assigned'::responder_status
            WHEN _team_status = 'Deployed' THEN 'Deployed'::responder_status
            ELSE NEW.status END;
    ELSIF NEW.team_id IS NULL AND OLD.team_id IS NOT NULL THEN
        NEW.status := 'Staged'::responder_status;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lifecycle Cleanup: Incident End
CREATE OR REPLACE FUNCTION cleanup_resources_on_incident_end()
RETURNS TRIGGER AS $func$
BEGIN
    IF NEW.end_datetime IS NOT NULL AND OLD.end_datetime IS NULL THEN
        UPDATE operational_periods SET end_datetime = NEW.end_datetime WHERE incident_id = NEW.incident_id AND end_datetime IS NULL;
        UPDATE assignments SET status = 'Incomplete', team_id = NULL WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id) AND status = 'Deployed';
        UPDATE assignments SET status = 'Planned', team_id = NULL WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id) AND status = 'Assigned';
        UPDATE teams SET status = 'Disbanded', last_par_check = NULL WHERE op_period_id IN (SELECT op_period_id FROM operational_periods WHERE incident_id = NEW.incident_id) AND status != 'Disbanded';
        UPDATE responders SET status = 'CheckedOut', checkout_datetime = NEW.end_datetime WHERE incident_id = NEW.incident_id AND checkout_datetime IS NULL;
        UPDATE vehicles SET status = 'CheckedOut', checkout_datetime = NEW.end_datetime WHERE incident_id = NEW.incident_id AND checkout_datetime IS NULL;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Membership Validation
CREATE OR REPLACE FUNCTION validate_responder_active_membership()
RETURNS TRIGGER AS $func$
BEGIN
    IF EXISTS (
        SELECT 1 FROM team_responders tr JOIN teams t ON tr.team_id = t.team_id
        WHERE tr.responder_id = NEW.responder_id AND tr.team_id != NEW.team_id AND t.status != 'Disbanded'
    ) THEN
        RAISE EXCEPTION 'Responder is already a member of another active team.';
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assignment Metrics
CREATE OR REPLACE FUNCTION sync_assignment_team_size()
RETURNS TRIGGER AS $func$
BEGIN
    IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id)) THEN
        NEW.team_size := (SELECT COUNT(*) FROM team_responders WHERE team_id = NEW.team_id);
    ELSIF TG_OP = 'UPDATE' AND NEW.team_id IS NULL THEN
        NEW.team_size := 0;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_assignment_size_on_membership_change()
RETURNS TRIGGER AS $func$
DECLARE
    _team_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END;
BEGIN
    UPDATE assignments SET team_size = (SELECT COUNT(*) FROM team_responders WHERE team_id = _team_id)
    WHERE team_id = _team_id;
    RETURN NULL;
END;
$func$ LANGUAGE plpgsql;

-- Assignment Status Synchronization
CREATE OR REPLACE FUNCTION sync_team_status_on_assignment_update()
RETURNS TRIGGER AS $func$
DECLARE
    _target_team_status team_status;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.team_id IS NOT NULL AND NEW.team_id IS NULL THEN
        UPDATE teams SET status = 'Staged'::team_status WHERE team_id = OLD.team_id AND status != 'Disbanded';
    END IF;

    IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
        _target_team_status := CASE
            WHEN NEW.status = 'Planned' THEN 'Staged'::team_status
            WHEN NEW.status = 'Assigned' THEN 'Assigned'::team_status
            WHEN NEW.status = 'Deployed' THEN 'Deployed'::team_status
            WHEN NEW.status = 'Completed' OR NEW.status = 'Incomplete' THEN 'Disbanded'::team_status
            ELSE NULL
        END;

        IF _target_team_status IS NOT NULL THEN
            UPDATE teams SET status = _target_team_status,
                last_par_check = CASE WHEN _target_team_status = 'Deployed' THEN CURRENT_TIMESTAMP ELSE last_par_check END
            WHERE team_id = NEW.team_id AND status IS DISTINCT FROM _target_team_status;
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Operational Control Logic: Start the next operational period
-- Closes the current period and carries over active teams and assignments.
CREATE OR REPLACE FUNCTION start_next_operational_period(p_incident_id TEXT, p_current_op_period_id UUID)
RETURNS UUID AS $func$
DECLARE
    _new_op_period_id UUID := gen_random_uuid();
    _current_op_number INTEGER;
    _team_id_map JSONB := '{}'::jsonb;
    _old_team RECORD;
    _new_team_id UUID;
    _old_asn RECORD;
    _new_staff_team_id UUID;
BEGIN
    -- 1. Get current OP info
    SELECT op_number INTO _current_op_number
    FROM operational_periods
    WHERE op_period_id = p_current_op_period_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Current operational period not found.';
    END IF;

    -- 2. Create the new OP
    INSERT INTO operational_periods (op_period_id, incident_id, op_number, start_datetime)
    VALUES (_new_op_period_id, p_incident_id, _current_op_number + 1, CURRENT_TIMESTAMP);

    -- 3. Close the old OP
    UPDATE operational_periods
    SET end_datetime = CURRENT_TIMESTAMP
    WHERE op_period_id = p_current_op_period_id;

    -- 4. Find the auto-created Staff team in the new OP (created via trigger)
    SELECT team_id INTO _new_staff_team_id
    FROM teams
    WHERE op_period_id = _new_op_period_id AND type = 'Staff' AND status != 'Disbanded'
    LIMIT 1;

    -- 5. Transition Teams
    FOR _old_team IN (
        SELECT * FROM teams 
        WHERE op_period_id = p_current_op_period_id 
          AND status != 'Disbanded'
    ) LOOP
        IF _old_team.type = 'Staff' AND _new_staff_team_id IS NOT NULL THEN
            UPDATE teams SET
                leader_responder_id = _old_team.leader_responder_id,
                equipment = _old_team.equipment,
                sartopo_color_hex = _old_team.sartopo_color_hex
            WHERE team_id = _new_staff_team_id;
            _new_team_id := _new_staff_team_id;
        ELSE
            _new_team_id := gen_random_uuid();
            INSERT INTO teams (team_id, op_period_id, team_name_number, sartopo_color_hex, type, status, leader_responder_id, equipment, last_par_check)
            VALUES (_new_team_id, _new_op_period_id, _old_team.team_name_number, _old_team.sartopo_color_hex, _old_team.type, _old_team.status, _old_team.leader_responder_id, _old_team.equipment, _old_team.last_par_check);
        END IF;

        _team_id_map := _team_id_map || jsonb_build_object(_old_team.team_id::TEXT, _new_team_id::TEXT);
        INSERT INTO team_responders (team_id, responder_id, role)
        SELECT _new_team_id, responder_id, role FROM team_responders WHERE team_id = _old_team.team_id ON CONFLICT DO NOTHING;

        -- Transition Vehicles (Requirement: Ensure vehicle attachments carry over to the new OP)
        UPDATE vehicles SET team_id = _new_team_id WHERE team_id = _old_team.team_id;
    END LOOP;

    -- 6. Transition Assignments
    FOR _old_asn IN (
        SELECT * FROM assignments 
        WHERE op_period_id = p_current_op_period_id 
          AND status NOT IN ('Completed', 'Incomplete')
    ) LOOP
        IF _old_asn.title = 'Command Staff' THEN
            UPDATE assignments SET 
                status = _old_asn.status, segment = _old_asn.segment, resource_type = _old_asn.resource_type, team_size = _old_asn.team_size, frequency_primary = _old_asn.frequency_primary, description = _old_asn.description, debrief_narrative = _old_asn.debrief_narrative, probability_of_detection = _old_asn.probability_of_detection, priority = _old_asn.priority, transportation = _old_asn.transportation, time_allocated = _old_asn.time_allocated, hazards = _old_asn.hazards, prepared_by = _old_asn.prepared_by, team_id = _new_staff_team_id, origin = _old_asn.origin
            WHERE op_period_id = _new_op_period_id AND title = 'Command Staff';
        ELSE
            INSERT INTO assignments (op_period_id, sartopo_id, status, segment, resource_type, team_size, frequency_primary, description, debrief_narrative, probability_of_detection, priority, transportation, time_allocated, hazards, prepared_by, title, is_orphaned, team_id, origin)
            VALUES (_new_op_period_id, _old_asn.sartopo_id, _old_asn.status, _old_asn.segment, _old_asn.resource_type, _old_asn.team_size, _old_asn.frequency_primary, _old_asn.description, _old_asn.debrief_narrative, _old_asn.probability_of_detection, _old_asn.priority, _old_asn.transportation, _old_asn.time_allocated, _old_asn.hazards, _old_asn.prepared_by, _old_asn.title, _old_asn.is_orphaned, (_team_id_map->>(_old_asn.team_id::TEXT))::UUID, _old_asn.origin);
        END IF;
    END LOOP;

    RETURN _new_op_period_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update responder statuses and assignment status when a team status changes
CREATE OR REPLACE FUNCTION sync_team_members_on_status_change()
RETURNS TRIGGER AS $func$
DECLARE
    _target_responder_status responder_status;
    _target_assignment_status assignment_status;
BEGIN
    _target_responder_status := CASE
        WHEN NEW.status = 'Staged' THEN 'Attached'::responder_status
        WHEN NEW.status = 'Assigned' THEN 'Assigned'::responder_status
        WHEN NEW.status = 'Deployed' THEN 'Deployed'::responder_status
        WHEN NEW.status = 'Disbanded' THEN 'Staged'::responder_status
        ELSE NULL
    END;

    IF _target_responder_status IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE responders
        SET status = _target_responder_status
        WHERE responder_id IN (SELECT responder_id FROM team_responders WHERE team_id = NEW.team_id)
          AND status IS DISTINCT FROM _target_responder_status;

        UPDATE vehicles
        SET status = _target_responder_status
        WHERE team_id = NEW.team_id
          AND status IS DISTINCT FROM _target_responder_status;
    END IF;

    IF NEW.status = 'Disbanded' AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE responder_team_history
        SET detached_datetime = CURRENT_TIMESTAMP
        WHERE team_id = NEW.team_id AND detached_datetime IS NULL;
    END IF;

    _target_assignment_status := CASE
        WHEN NEW.status = 'Assigned' THEN 'Assigned'::assignment_status
        WHEN NEW.status = 'Deployed' THEN 'Deployed'::assignment_status
        ELSE NULL
    END;

    IF _target_assignment_status IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE assignments
        SET status = _target_assignment_status
        WHERE team_id = NEW.team_id AND status IS DISTINCT FROM _target_assignment_status;
    END IF;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate team reactivation
CREATE OR REPLACE FUNCTION validate_team_activation()
RETURNS TRIGGER AS $func$
BEGIN
    IF OLD.status = 'Disbanded' AND NEW.status != 'Disbanded' THEN
        IF EXISTS (
            SELECT 1 FROM team_responders tr JOIN team_responders tr2 ON tr.responder_id = tr2.responder_id
            JOIN teams t2 ON tr2.team_id = t2.team_id
            WHERE tr.team_id = NEW.team_id AND tr2.team_id != NEW.team_id AND t2.status != 'Disbanded'
        ) THEN RAISE EXCEPTION 'One or more members of this team are already assigned to other active teams.';
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate team leader assignments
CREATE OR REPLACE FUNCTION validate_team_leader_membership()
RETURNS TRIGGER AS $func$
BEGIN
    IF NEW.leader_responder_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.leader_responder_id IS DISTINCT FROM NEW.leader_responder_id) THEN
        IF EXISTS (
            SELECT 1 FROM team_responders tr JOIN teams t ON tr.team_id = t.team_id
            WHERE tr.responder_id = NEW.leader_responder_id AND tr.team_id != NEW.team_id AND t.status != 'Disbanded'
        ) THEN RAISE EXCEPTION 'Responder is already assigned as a member or leader of another active team.';
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;