-- Migration: Harden scheduling and limit free text
-- Description: Bounds lesson length, closes two timing gaps around scheduling,
-- and caps how much text can be stored.

-- ============================================================================
-- SCHEDULING
-- ============================================================================

-- The shared lock on the class waits for a tutor change or a logbook submission
-- already in progress, so a new lesson always sees their result.
CREATE OR REPLACE FUNCTION schedule_lesson(p_class_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tutor_id uuid;
  v_lesson_id uuid;
BEGIN
  SELECT tutor_id INTO v_tutor_id FROM public.classes WHERE id = p_class_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF NOT (public.is_admin() OR public.is_tutor_of_class(p_class_id)) THEN
    RAISE EXCEPTION 'You can only schedule lessons for your own classes' USING ERRCODE = '42501';
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'A lesson must end after it starts';
  END IF;

  IF p_ends_at - p_starts_at NOT BETWEEN interval '15 minutes' AND interval '8 hours' THEN
    RAISE EXCEPTION 'A lesson must be between 15 minutes and 8 hours long';
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

-- A month is complete when it is over in WIB and every non-cancelled lesson in
-- it has an entry. Locking the class first means a lesson cannot be scheduled
-- into the month while this check runs.
CREATE OR REPLACE FUNCTION submit_logbook(p_logbook_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_class_id uuid;
  v_logbook public.logbooks%ROWTYPE;
BEGIN
  SELECT class_id INTO v_class_id FROM public.logbooks WHERE id = p_logbook_id;

  PERFORM 1 FROM public.classes WHERE id = v_class_id FOR UPDATE;

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

-- ============================================================================
-- TEXT LIMITS (the forms use the same numbers, see lib/limits.ts)
-- ============================================================================

ALTER TABLE classes
  ADD CONSTRAINT classes_title_length CHECK (length(title) <= 120),
  ADD CONSTRAINT classes_description_length CHECK (length(description) <= 2000);

ALTER TABLE logbook_entries
  ADD CONSTRAINT logbook_entries_topic_length CHECK (length(topic) <= 200),
  ADD CONSTRAINT logbook_entries_text_length CHECK (
    length(activities) <= 5000
    AND length(tutor_observation) <= 5000
    AND length(future_recommendation) <= 5000
  );

ALTER TABLE lessons
  ADD CONSTRAINT lessons_cancel_reason_length CHECK (length(cancel_reason) <= 500);

ALTER TABLE invoices
  ADD CONSTRAINT invoices_void_reason_length CHECK (length(void_reason) <= 500),
  ADD CONSTRAINT invoices_reference_note_length CHECK (length(reference_note) <= 500);

ALTER TABLE logbooks
  ADD CONSTRAINT logbooks_return_note_length CHECK (length(return_note) <= 2000);

-- Reasons for cancelling an invoice or ending an enrollment live only here.
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_metadata_size CHECK (pg_column_size(metadata) <= 10000);
