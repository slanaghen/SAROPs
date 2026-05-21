-- Seed script for 15 assignments and 31 responders
-- Associated with the most recently created incident and operational period.

DO $$
DECLARE
    latest_incident_id TEXT;
    latest_op_id UUID;
    incident_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. Identify the target Incident and Operational Period
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

    -- 2. Create 15 Assignments
    INSERT INTO assignments (op_period_id, title, resource_type, description, frequency_primary, status)
    VALUES
    (latest_op_id, 'Hasty 1', 'Hasty', 'Rapid search of primary trail corridor', 'TAC 1', 'Planned'),
    (latest_op_id, 'Hasty 2', 'Hasty', 'Rapid search of north creek bed', 'TAC 1', 'Planned'),
    (latest_op_id, 'Grid Alpha', 'Ground Search', 'High probability grid search Zone A', 'TAC 2', 'Planned'),
    (latest_op_id, 'Grid Beta', 'Ground Search', 'High probability grid search Zone B', 'TAC 2', 'Planned'),
    (latest_op_id, 'Grid Gamma', 'Ground Search', 'High probability grid search Zone C', 'TAC 2', 'Planned'),
    (latest_op_id, 'Drainage Scan', 'Water Search', 'Inspection of shoreline and drainage', 'TAC 3', 'Planned'),
    (latest_op_id, 'Ridge Recon', 'Aerial Search', 'Visual ridge reconnaissance and IR scan', 'TAC 4', 'Planned'),
    (latest_op_id, 'Road Patrol North', 'Vehicle Search', 'Mobile patrol of Hwy 10 north sector', 'TAC 5', 'Planned'),
    (latest_op_id, 'Road Patrol South', 'Vehicle Search', 'Mobile patrol of Hwy 10 south sector', 'TAC 5', 'Planned'),
    (latest_op_id, 'Point Tracking', 'Tracking', 'Sign cutting at Last Known Point', 'TAC 6', 'Planned'),
    (latest_op_id, 'K9 Block 1', 'Dog', 'Air scent search of forested block 1', 'TAC 7', 'Planned'),
    (latest_op_id, 'Summit Relay', 'Other', 'Establish radio relay at summit peak', 'TAC 8', 'Planned'),
    (latest_op_id, 'Grid Delta', 'Ground Search', 'Secondary grid search Zone D', 'TAC 9', 'Planned'),
    (latest_op_id, 'LZ Prep', 'Transport', 'Prepare Landing Zone Alpha for transport', 'TAC 10', 'Planned'),
    (latest_op_id, 'Base Medical', 'Medical', 'Medical standby support at Command Base', 'TAC 11', 'Planned');

    -- 3. Create 31 Responders
    FOR i IN 1..31 LOOP
        INSERT INTO responders (
            name,
            incident_id,
            agency,
            identifier,
            cell_phone,
            device_id,
            special_skills,
            checkin_datetime,
            status
        )
        VALUES (
            CASE 
                WHEN i = 1 THEN 'K9 Handler Sarah'
                WHEN i = 2 THEN 'UAS Pilot Mike'
                ELSE 'Searcher ' || i
            END,
            latest_incident_id,
            'County SAR',
            'SAR-' || (1000 + i),
            '555-010-' || LPAD(i::text, 4, '0'),
            'seed_dev_' || i || '_' || substr(md5(random()::text), 1, 6),
            CASE 
                WHEN i = 1 THEN 'Air Scent Dog'
                WHEN i = 2 THEN 'UAS'
                ELSE NULL
            END,
            incident_start_time,
            'Staged'
        );
    END LOOP;

    RAISE NOTICE 'Success: Seeded 15 assignments and 31 responders for Incident % (Op Period %)', latest_incident_id, latest_op_id;
END $$;