-- Migration: Create tutor earnings, audit log and the hours balance view

-- ============================================================================
-- TUTOR EARNINGS
-- One row per lesson, written only when a logbook is approved. UNIQUE (lesson_id)
-- makes it impossible to pay the same lesson twice.
-- ============================================================================

CREATE TABLE tutor_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE REFERENCES lessons(id),
  logbook_id uuid NOT NULL REFERENCES logbooks(id),
  class_id uuid NOT NULL REFERENCES classes(id),
  tutor_id uuid NOT NULL REFERENCES users(id),
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  rate_per_hour bigint NOT NULL CHECK (rate_per_hour > 0),
  amount bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_earning_amount CHECK (
    amount = round(rate_per_hour * duration_minutes / 60.0)::bigint
  )
);

CREATE INDEX idx_tutor_earnings_tutor ON tutor_earnings(tutor_id);
CREATE INDEX idx_tutor_earnings_logbook ON tutor_earnings(logbook_id);

COMMENT ON TABLE tutor_earnings IS 'Earnings snapshot per lesson, created on logbook approval';

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_id uuid REFERENCES users(id),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

COMMENT ON TABLE audit_log IS 'Append-only record of who changed money, access and logbook state';

-- ============================================================================
-- TRIGGER: Append-only tables
-- ============================================================================

CREATE FUNCTION reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER tutor_earnings_append_only
  BEFORE UPDATE OR DELETE ON tutor_earnings
  FOR EACH ROW
  EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION reject_mutation();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tutor_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tutor_earnings_select_tutor ON tutor_earnings
  FOR SELECT
  TO authenticated
  USING (tutor_id = auth.uid());

CREATE POLICY tutor_earnings_select_admin ON tutor_earnings
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY audit_log_select_admin ON audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- VIEW: Hours balance per active enrollment
-- security_invoker applies the caller's RLS. Tutors have no invoice policy, so
-- the inner join on paid invoices gives them no rows.
-- ============================================================================

CREATE VIEW student_hours_balance
WITH (security_invoker = true)
AS
SELECT
  e.id AS enrollment_id,
  e.class_id,
  e.student_id,
  paid.purchased_minutes,
  COALESCE(used.consumed_minutes, 0) AS consumed_minutes,
  paid.purchased_minutes - COALESCE(used.consumed_minutes, 0) AS raw_balance_minutes,
  GREATEST(paid.purchased_minutes - COALESCE(used.consumed_minutes, 0), 0) AS remaining_minutes,
  paid.purchased_minutes - COALESCE(used.consumed_minutes, 0) <= 0 AS needs_top_up
FROM enrollments e
JOIN LATERAL (
  SELECT SUM(i.hours * 60)::int AS purchased_minutes
  FROM invoices i
  WHERE i.enrollment_id = e.id AND i.status = 'paid'
) paid ON paid.purchased_minutes IS NOT NULL
LEFT JOIN LATERAL (
  SELECT SUM(l.duration_minutes)::int AS consumed_minutes
  FROM lessons l
  WHERE l.class_id = e.class_id
    AND l.status = 'scheduled'
    AND l.ends_at <= now()
    AND l.ends_at > e.activated_at
) used ON true
WHERE e.status = 'active';

COMMENT ON VIEW student_hours_balance IS 'Derived hours balance: paid minutes minus minutes of ended, non-cancelled lessons';
