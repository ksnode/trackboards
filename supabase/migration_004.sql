-- migration_004.sql
-- Admin force signout: invalidate all sessions for a user
-- Uruchom ręcznie w Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.admin_force_signout(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  -- Invalidate all sessions for user
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
END;
$$;
