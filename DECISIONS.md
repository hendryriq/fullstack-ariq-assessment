# DECISIONS.md

> **Status:** the database rules below are implemented and tested. The pages they mention (dashboard, earnings, audit list) are still being built. Delete this note before submitting.

## Conventions used throughout

- **Money** is stored as integer rupiah (`bigint`), never floats. A lesson's earnings are `round(tutor_rate × minutes / 60)`, so 90 minutes at Rp100,000/hour is Rp150,000.
- **Durations** are stored as integer minutes (derived from `ends_at - starts_at`) to avoid fractional-hour rounding.
- **Time** is stored as `timestamptz` (UTC) and entered/displayed in `Asia/Jakarta` (WIB, UTC+7). WIB has no daylight saving, so month boundaries are unambiguous.
- **Assumption:** in a group class every paid, active student is charged for every lesson that takes place, regardless of attendance. Per-student attendance is out of scope (see "What I would build next").
- **Every write is a Postgres function (RPC)** that checks the caller and runs in a single transaction: creating and updating classes, enrolling, invoice changes, scheduling, logbook changes. API clients have `SELECT` only on tables (grants plus read-only RLS), so neither the UI nor a direct API call can bypass a rule.
- **Class catalog:** "students see only classes they have paid for" covers the schedule and logbooks. A student still has to choose a class before paying, so `get_class_catalog()` returns only what is needed to enroll: title, description, tutor name, student rate and seats left. It refuses tutors, who must never see student rates.

---

## 1. How the invoice amount is calculated, and how hours used are counted

**Decision**

- When enrolling, the student picks a package size in whole hours (UI presets 6 / 12 / 24; the database accepts 1-100 via a `CHECK`).
- `invoice.amount = hours × class.student_rate` at the moment the invoice is created. The hours, the rate and the amount are **copied onto the invoice** as a snapshot, so later rate changes never alter an existing invoice.
- **Hours remaining** = purchased minutes (paid invoices for that enrollment) − consumed minutes.
- **Consumed minutes** = total duration of lessons in that class that have **ended**, are **not cancelled**, and ended after the student's access started (`enrollment.activated_at`, set when the first invoice is paid). A student who joins mid-term is not charged for earlier lessons.
- Hours are consumed when a lesson **ends**, not when its logbook is approved. Students see an accurate balance right away, while logbook approval only gates earnings and logbook visibility.
- Hours remaining is a **database view**, not a stored counter, so it cannot drift out of sync.

**Why:** a snapshot makes invoices immutable facts, and a derived balance is always consistent with the lessons table. A stored counter would need extra code to stay correct when lessons are cancelled or corrected.

**Enforced in:** `invoices` snapshot columns and `CHECK`s, `student_hours_balance` view, `enroll_student()` and `request_top_up()` RPCs.

## 2. What happens to paid students when the admin changes rate, capacity or tutor

| Change | Rule | Effect on students who already paid | Reason |
|---|---|---|---|
| **Student rate** | Applies to new invoices only, including top-ups. Existing invoices keep their snapshot. | Hours already bought keep their price. A later top-up uses the new rate. | A student paid a known price for a known number of hours. |
| **Tutor rate** | Applies to logbooks approved **after** the change, including lessons already taught but not yet approved. Earnings are snapshotted at approval time. The approval RPC takes the previewed total and rejects the approval if it no longer matches, so the admin never approves a number they did not see. | None. Students are charged by the student rate only. | One rate per class is easy to explain, and approved earnings never change. |
| **Capacity** | Can be raised freely. Cannot be set below the number of seats currently held (pending or active enrollments). | Nobody is removed. | Reducing capacity must not silently evict someone who paid. |
| **Tutor** | Can change at any time. Only lessons that have not started move to the new tutor, and the change is rejected if that tutor already has a lesson at one of those times. Every lesson that has started stays with the tutor who taught it and is paid to them (`lessons.tutor_id` is a snapshot). The class and its logbooks move to the new tutor, who also writes any entries the previous tutor left unfinished. The previous tutor keeps their lessons and earnings but no longer sees the class or its logbooks. | Enrollment, hours and access do not change. Upcoming lessons continue with the new tutor. | A class should never be stuck because a tutor left. A logbook can safely hold two tutors' lessons because earnings are calculated per lesson, not per logbook. |

**Trade-offs I accepted**

