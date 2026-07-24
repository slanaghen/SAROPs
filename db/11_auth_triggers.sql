--
-- Trigger to automatically create a user profile when a new user signs up via Supabase Auth.
--

-- 1. Create the function to be called by the trigger.
-- This function inserts a new row into public.users, pulling the email and UID from the new auth.users record.
-- It assigns a default 'responder' access level.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_uid, email, username, name, access_level)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.email, -- Default username to email
    NEW.raw_user_meta_data ->> 'name', -- Extract name from raw_user_meta_data if available
    'responder' -- Default all new sign-ups to the lowest privilege level
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger that fires after a new user is inserted into auth.users.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();