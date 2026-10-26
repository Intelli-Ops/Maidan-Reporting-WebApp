// import_expenses.js  (CLI wrapper)
// Thin command-line front end over lib/expenseImporter.js. All the actual
// parsing/validation lives in the library so the exact same code runs whether
// you import from the terminal or from the web upload endpoint.
//
// Usage:
//   node import_expenses.js <file-or-directory> [--dry-run] [--force] [--undated=month-start|carry|skip]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { importExpenses } = require('./lib/expenseImporter');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const TARGET = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
const UNDATED_ARG = process.argv.find((a) => a.startsWith('--undated='));
// Default 'carry': a blank Date in these sheets means "same day as the row
// above", which is how they are actually filled in. Passing an explicit
// default here previously overrode the library's own, so changing it there
// alone had no effect on CLI runs.
const UNDATED_POLICY = UNDATED_ARG ? UNDATED_ARG.split('=')[1] : 'carry';

if (!TARGET) {
  console.error('Usage: node import_expenses.js <file-or-directory> [--dry-run] [--force] [--undated=month-start|carry|skip]');
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
    const result = await importExpenses({
      client,
      sources,
      options: { dryRun: DRY_RUN, force: FORCE, undatedPolicy: UNDATED_POLICY },
    });

    result.log.forEach((line) => console.log('  ' + line));

    console.log('\n' + '='.repeat(60));
    console.log(`Files processed: ${result.filesProcessed} (${result.filesSkipped} already-imported, skipped)`);
    if (result.filesRejected > 0) {
      console.log(`Files REJECTED (nothing imported from them): ${result.filesRejected} — see warnings below.`);
    }
    console.log(`Total expense rows ${DRY_RUN ? 'that would be inserted' : 'inserted'}: ${result.totalInserted}`);
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
