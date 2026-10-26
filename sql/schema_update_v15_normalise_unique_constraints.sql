-- =====================================================================
-- v15 — Make the two databases express the same uniqueness the same way
--
-- Found by scripts/compare_schemas.js. Three differences, none of which
-- changed behaviour today but all of which would diverge further over time:
--
-- 1. Development carried DUPLICATE unique constraints on disbursements and
--    monthly_profit — the ones sql/maidan_schema.sql declares inline
--    (*_key, auto-named by Postgres) plus a second, hand-added pair covering
--    exactly the same columns. Two identical unique indexes on the same
--    columns cost writes twice over and enforce nothing extra.
--
-- 2. investors_name_unique was a CONSTRAINT in development but only an INDEX
--    in production (v12 created it with CREATE UNIQUE INDEX). Both satisfy
--    ON CONFLICT, but they live in different catalogs, so they are not the
--    same object: a constraint can be dropped by name with ALTER TABLE, be
--    targeted by a foreign key, and shows in information_schema. Promote the
--    index rather than recreating it, so the existing index is reused
--    instead of being rebuilt.
--
-- Written to be safe on a fresh database as well as on the two existing ones,
-- so every branch is guarded.
-- =====================================================================

-- 1. Drop the redundant hand-added duplicates, if present.
ALTER TABLE disbursements  DROP CONSTRAINT IF EXISTS disbursements_fi_period_unique;
ALTER TABLE monthly_profit DROP CONSTRAINT IF EXISTS monthly_profit_facility_period_unique;

-- 2. Promote investors_name_unique from a bare index to a real constraint.
--    ADD CONSTRAINT ... USING INDEX adopts the existing index in place.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'investors_name_unique' AND conrelid = 'investors'::regclass
  ) AND EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'investors_name_unique' AND relkind = 'i'
  ) THEN
    ALTER TABLE investors
      ADD CONSTRAINT investors_name_unique UNIQUE USING INDEX investors_name_unique;
  END IF;
END $$;

-- Same treatment for the partial unique index from v12. A partial index
-- CANNOT be promoted to a constraint (Postgres constraints cannot carry a
-- WHERE clause), so it stays an index in both databases by necessity — noted
-- here so a future reader does not mistake it for drift.
