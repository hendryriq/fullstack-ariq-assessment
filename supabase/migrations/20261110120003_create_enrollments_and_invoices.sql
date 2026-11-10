-- Migration: Create enrollments and invoices
-- Description: Student enrollments with invoice snapshots

-- ============================================================================
-- ENROLLMENTS TABLE
-- ============================================================================

CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id),
  student_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'active', 'cancelled')),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_class ON enrollments(class_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);

-- A student holds at most one open enrollment per class. Partial, so a student
-- can enroll again after a cancellation.
CREATE UNIQUE INDEX uniq_enrollments_open ON enrollments(class_id, student_id)
  WHERE status IN ('pending_payment', 'active');

COMMENT ON TABLE enrollments IS 'Student enrollments in classes. Can re-enroll after cancellation.';
COMMENT ON INDEX uniq_enrollments_open IS 'Prevents duplicate open enrollment; also speeds up seat counts';

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  hours int NOT NULL CHECK (hours >= 1 AND hours <= 100),
  rate_snapshot bigint NOT NULL,
  amount bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled', 'void')),
  paid_at timestamptz,
  paid_by uuid REFERENCES users(id),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid REFERENCES users(id),
  reference_note text,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_amount CHECK (amount = hours * rate_snapshot),
  CONSTRAINT valid_paid CHECK (
    (status IN ('paid', 'void') AND paid_at IS NOT NULL AND paid_by IS NOT NULL) OR
    (status NOT IN ('paid', 'void') AND paid_at IS NULL AND paid_by IS NULL)
  ),
  CONSTRAINT valid_void CHECK (
    (status = 'void' AND void_reason IS NOT NULL) OR
    (status != 'void')
  )
);

CREATE INDEX idx_invoices_enrollment ON invoices(enrollment_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_paid_at ON invoices(paid_at) WHERE status = 'paid';

COMMENT ON TABLE invoices IS 'Invoices with snapshot pricing (immutable after creation)';
COMMENT ON CONSTRAINT valid_paid ON invoices IS 'Allow paid_at for both paid and void status';

-- ============================================================================
-- TRIGGER: Invoice snapshot immutability
-- ============================================================================

CREATE FUNCTION protect_invoice_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.hours != NEW.hours OR
     OLD.rate_snapshot != NEW.rate_snapshot OR
     OLD.amount != NEW.amount THEN
    RAISE EXCEPTION 'Invoice snapshot fields (hours, rate_snapshot, amount) are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoice_immutability
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION protect_invoice_snapshot();

-- ============================================================================
-- HELPER: paid access check (SECURITY DEFINER so policies never recurse)
-- ============================================================================

CREATE FUNCTION is_paid_student_of_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.invoices i ON i.enrollment_id = e.id
    WHERE e.class_id = p_class_id
      AND e.student_id = auth.uid()
      AND e.status = 'active'
      AND i.status = 'paid'
  );
$$;

COMMENT ON FUNCTION is_paid_student_of_class IS 'Check if current user has a paid, active enrollment in the class';

REVOKE EXECUTE ON FUNCTION is_paid_student_of_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_paid_student_of_class(uuid) TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY: ENROLLMENTS
-- ============================================================================

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrollments_select_student ON enrollments
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY enrollments_select_tutor ON enrollments
  FOR SELECT
  TO authenticated
  USING (public.is_tutor_of_class(class_id));

CREATE POLICY enrollments_select_admin ON enrollments
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- ROW LEVEL SECURITY: INVOICES
-- ============================================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select_student ON invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE id = invoices.enrollment_id
        AND student_id = auth.uid()
    )
  );

CREATE POLICY invoices_select_admin ON invoices
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- ADD MISSING POLICIES TO PREVIOUS TABLES
-- ============================================================================

-- Students can see classes they are actively enrolled in
CREATE POLICY classes_select_student ON classes
  FOR SELECT
  TO authenticated
  USING (public.is_paid_student_of_class(id));

-- Students can see rates for classes they have paid for
CREATE POLICY student_rates_select_student ON student_rates
  FOR SELECT
  TO authenticated
  USING (public.is_paid_student_of_class(class_id));

COMMENT ON POLICY classes_select_student ON classes IS 'Students view classes they have paid for';
COMMENT ON POLICY student_rates_select_student ON student_rates IS 'Students view rates for classes they have paid for';
