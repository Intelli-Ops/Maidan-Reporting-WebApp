// build_reference_seed.js
//
// Writes sql/seed_reference.sql — the lookup data a fresh database needs
// before the app does anything useful.
//
// -------------------------------------------------------------------------
// WHAT GOES IN, AND WHAT DELIBERATELY DOES NOT
// -------------------------------------------------------------------------
// In:  facilities, sport_types, payment_methods, expense_categories and
//      bank_bin_reference — configuration, not business records. Without
//      them every dropdown is empty and no import can resolve a facility or
//      a category, so a handover without them is a handover of a dead app.
//
// Out: bookings, expenses, investors, disbursements, monthly_profit, users,
//      audit_log, ai_* and raw_import_batches. Those are real business
//      records — 10,000+ of them carry customer names, and users carries
//      password hashes. Git history is effectively permanent and a repo gets
//      cloned and forwarded, so none of it belongs in a file like this. A
//      real copy of the data is a database-to-database transfer.
//
// Usage:
//   DATABASE_URL=...  node scripts/build_reference_seed.js
//   node scripts/build_reference_seed.js --prod   # read from PROD_DATABASE_URL

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUT_FILE = path.join(__dirname, '..', 'sql', 'seed_reference.sql');
const USE_PROD = process.argv.includes('--prod');

// `order` keeps a self-referencing table's parents ahead of its children;
// `conflict` makes a re-run a no-op rather than a duplicate-key failure.
const TABLES = [
  { name: 'facilities', order: 'id', conflict: '(id)', skip: ['created_at'], seq: 'facilities_id_seq' },
  { name: 'sport_types', order: 'id', conflict: '(id)', skip: [], seq: 'sport_types_id_seq' },
  { name: 'payment_methods', order: 'id', conflict: '(id)', skip: [], seq: 'payment_methods_id_seq' },
  {
    name: 'expense_categories',
    // Parents (NULL parent) first, so the self-FK always resolves.
    order: 'parent_category_id NULLS FIRST, id',
    conflict: '(id)',
    skip: [],
    seq: 'expense_categories_id_seq',
  },
  { name: 'bank_bin_reference', order: 'bin_number', conflict: '(bin_number)', skip: ['updated_at'], seq: null },
];

function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const url = USE_PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) {
    console.error(`Missing ${USE_PROD ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} in .env.`);
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const out = [];
  out.push(`-- Maidan — reference (lookup) data, generated ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`);
  out.push('-- by scripts/build_reference_seed.js. Do not edit by hand.');
  out.push('--');
  out.push('-- Run AFTER supabase_deploy_all.sql, on a database that has the schema');
  out.push('-- but no rows. Safe to re-run: every statement is ON CONFLICT DO NOTHING.');
  out.push('--');
  out.push('-- This is configuration only — no bookings, expenses, investor figures');
  out.push('-- or user accounts. Create the first login with scripts/seed_admin.js.');
  out.push('');
  out.push('BEGIN;');

  const counts = [];
  for (const t of TABLES) {
    const { rows } = await client.query(`SELECT * FROM ${t.name} ORDER BY ${t.order}`);
    const cols = rows.length ? Object.keys(rows[0]).filter((c) => !t.skip.includes(c)) : [];
    out.push('');
    out.push(`-- ${t.name} (${rows.length} rows)`);
    for (const row of rows) {
      const vals = cols.map((c) => literal(row[c])).join(', ');
      out.push(`INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${vals}) ON CONFLICT ${t.conflict} DO NOTHING;`);
    }
    // Rows were inserted with explicit ids, which does NOT advance the
    // sequence — without this the next app-created row collides on the
    // primary key. Guarded by a row count so an empty table is left alone.
    if (t.seq && rows.length) {
      out.push(`SELECT setval('${t.seq}', (SELECT MAX(id) FROM ${t.name}));`);
    }
    counts.push(`${t.name}=${rows.length}`);
  }

  out.push('');
  out.push('COMMIT;');
  out.push('');

  await client.end();
  fs.writeFileSync(OUT_FILE, out.join('\n'));
  console.log(`Wrote sql/seed_reference.sql from ${USE_PROD ? 'production' : 'development'}:`);
  console.log('  ' + counts.join('  '));
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
