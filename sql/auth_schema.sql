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
