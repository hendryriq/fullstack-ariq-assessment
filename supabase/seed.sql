-- Seed Data: Minimal setup for testing the group class enrollment system
-- Creates: 1 admin, 2 tutors, 3 students, 1 class (capacity 2)
-- 1 student enrolled & paid, 2 not enrolled: student2 can take the last seat,
-- then student3 hits the capacity limit
-- Last month's lessons with a submitted logbook (admin can test approval flow)
--
-- Dates are relative to the WIB month the seed runs in, so last month's lessons
-- and logbook always line up, whatever day it is run.

-- ============================================================================
-- AUTH USERS
-- Passwords: Admin123!, Tutor123!, Student123!
-- GoTrue cannot read NULL in the token columns, so they are set to ''.
-- ============================================================================

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data
)
SELECT
  v.id::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  v.email,
  extensions.crypt(v.password, extensions.gen_salt('bf')),
  now(), now(), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
FROM (VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@stargeneration.test', 'Admin123!'),
  ('22222222-2222-2222-2222-222222222222', 'tutor1@stargeneration.test', 'Tutor123!'),
  ('33333333-3333-3333-3333-333333333333', 'tutor2@stargeneration.test', 'Tutor123!'),
  ('44444444-4444-4444-4444-444444444444', 'student1@stargeneration.test', 'Student123!'),
  ('55555555-5555-5555-5555-555555555555', 'student2@stargeneration.test', 'Student123!'),
  ('66666666-6666-6666-6666-666666666666', 'student3@stargeneration.test', 'Student123!')
) AS v(id, email, password)
ON CONFLICT (id) DO NOTHING;

-- Email identities, as Supabase Auth creates for a normal sign-up
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
FROM auth.users u
WHERE u.email LIKE '%@stargeneration.test'
ON CONFLICT DO NOTHING;

-- Application users table
INSERT INTO users (id, email, full_name, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@stargeneration.test', 'Admin User', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'tutor1@stargeneration.test', 'Budi Santoso', 'tutor'),
  ('33333333-3333-3333-3333-333333333333', 'tutor2@stargeneration.test', 'Siti Rahayu', 'tutor'),
  ('44444444-4444-4444-4444-444444444444', 'student1@stargeneration.test', 'Ahmad Rizki', 'student'),
  ('55555555-5555-5555-5555-555555555555', 'student2@stargeneration.test', 'Dewi Putri', 'student'),
  ('66666666-6666-6666-6666-666666666666', 'student3@stargeneration.test', 'Fajar Ramadhan', 'student')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CLASSES AND RATES
-- ============================================================================

INSERT INTO classes (id, title, description, capacity, tutor_id) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Mathematics Grade 10',
    'Advanced mathematics for grade 10 students covering algebra, geometry, and trigonometry',
    2,       -- Capacity: 2 students
    '22222222-2222-2222-2222-222222222222'  -- Assigned to Budi (tutor1)
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO student_rates (class_id, rate_per_hour) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 150000)  -- Rp 150,000 per hour per student
ON CONFLICT (class_id) DO NOTHING;

INSERT INTO tutor_rates (class_id, rate_per_hour) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 100000)  -- Rp 100,000 per hour for the tutor
ON CONFLICT (class_id) DO NOTHING;

-- ============================================================================
-- ENROLLMENTS (1 of 2 seats taken)
-- Activated a few days before the start of last month (WIB)
-- ============================================================================

INSERT INTO enrollments (id, class_id, student_id, status, activated_at)
SELECT v.id::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, v.student_id::uuid, 'active',
  (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - interval '1 month' - interval '3 days') AT TIME ZONE 'Asia/Jakarta'
