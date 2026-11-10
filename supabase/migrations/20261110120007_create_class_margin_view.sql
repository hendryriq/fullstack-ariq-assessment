-- Migration: Class margin for the admin dashboard
-- Margin = what students paid (paid invoices) - what tutors earned (approved earnings).

CREATE VIEW class_margin
WITH (security_invoker = true)
AS
SELECT
  c.id AS class_id,
  c.title,
  COALESCE(paid.total, 0)::bigint AS paid_by_students,
  COALESCE(earned.total, 0)::bigint AS earned_by_tutors,
  (COALESCE(paid.total, 0) - COALESCE(earned.total, 0))::bigint AS margin
FROM classes c
LEFT JOIN LATERAL (
  SELECT SUM(i.amount) AS total
  FROM invoices i
  JOIN enrollments e ON e.id = i.enrollment_id
  WHERE e.class_id = c.id AND i.status = 'paid'
) paid ON true
LEFT JOIN LATERAL (
  SELECT SUM(te.amount) AS total
  FROM tutor_earnings te
  WHERE te.class_id = c.id
) earned ON true
WHERE public.is_admin();

COMMENT ON VIEW class_margin IS 'Admin only: paid invoices minus approved tutor earnings per class';

REVOKE ALL ON class_margin FROM anon, authenticated;
GRANT SELECT ON class_margin TO authenticated;
