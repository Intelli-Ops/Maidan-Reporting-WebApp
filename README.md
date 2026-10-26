# Maidan — Reporting & Dashboard Web App

Internal reporting for Maidan Sports Complex: bookings, revenue, expenses and
investor disbursements across three facilities (KMC, Emaar, Malir Cantt).
Monthly data arrives as Excel workbooks, is imported through the app, and is
presented as three dashboards.

- **Bookings** — revenue, patterns by weekday, and time-slot analysis
- **Expenses** — spend by category and facility
- **Investors** — stakes, monthly profit and disbursements

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Node 20+, Express 5 |
| Frontend | React 19, TypeScript, Vite, Tailwind v4, Recharts, TanStack Query |
| Database | PostgreSQL (hosted on Supabase) |
| Auth | JWT + bcrypt, role-based |
| Email | Brevo (password-reset OTP) — optional |
| AI chat | Google Gemini — optional |

**One deployment, not two.** Express serves the built frontend from
`frontend/dist` after its API routes, so the app runs as a single service on a
single origin. There is no separate frontend host. (The app previously ran as
a split Vercel frontend + Render backend; `DEPLOYMENT_GUIDE.md` still describes
that arrangement in places — see the note at the top of that file.)

---

## Running it locally

```bash
git clone <this repo>
cd maidan-backend-main

npm install                       # backend
npm install --prefix frontend     # frontend

cp .env.example .env              # then fill it in — see "Configuration"
```

Two terminals:

```bash
npm run dev                       # API on http://localhost:5000
cd frontend && npm run dev        # UI  on http://localhost:5173
```

The frontend also runs standalone against mock data, with no database and no
backend at all:

```bash
cd frontend && npm run dev:mock
```

---

## Setting up a database from scratch

This is the path to follow when taking the project over, or when standing up a
second environment. It takes about five minutes.

**1. Create an empty PostgreSQL database.** Supabase's free tier is what this
runs on today. Any Postgres 14+ will do.

**2. Create the schema.** Open `supabase_deploy_all.sql`, paste it into the
Supabase SQL Editor, and Run. It is one transaction — if anything fails, the
whole thing rolls back and you are left with an empty database rather than a
half-built one.

```bash
# or, with PROD_DATABASE_URL set in .env:
node scripts/run_schema_on_prod.js --dry-run
node scripts/run_schema_on_prod.js
```

**3. Load the lookup data.** Run `sql/seed_reference.sql` the same way. This is
configuration, not business data:

| Table | Rows | What it is |
|---|---|---|
| `facilities` | 3 | KMC, Emaar, Malir Cantt |
| `sport_types` | 4 | Futsal, Padel, … |
| `payment_methods` | 7 | Cash, card, Payfast, … |
| `expense_categories` | 60 | Two-level category tree |
| `bank_bin_reference` | 68 | Card BIN to bank, discount rules |

Skip this step and the app loads but every dropdown is empty and no import can
resolve a facility or a category. It is safe to re-run.

**4. Create the first login.**

```bash
node scripts/seed_admin.js        # uses DEFAULT_ADMIN_* from .env
```

**5. Import real data** through the app: sign in, go to **Data Import**, and
upload the monthly workbooks. Bookings, Expenses and Investors are three
separate uploads.

### Keeping the schema honest

`supabase_deploy_all.sql` is **generated**, never hand-edited. To change the
schema, add a new `sql/schema_update_v<N>_<name>.sql` and rebuild:

```bash
node scripts/build_schema_bundle.js           # rewrite the bundle
node scripts/build_schema_bundle.js --check   # fail if it is out of date
```

The `--check` form exists because this file silently fell four migrations
behind once, and nothing noticed until a fresh database behaved differently
from production. `scripts/compare_schemas.js` diffs two live databases for the
same reason.

To regenerate the lookup data from a live database:

```bash
node scripts/build_reference_seed.js --prod
```

---

## Configuration

Every variable is documented in `.env.example`. `.env` is gitignored and must
never be committed. The ones without a safe default:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | Supabase **session pooler** string. The app refuses to start without it. |
| `JWT_SECRET` | **Yes** | Long and random. Changing it logs everyone out, which is correct. |
| `PORT` | No | Defaults to 5000. Render sets this itself. |
| `BREVO_API_KEY` | No | Unset disables password-reset email. |
| `GEMINI_API_KEY` | No | Unset makes the AI endpoint return 503 instead of crashing. |

A new owner should generate **their own** value for every secret rather than
reusing any existing one.

---

## Deploying

The app deploys as one service. On Render:

| Setting | Value |
|---|---|
| Build command | `npm install && cd frontend && npm ci --include=dev && npm run build` |
| Start command | `node server.js` |
| Node version | 20+ |

> **`--include=dev` is not optional.** Vite, TypeScript and the Tailwind plugin
> are devDependencies. With `NODE_ENV=production` set, npm skips
> devDependencies and the build fails with `Cannot find module 'vite'`. Note
> that `npm ci --dry-run` reports the same package count either way, so it
> cannot be used to test this — only a real install can.

`GET /api/health` returns the commit the running service was built from. The
daily GitHub Action in `.github/workflows/supabase-keepalive.yml` compares that
against the branch head and fails if the deployment stops keeping up — a
deployment can serve a stale build while answering every request with a healthy
200, which is exactly what happened for two months in 2026.

That workflow also pings Supabase (which pauses a project after ~7 days idle)
and Brevo (which deactivates an unused API key after 90 days).

---

## Things worth knowing before you change anything

- **The connection pool is capped at 12.** Supabase's session pooler starts
  returning `FATAL: too many clients` past 15. Scripts that open their own pool
  alongside the server will hit it.
- **Date presets mean complete calendar months.** "3 months" on 26 October is
  1 July – 30 September, never a window ending today. Every data source lands
  a month or more in arrears, so a window ending today finishes inside a
  stretch with no data and the dashboard looks broken.
- **Postgres TIME arithmetic wraps.** `'00:00:00'::time + interval '24 hour'`
  is `00:00:00`, which makes midnight-crossing bookings easy to get wrong.
  `bookings.crosses_midnight` exists for this.
- **The importer commits its own transaction.** Wrapping a test import in an
  outer `BEGIN`/`ROLLBACK` will not undo it; clean up by `import_batch_id`.
- **Apply schema changes to production before deploying code that reads the
  new columns**, not after.
- **Row-level security is enabled on all 16 tables with no policies**, so the
  Supabase anon key can read nothing. The app connects as the owner and
  bypasses RLS by design. Do not "fix" this by adding permissive policies.

---

## Repository layout

```
server.js                Express entry point; serves the API and frontend/dist
routes/                  Route definitions
controllers/             Request handling and validation
services/                Business logic and SQL
middleware/              Auth, error handling, rate limiting
db/pool.js               The single shared connection pool
sql/                     Base schema + numbered migrations + reference seed
supabase_deploy_all.sql  Generated bundle of everything in sql/
scripts/                 Imports, migrations, seeding, health checks
frontend/                React app (its own package.json)
```

Deeper documentation lives in `DEPLOYMENT_GUIDE.md` (hosting, env vars, CORS,
domains) and `DESIGN_SYSTEM.md` (UI conventions and chart colours).
