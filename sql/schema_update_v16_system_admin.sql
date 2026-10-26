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
