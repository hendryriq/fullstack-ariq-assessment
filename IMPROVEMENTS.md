# Improvements

The brief asks for improvements that solve real problems from "How the business works". This file covers the four I built on top of the required flow and rules: what each one does, how to try it with the seeded logins, and where it is built. `DECISIONS.md` keeps the short version for the decision log, together with the answers to the open decisions, which are not repeated here.

Run `npx supabase db reset` first, so the numbers below match. Every account uses the password `password123`.

| Problem named in the brief | Improvement | Who it helps |
|---|---|---|
| The admin "cannot easily tell how many hours each student has left, which invoices are still unpaid, or whether a class is profitable" | [1. Admin overview](#1-admin-overview-hours-left-unpaid-invoices-class-margin) | Admin |
| "Tutors ask the admin every month what they will be paid" | [2. Earnings preview for tutors, with a stale-number guard](#2-tutors-see-what-they-will-be-paid-before-approval) | Tutors and admin |
| Spreadsheets and WhatsApp leave no reliable record of who changed a price or marked an invoice paid | [3. Append-only audit log](#3-append-only-audit-log) | Admin |
| The admin cannot tell "whether a class is profitable" until the money has been spent | [4. Margin forecast per lesson hour](#4-margin-forecast-per-lesson-hour) | Admin |

## 1. Admin overview: hours left, unpaid invoices, class margin

**What it does.** One page answers the admin's three questions:

- **Hours left** for every active student, lowest first. Three hours or less (about two 90-minute lessons) is flagged "low hours". Zero or below is flagged "needs top-up", and the overdrawn time is shown.
- **Unpaid invoices**, oldest first, with how long each one has been waiting and the total outstanding.
- **Class margin**, as the brief defines it: paid invoices minus approved tutor earnings, per class and in total. A negative margin is flagged "loss".

**Try it.** Sign in as `admin@star.test`. Overview opens first. Ahmad Rizki has 9 h left in Mathematics Grade 10, and the class margin is Rp 1.800.000 (one paid 12-hour package, no approved earnings yet). Enroll as `student2@star.test` and the new invoice appears under Unpaid invoices. Approve last month's logbook and the margin drops by Rp 300.000.

**How it is built.** Two database views, so nothing is stored that could drift out of sync: `student_hours_balance` (paid minutes minus the minutes of ended, non-cancelled lessons) and `class_margin`. Both use `security_invoker`, so row level security still applies, and `class_margin` returns rows to an admin only. The page is `app/admin/page.tsx`.

**Why this over other options.** It answers three complaints from the brief on one screen. A CSV export would keep the admin in spreadsheets, and payment reminders would chase invoices without answering hours left or profitability.

**Left out.** Charts, date filters, export and email alerts. Margin is a cash figure, so it looks high right after a package is paid and falls as earnings are approved. I kept one formula that matches the brief.

## 2. Tutors see what they will be paid, before approval

**What it does.** The brief requires a preview for the admin before approval, and earnings for the tutor after it. I added two things:

- **A preview for the tutor.** On the tutor's Logbooks page, every month that is not yet approved shows an estimate per lesson and a total, as soon as each entry is written. It comes from the same database function as the admin's preview, `preview_logbook_earnings()`, which returns only the lessons the calling tutor taught. It shows the tutor rate, never the student rate.
- **A stale-number guard.** The admin approves the exact total they saw. `approve_logbook(id, expected_total)` recalculates inside the transaction and refuses with "Earnings changed since the preview" if the total is different, for example because the tutor rate changed after the preview was opened. The confirmation dialog repeats the amount before approving.

**Try it.**

1. Sign in as `tutor1@star.test` and open Logbooks. Last month shows two lessons at Rp 150.000 each and an estimated total of Rp 300.000 (2 × 90 minutes × Rp 100.000 per hour).
2. Sign in as admin, open Logbooks and review the same month. The preview shows the same Rp 300.000.
3. To see the guard, keep the review open, change the class's tutor rate in a second tab, then approve in the first tab. The approval is refused. Reload the review to see the new total. Run `npx supabase db reset` afterwards to restore the seed rates.

**How it is built.** `compute_logbook_earnings()` is the one place earnings are calculated, `round(tutor rate × minutes / 60)`. Both `preview_logbook_earnings()` and `approve_logbook()` use it, so the tutor, the admin and the recorded earnings always agree. They are in `supabase/migrations/20261110120006_create_rpcs.sql`. The pages are `app/tutor/logbooks/page.tsx` and `app/admin/logbooks/[id]/page.tsx`.

**Why this over other options.** A payslip after approval comes too late, because the tutor's question is what they *will* be paid. An estimate calculated in the browser would be a second formula that could disagree with the real one.

**Left out.** Payout batches, payslip export, and a pending-versus-paid payout status.

## 3. Append-only audit log

**What it does.** Records who did what and when: a class created or updated (with the old and new rates, capacity and tutor), an enrollment created or ended, an invoice paid, cancelled or voided, a top-up requested, a lesson cancelled, a logbook entry removed, and a logbook submitted, returned or approved. The reason is stored wherever one is required. The admin's Audit page lists the events, newest first, and filters them by record type.

**Try it.** Sign in as admin and open Audit. It starts with the seeded history. Do any step of the README tour and it appears at the top, with who did it and when. Filter by Invoice to see only invoice events.

**How it is built.** Each database function writes its audit row in the same transaction as the change, so a change cannot happen without its record. Only an admin can read the table, nobody can write to it directly, and a trigger blocks `UPDATE` and `DELETE` even for trusted code. The table and trigger are in `supabase/migrations/20261110120005_create_earnings_audit_and_balance.sql`, and the page is `app/admin/audit/page.tsx`.

**Why this over other options.** Several decisions deliberately allow corrections: ending an enrollment, returning a logbook, voiding an invoice. A record of who did each one makes those safe. I chose it over in-app notifications because it protects money and accountability first.

**Left out.** A detailed audit view with changes side by side and search.

## 4. Margin forecast per lesson hour

**What it does.** Overview's margin is a cash figure, so a class that will lose money still looks profitable until its logbooks are approved. This forecast shows the problem earlier, from the class's current rates:

- **Margin per lesson hour now:** active students × student rate − tutor rate. Students who have not paid are not counted.
- **Margin per lesson hour when full:** capacity × student rate − tutor rate.
- **Break-even:** how many students cover the tutor rate. A class that loses money even when full is flagged "Loss when full".

The Classes page shows the current margin and the break-even for every class. The Edit class page shows all three figures above the form, so the admin sees them before changing a rate.

**Try it.** Sign in as admin and open Classes. Mathematics Grade 10 shows Rp 50.000 per lesson hour (1 × Rp 150.000 − Rp 100.000) and a break-even of 1 student. Create a class with a student rate of 150000, a tutor rate of 400000 and a capacity of 2, and the new row is flagged "Loss when full", because 2 × Rp 150.000 is less than Rp 400.000. Run `npx supabase db reset` afterwards to remove it.

**How it is built.** One function, `classForecast()` in `lib/margin.ts`, holds the formula and is used by both pages: `app/admin/classes/page.tsx` and `app/admin/classes/[id]/page.tsx`. It reads rates and enrollments the admin can already read, so there is no new table, database function or write path, and tutors and students never see it.

**Why this over other options.** Tutors are paid per lesson whatever the number of students, so a tutor rate above the student rate is not automatically a loss: two students at Rp 150.000 cover a tutor at Rp 200.000. A rule forbidding it would reject valid classes, so the system informs the admin and the admin decides.

**Left out.** Blocking a rate, a live warning while typing in the form, and forecasting from each student's remaining hours.

## Smaller additions

These support the rules and decisions rather than solve a business problem on their own, so I do not count them as improvements.

- **Confirmation before actions that are hard to undo:** voiding an invoice, ending an enrollment, removing a logbook entry, submitting a logbook, and approving one, where the dialog shows the amount.
- **The Edit class page explains** what a change to each field affects before the admin saves it.
- **Limits against typos:** a lesson must be 15 minutes to 8 hours long, and free text has length limits, in the database and in the forms. A mistyped end date cannot wipe out students' hours or inflate earnings.
- **Simultaneous requests are settled by row locks:** two students taking the last seat, or a lesson scheduled while the class's tutor changes or its month is being submitted.
- **Shared computers:** an HttpOnly session cookie, security headers, and a full page load on sign in and sign out, so the next person cannot reach the previous account's pages.
- **Seed dates follow the calendar:** they are relative to the current month, so the tour works on any day.

What I would build next is listed in `DECISIONS.md`.
