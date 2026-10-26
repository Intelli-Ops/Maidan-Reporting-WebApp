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
