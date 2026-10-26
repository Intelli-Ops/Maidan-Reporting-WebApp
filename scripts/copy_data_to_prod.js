// copy_data_to_prod.js
//
// Copies real business data from one Postgres database to another —
// specifically, from the development Supabase project to a freshly
// created production one whose schema already exists.
//
// Usage (PowerShell):
//   $env:DEV_DATABASE_URL="postgresql://...dev-pooler..."
//   $env:PROD_DATABASE_URL="postgresql://...prod-pooler..."
//   node scripts/copy_data_to_prod.js --dry-run     # report only, writes nothing
//   node scripts/copy_data_to_prod.js               # actually copy
//
// Inserts use ON CONFLICT DO NOTHING, so the copy is idempotent — running it
// twice inserts nothing the second time rather than duplicating rows.
//
// Written against `pg`, which is already a dependency, so this needs no
// pg_dump/psql install. For the data volumes here (tens of thousands of
// rows) a row-by-row copy is fine; past a few million rows you'd want
// pg_dump --data-only instead.

require('dotenv').config();
const { Client } = require('pg');

// DEV_DATABASE_URL is optional: the existing DATABASE_URL in .env already
// points at the development database, so it is the sensible fallback and
// saves duplicating the same string under two names.
if (!process.env.DEV_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.DEV_DATABASE_URL = process.env.DATABASE_URL;
}

const DRY_RUN = process.argv.includes('--dry-run');

// Order matters: every table's foreign-key parents must already be
// populated when it loads. Derived from the REFERENCES clauses in
// sql/maidan_schema.sql:
//
//   facility_investors -> facilities, investors
//   monthly_profit     -> facilities
//   bookings           -> facilities, sport_types, payment_methods, bank_bin_reference
//   expenses           -> facilities, expense_categories, payment_methods
//   disbursements      -> facility_investors, monthly_profit
const TABLES = [
  // Level 0 — no outbound foreign keys.
  'facilities',
  'sport_types',
  'payment_methods',
  'expense_categories',
  'bank_bin_reference',
  'investors',
  // No FK constraint points here, but bookings.import_batch_id and
  // expenses.import_batch_id do reference these ids. The importers use the
  // table as their idempotency record: lib/bookingImporter.js looks up a
  // batch by (source_type, source_name) and SKIPs a file it has already
  // seen. Drop this table and re-importing the same spreadsheet no longer
  // matches, so it inserts a second full copy of every row — and --force
  // cannot undo it, because its cleanup deletes bookings by import_batch_id
  // and there is no batch row left to name.
  'raw_import_batches',
  // Level 1 — depend only on level 0.
  'facility_investors',
  'monthly_profit',
  // Level 2 — depend on level 1.
  'bookings',
  'expenses',
  'disbursements',
];

// Deliberately NOT copied:
//   users             — dev accounts and their bcrypt hashes, including any
//                       seeded with the DEFAULT_ADMIN_PASSWORD that was
//                       public on the old repo. Run seed_admin.js instead.
//   ai_conversations  — development chatbot experiments.
//   ai_messages       —   "
//   audit_log         — a log of development clicking; also the fastest-
//                       growing table against the 500MB free-tier cap. It
//                       has an FK to users, so it has to sit out whenever
//                       users does.
const SKIPPED = ['users', 'ai_conversations', 'ai_messages', 'audit_log'];

// Postgres caps a single statement at 65535 bound parameters. Batch size is
// derived per-table from the column count so wide tables don't overflow it.
const MAX_PARAMS = 60000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function tableExists(client, table) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS present`,
    [`public.${table}`]
  );
  return rows[0].present;
}

async function countRows(client, table) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

async function copyTable(dev, prod, table) {
  // Order by primary key so self-referencing rows (expense_categories has a
  // parent_id added in schema_update_v2.sql) land parent-before-child.
  const { rows: pkRows } = await dev.query(
    `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
      ORDER BY a.attnum`,
    [table]
  );
  const orderBy = pkRows.length ? `ORDER BY ${pkRows.map((r) => `"${r.attname}"`).join(', ')}` : '';

  const result = await dev.query(`SELECT * FROM ${table} ${orderBy}`);
  if (result.rows.length === 0) return { copied: 0, columns: 0 };

  const columns = result.fields.map((f) => f.name);
  const quoted = columns.map((c) => `"${c}"`).join(', ');
  const batchSize = Math.max(1, Math.floor(MAX_PARAMS / columns.length));

  let copied = 0;
  for (let start = 0; start < result.rows.length; start += batchSize) {
    const batch = result.rows.slice(start, start + batchSize);
    const values = [];
    const placeholders = batch.map((row, rowIndex) => {
      const slots = columns.map((col, colIndex) => {
        values.push(row[col]);
        return `$${rowIndex * columns.length + colIndex + 1}`;
      });
      return `(${slots.join(', ')})`;
    });

    // ON CONFLICT DO NOTHING makes the copy idempotent and lets it run
    // against tables that are already partly populated. That is the normal
    // case here, not an edge case: sql/maidan_schema.sql seeds facilities,
    // sport_types and payment_methods, so those three arrive with rows
    // already in them. Their seeded ids match dev exactly; dev simply has
    // extras added later (sport_types 5-6, payment_methods 9-10), and those
    // are what get inserted. It also means a re-run after a partial failure
    // is safe rather than duplicating everything.
    const res = await prod.query(
      `INSERT INTO ${table} (${quoted}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values
    );
    copied += res.rowCount;
  }

  return { copied, seen: result.rows.length, columns: columns.length };
}

