-- Suppress "does not exist" notices during the cleanup phase
SET client_min_messages TO warning;

-- Force PostgREST to reload the schema cache to recognize dropped columns
NOTIFY pgrst, 'reload schema';

-- Ensure a clean slate for checkin_responder_securely to avoid "function name not unique" errors
DROP FUNCTION IF EXISTS checkin_responder_securely(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- Old 12-parameter version (with p_vehicles)
DROP FUNCTION IF EXISTS checkin_responder_securely(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- Current 11-parameter version

-- RPC: Secure Check-in
CREATE OR REPLACE FUNCTION checkin_responder_securely(
  p_incident_id TEXT, p_auth_uid UUID, p_name TEXT, p_agency TEXT, p_identifier TEXT,
  p_cell_phone TEXT DEFAULT NULL, p_responder_type TEXT DEFAULT 'SAR',
  p_special_skills TEXT DEFAULT NULL, p_vehicles TEXT DEFAULT NULL,
  p_access_level TEXT DEFAULT 'responder', p_status TEXT DEFAULT 'Staged',
  p_device_id TEXT DEFAULT NULL
)
RETURNS SETOF responders AS $func$
DECLARE
    _responder_record responders;
    _v_text TEXT;
BEGIN
  INSERT INTO responders (
    incident_id, auth_uid, name, agency, identifier, cell_phone, responder_type,
    special_skills, access_level, status, device_id, checkin_datetime
  )
  VALUES (
    p_incident_id, p_auth_uid, p_name, p_agency, p_identifier, p_cell_phone, 
    p_responder_type::responder_type, p_special_skills,
    p_access_level::access_level, p_status::responder_status, 
    COALESCE(p_device_id, 'web_' || p_auth_uid || '_' || p_incident_id),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (device_id) DO UPDATE SET
    incident_id = EXCLUDED.incident_id, name = EXCLUDED.name, agency = EXCLUDED.agency,
    identifier = EXCLUDED.identifier, cell_phone = EXCLUDED.cell_phone, 
    auth_uid = EXCLUDED.auth_uid, checkin_datetime = EXCLUDED.checkin_datetime,
    updated_at = CURRENT_TIMESTAMP
  RETURNING * INTO _responder_record;

  -- Handle vehicles list if provided (Tactical resource creation, dissociated from responder)
  IF p_vehicles IS NOT NULL AND p_vehicles <> '' THEN
    FOR _v_text IN SELECT trim(s) FROM unnest(string_to_array(p_vehicles, ',')) s LOOP
      IF _v_text <> '' THEN
        INSERT INTO vehicles (incident_id, designation, checkin_datetime, status)
        VALUES (p_incident_id, _v_text, CURRENT_TIMESTAMP, p_status::responder_status)
        ON CONFLICT (incident_id, designation) DO UPDATE SET 
          status = EXCLUDED.status,
          checkout_datetime = NULL,
          updated_at = CURRENT_TIMESTAMP;
      END IF;
    END LOOP;
  END IF;

  RETURN NEXT _responder_record;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure a clean slate for User Management RPCs to avoid "function name not unique"
-- errors during GRANTs caused by previous signature changes.
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- 10 params
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- 11 params
DROP FUNCTION IF EXISTS admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT); -- Old 12-parameter version

-- RPC: User Management
CREATE OR REPLACE FUNCTION admin_add_user(
  p_email TEXT, p_username TEXT, p_password TEXT, p_access_level TEXT,
  p_name TEXT DEFAULT NULL, p_agency TEXT DEFAULT NULL, p_identifier TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL, p_type TEXT DEFAULT NULL, p_skills TEXT DEFAULT NULL,
  p_display_density TEXT DEFAULT 'comfortable'
)
RETURNS VOID AS $func$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))) THEN
    UPDATE users SET
      username = p_username,
      password = CASE WHEN p_password IS NOT NULL AND TRIM(p_password) <> '' THEN crypt(p_password, gen_salt('bf')) ELSE password END, -- Only update if provided
      access_level = p_access_level::access_level,
      name = p_name,
      agency = p_agency,
      identifier = p_identifier,
      cell_phone = p_phone,
      responder_type = CASE WHEN p_type IS NOT NULL AND p_type <> '' THEN p_type::responder_type ELSE NULL END,
      special_skills = p_skills,
      display_density = p_display_density::display_density
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));
  ELSE
    INSERT INTO users (
      email, username, password, access_level, name, agency, identifier,
      cell_phone, responder_type, special_skills, display_density
    )
    VALUES (
      LOWER(TRIM(p_email)), p_username, crypt(p_password, gen_salt('bf')), p_access_level::access_level,
      p_name, p_agency, p_identifier, p_phone,
      CASE WHEN p_type IS NOT NULL AND p_type <> '' THEN p_type::responder_type ELSE NULL END,
      p_skills, p_display_density::display_density
    );
  END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Remove User
CREATE OR REPLACE FUNCTION admin_remove_user(p_email TEXT)
RETURNS VOID AS $func$
BEGIN
  DELETE FROM users WHERE email = LOWER(p_email);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Update User Password
CREATE OR REPLACE FUNCTION admin_update_password(p_email TEXT, p_password TEXT)
RETURNS VOID AS $func$
BEGIN
  UPDATE users SET password = crypt(p_password, gen_salt('bf')) WHERE email = LOWER(p_email);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Login Verification
CREATE OR REPLACE FUNCTION verify_user_login(p_email TEXT, p_password TEXT)
RETURNS SETOF users AS $func$
BEGIN
  RETURN QUERY SELECT
    email, username, password, access_level,
    name, agency, identifier, cell_phone,
    responder_type, special_skills,
    display_density, created_at
  FROM users
  WHERE email = LOWER(p_email) AND (password = p_password OR password = crypt(p_password, password));
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- GRANTS
GRANT EXECUTE ON FUNCTION verify_user_login(TEXT, TEXT) TO anon, authenticated; -- Existing grant
GRANT EXECUTE ON FUNCTION checkin_responder_securely(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated; -- Updated signature (re-added vehicles)
GRANT EXECUTE ON FUNCTION admin_add_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated; -- Updated grant
GRANT EXECUTE ON FUNCTION admin_remove_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_password(TEXT, TEXT) TO authenticated;

-- Restore default message level for function creation and grants
RESET client_min_messages;