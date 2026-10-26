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
