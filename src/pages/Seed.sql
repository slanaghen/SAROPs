DO $$
DECLARE
    target_inc_id TEXT;
    target_op_id UUID;
    inc_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. Identify the most recently created incident and operational period
    SELECT incident_id, start_datetime INTO target_inc_id, inc_start
    FROM incidents
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT op_period_id INTO target_op_id
    FROM operational_periods
    WHERE incident_id = target_inc_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF target_inc_id IS NULL OR target_op_id IS NULL THEN
        RAISE EXCEPTION 'No incident or operational period found. Please initialize an incident first.';
    END IF;

    -- 2. Create 15 assignments with descriptions, types, and TAC channels
    INSERT INTO assignments (op_period_id, title, description, resource_type, frequency_primary, status)
    VALUES
    (target_op_id, 'Sector Alpha Search', 'Thorough grid search of the northern forest.', 'Ground', 'TAC 1', 'Planned'),
    (target_op_id, 'Sector Bravo Sweep', 'Hasty search of the eastern trail system.', 'Hasty', 'TAC 2', 'Planned'),
    (target_op_id, 'River Bank Recon', 'Visual inspection of the shoreline.', 'Water', 'MARINE 1', 'Planned'),
    (target_op_id, 'Ridge Point UAV', 'UAS flight to check high cliffs.', 'Other', 'UAV-DATA', 'Planned'),
    (target_op_id, 'Meadow Grid', 'Linear search through western clearings.', 'Ground', 'TAC 1', 'Planned'),
    (target_op_id, 'South Bowl K9', 'Area search with canine assistance.', 'Dog', 'TAC 3', 'Planned'),
    (target_op_id, 'Road Corridor A', 'Vehicle patrol of FS 301.', 'Vehicle', 'FS-CH', 'Planned'),
    (target_op_id, 'Summit Flight', 'Aerial observation of peaks.', 'UAS', 'AIR-GUARD', 'Planned'),
    (target_op_id, 'Creek Bed Tracking', 'Tracker search for signs of passage.', 'Tracking', 'TAC 2', 'Planned'),
    (target_op_id, 'Trailhead Standby', 'Medical and logistics support.', 'Medical', 'EMS-LINK', 'Planned'),
    (target_op_id, 'Peak Signal Station', 'Set up radio relay.', 'Other', 'TAC 5', 'Planned'),
    (target_op_id, 'Cache Delivery', 'Transport water and equipment.', 'Transport', 'TAC 1', 'Planned'),
    (target_op_id, 'North Slope Probe', 'Avalanche safety assessment.', 'Avalanche', 'BEACON', 'Planned'),
    (target_op_id, 'LZ Preparation', 'Clear and mark helicopter landing zone.', 'Helicopter', 'AIR-BASE', 'Planned'),
    (target_op_id, 'Cave Entrance Check', 'Manual inspection of known sinkholes.', 'Ground', 'TAC 4', 'Planned');

    -- 3. Create 31 responders checking in at the incident start time
    -- 1 Dog Handler
    INSERT INTO responders (name, incident_id, agency, identifier, device_id, checkin_datetime, special_skills, status)
    VALUES ('Sarah Miller', target_inc_id, 'K9 Search Team', 'K9-302', 'dev_k9_302', inc_start, 'Air Scent Dog', 'Staged');

    -- 1 UAS Pilot
    INSERT INTO responders (name, incident_id, agency, identifier, device_id, checkin_datetime, special_skills, status)
    VALUES ('James Chen', target_inc_id, 'UAS Response', 'PILOT-14', 'dev_pilot_14', inc_start, 'UAS', 'Staged');

    -- 29 general responders
    FOR i IN 1..29 LOOP
        INSERT INTO responders (name, incident_id, agency, identifier, device_id, checkin_datetime, status)
        VALUES (
            'Responder ' || i,
            target_inc_id,
            'County Sheriff Dept',
            'ID-' || (1000 + i),
            'dev_id_' || target_inc_id || '_' || i, -- Generates unique device_id for RLS compatibility
            inc_start,
            'Staged'
        );
    END LOOP;

    RAISE NOTICE 'Successfully created 15 assignments and 31 responders for incident % (OP %).', target_inc_id, target_op_id;
END $$;