- **Tutor rate:** there is one rate per class, as the brief describes, so a change also affects lessons that were taught but not yet approved. That includes the previous tutor's lessons if the rate changes together with a mid-month tutor change. To keep the old rate for a finished month, the admin approves its logbook before changing the rate. Effective-dated rates are listed under "next".
- **Tutor:** the new tutor may have to write entries for lessons they did not teach, when the previous tutor left them unfinished. The previous tutor is still the one paid for those lessons. I accepted this so that a class can always continue.

**Enforced in:** `update_class()` RPC, a trigger that rejects a capacity below the held seats, an exclusion constraint that rejects overlapping lessons for the new tutor, and per-lesson rows in `tutor_earnings`.

## 3. What happens when a student runs out of hours, or a lesson is cancelled

**Out of hours**

- The balance shown to the student never goes below 0. The admin can see the raw overdrawn minutes.
- Access is **not** revoked automatically. A paid student keeps their schedule and approved logbooks, and the class is flagged as "needs top-up" on the admin dashboard and on the student's page.
- The student can request a **top-up**: a new invoice on the same enrollment at the current student rate. Only one top-up can be unpaid at a time.
- Overdrawn time is a debt, so the next top-up covers it first. A student who is 60 minutes overdrawn and buys 2 hours has 60 minutes left.
- The admin can **end the enrollment**, with a required reason, when a student has run out of hours and does not top up, or leaves. This frees the seat and ends access. Unused hours are not carried over and refunds are out of scope. The student can enroll again with a new package.

**Why not revoke access automatically:** lessons are group lessons that run regardless of one student's balance, and the tutor is paid either way. Cutting a student off automatically would be hard to explain to a parent, and it is a policy call that belongs to the admin, so the system flags it and the admin decides.

**Why the admin can end an enrollment:** voiding is blocked once hours are used, so without this a student who has left would hold their seat forever.

**Cancelled lesson**

- A lesson is **soft-cancelled** (`status = 'cancelled'`, reason required), never deleted, so there is an audit trail.
- Cancelled lessons consume no hours, cannot receive a logbook entry, earn nothing, and are ignored by the overlap constraint.
- The tutor can cancel their own lesson only **before it starts**. The admin can cancel any lesson that has no logbook entry.
- To change a lesson's time, it is cancelled and a new one is scheduled. There is no separate reschedule action, so every change keeps a reason on record.

**Enforced in:** the `student_hours_balance` view, `request_top_up()`, `end_enrollment()` and `cancel_lesson()` RPCs, a trigger that freezes lessons with a logbook entry, an exclusion constraint on `lessons` filtered with `WHERE status <> 'cancelled'`, and a trigger on `logbook_entries` that rejects entries for cancelled or unfinished lessons.

## 4. What happens when the admin finds a problem in a submitted logbook

**Decision: "Return for revision" with a mandatory note.**

- Status flow: `draft → submitted → approved`, with `submitted → returned → submitted` as the correction loop. `returned` behaves like `draft`: the tutor can edit entries and resubmit.
- **A month is complete** when the WIB month is over and every non-cancelled lesson in it has an entry. Only then can the tutor submit. No lesson can be added to a month whose logbook is submitted or approved.
- The admin's note and the reviewer are stored and shown to the tutor until the logbook is resubmitted, and the audit log keeps the note. Every transition is written to the audit log.
- **Wrong facts:** while a logbook is `draft` or `returned`, the tutor can remove an entry. If a lesson did not happen, the tutor removes the entry and the admin cancels the lesson, so it earns nothing and uses no hours. If the time was wrong, the admin also cancels it, a corrected lesson is scheduled, and the tutor logs that one instead.
- No earnings exist until approval, so returning a logbook has no financial side effects.
- **Approved is final and read-only** at the database level (trigger blocks `UPDATE`/`DELETE` on the logbook and its entries). Approving again returns the same total and adds nothing, because of `UNIQUE (lesson_id)` on `tutor_earnings` plus a status check. Fixing an approved logbook would require a correction record, which I deliberately left out (see "next").

**Why:** a reject-and-delete flow loses the tutor's work, and letting the admin edit the tutor's entries would put words in the tutor's mouth. Returning keeps the class's tutor responsible for the content.

**Enforced in:** `save_logbook_entry()`, `remove_logbook_entry()`, `submit_logbook()`, `return_logbook()`, `approve_logbook()` RPCs, the open-month check in `schedule_lesson()`, plus immutability triggers on approved rows.

## 5. How an invoice becomes Paid, who can mark it, and whether that can be undone

**Decision**

