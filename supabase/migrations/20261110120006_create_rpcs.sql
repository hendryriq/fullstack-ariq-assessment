-- Migration: RPCs for every state change
-- Description: Clients can only read tables (through RLS). Every write goes through
-- one of these functions, which checks the caller and applies the business rule in
-- a single transaction. See DECISIONS.md for the reasoning behind each rule.

-- ============================================================================
-- INTERNAL HELPERS (not callable by API clients)
-- ============================================================================

CREATE FUNCTION write_audit_log(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  INSERT INTO public.audit_log (event_type, entity_type, entity_id, actor_id, metadata)
  VALUES (p_event_type, p_entity_type, p_entity_id, auth.uid(), p_metadata);
$$;

CREATE FUNCTION assert_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can do this' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION assert_tutor_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role = 'tutor') THEN
    RAISE EXCEPTION 'The assigned user must be a tutor';
  END IF;
END;
$$;

-- A month that is already submitted or approved cannot receive more lessons:
-- they could never get a logbook entry, so the tutor would never be paid.
CREATE FUNCTION assert_logbook_month_open(p_class_id uuid, p_starts_at timestamptz)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.logbooks
    WHERE class_id = p_class_id
      AND month = date_trunc('month', p_starts_at AT TIME ZONE 'Asia/Jakarta')::date
      AND status IN ('submitted', 'approved')
  ) THEN
    RAISE EXCEPTION 'The logbook for this month is already submitted or approved';
  END IF;
END;
$$;

