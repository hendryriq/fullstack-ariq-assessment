-- Migration: Create classes and rate tables
-- Description: Separate student_rates and tutor_rates to prevent tutors seeing student rates.
-- Writes go through the create_class/update_class RPCs, so RLS here is read-only.

-- Enable required extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- CLASSES TABLE
-- ============================================================================

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  capacity int NOT NULL CHECK (capacity > 0 AND capacity <= 50),
  tutor_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_tutor ON classes(tutor_id);

COMMENT ON TABLE classes IS 'Group classes with capacity and assigned tutor';
COMMENT ON COLUMN classes.capacity IS 'Maximum number of students (1-50)';

-- ============================================================================
-- RATE TABLES (separated to prevent rate leakage)
-- A student rate may be below the tutor rate: a tutor is paid per lesson while
-- every student in the class pays, so such a class can still be profitable.
-- ============================================================================

CREATE TABLE student_rates (
  class_id uuid PRIMARY KEY REFERENCES classes(id),
  rate_per_hour bigint NOT NULL CHECK (rate_per_hour > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tutor_rates (
  class_id uuid PRIMARY KEY REFERENCES classes(id),
  rate_per_hour bigint NOT NULL CHECK (rate_per_hour > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE student_rates IS 'Student rates per class (admins and paid students only)';
COMMENT ON TABLE tutor_rates IS 'Tutor rates per class (admins and the assigned tutor only)';

-- ============================================================================
-- HELPER: class tutor check (SECURITY DEFINER so policies never recurse)
-- ============================================================================

CREATE FUNCTION is_tutor_of_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.users u ON u.id = c.tutor_id
    WHERE c.id = p_class_id
      AND u.id = auth.uid()
      AND u.role = 'tutor'
  );
$$;

COMMENT ON FUNCTION is_tutor_of_class IS 'Check if current user is tutor of specific class';

REVOKE EXECUTE ON FUNCTION is_tutor_of_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_tutor_of_class(uuid) TO authenticated;

-- ============================================================================
-- TRIGGER: Prevent capacity reduction below held seats
-- ============================================================================

CREATE FUNCTION check_class_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_held_seats int;
BEGIN
  SELECT COUNT(*) INTO v_held_seats
  FROM public.enrollments
  WHERE class_id = NEW.id
    AND status IN ('pending_payment', 'active');

  IF NEW.capacity < v_held_seats THEN
    RAISE EXCEPTION 'Cannot reduce capacity to % because % seats are currently held',
      NEW.capacity, v_held_seats;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_class_capacity
  BEFORE UPDATE OF capacity ON classes
  FOR EACH ROW
  EXECUTE FUNCTION check_class_capacity();

-- ============================================================================
-- ROW LEVEL SECURITY: CLASSES
-- ============================================================================

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Tutors: see their assigned classes
CREATE POLICY classes_select_tutor ON classes
  FOR SELECT
  TO authenticated
  USING (public.is_tutor_of_class(id));

-- Admins: see all classes
CREATE POLICY classes_select_admin ON classes
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Note: Student policy will be added in enrollments migration (after table exists)

COMMENT ON POLICY classes_select_tutor ON classes IS 'Tutors view their assigned classes';
COMMENT ON POLICY classes_select_admin ON classes IS 'Admins view all classes';

-- ============================================================================
-- ROW LEVEL SECURITY: RATES
-- ============================================================================

ALTER TABLE student_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_rates ENABLE ROW LEVEL SECURITY;

-- Student rates: only admins and paid students (student policy added after enrollments exists).
-- There is deliberately no tutor policy on this table.
CREATE POLICY student_rates_select_admin ON student_rates
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Tutor rates: only admins and assigned tutors
CREATE POLICY tutor_rates_select_admin ON tutor_rates
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY tutor_rates_select_tutor ON tutor_rates
  FOR SELECT
  TO authenticated
  USING (public.is_tutor_of_class(class_id));

COMMENT ON POLICY student_rates_select_admin ON student_rates IS 'Admins view all student rates';
COMMENT ON POLICY tutor_rates_select_admin ON tutor_rates IS 'Admins view all tutor rates';
COMMENT ON POLICY tutor_rates_select_tutor ON tutor_rates IS 'Tutors view rates for their classes only';
