// import_bookings.js  (CLI wrapper)
// Thin command-line front end over lib/bookingImporter.js.
//
// Usage:
//   node import_bookings.js <file-or-directory> [--dry-run] [--force]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { importBookings } = require('./lib/bookingImporter');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const TARGET = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

if (!TARGET) {
  console.error('Usage: node import_bookings.js <file-or-directory> [--dry-run] [--force]');
  process.exit(1);
}

function findXlsxFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const results = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.xlsx$/i.test(entry.name) && !entry.name.startsWith('~$')) results.push(full);
    }
  })(target);
  results.sort();
  return results;
}

async function main() {
  const paths = findXlsxFiles(TARGET);
  if (paths.length === 0) {
    console.error(`No .xlsx files found under: ${TARGET}`);
    process.exit(1);
  }
  console.log(`Found ${paths.length} file(s) to process.${DRY_RUN ? ' [DRY RUN — no DB writes]' : ''}`);

  const sources = paths.map((p) => ({ path: p, fileName: path.relative(process.cwd(), p) }));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const result = await importBookings({
      client,
      sources,
      options: { dryRun: DRY_RUN, force: FORCE },
    });

    result.log.forEach((line) => console.log('  ' + line));

    console.log('\n' + '='.repeat(60));
    console.log(`Files processed: ${result.filesProcessed} (${result.filesSkipped} already-imported, skipped)`);
    console.log(`Total booking rows ${DRY_RUN ? 'that would be inserted' : 'inserted'}: ${result.totalInserted}`);
    console.log(`Warnings: ${result.warningCount}`);
    if (result.warnings.length) {
      console.log('-'.repeat(60));
      result.warnings.forEach((w) => console.log('  ⚠ ' + w));
    }
    console.log('='.repeat(60));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
