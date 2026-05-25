CREATE OR REPLACE FUNCTION public.seed_data_specific()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions to bypass RLS for development seeding
AS $$
DECLARE
    latest_incident_id TEXT;
    latest_op_id UUID;
    incident_start_time TIMESTAMP WITH TIME ZONE;
    assigned_responder_auth_uid UUID;
BEGIN
    -- 1. Identify the most recently created incident and operational period
    SELECT incident_id, start_datetime INTO latest_incident_id, incident_start_time
    FROM incidents
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT op_period_id INTO latest_op_id
    FROM operational_periods
    WHERE incident_id = latest_incident_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Validation to ensure an incident and op period exist
    IF latest_incident_id IS NULL THEN
        RAISE EXCEPTION 'No incident found. Please create an incident first.';
    END IF;
    IF latest_op_id IS NULL THEN
        RAISE EXCEPTION 'No operational period found for incident %. Please create one first.', latest_incident_id;
    END IF;

    -- 2. Identify the auth_uid from the most recently created responder whose status is 'Assigned'
    SELECT auth_uid INTO assigned_responder_auth_uid
    FROM responders
    WHERE status = 'Assigned' AND auth_uid IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF assigned_responder_auth_uid IS NULL THEN
        RAISE EXCEPTION 'No assigned responder with an auth_uid found. Please ensure at least one responder is checked in and assigned.';
    END IF;

    -- 3. Create 15 assignments with descriptions, types, and TAC channels
    INSERT INTO assignments (op_period_id, title, description, resource_type, frequency_primary, status)
    VALUES
    (latest_op_id, 'Hasty 1', 'Rapid sweep of primary trail corridor', 'Hasty', 'TAC 1', 'Planned'),
    (latest_op_id, 'Hasty 2', 'Rapid sweep of north creek bed', 'Hasty', 'TAC 1', 'Planned'),
    (latest_op_id, 'Grid Alpha', 'Thorough grid search of Sector 1', 'Ground', 'TAC 2', 'Planned'),
    (latest_op_id, 'Grid Beta', 'Thorough grid search of Sector 2', 'Ground', 'TAC 2', 'Planned'),
    (latest_op_id, 'Grid Gamma', 'Thorough grid search of Sector 3', 'Ground', 'TAC 2', 'Planned'),
    (latest_op_id, 'K9 Block A', 'Area search of high-probability block A', 'Dog', 'TAC 3', 'Planned'),
    (latest_op_id, 'K9 Block B', 'Area search of high-probability block B', 'Dog', 'TAC 3', 'Planned'),
    (latest_op_id, 'UAS Recon 1', 'Thermal scan of ridge line and cliffs', 'Other', 'UAV-DATA', 'Planned'),
    (latest_op_id, 'Road Patrol North', 'Vehicle patrol of Hwy 40 North', 'Vehicle', 'ROAD-BASE', 'Planned'),
    (latest_op_id, 'Road Patrol South', 'Vehicle patrol of Hwy 40 South', 'Vehicle', 'ROAD-BASE', 'Planned'),
    (latest_op_id, 'Water Recon', 'Shoreline inspection of reservoir', 'Water', 'MARINE 1', 'Planned'),
    (latest_op_id, 'Tracking 1', 'Sign cutting at Last Known Point', 'Tracking', 'TAC 4', 'Planned'),
    (latest_op_id, 'Summit Relay', 'Establish radio relay at Peak 10', 'Other', 'TAC 5', 'Planned'),
    (latest_op_id, 'LZ Preparation', 'Clear and mark helicopter landing zone Alpha', 'Helicopter', 'AIR-GUARD', 'Planned'),
    (latest_op_id, 'Medical Standby', 'Medical and logistics support at Base', 'Medical', 'EMS-LINK', 'Planned');

    -- 4. Create 31 responders (1 Dog, 1 UAS, 29 general)
    -- All associated with the most recently created incident and sharing the same auth_uid.

    -- Dog Handler
    INSERT INTO responders (name, incident_id, agency, identifier, device_id, special_skills, checkin_datetime, status, auth_uid)
    VALUES (
        'Sarah Miller (K9)',
        latest_incident_id,
        'K9 Search Unit',
        'K9-302',
        'dev_k9_' || latest_incident_id || '_' || substr(md5(random()::text), 1, 4),
        'Air Scent Dog',
        incident_start_time,
        'Staged',
        assigned_responder_auth_uid
    );

    -- UAS Pilot
    INSERT INTO responders (name, incident_id, agency, identifier, device_id, special_skills, checkin_datetime, status, auth_uid)
    VALUES (
        'James Chen (UAS)',
        latest_incident_id,
        'UAS Response',
        'PILOT-14',
        'dev_uas_' || latest_incident_id || '_' || substr(md5(random()::text), 1, 4),
        'UAS',
        incident_start_time,
        'Staged',
        assigned_responder_auth_uid
    );

    -- 29 General Responders
    FOR i IN 1..29 LOOP
        INSERT INTO responders (name, incident_id, agency, identifier, device_id, checkin_datetime, status, auth_uid)
        VALUES (
            'Responder ' || i,
            latest_incident_id,
            'County SAR',
            'ID-' || (1000 + i),
            'dev_res_' || i || '_' || latest_incident_id || '_' || substr(md5(random()::text), 1, 4),
            incident_start_time,
            'Staged',
            assigned_responder_auth_uid
        );
    END LOOP;

    RAISE NOTICE 'Success: Seeded 15 assignments and 31 responders for Incident % (OP %).', latest_incident_id, latest_op_id;
END $$;

-- Grant access to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.seed_data_specific() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_data_specific() TO anon;