// A data-only copy carries each row's existing id but leaves the sequence
// counter untouched, so the next INSERT reuses id 1 and trips the primary
// key. This walks every sequence and fast-forwards it past the data.
const RESET_SEQUENCES = `
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS seq, t.relname AS tbl, a.attname AS col
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_depend d ON d.objid = c.oid AND d.classid = 'pg_class'::regclass
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
     WHERE c.relkind = 'S'
       -- public only. Supabase ships its own sequences in auth/storage/realtime
       -- (auth.refresh_tokens_id_seq and friends); touching those is both
       -- wrong and, since they are not on the search_path, an instant
       -- 'relation does not exist' that rolls back the whole copy.
       AND n.nspname = 'public'
  LOOP
    -- Schema-qualify both the sequence and the table so this never depends
    -- on whatever search_path the connection happens to have.
    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1))',
      r.sch || '.' || r.seq, r.col, r.sch, r.tbl
    );
  END LOOP;
END $$;
`;

async function main() {
  const devUrl = requireEnv('DEV_DATABASE_URL');
  const prodUrl = requireEnv('PROD_DATABASE_URL');

  if (devUrl === prodUrl) {
    console.error('DEV_DATABASE_URL and PROD_DATABASE_URL are identical. Refusing to run.');
    process.exit(1);
  }

  const dev = new Client({ connectionString: devUrl });
  const prod = new Client({ connectionString: prodUrl });
  await dev.connect();
  await prod.connect();

  console.log(DRY_RUN ? '\nDRY RUN — nothing will be written.\n' : '\nCopying data.\n');
  console.log('table                  source rows   target rows');
  console.log('--------------------------------------------------');

  const plan = [];
  let blocked = false;

  for (const table of TABLES) {
    if (!(await tableExists(dev, table))) {
      console.log(`${table.padEnd(22)} MISSING in source — skipping`);
      continue;
    }
    if (!(await tableExists(prod, table))) {
      console.error(`${table.padEnd(22)} MISSING in target — did the schema run?`);
      blocked = true;
      continue;
    }
    const sourceCount = await countRows(dev, table);
    const targetCount = await countRows(prod, table);
    console.log(`${table.padEnd(22)} ${String(sourceCount).padStart(11)}   ${String(targetCount).padStart(11)}`);

    plan.push({ table, sourceCount, targetCount });
  }

  console.log('--------------------------------------------------');
  console.log(`Skipped by design: ${SKIPPED.join(', ')}\n`);

  if (blocked && !DRY_RUN) {
    console.error('A table is missing in the target. Run scripts/run_schema_on_prod.js first.');
    await dev.end();
    await prod.end();
    process.exit(1);
  }

  if (DRY_RUN) {
    const total = plan.reduce((sum, p) => sum + p.sourceCount, 0);
    console.log(`Would copy ${total} rows across ${plan.length} tables.`);
    await dev.end();
    await prod.end();
    return;
  }

  // One transaction for the whole copy: a foreign-key violation partway
  // through rolls everything back rather than leaving a half-populated
  // database that is harder to clean up than to redo.
  await prod.query('BEGIN');
  try {
    let total = 0;
    for (const { table } of plan) {
      const { copied } = await copyTable(dev, prod, table);
      total += copied;
      console.log(`  ${table.padEnd(22)} ${String(copied).padStart(7)} rows`);
    }
    console.log('\nResetting sequences...');
    await prod.query(RESET_SEQUENCES);
    await prod.query('COMMIT');
    console.log(`\nDone. Copied ${total} rows.`);
    console.log('Next: run scripts/seed_admin.js against production to create the admin user.');
  } catch (err) {
    await prod.query('ROLLBACK');
    console.error('\nCopy failed and was rolled back. Nothing was written.');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await dev.end();
    await prod.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
