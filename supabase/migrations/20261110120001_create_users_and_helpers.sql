-- Migration: Create users table and helper functions
-- Description: Base user table with role-based access and SECURITY DEFINER helpers to avoid recursion

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'tutor', 'student')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);

COMMENT ON TABLE users IS 'Application users linked to Supabase Auth';
COMMENT ON COLUMN users.role IS 'User role: admin, tutor, or student';

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid policy recursion)
-- Helpers that read later tables live in the migration that creates those tables.
-- ============================================================================

-- Check if current user is admin
CREATE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Get current user role (returns NULL for anon/unauthenticated)
CREATE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION is_admin IS 'Check if current user is admin (avoids policy recursion)';
COMMENT ON FUNCTION current_user_role IS 'Get current user role (NULL if not authenticated)';

-- Revoke from anon and public, grant to authenticated only
REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY: USERS
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can read all users (using helper to avoid recursion)
CREATE POLICY users_select_admin ON users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMENT ON POLICY users_select_own ON users IS 'Users view their own profile';
COMMENT ON POLICY users_select_admin ON users IS 'Admins view all users';
