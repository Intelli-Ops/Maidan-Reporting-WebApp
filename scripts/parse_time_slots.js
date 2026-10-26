// parse_time_slots.js
// Backfills bookings.start_time / end_time / slot_start_hour / crosses_midnight
// / time_parse_status by parsing the free-text bookings.time_slot_raw field.
//
// Run add_time_slot_columns.sql FIRST.
//
// Usage:
//   node parse_time_slots.js --dry-run     analyse only, print a report, no writes
//   node parse_time_slots.js               parse and update the bookings table
//   node parse_time_slots.js --only-unparsed   skip rows already parsed
//
// -------------------------------------------------------------------------
// HOW THIS WORKS
// -------------------------------------------------------------------------
// The heuristic is documented in full in lib/timeSlotParser.js. In short:
// time_slot_raw is hand-typed and wildly inconsistent, so am/pm is resolved by
// scoring candidate readings against duration_hours rather than guessing.
//
// The importer now parses each slot at insert time, so this script exists for
// the rows it did not: data imported before that existed, and re-runs after
// the heuristic improves.
// -------------------------------------------------------------------------

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_UNPARSED = process.argv.includes('--only-unparsed');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------
//
// Shared with lib/bookingImporter.js, which parses each slot as it inserts
// the row. Kept in one module on purpose: two copies of a heuristic this
// fiddly drift apart, and then the same slot text means different things
// depending on which code path happened to touch the row.
const { parseTimeSlot, hhmm } = require('./lib/timeSlotParser');

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function run() {
    const client = await pool.connect();
    const stats = { exact: 0, stated: 0, relaxed: 0, inferred: 0, failed: 0 };
    const failures = [];
    const hourHistogram = new Array(24).fill(0);

    try {
        const where = ONLY_UNPARSED ? 'WHERE time_parse_status IS NULL' : '';
        const res = await client.query(
            `SELECT id, time_slot_raw, duration_hours FROM bookings ${where} ORDER BY id`
        );
        console.log(`Rows to process: ${res.rows.length}${DRY_RUN ? '  [DRY RUN — no writes]' : ''}`);

        if (!DRY_RUN) await client.query('BEGIN');

        // Writes go out in batches, not one statement per row. A row-at-a-time
        // loop is 9,000+ sequential round-trips to the database — about 45
        // minutes of pure network latency against a remote host, for a few
        // seconds of actual work, all inside one transaction that has to be
        // held open the whole time. Batched, the same backfill is ~20
        // statements and finishes in seconds.
        const BATCH = 500;
        let queued = [];
        let n = 0;

        async function flush() {
            if (DRY_RUN || queued.length === 0) return;

            // One UPDATE ... FROM (VALUES ...) joined back on id. The casts on
            // the first tuple are required: without them Postgres cannot infer
            // a type for the VALUES columns.
            const params = [];
            const tuples = queued.map((row, i) => {
                const b = i * 6;
                params.push(...row);
                return i === 0
                    ? `($${b + 1}::time, $${b + 2}::time, $${b + 3}::smallint, $${b + 4}::boolean, $${b + 5}::text, $${b + 6}::bigint)`
                    : `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
            });

            await client.query(
                `UPDATE bookings b
                    SET start_time = v.start_time,
                        end_time = v.end_time,
                        slot_start_hour = v.slot_start_hour,
                        crosses_midnight = v.crosses_midnight,
                        time_parse_status = v.time_parse_status
                   FROM (VALUES ${tuples.join(', ')})
                     AS v(start_time, end_time, slot_start_hour, crosses_midnight, time_parse_status, id)
                  WHERE b.id = v.id`,
                params
            );
            queued = [];
        }

        for (const row of res.rows) {
            const r = parseTimeSlot(row.time_slot_raw, row.duration_hours);
            // Guarded: an unknown status would otherwise make the counter NaN
            // and quietly drop those rows out of the report.
            stats[r.status] = (stats[r.status] || 0) + 1;

            if (r.status === 'failed') {
                if (failures.length < 40) {
                    failures.push(`  id=${row.id}  ${JSON.stringify(row.time_slot_raw)}  dur=${row.duration_hours}  (${r.reason})`);
                }
                queued.push([null, null, null, false, 'failed', row.id]);
            } else {
                hourHistogram[r.sh]++;
                queued.push([hhmm(r.sh, r.sm), hhmm(r.eh, r.em), r.sh, r.crosses, r.status, row.id]);
            }

            if (queued.length >= BATCH) await flush();
            if (++n % 500 === 0) console.log(`  ...${n} processed`);
        }
        await flush();

        if (!DRY_RUN) await client.query('COMMIT');

        const total = res.rows.length || 1;
        const pct = (x) => `${((x / total) * 100).toFixed(1)}%`;
        console.log('\n' + '='.repeat(64));
        console.log(`  exact    (span matched duration_hours)      : ${String(stats.exact).padStart(5)}  ${pct(stats.exact)}`);
        console.log(`  stated   (am/pm given on both ends, trusted): ${String(stats.stated).padStart(5)}  ${pct(stats.stated)}`);
        console.log(`  relaxed  (matched after overriding am/pm)   : ${String(stats.relaxed).padStart(5)}  ${pct(stats.relaxed)}`);
        console.log(`  inferred (no duration match — best guess)   : ${String(stats.inferred).padStart(5)}  ${pct(stats.inferred)}`);
        console.log(`  failed                                      : ${String(stats.failed).padStart(5)}  ${pct(stats.failed)}`);
        console.log('='.repeat(64));

        console.log('\nBookings by start hour:');
        const peak = Math.max(...hourHistogram);
        hourHistogram.forEach((c, h) => {
            if (!c) return;
            const bar = '#'.repeat(Math.max(1, Math.round((c / peak) * 50)));
            console.log(`  ${String(h).padStart(2, '0')}:00  ${String(c).padStart(5)}  ${bar}`);
        });

        if (failures.length) {
            console.log('\nUnparsed rows (first 40) — these need a look:');
            failures.forEach((f) => console.log(f));
        }
    } catch (err) {
        if (!DRY_RUN) await client.query('ROLLBACK');
        console.error('❌ Failed, rolled back:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

run();