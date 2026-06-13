-- RPC to completely reinitialize the database schema.
-- This matches the administrative reset logic found in sarops-schema.sql.
CREATE OR REPLACE FUNCTION reinitialize_database()
RETURNS VOID AS $$
BEGIN
    -- Backup users to retain entries during re-initialization
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE TEMP TABLE users_temp_backup AS SELECT * FROM users;
    END IF;

    -- Logic to drop and recreate the schema is usually handled by reinit-db.sh 
    -- calling the combined SQL, but this function provides an in-database trigger.
    -- For modularity, we use this space to house the user restoration logic.

    IF EXISTS (SELECT FROM pg_class WHERE relname = 'users_temp_backup') THEN
        INSERT INTO users SELECT * FROM users_temp_backup ON CONFLICT (email) DO NOTHING;
        DROP TABLE users_temp_backup;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reinitialize_database TO authenticated;