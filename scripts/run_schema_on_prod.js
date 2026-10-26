// run_schema_on_prod.js
//
// Applies supabase_deploy_all.sql to the production database, so the schema
// can go in from here instead of pasting 540 lines into the Supabase SQL
// Editor by hand.
//
// The file already wraps itself in BEGIN/COMMIT, and Postgres DDL is
// transactional, so a failure anywhere rolls the whole thing back and leaves
// an empty database rather than a half-built one.
//
// Usage:
//   node scripts/run_schema_on_prod.js --dry-run   # report target state only
//   node scripts/run_schema_on_prod.js             # apply it

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const SCHEMA_FILE = path.join(__dirname, '..', 'supabase_deploy_all.sql');

async function main() {
  const url = process.env.PROD_DATABASE_URL;
  if (!url) {
    console.error('Missing PROD_DATABASE_URL. Add it to .env (which is gitignored).');
    process.exit(1);
  }
  if (url === process.env.DATABASE_URL) {
    console.error('PROD_DATABASE_URL matches DATABASE_URL (the dev database). Refusing to run.');
    process.exit(1);
  }
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`Schema file not found: ${SCHEMA_FILE}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const client = new Client({ connectionString: url });
  await client.connect();

  // Refuse to re-run over an existing schema — the file uses bare CREATE
  // TABLE for the base tables, so a second run would error partway through
  // rather than no-op.
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log(`Target currently has ${rows.length} table(s) in public.`);
  if (rows.length > 0) {
    console.log('  ' + rows.map((r) => r.table_name).join(', '));
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would execute ${sql.split('\n').length} lines from supabase_deploy_all.sql.`);
    await client.end();
    return;
  }

  if (rows.length > 0) {
    console.error('\nTarget is not empty. Refusing to apply the schema over existing tables.');
    await client.end();
    process.exit(1);
  }

  console.log('\nApplying schema...');
  try {
    // One query() call: the file supplies its own BEGIN/COMMIT.
    await client.query(sql);
    const after = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`
    );
    console.log(`✅ Schema applied. ${after.rows.length} tables created:`);
    console.log('   ' + after.rows.map((r) => r.table_name).join(', '));
    console.log('\nNext: node scripts/copy_data_to_prod.js --dry-run');
  } catch (err) {
    console.error('❌ Schema failed and was rolled back. Nothing was written.');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
