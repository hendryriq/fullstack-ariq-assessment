-- Migration: Create lessons and logbooks
-- Description: Lesson scheduling with overlap prevention, logbooks with immutability.
-- Writes go through RPCs (see the RPC migration), so RLS here is read-only.

-- ============================================================================
-- LESSONS TABLE
-- ============================================================================

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id),
  tutor_id uuid NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes int GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (ends_at - starts_at))::int / 60
  ) STORED,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled')),
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_time_range CHECK (ends_at > starts_at),
  CONSTRAINT valid_cancel CHECK (
    (status = 'cancelled' AND cancel_reason IS NOT NULL) OR
    (status = 'scheduled')
  ),

  -- Prevent overlapping lessons for same tutor (requires btree_gist)
  EXCLUDE USING gist (
    tutor_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status != 'cancelled')
);

CREATE INDEX idx_lessons_class ON lessons(class_id);
CREATE INDEX idx_lessons_tutor ON lessons(tutor_id);
CREATE INDEX idx_lessons_starts_at ON lessons(starts_at);

COMMENT ON TABLE lessons IS 'Scheduled lessons with tutor overlap prevention';
COMMENT ON COLUMN lessons.tutor_id IS 'Tutor snapshot (immutable for earnings attribution)';

-- ============================================================================
-- LOGBOOKS TABLE
-- ============================================================================

CREATE TABLE logbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id),
  month date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'returned', 'approved')),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES users(id),
  returned_at timestamptz,
  returned_by uuid REFERENCES users(id),
  return_note text,
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(class_id, month),
  CONSTRAINT valid_month CHECK (EXTRACT(DAY FROM month) = 1),
  CONSTRAINT valid_return CHECK (
    (status = 'returned' AND return_note IS NOT NULL) OR
    (status != 'returned')
  )
);

CREATE INDEX idx_logbooks_status ON logbooks(status);

COMMENT ON TABLE logbooks IS 'Monthly logbooks per class (one per class per month in WIB)';

-- ============================================================================
-- LOGBOOK ENTRIES TABLE
-- ============================================================================