- Lifecycle: `pending → paid`, and `pending → cancelled` or `paid → void`.
- **Only an admin** can mark an invoice paid, through `mark_invoice_paid()`. Payment is simulated, so the admin acts as the "gateway". The function records `paid_by`, `paid_at` and an optional reference note. Marking an already-paid invoice is a no-op.
- Marking paid activates the enrollment (`activated_at`), which unlocks the schedule, approved logbooks and hours balance for the student (enforced by RLS, not just the UI).
- Only an admin can cancel a pending invoice. Cancelling the first invoice of an enrollment frees the seat, and cancelling a top-up leaves the enrollment active.
- **There is no "un-pay".** The admin can **void** a paid invoice, with a reason, only if the hours it bought are unused, meaning the remaining paid invoices still cover every minute consumed.
- If no paid invoice remains after a void, the student loses access and the seat is freed. Voiding a top-up while another paid invoice remains keeps the student enrolled.
- If the hours have been used, voiding is blocked, because it would need a refund or credit note, which is out of scope.

**Seat rule that goes with this:** a seat is held from the moment of enrollment (`pending_payment` or `active`). This guarantees the quoted price and capacity, and it is the reason the capacity race condition is handled in `enroll_student()` with a row lock on the class. Cancelling the first invoice, voiding the last paid invoice or ending the enrollment releases the seat.

**Enforced in:** `mark_invoice_paid()`, `cancel_invoice()` and `void_invoice()` RPCs, RLS on student-facing tables, and a partial unique index on enrollments `(class_id, student_id)` for open enrollments, so a student cannot enroll twice but can enroll again after a cancellation.

---

## My own improvements

### A. Admin dashboard: hours left, unpaid invoices, class margin

- **Who it helps:** the admin, who today "cannot easily tell how many hours each student has left, which invoices are still unpaid, or whether a class is profitable".
- **What it shows:** a per-student hours table with low or overdrawn balances highlighted, unpaid invoices sorted by age, and each class's margin as the brief defines it: what students paid (paid invoices) minus what tutors earned (approved earnings).
- **Why this over alternatives:** it answers three complaints named in the brief on one screen. A CSV export would keep the admin in spreadsheets, and automatic payment reminders would chase unpaid invoices without answering hours left or profitability.
- **Left out:** charts, date-range filters, CSV export, email alerts, and a per-hour "recognised" margin. Margin is a cash figure, so it looks high right after a package is paid. I accepted that to keep one formula that matches the brief.

### B. Tutors see what they will be paid, with a stale-number guard

- **Who it helps:** tutors, who ask the admin every month what they will be paid, and the admin, who stops answering that question and can approve safely.
- **What it does:** the brief already requires an admin preview and earnings after approval. I added two things. A tutor can open the same preview before approval, limited to the lessons they taught, so they see the amount as soon as the entries are in. And `approve_logbook(id, expected_total)` recomputes inside the transaction and refuses if the total differs from what was previewed. Preview and approval use one calculation, so the tutor and the admin see the same amount for each lesson. The preview contains the tutor rate only, never the student rate.
- **Why this over alternatives:** a payslip sent after approval would come too late, because the question is what they *will* be paid. Calculating the estimate in the browser would add a second formula that could disagree with the real one.
- **Left out:** payout batches, payslip export, pending-versus-paid payout status.

### C. Append-only audit log

- **Who it helps:** the admin, and anyone who has to explain a number later. Spreadsheets and WhatsApp leave no reliable record of who changed a price or marked an invoice paid.
- **What it does:** records who did what and when for class changes, enrollments created or ended, invoices paid, cancelled or voided, cancelled lessons, removed logbook entries, and logbook submit/return/approve, with the reason where one is required. A trigger blocks updates and deletes on the table.
- **Why this over alternatives:** decisions 3, 4 and 5 deliberately allow corrective actions (ending an enrollment, returning a logbook, voiding an invoice), and an audit trail is what makes those safe. I chose it over in-app notifications because it protects money and accountability first.
- **Left out:** a rich audit UI. The admin gets a simple filterable list per class and per invoice.

---

## What I would build next with another day

1. **Automated tests:** SQL tests for RLS and constraints, plus end-to-end tests for the capacity race and double approval, run in CI. These protect every rule above.
2. **Pending-invoice expiry**, to release seats that are held but never paid.
3. **Notifications** (email or WhatsApp) for invoice created, logbook returned or approved, and hours running low.

**Beyond one day:** effective-dated tutor rates so a rate change never affects lessons already taught, correction records for approved logbooks, credit notes and refunds, per-student attendance with make-up lessons, and a real payment gateway with webhooks.
