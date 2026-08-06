-- /db/13_assignment_logic.sql

-- This function atomically creates an assignment, generating a sequential name
-- if one is not provided. This prevents race conditions inherent in a
-- client-side "read-modify-write" pattern for name generation.
CREATE OR REPLACE FUNCTION create_assignment_atomic(
    p_op_period_id UUID,
    p_incident_id TEXT,
    p_title TEXT,
    p_segment TEXT,
    p_resource_type TEXT,
    p_team_size INT,
    p_frequency_primary TEXT,
    p_description TEXT,
    p_priority TEXT,
    p_transportation TEXT,
    p_time_allocated TEXT,
    p_hazards TEXT,
    p_prepared_by TEXT
)
RETURNS assignments AS $$
DECLARE
    _final_title TEXT;
    _used_suffixes TEXT[];
    _next_suffix CHAR(1);
    _new_assignment assignments;
BEGIN
    IF p_title IS NOT NULL AND p_title <> '' THEN
        _final_title := p_title;
        -- Uniqueness check
        IF EXISTS (
            SELECT 1 FROM assignments a
            JOIN operational_periods op ON a.op_period_id = op.op_period_id
            WHERE op.incident_id = p_incident_id AND a.title = _final_title
        ) THEN
            RAISE EXCEPTION 'An assignment named "%" already exists in this incident.', _final_title;
        END IF;
    ELSE
        -- Logic to generate the next available name
        SELECT array_agg(SUBSTRING(title FROM (LENGTH(p_segment) + 1) FOR 1))
        INTO _used_suffixes
        FROM assignments
        WHERE op_period_id = p_op_period_id AND segment = p_segment AND title ~ ('^' || p_segment || '[A-Z]$');

        _used_suffixes := COALESCE(_used_suffixes, '{}');

        _next_suffix := (SELECT chr(s.i) FROM generate_series(65, 90) AS s(i) WHERE chr(s.i) <> ALL(_used_suffixes) ORDER BY s.i LIMIT 1);
        _final_title := p_segment || COALESCE(_next_suffix, 'A');
    END IF;

    -- Insert the new assignment
    INSERT INTO assignments (op_period_id, title, segment, resource_type, team_size, frequency_primary, description, priority, transportation, time_allocated, hazards, prepared_by, status, origin)
    VALUES (p_op_period_id, _final_title, p_segment, p_resource_type, p_team_size, p_frequency_primary, p_description, p_priority, p_transportation, p_time_allocated, p_hazards, p_prepared_by, 'Planned', 'SAROps')
    RETURNING * INTO _new_assignment;

    RETURN _new_assignment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_assignment_atomic(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;