-- The one place earnings are calculated, used by both preview and approval.
CREATE FUNCTION compute_logbook_earnings(p_logbook_id uuid)
RETURNS TABLE (
  lesson_id uuid,
  tutor_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes int,
  rate_per_hour bigint,
  amount bigint
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    l.id,
    l.tutor_id,
    l.starts_at,
    l.ends_at,
    l.duration_minutes,
    r.rate_per_hour,
    round(r.rate_per_hour * l.duration_minutes / 60.0)::bigint
  FROM public.logbook_entries le
  JOIN public.lessons l ON l.id = le.lesson_id
  JOIN public.tutor_rates r ON r.class_id = l.class_id
  WHERE le.logbook_id = p_logbook_id
  ORDER BY l.starts_at;
$$;

-- ============================================================================
-- READ RPCs: safe projections that RLS alone cannot express
-- ============================================================================

-- Sales information for a student choosing a class. The brief hides paid-only
-- content (schedule, logbooks); this exposes only what is needed to enroll.
CREATE FUNCTION get_class_catalog()
RETURNS TABLE (
  class_id uuid,
  title text,
  description text,
  tutor_name text,
  student_rate bigint,
  capacity int,
  seats_left int,
  my_enrollment_id uuid,
  my_enrollment_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Only students can browse the class catalog' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    u.full_name,
    sr.rate_per_hour,
    c.capacity,
    c.capacity - (
      SELECT COUNT(*)::int FROM public.enrollments held
      WHERE held.class_id = c.id AND held.status IN ('pending_payment', 'active')
    ),
    mine.id,
    mine.status
  FROM public.classes c
  JOIN public.users u ON u.id = c.tutor_id
  JOIN public.student_rates sr ON sr.class_id = c.id
  LEFT JOIN public.enrollments mine
    ON mine.class_id = c.id
   AND mine.student_id = auth.uid()
   AND mine.status IN ('pending_payment', 'active')
  ORDER BY c.title;
END;
$$;

-- Tutors cannot read other users directly, so names come through this projection.
CREATE FUNCTION get_class_roster(p_class_id uuid)
RETURNS TABLE (student_id uuid, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_tutor_of_class(p_class_id)) THEN
    RAISE EXCEPTION 'You cannot view this class roster' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.full_name
  FROM public.enrollments e
  JOIN public.users u ON u.id = e.student_id
  WHERE e.class_id = p_class_id AND e.status = 'active'
  ORDER BY u.full_name;
END;
$$;

-- ============================================================================
-- CLASSES
-- ============================================================================

CREATE FUNCTION create_class(
  p_title text,
  p_description text,
  p_capacity int,
  p_tutor_id uuid,
  p_student_rate bigint,
  p_tutor_rate bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_class_id uuid;
BEGIN
  PERFORM public.assert_admin();
  PERFORM public.assert_tutor_account(p_tutor_id);

  INSERT INTO public.classes (title, description, capacity, tutor_id)
  VALUES (p_title, p_description, p_capacity, p_tutor_id)
  RETURNING id INTO v_class_id;

  INSERT INTO public.student_rates (class_id, rate_per_hour) VALUES (v_class_id, p_student_rate);
  INSERT INTO public.tutor_rates (class_id, rate_per_hour) VALUES (v_class_id, p_tutor_rate);

  PERFORM public.write_audit_log('class_created', 'class', v_class_id, jsonb_build_object(
    'capacity', p_capacity, 'tutor_id', p_tutor_id,
    'student_rate', p_student_rate, 'tutor_rate', p_tutor_rate
  ));

  RETURN v_class_id;
END;
$$;

CREATE FUNCTION update_class(
  p_class_id uuid,
  p_title text,
  p_description text,
  p_capacity int,
  p_tutor_id uuid,
  p_student_rate bigint,
  p_tutor_rate bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_class public.classes%ROWTYPE;
  v_old_student_rate bigint;
  v_old_tutor_rate bigint;
BEGIN
  PERFORM public.assert_admin();

  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  SELECT rate_per_hour INTO v_old_student_rate FROM public.student_rates WHERE class_id = p_class_id;
  SELECT rate_per_hour INTO v_old_tutor_rate FROM public.tutor_rates WHERE class_id = p_class_id;

  IF p_tutor_id <> v_class.tutor_id THEN
    PERFORM public.assert_tutor_account(p_tutor_id);
  END IF;

  -- The capacity trigger rejects a value below the seats currently held.
  UPDATE public.classes
  SET title = p_title,
      description = p_description,
      capacity = p_capacity,
      tutor_id = p_tutor_id,
      updated_at = now()
  WHERE id = p_class_id;

  UPDATE public.student_rates SET rate_per_hour = p_student_rate WHERE class_id = p_class_id;
  UPDATE public.tutor_rates SET rate_per_hour = p_tutor_rate WHERE class_id = p_class_id;

  -- Only lessons that have not started move. Every other lesson stays with,
  -- and is paid to, the tutor who taught it.
  IF p_tutor_id <> v_class.tutor_id THEN
    BEGIN
      UPDATE public.lessons
      SET tutor_id = p_tutor_id
      WHERE class_id = p_class_id
        AND status = 'scheduled'
        AND starts_at > now();
    EXCEPTION WHEN exclusion_violation THEN
      RAISE EXCEPTION 'The new tutor already has a lesson at the time of an upcoming lesson in this class';
    END;
  END IF;

  IF p_capacity <> v_class.capacity
     OR p_tutor_id <> v_class.tutor_id
     OR p_student_rate <> v_old_student_rate
     OR p_tutor_rate <> v_old_tutor_rate THEN
    PERFORM public.write_audit_log('class_updated', 'class', p_class_id, jsonb_build_object(
      'capacity', jsonb_build_array(v_class.capacity, p_capacity),
      'tutor_id', jsonb_build_array(v_class.tutor_id, p_tutor_id),
      'student_rate', jsonb_build_array(v_old_student_rate, p_student_rate),
      'tutor_rate', jsonb_build_array(v_old_tutor_rate, p_tutor_rate)
    ));
  END IF;
END;
$$;

-- ============================================================================
-- ENROLLMENT AND INVOICES
-- ============================================================================

-- The row lock on the class serialises concurrent enrollments, so two students
-- cannot both take the last seat.
CREATE FUNCTION enroll_student(p_class_id uuid, p_hours int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_capacity int;
  v_held_seats int;
  v_rate bigint;
  v_enrollment_id uuid;
  v_invoice_id uuid;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Only students can enroll' USING ERRCODE = '42501';
  END IF;

  IF p_hours IS NULL OR p_hours NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Package size must be between 1 and 100 hours';
  END IF;

  SELECT capacity INTO v_capacity FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE class_id = p_class_id
      AND student_id = v_student_id
      AND status IN ('pending_payment', 'active')
  ) THEN
    RAISE EXCEPTION 'You are already enrolled in this class';
  END IF;

  SELECT COUNT(*) INTO v_held_seats
  FROM public.enrollments
  WHERE class_id = p_class_id AND status IN ('pending_payment', 'active');

  IF v_held_seats >= v_capacity THEN
    RAISE EXCEPTION 'This class is full';
  END IF;

  SELECT rate_per_hour INTO v_rate FROM public.student_rates WHERE class_id = p_class_id;

  INSERT INTO public.enrollments (class_id, student_id)
  VALUES (p_class_id, v_student_id)
  RETURNING id INTO v_enrollment_id;

  INSERT INTO public.invoices (enrollment_id, hours, rate_snapshot, amount)
  VALUES (v_enrollment_id, p_hours, v_rate, p_hours * v_rate)
  RETURNING id INTO v_invoice_id;

  PERFORM public.write_audit_log('enrollment_created', 'enrollment', v_enrollment_id, jsonb_build_object(
    'invoice_id', v_invoice_id, 'hours', p_hours, 'amount', p_hours * v_rate
  ));

  RETURN v_invoice_id;
END;
$$;

CREATE FUNCTION request_top_up(p_enrollment_id uuid, p_hours int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_rate bigint;
  v_invoice_id uuid;
BEGIN
  IF p_hours IS NULL OR p_hours NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Package size must be between 1 and 100 hours';
  END IF;

  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id FOR UPDATE;

  IF NOT FOUND OR v_enrollment.student_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  IF v_enrollment.status <> 'active' THEN
    RAISE EXCEPTION 'Only an active enrollment can be topped up';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE enrollment_id = p_enrollment_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'This enrollment already has an unpaid invoice';
  END IF;

  SELECT rate_per_hour INTO v_rate FROM public.student_rates WHERE class_id = v_enrollment.class_id;

  INSERT INTO public.invoices (enrollment_id, hours, rate_snapshot, amount)
  VALUES (p_enrollment_id, p_hours, v_rate, p_hours * v_rate)
  RETURNING id INTO v_invoice_id;

  PERFORM public.write_audit_log('invoice_topped_up', 'invoice', v_invoice_id, jsonb_build_object(
    'enrollment_id', p_enrollment_id, 'hours', p_hours, 'amount', p_hours * v_rate
  ));

  RETURN v_invoice_id;
END;
$$;

-- Marking an already-paid invoice is a no-op.
CREATE FUNCTION mark_invoice_paid(p_invoice_id uuid, p_reference_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
BEGIN
  PERFORM public.assert_admin();

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN;
  END IF;

  IF v_invoice.status <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending invoice can be marked paid';
  END IF;

  UPDATE public.invoices
  SET status = 'paid',
      paid_at = now(),
      paid_by = auth.uid(),
      reference_note = p_reference_note
  WHERE id = p_invoice_id;

  UPDATE public.enrollments
  SET status = 'active',
      activated_at = COALESCE(activated_at, now())
  WHERE id = v_invoice.enrollment_id;

  PERFORM public.write_audit_log('invoice_paid', 'invoice', p_invoice_id, jsonb_build_object(
    'amount', v_invoice.amount, 'reference_note', p_reference_note
  ));
END;
$$;

-- Cancelling the unpaid invoice of a new enrollment also releases its seat.
-- A top-up invoice leaves the active enrollment untouched.
CREATE FUNCTION cancel_invoice(p_invoice_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
BEGIN
  PERFORM public.assert_admin();

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending invoice can be cancelled';
  END IF;

  UPDATE public.invoices SET status = 'cancelled' WHERE id = p_invoice_id;

  UPDATE public.enrollments
  SET status = 'cancelled'
  WHERE id = v_invoice.enrollment_id AND status = 'pending_payment';

  PERFORM public.write_audit_log('invoice_cancelled', 'invoice', p_invoice_id, jsonb_build_object(
    'reason', p_reason
  ));
END;
$$;

-- A paid invoice can be voided only if the hours it bought are unused, meaning
-- the invoices left over still cover every minute consumed so far.
CREATE FUNCTION void_invoice(p_invoice_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_purchased_minutes int;
  v_consumed_minutes int;
BEGIN
  PERFORM public.assert_admin();

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to void an invoice';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status <> 'paid' THEN
    RAISE EXCEPTION 'Only a paid invoice can be voided';
  END IF;

  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_invoice.enrollment_id FOR UPDATE;

  SELECT COALESCE(SUM(hours * 60), 0)::int INTO v_purchased_minutes
  FROM public.invoices
  WHERE enrollment_id = v_invoice.enrollment_id AND status = 'paid';

  SELECT COALESCE(SUM(duration_minutes), 0)::int INTO v_consumed_minutes
  FROM public.lessons
  WHERE class_id = v_enrollment.class_id
    AND status = 'scheduled'
    AND ends_at <= now()
    AND ends_at > v_enrollment.activated_at;

  IF v_purchased_minutes - v_invoice.hours * 60 < v_consumed_minutes THEN
    RAISE EXCEPTION 'This invoice cannot be voided because its hours have already been used';
  END IF;

  UPDATE public.invoices
  SET status = 'void',
      void_reason = p_reason,
      voided_at = now(),
      voided_by = auth.uid()
  WHERE id = p_invoice_id;

  -- With nothing left paid, the student loses access and the seat is released.
  IF NOT EXISTS (
    SELECT 1 FROM public.invoices
    WHERE enrollment_id = v_invoice.enrollment_id AND status = 'paid'
  ) THEN
    UPDATE public.enrollments SET status = 'cancelled' WHERE id = v_invoice.enrollment_id;

    UPDATE public.invoices
    SET status = 'cancelled'
    WHERE enrollment_id = v_invoice.enrollment_id AND status = 'pending';
  END IF;

  PERFORM public.write_audit_log('invoice_voided', 'invoice', p_invoice_id, jsonb_build_object(
    'reason', p_reason, 'amount', v_invoice.amount
  ));
END;
$$;

-- Frees the seat of a student who ran out of hours or left. Unused hours are
-- not carried over; refunds happen outside this system.
CREATE FUNCTION end_enrollment(p_enrollment_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  PERFORM public.assert_admin();

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to end an enrollment';
  END IF;

  SELECT status INTO v_status FROM public.enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Only an active enrollment can be ended';
  END IF;

  UPDATE public.enrollments SET status = 'cancelled' WHERE id = p_enrollment_id;

  UPDATE public.invoices
  SET status = 'cancelled'
  WHERE enrollment_id = p_enrollment_id AND status = 'pending';

  PERFORM public.write_audit_log('enrollment_ended', 'enrollment', p_enrollment_id, jsonb_build_object(
    'reason', p_reason
  ));
END;
$$;

-- ============================================================================
-- LESSONS
-- ============================================================================

CREATE FUNCTION schedule_lesson(p_class_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tutor_id uuid;
  v_lesson_id uuid;
BEGIN
  SELECT tutor_id INTO v_tutor_id FROM public.classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF NOT (public.is_admin() OR public.is_tutor_of_class(p_class_id)) THEN
    RAISE EXCEPTION 'You can only schedule lessons for your own classes' USING ERRCODE = '42501';
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'A lesson must end after it starts';
  END IF;

  PERFORM public.assert_logbook_month_open(p_class_id, p_starts_at);

  BEGIN
    INSERT INTO public.lessons (class_id, tutor_id, starts_at, ends_at)
    VALUES (p_class_id, v_tutor_id, p_starts_at, p_ends_at)
    RETURNING id INTO v_lesson_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'The tutor already has a lesson at this time';
  END;

  RETURN v_lesson_id;
END;
$$;

-- Admins may cancel any lesson without a logbook entry (the entry rule is
-- enforced by the protect_logged_lesson trigger). Tutors only before it starts.
-- To change a lesson's time, cancel it and schedule a new one.
CREATE FUNCTION cancel_lesson(p_lesson_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lesson public.lessons%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to cancel a lesson';
  END IF;

  SELECT * INTO v_lesson FROM public.lessons WHERE id = p_lesson_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  IF NOT (public.is_admin() OR (v_lesson.tutor_id = auth.uid() AND v_lesson.starts_at > now())) THEN
    RAISE EXCEPTION 'Tutors can only cancel their own lessons before they start' USING ERRCODE = '42501';
  END IF;

  IF v_lesson.status = 'cancelled' THEN
    RAISE EXCEPTION 'This lesson is already cancelled';
  END IF;

  UPDATE public.lessons
  SET status = 'cancelled',
      cancel_reason = p_reason,
      cancelled_at = now(),
      cancelled_by = auth.uid()
  WHERE id = p_lesson_id;

  PERFORM public.write_audit_log('lesson_cancelled', 'lesson', p_lesson_id, jsonb_build_object(
    'reason', p_reason
  ));
END;
$$;

-- ============================================================================
-- LOGBOOKS
-- ============================================================================

-- Adds or edits the entry for a lesson, creating the month's logbook on first use.
-- The month always comes from the lesson's WIB start time, never from the client.
CREATE FUNCTION save_logbook_entry(
  p_lesson_id uuid,
  p_topic text,
  p_activities text,
  p_tutor_observation text,
  p_future_recommendation text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lesson public.lessons%ROWTYPE;
  v_month date;
  v_logbook public.logbooks%ROWTYPE;
  v_entry_id uuid;
BEGIN
  SELECT * INTO v_lesson FROM public.lessons WHERE id = p_lesson_id;

  -- The class's current tutor owns its logbook, including lessons left
  -- unfinished by a previous tutor.
  IF NOT FOUND OR NOT public.is_tutor_of_class(v_lesson.class_id) THEN
    RAISE EXCEPTION 'Lesson not found' USING ERRCODE = '42501';
  END IF;

  v_month := date_trunc('month', v_lesson.starts_at AT TIME ZONE 'Asia/Jakarta')::date;

  INSERT INTO public.logbooks (class_id, month)
  VALUES (v_lesson.class_id, v_month)
  ON CONFLICT (class_id, month) DO NOTHING;

  SELECT * INTO v_logbook
  FROM public.logbooks
  WHERE class_id = v_lesson.class_id AND month = v_month
  FOR UPDATE;

  IF v_logbook.status NOT IN ('draft', 'returned') THEN
    RAISE EXCEPTION 'This logbook can no longer be edited';
  END IF;

  -- The validation trigger rejects cancelled or unfinished lessons.
  INSERT INTO public.logbook_entries (
    logbook_id, lesson_id, topic, activities, tutor_observation, future_recommendation
  )
  VALUES (
    v_logbook.id, p_lesson_id, p_topic, p_activities, p_tutor_observation, p_future_recommendation
  )
  ON CONFLICT (lesson_id) DO UPDATE
  SET topic = EXCLUDED.topic,
      activities = EXCLUDED.activities,
      tutor_observation = EXCLUDED.tutor_observation,
      future_recommendation = EXCLUDED.future_recommendation,
      updated_at = now()
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

-- Takes back an entry that has a factual mistake, such as a wrong time or a
-- lesson that did not happen. The lesson can then be cancelled by the admin.
CREATE FUNCTION remove_logbook_entry(p_lesson_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry public.logbook_entries%ROWTYPE;
  v_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = p_lesson_id AND public.is_tutor_of_class(l.class_id)
  ) THEN
    RAISE EXCEPTION 'Lesson not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_entry FROM public.logbook_entries WHERE lesson_id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This lesson has no logbook entry';
  END IF;

  SELECT status INTO v_status FROM public.logbooks WHERE id = v_entry.logbook_id FOR UPDATE;

  IF v_status NOT IN ('draft', 'returned') THEN
    RAISE EXCEPTION 'This logbook can no longer be edited';
  END IF;

  DELETE FROM public.logbook_entries WHERE id = v_entry.id;

  PERFORM public.write_audit_log('logbook_entry_removed', 'lesson', p_lesson_id, jsonb_build_object(
    'logbook_id', v_entry.logbook_id, 'topic', v_entry.topic
  ));
END;
$$;

-- A month is complete when it is over in WIB and every non-cancelled lesson in
-- it has an entry.
CREATE FUNCTION submit_logbook(p_logbook_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_logbook public.logbooks%ROWTYPE;
BEGIN
  SELECT * INTO v_logbook FROM public.logbooks WHERE id = p_logbook_id FOR UPDATE;

  IF NOT FOUND OR NOT public.is_tutor_of_class(v_logbook.class_id) THEN
    RAISE EXCEPTION 'Logbook not found' USING ERRCODE = '42501';
  END IF;

  IF v_logbook.status NOT IN ('draft', 'returned') THEN
    RAISE EXCEPTION 'Only a draft or returned logbook can be submitted';
  END IF;

  IF date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta')::date <= v_logbook.month THEN
    RAISE EXCEPTION 'A logbook can only be submitted after its month has ended';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.logbook_entries WHERE logbook_id = p_logbook_id) THEN
    RAISE EXCEPTION 'A logbook needs at least one entry before it can be submitted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.class_id = v_logbook.class_id
      AND l.status = 'scheduled'
      AND date_trunc('month', l.starts_at AT TIME ZONE 'Asia/Jakarta')::date = v_logbook.month
      AND NOT EXISTS (SELECT 1 FROM public.logbook_entries le WHERE le.lesson_id = l.id)
  ) THEN
    RAISE EXCEPTION 'Every lesson in this month needs an entry before submitting';
  END IF;

  UPDATE public.logbooks
  SET status = 'submitted',
      submitted_at = now(),
      submitted_by = auth.uid(),
      return_note = NULL
  WHERE id = p_logbook_id;

  PERFORM public.write_audit_log('logbook_submitted', 'logbook', p_logbook_id);
END;
$$;

CREATE FUNCTION return_logbook(p_logbook_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  PERFORM public.assert_admin();

  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN
    RAISE EXCEPTION 'A note is required to return a logbook';
  END IF;

  SELECT status INTO v_status FROM public.logbooks WHERE id = p_logbook_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Logbook not found';
  END IF;

  IF v_status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted logbook can be returned';
  END IF;

  UPDATE public.logbooks
  SET status = 'returned',
      returned_at = now(),
      returned_by = auth.uid(),
      return_note = p_note
  WHERE id = p_logbook_id;

  PERFORM public.write_audit_log('logbook_returned', 'logbook', p_logbook_id, jsonb_build_object(
    'note', p_note
  ));
END;
$$;

-- The admin sees every lesson. Anyone else sees only the lessons they taught,
-- so nobody sees another tutor's earnings. Only the tutor rate appears here,
-- never the student rate.
CREATE FUNCTION preview_logbook_earnings(p_logbook_id uuid)
RETURNS TABLE (
  lesson_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes int,
  rate_per_hour bigint,
  amount bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT e.lesson_id, e.starts_at, e.ends_at, e.duration_minutes, e.rate_per_hour, e.amount
  FROM public.compute_logbook_earnings(p_logbook_id) e
  WHERE public.is_admin() OR e.tutor_id = auth.uid();
END;
$$;

-- Approves only if the total still matches what the admin previewed. Approving
-- again returns the existing total and adds nothing.
CREATE FUNCTION approve_logbook(p_logbook_id uuid, p_expected_total bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_logbook public.logbooks%ROWTYPE;
  v_total bigint;
BEGIN
  PERFORM public.assert_admin();

  SELECT * INTO v_logbook FROM public.logbooks WHERE id = p_logbook_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Logbook not found';
  END IF;

  IF v_logbook.status = 'approved' THEN
    SELECT COALESCE(SUM(e.amount), 0)::bigint INTO v_total
    FROM public.tutor_earnings e
    WHERE e.logbook_id = p_logbook_id;
    RETURN v_total;
  END IF;

  IF v_logbook.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted logbook can be approved';
  END IF;

  -- Holds the rate steady between the total check and the insert below.
  PERFORM 1 FROM public.tutor_rates WHERE class_id = v_logbook.class_id FOR SHARE;

  SELECT COALESCE(SUM(e.amount), 0)::bigint INTO v_total
  FROM public.compute_logbook_earnings(p_logbook_id) e;

  IF v_total IS DISTINCT FROM p_expected_total THEN
    RAISE EXCEPTION 'Earnings changed since the preview (now %). Review the preview and approve again', v_total;
  END IF;

  INSERT INTO public.tutor_earnings (
    lesson_id, logbook_id, class_id, tutor_id, duration_minutes, rate_per_hour, amount
  )
  SELECT e.lesson_id, p_logbook_id, v_logbook.class_id, e.tutor_id, e.duration_minutes, e.rate_per_hour, e.amount
  FROM public.compute_logbook_earnings(p_logbook_id) e
  ON CONFLICT (lesson_id) DO NOTHING;

  UPDATE public.logbooks
  SET status = 'approved',
      approved_at = now(),
      approved_by = auth.uid()
  WHERE id = p_logbook_id;

  PERFORM public.write_audit_log('logbook_approved', 'logbook', p_logbook_id, jsonb_build_object(
    'total', v_total
  ));

  RETURN v_total;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Internal helpers: reachable only from the functions above.
REVOKE EXECUTE ON FUNCTION write_audit_log(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION assert_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION assert_tutor_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION assert_logbook_month_open(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION compute_logbook_earnings(uuid) FROM PUBLIC, anon, authenticated;

-- API: signed-in users only; each function checks the caller's role itself.
REVOKE EXECUTE ON FUNCTION get_class_catalog() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_class_roster(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION create_class(text, text, int, uuid, bigint, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION update_class(uuid, text, text, int, uuid, bigint, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION enroll_student(uuid, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION request_top_up(uuid, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION mark_invoice_paid(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION cancel_invoice(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION void_invoice(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION schedule_lesson(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION end_enrollment(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION remove_logbook_entry(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION cancel_lesson(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION save_logbook_entry(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION submit_logbook(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION return_logbook(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION preview_logbook_earnings(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION approve_logbook(uuid, bigint) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION get_class_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION get_class_roster(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_class(text, text, int, uuid, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION update_class(uuid, text, text, int, uuid, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION enroll_student(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION request_top_up(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_invoice_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION void_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_lesson(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION end_enrollment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_logbook_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_lesson(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION save_logbook_entry(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_logbook(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION return_logbook(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION preview_logbook_earnings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_logbook(uuid, bigint) TO authenticated;

-- Tables and views are read-only for API clients, regardless of platform defaults.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
