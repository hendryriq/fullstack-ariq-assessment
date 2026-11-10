# Star Generation: Group Class Enrollment & Billing

Three role-based views for group classes. One tutor teaches several students, students pay for a package of hours before they get access, and the tutor is paid for the lessons they teach.

- **Admin:** creates classes, manages invoices and students, reviews logbooks, approves earnings, and sees hours left, unpaid invoices and class margin.
- **Tutor:** schedules lessons, writes the monthly logbook, submits it for approval, and sees what they will earn and have earned.
- **Student:** enrolls, receives an invoice, and after payment sees the schedule, hours left and approved logbooks.

Built with TypeScript, Next.js 16 (React 19), Tailwind CSS 4, and Supabase Auth and PostgreSQL.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and [DECISIONS.md](DECISIONS.md) for the decision log.

## Requirements

- Node.js 20.9 or newer, with npm
- Docker, running (for local Supabase)
- An internet connection the first time you run the app, because DM Sans is downloaded from Google Fonts

The Supabase CLI is installed by `npm install`, so no global install is needed.

## Run it from a fresh clone

```bash
git clone https://github.com/hendryriq/fullstack-ariq-assessment.git
cd fullstack-ariq-assessment
npm install

# Start local Supabase, then apply the migrations and seed data
npx supabase start
npx supabase db reset

# Create the environment file (it is not in the repository, so every clone needs its own)
cp .env.example .env.local
npx supabase status -o env
```

Open `.env.local` and paste the `PUBLISHABLE_KEY` value from that output after `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, without quotes. Use only the publishable key, never the secret or service role key. The URL already matches local Supabase. Then start the app:

```bash
npm run dev
```

Next.js reads `.env.local` only when it starts. If you edit the file while the app is running, stop it with Ctrl+C and run `npm run dev` again.

Open <http://localhost:3000>. There is no sign-up, so use the seeded logins below.

## Seeded logins

Every account uses the password `password123`.

| Role | Email | Starting state |
|---|---|---|
| Admin | `admin@star.test` | |
| Tutor | `tutor1@star.test` | Teaches Mathematics Grade 10, and has last month's logbook waiting for approval |
| Tutor | `tutor2@star.test` | No class yet |
| Student | `student1@star.test` | Paid for 12 hours, 9 hours left |
| Student | `student2@star.test` | Not enrolled, can take the last seat |
| Student | `student3@star.test` | Not enrolled, reaches the capacity limit after student2 enrolls |

The seed also creates one class with a capacity of 2. `npx supabase db reset` restores this starting state at any time.

## A short tour

Each step uses only the seeded data.

1. **Enroll and reach capacity.** As student2, open Browse classes and enroll in Mathematics Grade 10. An invoice appears. As student3, the same class now says it is full.
2. **Pay an invoice.** As admin, open Invoices and mark student2's invoice paid. As student2, My classes now shows the hours left and Schedule shows the upcoming lessons.
3. **Review a logbook.** As admin, open Logbooks and review last month's logbook. The preview shows Rp 300.000. Return it with a note.
4. **Correct it.** As tutor1, open Logbooks, read the note, edit an entry and submit again.
5. **Approve it.** As admin, approve the logbook. As tutor1, Earnings shows Rp 300.000. As student1, Logbooks now shows it.
6. **Test the schedule rules.** As tutor1, open Schedule and add a lesson. Then try one that overlaps it, or one longer than 8 hours.
7. **Oversee it.** As admin, Overview shows hours left, unpaid invoices and class margin. Audit shows who did each step above.

## Rules worth knowing while testing

- All times are entered and shown in WIB (UTC+7).
- A lesson must be between 15 minutes and 8 hours long.
- A logbook entry can only be written after its lesson has ended.
- A logbook can only be submitted after its month has ended in WIB, so the current month shows a note instead of a submit button. To try submitting, use the return and resubmit steps in the tour.

## If something goes wrong

| Symptom | Cause and fix |
|---|---|
| `Your project's URL and Key are required to create a Supabase client` | `.env.local` is missing, or the publishable key line is empty. Follow the environment file step above, then restart `npm run dev`. |
| Pages load slowly, then send you to sign in | The app cannot reach Supabase. Check that Docker is running and `npx supabase status` lists the services. If not, run `npx supabase start`. |
| `npx supabase start` fails because a port is already in use | Another Supabase stack is using the local ports, often another copy of this project. Run `npx supabase stop`, then start again. |
| The data no longer matches the tour | Run `npx supabase db reset` to restore the seed data. |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app for development |
| `npm run build` | Builds the app for production |
| `npm run start` | Serves the production build |
| `npm run lint` | Runs ESLint |
| `npm run db:types` | Regenerates `lib/database.types.ts` after a schema change |
| `npx supabase db reset` | Rebuilds the local database and seed data |
| `npx supabase stop` | Stops local Supabase |

## Project layout

```
app/admin, app/tutor, app/student   Pages and Server Actions for each role
app/login, app/actions              Sign in and sign out
components/                         Shared UI (components/ui.tsx holds the basics)
lib/                                Auth check, Supabase client, formatting, limits
proxy.ts                            Session refresh and redirect for signed-out visitors
supabase/migrations, seed.sql       Schema, security rules and seed data
```

## Before deploying

The app has only been run against local Supabase. A real deployment also needs:

- **Real accounts.** The seed is for local use only. Do not reuse its accounts or its password.
- **Sign-ups off in the hosted project.** `supabase/config.toml` only applies locally.
- **Environment variables at build time.** Next.js inlines `NEXT_PUBLIC_*` values during the build.
- **Login protection.** Local testing did not show any limit on repeated wrong passwords, and the app adds none. Confirm Supabase's limits on the hosted project. Because sign-in runs on the server, those limits see the server's address rather than each visitor's. Also raise the minimum password length, which is 6 locally.
- **A `Secure` session cookie** in `lib/supabase/config.ts`, once the site is served over HTTPS.

## Known limitations

- The Content Security Policy covers framing, base tags, form targets and plugins. It does not restrict scripts, because that needs a nonce on every request, which would turn off prerendering.
- If an admin ends an enrollment at the same moment another request marks one of its invoices paid, one of the two can fail with a general error. The data stays correct, and retrying works.
- If a session expires while a form is open, submitting it shows the error page. "Try again" then leads to sign in. Nothing is saved.
- If the Supabase API is unreachable, a signed-in page waits about 40 seconds and then shows sign in.

Decisions and trade-offs about how the product behaves are in [DECISIONS.md](DECISIONS.md).
