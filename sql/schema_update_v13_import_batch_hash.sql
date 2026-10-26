-- =====================================================================
-- v13 — Identify import batches by file CONTENT, not by file name
--
-- WHY: raw_import_batches is the importers' idempotency record. Before an
-- import they ask "have I seen this file?" by looking up
-- (source_type, source_name), and skip the file if the answer is yes.
--
-- source_name is only the file's basename. The monthly booking workbooks are
-- named after the day of the month — 1.xlsx, 2.xlsx, ... 31.xlsx — and that
-- name repeats every single month. July's 1.xlsx imported fine because
-- nothing was named 1.xlsx yet, but August's 1.xlsx would match July's row,
-- be treated as already-imported, and be SKIPPED. Silently: no error, no
-- rows, just a month of bookings quietly missing.
--
-- (It survived this long only because the older batches happen to carry a
-- full relative path — '..\data\bookings\April Bookings\12.xlsx' — while
-- newer ones store the basename, so the two generations did not collide.)
--
-- FIX: hash the workbook bytes and use that as the identity. A name can
-- repeat; SHA-256 of the contents cannot, short of the file genuinely being
-- the same file. This also gets the semantics right in both directions:
--
--   same name, different month   -> different hash -> imports (was skipped)
--   re-uploading the identical file -> same hash  -> skipped (as intended)
--   file edited and re-uploaded  -> different hash -> imports as new
--
-- source_name is kept, purely so the UI and logs can show something a human
-- recognises.
-- =====================================================================

ALTER TABLE raw_import_batches
  ADD COLUMN IF NOT EXISTS source_hash TEXT;

-- Nullable and NOT unique on its own: rows imported before this migration
-- have no hash, and several legacy rows share NULL. The partial unique index
-- below applies only where a hash exists, so old rows are left alone while
-- new ones are properly constrained.
CREATE UNIQUE INDEX IF NOT EXISTS raw_import_batches_type_hash_unique
  ON raw_import_batches (source_type, source_hash)
  WHERE source_hash IS NOT NULL;

-- Lookups still fall back to source_name for pre-hash rows.
CREATE INDEX IF NOT EXISTS idx_raw_import_batches_type_name
  ON raw_import_batches (source_type, source_name);
