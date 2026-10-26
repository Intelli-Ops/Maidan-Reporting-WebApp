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
