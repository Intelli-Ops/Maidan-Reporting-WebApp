-- =====================================================================
-- v12 — Unique indexes the investor importer depends on
--
-- BACKFILLED MIGRATION, same story as v11: these indexes existed only in the
-- live development database and were never written into sql/. A database
-- built from these files came out without them, and the investor import then
-- failed on its very first statement with:
--
--   there is no unique or exclusion constraint matching the ON CONFLICT
--   specification
--
-- These are not optional performance indexes. lib/investorImporter.js writes
-- with ON CONFLICT clauses that require exactly these targets:
--
--   INSERT INTO investors (name) ... ON CONFLICT (name)
--   INSERT INTO facility_investors (...) ...
--     ON CONFLICT (facility_id, investor_id) WHERE effective_to IS NULL
--
-- Postgres matches an ON CONFLICT target to a unique index, so without them
-- the statement is rejected outright rather than merely running slowly.
--
-- Safe to apply to populated databases: both were verified to hold no
-- duplicates on dev and production before this was written.
-- =====================================================================

-- One investor row per name, so re-importing a workbook updates the existing
-- investor instead of creating a second copy of the same person.
CREATE UNIQUE INDEX IF NOT EXISTS investors_name_unique
  ON investors (name);

-- One ACTIVE stake per (facility, investor). Partial on effective_to IS NULL
-- so historical, closed-out stakes can coexist with the current one — the
-- uniqueness applies only to the open row.
CREATE UNIQUE INDEX IF NOT EXISTS facility_investors_active_unique
  ON facility_investors (facility_id, investor_id)
  WHERE effective_to IS NULL;

-- Non-unique companion used for lookups of the active stake. Kept separate
-- from the constraint above so intent stays readable: one enforces, one
-- serves reads.
CREATE INDEX IF NOT EXISTS idx_facility_investors_active
  ON facility_investors (facility_id, investor_id)
  WHERE effective_to IS NULL;