FROM (VALUES
  ('e1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444')  -- Ahmad (student1)
) AS v(id, student_id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- INVOICES (student1 has paid for 12 hours)
-- ============================================================================

INSERT INTO invoices (id, enrollment_id, hours, rate_snapshot, amount, status, paid_at, paid_by)
SELECT v.id::uuid, v.enrollment_id::uuid, 12, 150000, 1800000, 'paid',
  (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - interval '1 month' - interval '3 days') AT TIME ZONE 'Asia/Jakarta',
  '11111111-1111-1111-1111-111111111111'::uuid  -- Marked paid by admin
FROM (VALUES
  ('c1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111')
) AS v(id, enrollment_id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- LESSONS (2 last month, 2 upcoming), 14:00-15:30 WIB (90 minutes)
-- ============================================================================

INSERT INTO lessons (id, class_id, tutor_id, starts_at, ends_at, status)
SELECT
  v.id::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,  -- Budi
  (v.day_wib + time '14:00') AT TIME ZONE 'Asia/Jakarta',
  (v.day_wib + time '15:30') AT TIME ZONE 'Asia/Jakarta',
  'scheduled'
FROM (
  SELECT 'd1111111-1111-1111-1111-111111111111' AS id,
         (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - interval '1 month' + interval '9 days')::date AS day_wib
  UNION ALL
  SELECT 'd2222222-2222-2222-2222-222222222222',
         (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - interval '1 month' + interval '16 days')::date
  UNION ALL
  SELECT 'd3333333-3333-3333-3333-333333333333',
         ((now() AT TIME ZONE 'Asia/Jakarta') + interval '3 days')::date
  UNION ALL
  SELECT 'd4444444-4444-4444-4444-444444444444',
         ((now() AT TIME ZONE 'Asia/Jakarta') + interval '7 days')::date
) AS v
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- LOGBOOK (last month, SUBMITTED status for testing approval)
-- ============================================================================

INSERT INTO logbooks (id, class_id, month, status, submitted_at, submitted_by) VALUES
  (
    'b1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - interval '1 month')::date,
    'submitted',  -- Ready for admin to test preview & approve
    now() - interval '1 hour',
    '22222222-2222-2222-2222-222222222222'  -- Submitted by Budi
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- LOGBOOK ENTRIES (for the 2 lessons last month)
-- ============================================================================

INSERT INTO logbook_entries (id, logbook_id, lesson_id, topic, activities, tutor_observation, future_recommendation) VALUES
  (
    'f1111111-1111-1111-1111-111111111111',
    'b1111111-1111-1111-1111-111111111111',
    'd1111111-1111-1111-1111-111111111111',
    'Quadratic Equations - Factoring',
    'Reviewed factoring methods including common factors, difference of squares, and trinomials. Students completed problem set 3.1-3.5 with guidance. Worked through examples on the whiteboard and students practiced independently.',
    'Ahmad is grasping the factoring concepts well and asked insightful questions about when to use each method.',
    'Continue with graphing quadratic functions next lesson. Prepare coordinate plane practice.'
  ),
  (
    'f2222222-2222-2222-2222-222222222222',
    'b1111111-1111-1111-1111-111111111111',
    'd2222222-2222-2222-2222-222222222222',
    'Graphing Parabolas',
    'Graphed various parabolas using the vertex form and standard form. Identified vertex, axis of symmetry, and direction of opening. Students practiced plotting points and sketching curves.',
    'Good progress overall. Ahmad can identify key features of parabolas and needs more practice with word problems and real-world applications.',
    'Introduce completing the square method and connect it to vertex form. Bring real-world examples.'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- AUDIT LOG (for seeded actions)
-- ============================================================================

INSERT INTO audit_log (event_type, entity_type, entity_id, actor_id, metadata, created_at) VALUES
  (
    'enrollment_created',
    'enrollment',
    'e1111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    jsonb_build_object('invoice_id', 'c1111111-1111-1111-1111-111111111111', 'hours', 12, 'amount', 1800000),
    now() - interval '1 hour'
  ),
  (
    'invoice_paid',
    'invoice',
    'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    jsonb_build_object('amount', 1800000),
    now() - interval '1 hour'
  ),
  (
    'logbook_submitted',
    'logbook',
    'b1111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    NULL,
    now() - interval '1 hour'
  );

-- ============================================================================
-- SEED SUMMARY
-- ============================================================================

-- Users:
--   admin@stargeneration.test (Admin User)
--   tutor1@stargeneration.test (Budi Santoso)
--   tutor2@stargeneration.test (Siti Rahayu) - not assigned to any class yet
--   student1@stargeneration.test (Ahmad Rizki) - enrolled & paid
--   student2@stargeneration.test (Dewi Putri) - NOT enrolled (can take the last seat)
--   student3@stargeneration.test (Fajar Ramadhan) - NOT enrolled (can test capacity limit)
--
-- Passwords: Admin123!, Tutor123!, Student123!
--
-- Classes:
--   Mathematics Grade 10 (1 of 2 seats taken)
--   - Student rate: Rp 150,000/hour
--   - Tutor rate: Rp 100,000/hour
--   - Assigned to: Budi (tutor1)
--
-- Current State:
--   - student1 enrolled & paid (12 hours = 720 minutes)
--   - 2 lessons last month (90 min each = 180 min consumed)
--   - Remaining balance: 540 minutes (9 hours)
--   - 1 logbook SUBMITTED (not approved yet)
--   - Expected earnings: 2 lessons x 90 min x Rp 100k/60 = Rp 300,000 total
--
-- Testing Scenarios:
--   1. Admin login -> preview logbook earnings -> approve (test stale-guard)
--   2. Student2 enrolls (takes the last seat), then student3 tries -> should fail (capacity full)
--   3. Admin void invoice -> should fail (hours already consumed)
--   4. Tutor view earnings -> should be empty until logbook approved
--   5. Student view logbooks -> should see nothing until approved
