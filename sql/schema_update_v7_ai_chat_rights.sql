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
