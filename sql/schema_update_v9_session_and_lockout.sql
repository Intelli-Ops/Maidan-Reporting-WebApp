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
