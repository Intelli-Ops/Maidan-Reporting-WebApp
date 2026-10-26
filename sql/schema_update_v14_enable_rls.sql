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