CREATE TABLE logbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logbook_id uuid NOT NULL REFERENCES logbooks(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) UNIQUE,
  topic text NOT NULL CHECK (length(trim(topic)) > 0),
  activities text NOT NULL CHECK (length(trim(activities)) > 0),
  tutor_observation text NOT NULL CHECK (length(trim(tutor_observation)) > 0),
  future_recommendation text NOT NULL CHECK (length(trim(future_recommendation)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_logbook_entries_logbook ON logbook_entries(logbook_id);

COMMENT ON TABLE logbook_entries IS 'Lesson entries in logbooks (one entry per lesson)';

-- ============================================================================
-- TRIGGERS: Logbook immutability
-- ============================================================================

CREATE FUNCTION protect_approved_logbook()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Approved logbooks are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);  -- Handle both UPDATE and DELETE
END;
$$;

CREATE TRIGGER logbook_immutability
  BEFORE UPDATE OR DELETE ON logbooks
  FOR EACH ROW
  EXECUTE FUNCTION protect_approved_logbook();

-- Checks both the old and the new logbook, so an entry cannot be moved out of
-- an approved logbook either.
CREATE FUNCTION protect_approved_logbook_entries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND EXISTS (
    SELECT 1 FROM public.logbooks WHERE id = OLD.logbook_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Cannot modify entries in approved logbook';
  END IF;

  IF TG_OP <> 'DELETE' AND EXISTS (
    SELECT 1 FROM public.logbooks WHERE id = NEW.logbook_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Cannot modify entries in approved logbook';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER logbook_entry_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON logbook_entries
  FOR EACH ROW
  EXECUTE FUNCTION protect_approved_logbook_entries();

-- ============================================================================
-- TRIGGER: An entry needs a finished lesson from the logbook's class and month
-- ============================================================================

CREATE FUNCTION validate_logbook_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_lesson public.lessons%ROWTYPE;
  v_logbook public.logbooks%ROWTYPE;
BEGIN
  SELECT * INTO v_lesson FROM public.lessons WHERE id = NEW.lesson_id;
  SELECT * INTO v_logbook FROM public.logbooks WHERE id = NEW.logbook_id;

  IF v_lesson.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled lesson cannot have a logbook entry';
  END IF;

  IF v_lesson.ends_at > now() THEN
    RAISE EXCEPTION 'A logbook entry can only be added after the lesson has ended';
  END IF;

  IF v_lesson.class_id <> v_logbook.class_id THEN
    RAISE EXCEPTION 'Lesson does not belong to the class of this logbook';
  END IF;

  IF date_trunc('month', v_lesson.starts_at AT TIME ZONE 'Asia/Jakarta')::date <> v_logbook.month THEN
    RAISE EXCEPTION 'Lesson does not belong to the month of this logbook';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER logbook_entry_validation
  BEFORE INSERT OR UPDATE OF logbook_id, lesson_id ON logbook_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_logbook_entry();

-- ============================================================================
-- TRIGGER: A lesson with a logbook entry is frozen
-- Its duration drives earnings and hours used, so it cannot change once logged.
-- ============================================================================

CREATE FUNCTION protect_logged_lesson()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.logbook_entries WHERE lesson_id = OLD.id) AND (
    TG_OP = 'DELETE' OR
    NEW.starts_at <> OLD.starts_at OR
    NEW.ends_at <> OLD.ends_at OR
    NEW.class_id <> OLD.class_id OR
    NEW.tutor_id <> OLD.tutor_id OR
    NEW.status <> OLD.status
  ) THEN
    RAISE EXCEPTION 'A lesson with a logbook entry cannot be changed or cancelled';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER logged_lesson_immutability
  BEFORE UPDATE OR DELETE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION protect_logged_lesson();

-- ============================================================================
-- ROW LEVEL SECURITY: LESSONS
-- ============================================================================

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Tutors: lessons of their assigned classes, plus lessons they taught before a
-- tutor change (needed for their earnings history)
CREATE POLICY lessons_select_tutor ON lessons
  FOR SELECT
  TO authenticated
  USING (tutor_id = auth.uid() OR public.is_tutor_of_class(class_id));

-- Students: lessons that ended after their access started (same rule as hours used)
CREATE POLICY lessons_select_student ON lessons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.class_id = lessons.class_id
        AND e.student_id = auth.uid()
        AND e.status = 'active'
        AND e.activated_at IS NOT NULL
        AND lessons.ends_at > e.activated_at
    )
  );

CREATE POLICY lessons_select_admin ON lessons
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- ROW LEVEL SECURITY: LOGBOOKS
-- ============================================================================

ALTER TABLE logbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY logbooks_select_tutor ON logbooks
  FOR SELECT
  TO authenticated
  USING (public.is_tutor_of_class(class_id));

-- Students: only approved logbooks of classes they have paid for
CREATE POLICY logbooks_select_student ON logbooks
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved' AND
    public.is_paid_student_of_class(class_id)
  );

CREATE POLICY logbooks_select_admin ON logbooks
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- ROW LEVEL SECURITY: LOGBOOK ENTRIES
-- ============================================================================

ALTER TABLE logbook_entries ENABLE ROW LEVEL SECURITY;

-- Tutors read their entries in every status, including after submission
CREATE POLICY logbook_entries_select_tutor ON logbook_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.logbooks lb
      WHERE lb.id = logbook_entries.logbook_id
        AND public.is_tutor_of_class(lb.class_id)
    )
  );

CREATE POLICY logbook_entries_select_student ON logbook_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.logbooks lb
      WHERE lb.id = logbook_entries.logbook_id
        AND lb.status = 'approved'
        AND public.is_paid_student_of_class(lb.class_id)
    )
  );

CREATE POLICY logbook_entries_select_admin ON logbook_entries
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
