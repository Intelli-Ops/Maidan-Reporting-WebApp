// import_investors.js  (CLI wrapper)
// Thin command-line front end over lib/investorImporter.js.
//
// Usage:
//   node import_investors.js [path-to-workbook] [--dry-run] [--upsert]
//
//   default mode is REPLACE (wipe + rebuild). Pass --upsert for the old
//   non-destructive ON CONFLICT behaviour. Path defaults to
//   ../data/Maidan Investor Disbursements.xlsx (override with XLSX_PATH).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { importInvestors } = require('./lib/investorImporter');

const DRY_RUN = process.argv.includes('--dry-run');
const MODE = process.argv.includes('--upsert') ? 'upsert' : 'replace';
const ARG_PATH = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
const XLSX_PATH = ARG_PATH || process.env.XLSX_PATH
  || path.join(__dirname, '..', 'data', 'Maidan Investor Disbursements.xlsx');

async function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`❌ Workbook not found at: ${XLSX_PATH}`);
    console.error('   Pass a path, set XLSX_PATH, or place the file at the default location.');
    process.exit(1);
  }
  console.log(`Reading workbook: ${XLSX_PATH}`);
  console.log(`Mode: ${MODE}${DRY_RUN ? '  [DRY RUN — no DB writes]' : ''}`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const result = await importInvestors({
      client,
      source: { path: XLSX_PATH, fileName: path.basename(XLSX_PATH) },
      options: { mode: MODE, dryRun: DRY_RUN },
    });

    result.log.forEach((line) => console.log('  ' + line));

    console.log('\n' + '='.repeat(60));
    if (result.refused) {
      console.error('❌ REFUSED — workbook failed validation, no data was touched:');
      result.problems.forEach((p) => console.error('   • ' + p));
    } else if (!result.ok) {
      console.error('❌ ' + result.reason);
    } else {
      console.log(`✅ ${DRY_RUN ? 'Would import' : 'Imported'} (${result.mode}):`);
      console.log(`   facilities: ${result.facilitiesProcessed}`);
      console.log(`   monthly_profit rows: ${result.monthsInserted}`);
      console.log(`   disbursements: ${result.disbursementsInserted}`);
    }
    if (result.warnings && result.warnings.length) {
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
