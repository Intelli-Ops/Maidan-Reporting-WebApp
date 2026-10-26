-- Maidan — full schema, generated 2026-10-26T19:17:02Z
-- by scripts/build_schema_bundle.js. Do not edit by hand: edit the
-- files in sql/ and re-run that script, or your change is lost on the
-- next rebuild.
--
-- Paste into the Supabase SQL Editor and Run, or apply with
-- scripts/run_schema_on_prod.js.
--
-- Wrapped in a transaction: Postgres DDL is transactional, so if any
-- statement fails the whole thing rolls back and you are left with an
-- empty database rather than a half-built schema.

BEGIN;

-- ============================================================
-- sql/maidan_schema.sql
-- ============================================================
-- =====================================================================
-- MAIDAN SPORTS COMPLEX — REPORTING & DASHBOARD DATABASE SCHEMA
-- Target: Supabase (Postgres)
-- Domains covered: Investor Disbursements | Expenses | Bookings/Revenue
-- =====================================================================


-- =====================================================================
-- 1. CORE REFERENCE TABLES
-- =====================================================================

-- Facilities: KMC, Emaar, Malir Cantt
CREATE TABLE facilities (
    id              SERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,      -- e.g. 'KMC', 'EMAAR', 'MALIR'
    name            TEXT NOT NULL,             -- e.g. 'Maidan KMC'
    location        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sport types: Futsal, Padel (extensible if new sports get added later)
CREATE TABLE sport_types (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE       -- 'Futsal', 'Padel'
);

-- Expense categories: kept as a lookup table (not free text) so dashboard
-- filters/dropdowns stay clean. Add new categories via INSERT any time.
CREATE TABLE expense_categories (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE       -- 'Salary', 'Investor', 'Internet', etc.
);

-- Payment methods used across bookings + expenses
CREATE TABLE payment_methods (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE       -- 'Cash', 'Card', 'IBFT', 'Cheque', 'NA'
);

-- Bank BIN lookup table — static reference data from the "Bank Details" tab.
-- Seeded once, updated only when a new card program is added.
CREATE TABLE bank_bin_reference (
    bin_number              BIGINT PRIMARY KEY,
    bank_name               TEXT NOT NULL,
    card_type               TEXT,
    discount_pct            NUMERIC(5,4),      -- e.g. 0.4000 = 40%
    discount_cap            NUMERIC(12,2),
    monthly_txn_limit       INTEGER,
    daily_txn_limit         INTEGER,
    bank_discount_share     NUMERIC(5,4),      -- portion of discount borne by bank
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================================
-- 2. BOOKINGS / REVENUE
-- =====================================================================

CREATE TABLE bookings (
    id                  BIGSERIAL PRIMARY KEY,
    facility_id         INTEGER NOT NULL REFERENCES facilities(id),
    sport_type_id       INTEGER NOT NULL REFERENCES sport_types(id),

    booking_date        DATE NOT NULL,
    time_slot_raw        TEXT,                 -- original text e.g. '7 am to 10 am'
    duration_hours       NUMERIC(5,2) NOT NULL,

    customer_name        TEXT,

    per_hour_rate         NUMERIC(12,2),
    gross_amount          NUMERIC(12,2) NOT NULL,   -- Amount before discount
    discount_pct          NUMERIC(6,4) DEFAULT 0,
    discount_amount        NUMERIC(12,2) DEFAULT 0,
    net_amount             NUMERIC(12,2) NOT NULL,   -- Amount actually received (= Revenue)

    payment_method_id      INTEGER REFERENCES payment_methods(id),
    bank_bin               BIGINT REFERENCES bank_bin_reference(bin_number),

    status                 TEXT NOT NULL,      -- 'Done', 'Cancel', 'Academy', etc.
    remarks                TEXT,

    -- Raw/original fields kept for traceability — if our parsing logic
    -- ever misreads a facility or sport type, you can see exactly what
    -- it parsed from and fix it without losing the source data.
    agent_name_raw          TEXT,
    income_raw              TEXT,

    import_batch_id          BIGINT,           -- links to raw_import_batches
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_facility_date ON bookings(facility_id, booking_date);
CREATE INDEX idx_bookings_date ON bookings(booking_date);


-- =====================================================================
-- 3. EXPENSES
-- =====================================================================

CREATE TABLE expenses (
    id                  BIGSERIAL PRIMARY KEY,
    facility_id          INTEGER NOT NULL REFERENCES facilities(id),
    expense_category_id  INTEGER NOT NULL REFERENCES expense_categories(id),

    expense_date          DATE NOT NULL,
    item                  TEXT,
    description           TEXT,

    amount                NUMERIC(12,2) NOT NULL,

    payment_method_id      INTEGER REFERENCES payment_methods(id),
    cheque_number           TEXT,
    source_account          TEXT,
    source_bank             TEXT,

    import_batch_id          BIGINT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_facility_date ON expenses(facility_id, expense_date);
CREATE INDEX idx_expenses_category ON expenses(expense_category_id);


-- =====================================================================
-- 4. INVESTORS & DISBURSEMENTS
-- =====================================================================

CREATE TABLE investors (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    contact_info    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ownership % per facility, with date-ranged validity.
-- Handles BOTH cases without needing to know the answer up front:
--   - Fixed forever  -> just one row per investor/facility, effective_to = NULL
--   - Changes later  -> close old row (set effective_to), insert new row
CREATE TABLE facility_investors (
    id                      SERIAL PRIMARY KEY,
    facility_id             INTEGER NOT NULL REFERENCES facilities(id),
    investor_id             INTEGER NOT NULL REFERENCES investors(id),
    investment_amount       NUMERIC(14,2),
    ownership_percentage    NUMERIC(6,4) NOT NULL,   -- e.g. 0.2500 = 25%
    effective_from          DATE NOT NULL DEFAULT '2024-01-01',
    effective_to            DATE,                     -- NULL = currently active
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_facility_investors_active
    ON facility_investors(facility_id, investor_id)
    WHERE effective_to IS NULL;

-- Monthly profit pool per facility — manually entered for now (Option A).
-- Later this can be cross-checked against SUM(bookings.net_amount) - SUM(expenses.amount)
-- for that facility/month as a reconciliation step, without changing this table.
CREATE TABLE monthly_profit (
    id                  SERIAL PRIMARY KEY,
    facility_id         INTEGER NOT NULL REFERENCES facilities(id),
    period_month        DATE NOT NULL,            -- store as first-of-month, e.g. 2026-05-01
    profit_amount       NUMERIC(14,2) NOT NULL,
    entered_by           TEXT,
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(facility_id, period_month)
);

-- Actual disbursement per investor per month.
-- disbursed_amount is a SNAPSHOT (computed once, stored) — so a later change
-- to ownership % never silently rewrites a past month's disbursed amount.
CREATE TABLE disbursements (
    id                       BIGSERIAL PRIMARY KEY,
    facility_investor_id     INTEGER NOT NULL REFERENCES facility_investors(id),
    monthly_profit_id        INTEGER NOT NULL REFERENCES monthly_profit(id),

    period_month             DATE NOT NULL,
    ownership_pct_used       NUMERIC(6,4) NOT NULL,   -- % actually applied, snapshot
    disbursed_amount         NUMERIC(14,2) NOT NULL,

    status                   TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' / 'Disbursed'
    disbursed_date            DATE,

    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(facility_investor_id, period_month)
);

CREATE INDEX idx_disbursements_period ON disbursements(period_month);
CREATE INDEX idx_disbursements_status ON disbursements(status);


-- =====================================================================
-- 5. IMPORT TRACKING (for the Google Sheets sync pipeline)
-- =====================================================================

-- Every sync run logs itself here — lets the sync script avoid
-- re-importing the same rows twice (idempotency), and gives you an
-- audit trail of when data last landed.
CREATE TABLE raw_import_batches (
    id              BIGSERIAL PRIMARY KEY,
    source_type     TEXT NOT NULL,     -- 'booking', 'expense', 'investor'
    source_name     TEXT,              -- sheet/file name or tab name
    row_count       INTEGER,
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes           TEXT
);


-- =====================================================================
-- 6. SEED DATA — facilities (safe to run once)
-- =====================================================================

INSERT INTO facilities (code, name) VALUES
    ('KMC', 'Maidan KMC'),
    ('EMAAR', 'Maidan Emaar'),
    ('MALIR', 'Maidan Malir Cantt')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sport_types (name) VALUES
    ('Futsal'),
    ('Padel')
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_methods (name) VALUES
    ('Cash'), ('Card'), ('IBFT'), ('Cheque'), ('NA')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- sql/auth_schema.sql
-- ============================================================
-- =====================================================================
-- AUTHENTICATION & USER MANAGEMENT SCHEMA
-- Run this script in your Supabase SQL Editor to enable Auth.
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'manager', -- see schema_update_v5_operations_manager_upload_rights.sql for the current role set
    facility_id     INTEGER REFERENCES facilities(id), -- NULL means global access across all facilities
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================
-- sql/schema_update_v2.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v2 — based on Taha's answers
-- Run this AFTER maidan_schema.sql has already been executed.
-- Safe to run on a table that already has data (all additive changes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Expense sub-categories
-- Taha confirmed categories/subcategories change monthly. Rather than
-- guess the exact hierarchy, this lets a category optionally point to
-- a parent category — e.g. 'Internet' -> parent 'Utilities'.
-- Top-level categories just leave parent_category_id as NULL.
-- ---------------------------------------------------------------------
ALTER TABLE expense_categories
    ADD COLUMN parent_category_id INTEGER REFERENCES expense_categories(id);

CREATE INDEX idx_expense_categories_parent ON expense_categories(parent_category_id);


-- ---------------------------------------------------------------------
-- 2. Index to support "which BIN numbers are used most" reporting
-- (Taha specifically wants this comparison on the dashboard)
-- ---------------------------------------------------------------------
CREATE INDEX idx_bookings_bank_bin ON bookings(bank_bin);

-- ============================================================
-- sql/schema_update_v3_registration_approval.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v3 — Registration + admin-approval workflow
-- Run this AFTER auth_schema.sql (and schema_update_v2.sql) have been applied.
-- Safe to run on a table that already has data (additive + backfill).
-- =====================================================================

-- 1. New columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- 2. Backfill: rows that exist today were created under the old
--    self-service signup flow and are already usable in production.
--    Grandfather them in as approved so this migration doesn't lock
--    out the existing seeded admin / any existing managers.
UPDATE users SET status = 'approved' WHERE status = 'pending';

-- 3. role becomes optional: NULL until an admin approves and assigns one
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;

-- 4. Constrain the allowed values now that they're hand-maintained strings
ALTER TABLE users ADD CONSTRAINT chk_users_status CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IS NULL OR role IN ('admin','manager','viewer'));

-- 5. Defense in depth: an approved user must have a role
ALTER TABLE users ADD CONSTRAINT chk_users_role_required_when_approved
  CHECK (status <> 'approved' OR role IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================
-- sql/schema_update_v4_remove_user_facility.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v4 — Remove per-user facility scoping
-- Run this AFTER auth_schema.sql, schema_update_v2.sql and
-- schema_update_v3_registration_approval.sql have been applied.
--
-- users.facility_id was meant to lock a manager's account to a single
-- facility's data. It's no longer used for security/privacy reasons —
-- role (admin/manager/viewer) is now the only access-control axis on
-- users. This does NOT touch the `facilities` table itself, or
-- facility_id on bookings/expenses/investors/monthly_profit — those
-- describe which facility a business record belongs to and are
-- unrelated to user permissions.
-- =====================================================================

ALTER TABLE users DROP COLUMN IF EXISTS facility_id;

-- ============================================================
-- sql/schema_update_v5_operations_manager_upload_rights.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v5 — Operations manager role + per-user upload rights
-- Run this AFTER auth_schema.sql, schema_update_v2.sql,
-- schema_update_v3_registration_approval.sql and
-- schema_update_v4_remove_user_facility.sql have been applied.
--
-- Renames the 'manager' role to 'operations_manager' (more roles of this
-- kind may be added later) and introduces a `can_upload` flag that is
-- assigned per-user at approval time, independent of role. Admins always
-- retain upload rights regardless of this flag (enforced in application
-- code); everyone else needs it explicitly granted.
-- =====================================================================

-- 1. Drop the old constraint first — it only allows 'manager', so renaming
--    rows to 'operations_manager' before this step would violate it.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;

-- 2. Rename the existing role now that nothing constrains it
UPDATE users SET role = 'operations_manager' WHERE role = 'manager';

-- 3. Add the new, tightened constraint
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IS NULL OR role IN ('admin','operations_manager','viewer'));

-- 4. Per-user upload permission, independent of role
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_upload BOOLEAN NOT NULL DEFAULT false;

-- 5. Backfill: preserve current behavior for existing accounts that could
--    already upload under the old admin/manager role check.
UPDATE users SET can_upload = true WHERE role IN ('admin', 'operations_manager');

-- ============================================================
-- sql/schema_update_v6_password_reset.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v6 — password reset support
-- Run this AFTER schema_update_v5_operations_manager_upload_rights.sql.
-- Safe to run on a table that already has data (all additive changes).
--
-- No email/SMS provider is wired up, so "forgot password" is a self-service
-- flow verified by email + registered phone (both known only to the account
-- holder) instead of a mailed link. reset_token_hash stores a SHA-256 hash
-- of a random token (never the raw token) so a DB read alone can't be used
-- to reset an account; reset_token_expires_at makes it single-use/short-lived.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash
    ON users(reset_token_hash)
    WHERE reset_token_hash IS NOT NULL;

-- ============================================================
-- sql/schema_update_v7_ai_chat_rights.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v7 — Per-user AI chatbot access
-- Run this AFTER schema_update_v6_password_reset.sql has been applied.
--
-- Mirrors the can_upload pattern from v5: a per-user flag, independent of
-- role, gating the /api/ai/ask chatbot. Admins always retain access
-- regardless of this flag (enforced in application code); everyone else
-- needs it explicitly granted at approval time or later via admin edit.
-- Unlike can_upload, this is a brand-new feature nobody has ever had access
-- to, so only admins are backfilled true — operations_managers/viewers must
-- be granted it explicitly, same as a fresh registration would be.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_use_ai_chat BOOLEAN NOT NULL DEFAULT false;

UPDATE users SET can_use_ai_chat = true WHERE role = 'admin';

-- ============================================================
-- sql/schema_update_v8_ai_conversations.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v8 — Saved AI chat history
-- Run this AFTER schema_update_v7_ai_chat_rights.sql has been applied.
--
-- /api/ai/ask was stateless: it answered a question and kept nothing, so
-- every panel open started blank. These two tables give the assistant a
-- history that belongs to the user account rather than to a browser, so it
-- follows them across machines and survives clearing site data.
--
-- Conversations are per-user and never shared: every query in
-- aiConversation.service.js filters on user_id, and ON DELETE CASCADE means
-- deactivating/removing a user takes their history with them rather than
-- orphaning rows that still hold their questions.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Derived from the first question (truncated), not asked for — a titling
    -- round-trip to Gemini would double the cost of every new conversation.
    title       TEXT NOT NULL,
    -- Which dashboard the conversation started from ('bookings' / 'expenses'
    -- / 'investors'), or NULL when started from the Ask AI screen. Only used
    -- to label the row in the history list.
    scope       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The history list is always "my conversations, most recently used first",
-- so the index carries updated_at rather than leaving it to a sort.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
    ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
    id               BIGSERIAL PRIMARY KEY,
    conversation_id  BIGINT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content          TEXT NOT NULL,

    -- Assistant rows only: the audit trail the UI shows under an answer.
    -- Stored rather than recomputed because the same question re-asked later
    -- can generate different SQL — the record has to be what actually ran.
    sql_text         TEXT,
    row_count        INTEGER,
    rows_json        JSONB,

    -- Set instead of the three columns above when the question failed
    -- (unanswerable, upstream error). Kept in the thread so reopening a
    -- conversation shows what was asked and that it didn't land, rather than
    -- silently dropping the turn.
    error            TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON ai_messages(conversation_id, id);

-- ============================================================
-- sql/schema_update_v9_session_and_lockout.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v9 — session invalidation + per-account login lockout
-- Run this AFTER schema_update_v8_ai_conversations.sql.
-- Safe to run on a table that already has data (all additive changes).
--
-- token_version: embedded in every JWT at login (as `tv`) and compared
-- against the live column in authenticateToken. Bumped on password
-- change/reset so a JWT issued before that point stops verifying
-- immediately, instead of staying valid until its natural expiry — a
-- password change is meaningless as an incident-response tool otherwise.
-- Tokens issued before this migration carry no `tv` claim at all; those are
-- treated as valid until they expire naturally (a soft rollout, not a forced
-- logout of every existing session the moment this ships).
--
-- failed_login_attempts / locked_until: a per-account lockout independent of
-- source IP, layered on top of the existing IP-based loginLimiter — that
-- limiter alone doesn't slow an attacker spreading guesses across many IPs
-- against one known account.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- ============================================================
-- sql/schema_update_v10_audit_log.sql
-- ============================================================
-- =====================================================================
-- SCHEMA UPDATE v10 — admin action audit trail
-- Run this AFTER schema_update_v9_session_and_lockout.sql.
-- Safe to run on a table that already has data (all additive changes).
--
-- Until now, "who approved/rejected/edited/deleted a user, or replaced the
-- investor dataset" had no durable trail beyond the users row itself (which
-- is overwritten on every subsequent change, or gone entirely once deleted).
-- For a financial-reporting system, that makes any future dispute or
-- incident investigation much harder than it needs to be.
--
-- actor_user_id is ON DELETE SET NULL rather than CASCADE — deleting the
-- admin who performed an action shouldn't delete the record that they did.
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id             BIGSERIAL PRIMARY KEY,
    actor_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action         TEXT NOT NULL,
    target_type    TEXT,
    target_id      TEXT,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================
-- sql/schema_update_v11_booking_time_slots.sql
-- ============================================================
-- =====================================================================
-- v11 — Booking time-slot columns
--
-- BACKFILLED MIGRATION. These columns and indexes already existed in the
-- development database but had never been written into sql/ — they were
-- applied directly, so a database built purely from these files came out
-- missing them. That drift only surfaced when the production copy failed
-- with: column "start_time" of relation "bookings" does not exist.
--
-- Captured here from the live dev schema so the two match and any future
-- environment can be rebuilt from these files alone.
--
-- Written by scripts/parse_time_slots.js, which parses the free-text time
-- slot on each imported booking; described to the chatbot in
-- services/aiQuery.service.js, which is why production genuinely needs them
-- (without them the AI generates SQL against columns that do not exist).
--
-- All columns are nullable: existing rows predate the parser, and a booking
-- whose slot text cannot be parsed legitimately has no time.
-- =====================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time        TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time          TIME;

-- Hour-of-day the slot starts (0-23), denormalised from start_time so the
-- dashboard can group by hour without a per-row function call.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_start_hour   SMALLINT;

-- True when end_time < start_time, i.e. the slot runs past midnight. Stored
-- rather than derived so duration maths does not have to special-case it.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS crosses_midnight  BOOLEAN DEFAULT FALSE;

-- Records how the parse went ('ok', or a reason it failed), so unparseable
-- slot text is visible and fixable instead of silently becoming NULL.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS time_parse_status TEXT;

-- Supports the Patterns tab on the bookings dashboard, which groups by hour
-- both overall and per facility.
CREATE INDEX IF NOT EXISTS idx_bookings_slot_start_hour     ON bookings (slot_start_hour);
CREATE INDEX IF NOT EXISTS idx_bookings_facility_slot_hour  ON bookings (facility_id, slot_start_hour);

-- ============================================================
-- sql/schema_update_v12_investor_unique_indexes.sql
-- ============================================================
-- =====================================================================
-- v12 — Unique indexes the investor importer depends on
--
-- BACKFILLED MIGRATION, same story as v11: these indexes existed only in the
-- live development database and were never written into sql/. A database
-- built from these files came out without them, and the investor import then
-- failed on its very first statement with:
--
--   there is no unique or exclusion constraint matching the ON CONFLICT
--   specification
--
-- These are not optional performance indexes. lib/investorImporter.js writes
-- with ON CONFLICT clauses that require exactly these targets:
--
--   INSERT INTO investors (name) ... ON CONFLICT (name)
--   INSERT INTO facility_investors (...) ...
--     ON CONFLICT (facility_id, investor_id) WHERE effective_to IS NULL
--
-- Postgres matches an ON CONFLICT target to a unique index, so without them
-- the statement is rejected outright rather than merely running slowly.
--
-- Safe to apply to populated databases: both were verified to hold no
-- duplicates on dev and production before this was written.
-- =====================================================================

-- One investor row per name, so re-importing a workbook updates the existing
-- investor instead of creating a second copy of the same person.
CREATE UNIQUE INDEX IF NOT EXISTS investors_name_unique
  ON investors (name);

-- One ACTIVE stake per (facility, investor). Partial on effective_to IS NULL
-- so historical, closed-out stakes can coexist with the current one — the
-- uniqueness applies only to the open row.
CREATE UNIQUE INDEX IF NOT EXISTS facility_investors_active_unique
  ON facility_investors (facility_id, investor_id)
  WHERE effective_to IS NULL;

-- Non-unique companion used for lookups of the active stake. Kept separate
-- from the constraint above so intent stays readable: one enforces, one
-- serves reads.
CREATE INDEX IF NOT EXISTS idx_facility_investors_active
  ON facility_investors (facility_id, investor_id)
  WHERE effective_to IS NULL;

-- ============================================================
-- sql/schema_update_v13_import_batch_hash.sql
-- ============================================================
-- =====================================================================
-- v13 — Identify import batches by file CONTENT, not by file name
--
-- WHY: raw_import_batches is the importers' idempotency record. Before an
-- import they ask "have I seen this file?" by looking up
-- (source_type, source_name), and skip the file if the answer is yes.
--
-- source_name is only the file's basename. The monthly booking workbooks are
-- named after the day of the month — 1.xlsx, 2.xlsx, ... 31.xlsx — and that
-- name repeats every single month. July's 1.xlsx imported fine because
-- nothing was named 1.xlsx yet, but August's 1.xlsx would match July's row,
-- be treated as already-imported, and be SKIPPED. Silently: no error, no
-- rows, just a month of bookings quietly missing.
--
-- (It survived this long only because the older batches happen to carry a
-- full relative path — '..\data\bookings\April Bookings\12.xlsx' — while
-- newer ones store the basename, so the two generations did not collide.)
--
-- FIX: hash the workbook bytes and use that as the identity. A name can
-- repeat; SHA-256 of the contents cannot, short of the file genuinely being
-- the same file. This also gets the semantics right in both directions:
--
--   same name, different month   -> different hash -> imports (was skipped)
--   re-uploading the identical file -> same hash  -> skipped (as intended)
--   file edited and re-uploaded  -> different hash -> imports as new
--
-- source_name is kept, purely so the UI and logs can show something a human
-- recognises.
-- =====================================================================

ALTER TABLE raw_import_batches
  ADD COLUMN IF NOT EXISTS source_hash TEXT;

-- Nullable and NOT unique on its own: rows imported before this migration
-- have no hash, and several legacy rows share NULL. The partial unique index
-- below applies only where a hash exists, so old rows are left alone while
-- new ones are properly constrained.
CREATE UNIQUE INDEX IF NOT EXISTS raw_import_batches_type_hash_unique
  ON raw_import_batches (source_type, source_hash)
  WHERE source_hash IS NOT NULL;

-- Lookups still fall back to source_name for pre-hash rows.
CREATE INDEX IF NOT EXISTS idx_raw_import_batches_type_name
  ON raw_import_batches (source_type, source_name);

-- ============================================================
-- sql/schema_update_v14_enable_rls.sql
-- ============================================================
-- =====================================================================
-- v14 — Enable Row Level Security on every application table, and add the
--       two users indexes that were missing from development
--
-- SECURITY FIX. Supabase grants the `anon` and `authenticated` roles full
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE on every table in `public` by default,
-- and exposes them through the project's PostgREST endpoint at
-- https://<project>.supabase.co/rest/v1/. The only thing standing between
-- that endpoint and the data is Row Level Security.
--
-- The development database had RLS enabled on all 16 tables (Supabase's
-- `ensure_rls` event trigger does it automatically on table creation). The
-- production database, built by running the schema files through a plain
-- Postgres connection, did not — that event trigger never fired. Result:
-- anyone holding the production anon key could read `users` (password hashes
-- included), read every booking and expense, and TRUNCATE any table.
--
-- Enabling RLS with NO policies denies everything to anon/authenticated,
-- which is exactly what is wanted: nothing is supposed to reach these tables
-- except the backend.
--
-- This does NOT affect the application. The API connects as `postgres`, which
-- owns these tables and carries BYPASSRLS; owners are exempt from RLS unless
-- FORCE ROW LEVEL SECURITY is set, and it is not set here. Verified against
-- production before writing this.
--
-- If a restricted role is ever added (for example the read-only role for the
-- AI query service), it WILL be subject to RLS and will need explicit
-- policies. That is the correct default: opt in, not opt out.
-- =====================================================================

ALTER TABLE facilities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sport_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_bin_reference    ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_investors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_profit        ENABLE ROW LEVEL SECURITY;
ALTER TABLE disbursements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_import_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;

-- Present in production (created by sql/auth_schema.sql) but missing from the
-- development database, which predates them. Added here so the two match and
-- so login lookups are indexed in both.
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- ============================================================
-- sql/schema_update_v15_normalise_unique_constraints.sql
-- ============================================================
-- =====================================================================
-- v15 — Make the two databases express the same uniqueness the same way
--
-- Found by scripts/compare_schemas.js. Three differences, none of which
-- changed behaviour today but all of which would diverge further over time:
--
-- 1. Development carried DUPLICATE unique constraints on disbursements and
--    monthly_profit — the ones sql/maidan_schema.sql declares inline
--    (*_key, auto-named by Postgres) plus a second, hand-added pair covering
--    exactly the same columns. Two identical unique indexes on the same
--    columns cost writes twice over and enforce nothing extra.
--
-- 2. investors_name_unique was a CONSTRAINT in development but only an INDEX
--    in production (v12 created it with CREATE UNIQUE INDEX). Both satisfy
--    ON CONFLICT, but they live in different catalogs, so they are not the
--    same object: a constraint can be dropped by name with ALTER TABLE, be
--    targeted by a foreign key, and shows in information_schema. Promote the
--    index rather than recreating it, so the existing index is reused
--    instead of being rebuilt.
--
-- Written to be safe on a fresh database as well as on the two existing ones,
-- so every branch is guarded.
-- =====================================================================

-- 1. Drop the redundant hand-added duplicates, if present.
ALTER TABLE disbursements  DROP CONSTRAINT IF EXISTS disbursements_fi_period_unique;
ALTER TABLE monthly_profit DROP CONSTRAINT IF EXISTS monthly_profit_facility_period_unique;

-- 2. Promote investors_name_unique from a bare index to a real constraint.
--    ADD CONSTRAINT ... USING INDEX adopts the existing index in place.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'investors_name_unique' AND conrelid = 'investors'::regclass
  ) AND EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'investors_name_unique' AND relkind = 'i'
  ) THEN
    ALTER TABLE investors
      ADD CONSTRAINT investors_name_unique UNIQUE USING INDEX investors_name_unique;
  END IF;
END $$;

-- Same treatment for the partial unique index from v12. A partial index
-- CANNOT be promoted to a constraint (Postgres constraints cannot carry a
-- WHERE clause), so it stays an index in both databases by necessity — noted
-- here so a future reader does not mistake it for drift.

-- ============================================================
-- sql/schema_update_v16_system_admin.sql
-- ============================================================
-- =====================================================================
-- v16 — Add the system-administrator flag to users
--
-- Background: role answers "what kind of account is this" and is granted
-- through the normal approval/edit flow. It cannot also express "this one
-- account outranks the other admins", because anything the admin endpoints
-- can grant, an admin can grant to themselves.
--
-- So this is a separate column rather than a fourth role value:
--
--   * No API path writes it. controllers/auth.controller.js never reads it
--     from a request body and services/auth.service.js never includes it in
--     an UPDATE ... SET list, so it can only be set by a direct database
--     statement (scripts/set_system_admin.js). An account cannot grant
--     itself the flag through the app at any privilege level.
--   * role stays one of the existing three values, so authorizeRoles, the
--     JWT payload, the request validators, and every role dropdown are
--     untouched — no permission check has to learn a new value, which is
--     where a fourth role would most likely have gone wrong.
--
-- The partial unique index allows at most one row holding the flag. Postgres
-- indexes only the rows matching the WHERE clause, so the false rows are not
-- covered and any number of them can coexist.
-- =====================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_system_admin
  ON users (is_system_admin)
  WHERE is_system_admin;

COMMIT;
