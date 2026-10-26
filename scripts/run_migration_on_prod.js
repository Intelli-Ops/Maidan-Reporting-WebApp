// run_migration_on_prod.js
//
// Applies ONE sql/schema_update_*.sql file to a database, inside a
// transaction. Companion to run_schema_on_prod.js, which builds an empty
// database from supabase_deploy_all.sql and deliberately refuses to run
// against a populated one — that leaves incremental migrations with no tool
// at all, so they have been going in by hand through the Supabase SQL editor.
//
// Postgres DDL is transactional: if any statement in the file fails, the whole
// file rolls back and the database is left exactly as it was.
//
// Usage:
//   node scripts/run_migration_on_prod.js sql/schema_update_v16_system_admin.sql --dry-run
//   node scripts/run_migration_on_prod.js sql/schema_update_v16_system_admin.sql          # dev
//   node scripts/run_migration_on_prod.js sql/schema_update_v16_system_admin.sql --prod   # production
//
// Every migration in sql/ is written to be re-runnable (IF NOT EXISTS / IF
// EXISTS guards throughout), so applying one twice is a no-op rather than an
// error. There is no migrations table here; which files have been applied is
// tracked by the deployment guide, not by the database.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PROD = args.includes('--prod');
const fileArg = args.find((a) => !a.startsWith('--'));

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  if (!fileArg) {
    fail('Usage: node scripts/run_migration_on_prod.js <sql-file> [--prod] [--dry-run]');
  }

  const file = path.resolve(fileArg);
  if (!fs.existsSync(file)) {
    fail(`SQL file not found: ${file}`);
  }
  const sql = fs.readFileSync(file, 'utf8');

  const connectionString = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
  if (!connectionString) {
    fail(PROD ? 'Missing PROD_DATABASE_URL.' : 'Missing DATABASE_URL.');
  }
  if (PROD && connectionString === process.env.DATABASE_URL) {
    fail('PROD_DATABASE_URL matches DATABASE_URL. Refusing to run.');
  }

  console.log(`File  : ${path.relative(process.cwd(), file)}`);
  console.log(`Target: ${PROD ? 'PRODUCTION' : 'development'} database`);

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would execute ${sql.split('\n').length} lines. Nothing was written.`);
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('\nApplied and committed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nFailed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
