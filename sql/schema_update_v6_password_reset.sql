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
