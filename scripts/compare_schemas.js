// compare_schemas.js
//
// Compares the development and production database schemas in full — not just
// columns, but everything that changes behaviour.
//
// This exists because schema drift bit three times in one afternoon, each time
// only surfacing when something already depended on it:
//   v11  five bookings columns existed only in dev -> data copy failed
//   v12  two UNIQUE indexes existed only in dev    -> investor import failed
//        on ON CONFLICT, which needs a matching unique index
//   v13  batch identity was name-based             -> next month silently skipped
//
// The first two were invisible until they broke something. Run this after any
// schema change, and before any deployment.
//
// Usage:
//   node scripts/compare_schemas.js            # summary
//   node scripts/compare_schemas.js --verbose  # list every difference
//
// Exits non-zero when the two databases differ, so CI can gate on it.

require('dotenv').config();
const { Client } = require('pg');

const VERBOSE = process.argv.includes('--verbose');

// Each check pulls a normalised, sorted list of "facts" about a database.
// Comparing sets of strings keeps the diff logic trivial and makes any
// difference readable as-is.
const CHECKS = [
  {
    name: 'tables',
    sql: `SELECT table_name AS fact FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  },
  {
    name: 'columns',
    // Includes type, nullability and default: a column that exists in both but
    // is NOT NULL in one and nullable in the other is a real difference that
    // will reject inserts on one side only.
    sql: `SELECT table_name || '.' || column_name || ' :: ' || data_type
                 || CASE WHEN character_maximum_length IS NOT NULL
                         THEN '(' || character_maximum_length || ')' ELSE '' END
                 || CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
                 || COALESCE(' DEFAULT ' || column_default, '') AS fact
            FROM information_schema.columns WHERE table_schema = 'public'`,
  },
  {
    name: 'indexes',
    // Index NAMES are stripped: the same index created by hand on one side and
    // by a migration on the other gets different names but identical
    // behaviour, and flagging that as drift is noise.
    sql: `SELECT regexp_replace(indexdef, 'INDEX [^ ]+ ON', 'INDEX ON') AS fact
            FROM pg_indexes WHERE schemaname = 'public'`,
  },
  {
    name: 'constraints',
    // Constraint names are kept here because a FK's name is how you drop or
    // alter it, and mismatched names mean migrations diverge later.
    sql: `SELECT c.conname || ' ON ' || c.conrelid::regclass || ': ' || pg_get_constraintdef(c.oid) AS fact
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
           WHERE n.nspname = 'public'`,
  },
  {
    name: 'sequences',
    sql: `SELECT sequence_name AS fact FROM information_schema.sequences
           WHERE sequence_schema = 'public'`,
  },
  {
    name: 'triggers',
    sql: `SELECT trigger_name || ' ON ' || event_object_table || ' ' || action_timing
                 || ' ' || event_manipulation AS fact
            FROM information_schema.triggers WHERE trigger_schema = 'public'`,
  },
  {
    name: 'functions',
    sql: `SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS fact
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'`,
  },
  {
    name: 'views',
    sql: `SELECT table_name AS fact FROM information_schema.views
           WHERE table_schema = 'public'`,
  },
  {
    name: 'enum types',
    sql: `SELECT t.typname || ' = ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS fact
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public'
           GROUP BY t.typname`,
  },
];

// Returns a MULTISET (fact -> count), not a Set.
//
// A Set collapses duplicates, which hid a real problem: development carried
// two identical unique indexes on disbursements and two on monthly_profit,
// and the index check reported "no differences" because both databases had
// the same DISTINCT index definitions. Counting occurrences catches that.
async function collect(client, sql) {
  const { rows } = await client.query(sql);
  const counts = new Map();
  for (const r of rows) {
    const fact = String(r.fact).replace(/\s+/g, ' ').trim();
    counts.set(fact, (counts.get(fact) || 0) + 1);
  }
  return counts;
}

// Facts present more times in `a` than in `b`, expanded so a duplicate shows
// up as its own line rather than being silently absorbed.
function excess(a, b) {
  const out = [];
  for (const [fact, n] of a) {
    const extra = n - (b.get(fact) || 0);
    for (let i = 0; i < extra; i++) out.push(n > 1 ? `${fact}   [x${n} here]` : fact);
  }
  return out.sort();
}

(async () => {
  const devUrl = process.env.DATABASE_URL;
  const prodUrl = process.env.PROD_DATABASE_URL;
  if (!devUrl || !prodUrl) {
    console.error('Both DATABASE_URL and PROD_DATABASE_URL must be set in .env');
    process.exit(1);
  }

  const dev = new Client({ connectionString: devUrl });
  const prod = new Client({ connectionString: prodUrl });
  await dev.connect();
  await prod.connect();

  console.log('Comparing dev and production schemas\n');
  console.log('check            dev   prod   only-dev   only-prod');
  console.log('---------------------------------------------------');

  let differences = 0;
  const details = [];

  for (const check of CHECKS) {
    const d = await collect(dev, check.sql);
    const p = await collect(prod, check.sql);
    const onlyDev = excess(d, p);
    const onlyProd = excess(p, d);
    differences += onlyDev.length + onlyProd.length;

    const flag = onlyDev.length + onlyProd.length === 0 ? '' : '  <-- differs';
    console.log(
      check.name.padEnd(16) +
        String([...d.values()].reduce((a, b) => a + b, 0)).padStart(4) +
        String([...p.values()].reduce((a, b) => a + b, 0)).padStart(7) +
        String(onlyDev.length).padStart(11) +
        String(onlyProd.length).padStart(12) +
        flag
    );
    if (onlyDev.length || onlyProd.length) details.push({ check: check.name, onlyDev, onlyProd });
  }

  console.log('---------------------------------------------------');

  if (details.length && (VERBOSE || differences <= 20)) {
    console.log('');
    for (const d of details) {
      console.log(`### ${d.check}`);
      d.onlyDev.forEach((x) => console.log(`  DEV ONLY : ${x}`));
      d.onlyProd.forEach((x) => console.log(`  PROD ONLY: ${x}`));
      console.log('');
    }
  } else if (details.length) {
    console.log(`\n${differences} differences. Re-run with --verbose to list them.`);
  }

  await dev.end();
  await prod.end();

  if (differences === 0) {
    console.log('\nSchemas are identical.');
  } else {
    console.log(`\n${differences} difference(s) found.`);
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
