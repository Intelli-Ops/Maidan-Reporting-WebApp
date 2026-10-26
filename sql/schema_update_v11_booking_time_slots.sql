-- =====================================================================
-- v11 — Booking time-slot columns
--
-- BACKFILLED MIGRATION. These columns and indexes already existed in the
-- development database but had never been written into sql/ — they were
-- applied directly, so a database built purely from these files came out
-- missing them. That drift only surfaced when the production copy failed
-- with: column "start_time" of relation "bookings" does not exist.
--
-- Captured here from the live dev schema so the two match and any future
-- environment can be rebuilt from these files alone.
--
-- Written by scripts/parse_time_slots.js, which parses the free-text time
-- slot on each imported booking; described to the chatbot in
-- services/aiQuery.service.js, which is why production genuinely needs them
-- (without them the AI generates SQL against columns that do not exist).
--
-- All columns are nullable: existing rows predate the parser, and a booking
-- whose slot text cannot be parsed legitimately has no time.
-- =====================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time        TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time          TIME;

-- Hour-of-day the slot starts (0-23), denormalised from start_time so the
-- dashboard can group by hour without a per-row function call.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_start_hour   SMALLINT;

-- True when end_time < start_time, i.e. the slot runs past midnight. Stored
-- rather than derived so duration maths does not have to special-case it.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS crosses_midnight  BOOLEAN DEFAULT FALSE;

-- Records how the parse went ('ok', or a reason it failed), so unparseable
-- slot text is visible and fixable instead of silently becoming NULL.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS time_parse_status TEXT;

-- Supports the Patterns tab on the bookings dashboard, which groups by hour
-- both overall and per facility.
CREATE INDEX IF NOT EXISTS idx_bookings_slot_start_hour     ON bookings (slot_start_hour);
CREATE INDEX IF NOT EXISTS idx_bookings_facility_slot_hour  ON bookings (facility_id, slot_start_hour);
