require('dotenv').config();
const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Dates.
//
// A Postgres DATE carries no time and no timezone, but node-pg parses it into
// a JS Date at LOCAL midnight, which then serializes to JSON in UTC. In
// Pakistan (UTC+5) that turns period_month = 2026-06-01 into
// "2026-05-31T19:00:00.000Z", and every consumer that reads the leading
// characters of that string sees May — so all the month-labelled charts were
// captioned one month early. Handing the string through untouched keeps the
// calendar date the database actually stores.
types.setTypeParser(types.builtins.DATE, (value) => value);

// max MUST stay under the Postgres endpoint's own client limit.
//
// This deploys against a Supabase session-mode pooler capped at 15 clients.
// A local `max` above that ceiling does not buy extra parallelism — it just
// moves the failure: pg happily opens a 16th connection, the pooler rejects it
// with FATAL "(EMAXCONNSESSION) max clients reached in session mode", and the
// whole request 500s. Staying under the ceiling makes pg QUEUE the overflow
// instead, which is slower under load but never fails.
//
// (It was previously 20, i.e. above the ceiling, which surfaced as intermittent
// dashboard 500s whenever requests overlapped — the bookings dashboard alone
// fans out 11 sections, several of which run two queries each, so two
// overlapping dashboard loads were enough to cross it.)
//
// 12 stays under the ceiling while leaving headroom for the auth/lookup/upload
// traffic that shares the same pooler.
const MAX_POOL = Number(process.env.DB_POOL_MAX) || 12;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: MAX_POOL,
  // Return idle connections to the pooler rather than holding all of them open.
  idleTimeoutMillis: 30_000,
  // Generous on purpose. This is the wait for a FREE CONNECTION, not a query
  // timeout, and the database is remote — individual dashboard queries run in
  // seconds, so a request queued behind a full pool can legitimately wait a
  // while. Set to 10s initially, which turned overlapping dashboard loads into
  // "Connection terminated due to connection timeout" 500s; the queue was
  // working as intended and the deadline was simply too short for it.
  connectionTimeoutMillis: 45_000,
});

module.exports = pool;
