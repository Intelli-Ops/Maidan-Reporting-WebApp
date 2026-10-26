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
