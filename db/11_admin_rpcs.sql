-- RPC to completely reinitialize the database schema.
-- This matches the administrative reset logic found in sarops-schema.sql.
CREATE OR REPLACE FUNCTION reinitialize_database()
RETURNS VOID AS $$
BEGIN
    -- Backup users to retain entries during re-initialization
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE 'CREATE TEMP TABLE users_temp_backup (
            email TEXT, username TEXT, password TEXT, access_level_text TEXT,
            name TEXT, agency TEXT, identifier TEXT, cell_phone TEXT, 
            responder_type_text TEXT, special_skills TEXT, 
            vehicles TEXT,
            display_density_text TEXT, created_at TIMESTAMP WITH TIME ZONE
        )';
        
        EXECUTE format('INSERT INTO users_temp_backup (
                    email, username, password, access_level_text, name, agency, 
                    identifier, cell_phone, responder_type_text, special_skills, 
                    vehicles, display_density_text, created_at
                 )
                 SELECT 
                    email, 
                    %s, -- username
                    password, 
                    %s, -- access_level
                    %s, -- name
                    %s, -- agency
                    %s, -- identifier
                    %s, -- cell_phone
                    %s, -- responder_type
                    %s, -- special_skills
                    %s, -- vehicles
                    %s, -- display_density
                    %s  -- created_at
                 FROM users',
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN 'username' ELSE 'email' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='access_level') THEN 'access_level::TEXT' ELSE '''responder''' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name') THEN 'name' ELSE 'NULL' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='agency') THEN 'agency' ELSE 'NULL' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='identifier') THEN 'identifier' ELSE 'NULL' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cell_phone') THEN 'cell_phone' ELSE 'NULL' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='responder_type') THEN 'responder_type::TEXT' ELSE '''SAR''' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='special_skills') THEN 'special_skills' ELSE 'NULL' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vehicles') THEN 'vehicles' ELSE 'NULL' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='display_density') THEN 'display_density::TEXT' ELSE '''comfortable''' END,
                 CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_at') THEN 'created_at' ELSE 'CURRENT_TIMESTAMP' END
        );
    END IF;

    IF EXISTS (SELECT FROM pg_class WHERE relname = 'users_temp_backup') THEN
        INSERT INTO users (email, username, password, access_level, name, agency, identifier, cell_phone, responder_type, special_skills, vehicles, display_density, created_at)
        SELECT email, COALESCE(username, email), password, access_level_text::access_level, name, agency, identifier, cell_phone, responder_type_text::responder_type, special_skills, vehicles, display_density_text::display_density, created_at
        FROM users_temp_backup ON CONFLICT (email) DO NOTHING;
        DROP TABLE users_temp_backup;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reinitialize_database TO authenticated;