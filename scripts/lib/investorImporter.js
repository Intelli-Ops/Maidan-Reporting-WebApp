// lib/investorImporter.js
// Core investor-import logic, callable from the CLI (import_investors.js) and
// an HTTP upload endpoint. Loads investors, facility_investors, monthly_profit,
// and disbursements from the investor workbook.
//
// DETECTION IS ANCHOR-BASED, NOT POSITION-BASED.
// The old version hardcoded every row and column, so any shift broke it. Real
// tabs already differ: KMC's table starts in column A, Emaar's in column D,
// Malir's in column C. So instead of fixed indices we locate landmarks by text:
//   * header row/column  -> the cell containing "Month" (Year/Amount follow it)
//   * investors          -> every header cell after Amount that isn't a
//                           "Disbursement Status" column IS an investor; its
//                           name is read from the header, so adding an investor
//                           column just works. A trailing " Share" (Emaar/Malir
//                           write "Ahsan Share") is stripped.
//   * investment row     -> the row whose first labelled cell says "Investment Amount"
//   * percentage row     -> ... says "Investor Percentage"
//   * data rows          -> every row whose Month cell is a real month name
//                           (incl. combined "June/July"); the first non-month
//                           row (Total Profit / Disbursed / ...) ends the data.
//
// Modes:
//   'replace' (DEFAULT for uploads) — wipe the four investor tables and rebuild,
//              all in ONE transaction, but only AFTER validateWorkbook passes,
//              so a wrong/empty/moved-layout file can never wipe good data.
//   'upsert'  — non-destructive ON CONFLICT behaviour, for manual runs.
//
// Feed a workbook via { path } (CLI) or { buffer, fileName } (upload).

const path = require('path');
const XLSX = require('xlsx');

const FACILITY_SHEETS = [
  { facilityCode: 'KMC', sheetName: 'KMC' },
  { facilityCode: 'EMAAR', sheetName: 'Emaar' },
  { facilityCode: 'MALIR', sheetName: 'Malir' },
];

const MONTH_NUMBERS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const norm = (v) => String(v ?? '').trim().toLowerCase();

function monthPartsOf(label) {
  return String(label).split('/').map((s) => s.trim()).filter(Boolean);
}
function isMonthLabel(v) {
  if (v === null || v === undefined) return false;
  return monthPartsOf(v).some((p) => MONTH_NUMBERS[p.toLowerCase()] !== undefined);
}

function parseMonthLabel(rawLabel) {
  const parts = monthPartsOf(rawLabel);
  return { monthName: parts[parts.length - 1], isCombined: parts.length > 1, rawLabel: String(rawLabel) };
}

function applyKnownFixes(facilityCode, monthName, year) {
  if (facilityCode === 'KMC' && monthName.toLowerCase() === 'january' && Number(year) === 2024) return 2025;
  return year;
}

function toPeriodDate(monthName, year) {
  const monthNum = MONTH_NUMBERS[monthName.toLowerCase()];
  if (!monthNum) throw new Error(`Unrecognized month name: ${monthName}`);
  return `${year}-${String(monthNum).padStart(2, '0')}-01`;
}

function stripShare(name) {
  return String(name).replace(/\s*share\s*$/i, '').trim();
}

function readWorkbook(source) {
  return source.buffer ? XLSX.read(source.buffer, { type: 'buffer' }) : XLSX.readFile(source.path);
}

function detectLayout(rows) {
  let headerRow = -1;
  let monthCol = -1;
  for (let r = 0; r < Math.min(12, rows.length); r++) {
    const row = rows[r] || [];
    const idx = row.findIndex((c) => norm(c) === 'month');
    if (idx !== -1) { headerRow = r; monthCol = idx; break; }
  }
  if (headerRow === -1) return null;

  const header = rows[headerRow];
  const yearCol = monthCol + 1;
  const amountCol = monthCol + 2;
  if (norm(header[yearCol]) !== 'year' || norm(header[amountCol]) !== 'amount') return null;

  const investors = [];
  for (let c = amountCol + 1; c < header.length; c++) {
    const label = header[c];
    if (label === null || label === undefined || String(label).trim() === '') continue;
    if (norm(label).includes('disbursement status') || norm(label) === 'status') continue;
    investors.push({ name: stripShare(label), amountCol: c, statusCol: c + 1 });
  }
  if (investors.length === 0) return null;

  let investmentRow = -1;
  let percentageRow = -1;
  for (let r = headerRow + 1; r < Math.min(headerRow + 6, rows.length); r++) {
    const row = rows[r] || [];
    const firstText = row.map(norm).find((x) => x);
    if (firstText === 'investment amount') investmentRow = r;
    else if (firstText === 'investor percentage') percentageRow = r;
  }

  const dataStart = (percentageRow !== -1 ? percentageRow : headerRow + 2) + 1;
  let dataEnd = dataStart;
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r] || [];
    if (isMonthLabel(row[monthCol])) dataEnd = r + 1;
    else if (row[monthCol] !== null && row[monthCol] !== undefined) break;
  }

  return { headerRow, monthCol, yearCol, amountCol, investors, investmentRow, percentageRow, dataStart, dataEnd };
}

function validateWorkbook(workbook) {
  const problems = [];
  let totalMonthRows = 0;

  for (const { facilityCode, sheetName } of FACILITY_SHEETS) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { problems.push(`Missing sheet "${sheetName}" for facility ${facilityCode}.`); continue; }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const layout = detectLayout(rows);
    if (!layout) {
      problems.push(`Sheet "${sheetName}": could not locate Month/Year/Amount + investor columns — layout unrecognised.`);
      continue;
    }
    let monthRows = 0;
    for (let r = layout.dataStart; r < layout.dataEnd; r++) {
      const row = rows[r] || [];
      if (isMonthLabel(row[layout.monthCol]) && row[layout.amountCol] !== null && row[layout.amountCol] !== undefined) monthRows++;
    }
    if (monthRows === 0) problems.push(`Sheet "${sheetName}" has no filled month/amount rows.`);
    totalMonthRows += monthRows;
  }

  return { ok: problems.length === 0 && totalMonthRows > 0, problems, totalMonthRows };
}

async function loadSheet(client, facilityCode, rows, warnings, log, counts) {
  const layout = detectLayout(rows);
  if (!layout) { warnings.push(`${facilityCode}: layout unrecognised — sheet skipped.`); return; }

  const facRes = await client.query('SELECT id FROM facilities WHERE code = $1', [facilityCode]);
  if (facRes.rows.length === 0) throw new Error(`No row in "facilities" with code = '${facilityCode}'.`);
  const facilityId = facRes.rows[0].id;

  const investmentRowData = layout.investmentRow !== -1 ? rows[layout.investmentRow] : [];
  const percentageRowData = layout.percentageRow !== -1 ? rows[layout.percentageRow] : [];

  const facilityInvestorIds = {};
  for (const inv of layout.investors) {
    const ownershipPct = percentageRowData[inv.amountCol];
    if (ownershipPct === null || ownershipPct === undefined) continue;
    const investmentAmount = investmentRowData[inv.amountCol];

    const invRes = await client.query(
      `INSERT INTO investors (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [inv.name]
    );
    const investorId = invRes.rows[0].id;

    const fiRes = await client.query(
      `INSERT INTO facility_investors (facility_id, investor_id, investment_amount, ownership_percentage, effective_from)
       VALUES ($1, $2, $3, $4, '2024-08-01')
       ON CONFLICT (facility_id, investor_id) WHERE effective_to IS NULL DO NOTHING RETURNING id`,
      [facilityId, investorId, investmentAmount || null, ownershipPct]
    );
    let facilityInvestorId;
    if (fiRes.rows.length > 0) facilityInvestorId = fiRes.rows[0].id;
    else {
      const ex = await client.query(
        `SELECT id FROM facility_investors WHERE facility_id = $1 AND investor_id = $2 AND effective_to IS NULL`,
        [facilityId, investorId]
      );
      facilityInvestorId = ex.rows[0].id;
    }
    facilityInvestorIds[inv.name] = { id: facilityInvestorId, pct: ownershipPct };
  }

  for (let r = layout.dataStart; r < layout.dataEnd; r++) {
    const row = rows[r];
    if (!row || !isMonthLabel(row[layout.monthCol])) continue;
    const amount = row[layout.amountCol];
    if (amount === null || amount === undefined) continue;

    const { monthName, isCombined, rawLabel } = parseMonthLabel(row[layout.monthCol]);
    const year = applyKnownFixes(facilityCode, monthName, row[layout.yearCol]);
    const periodMonth = toPeriodDate(monthName, year);
    const notes = isCombined ? `Original label in source sheet: "${rawLabel}"` : null;

    const mpRes = await client.query(
      `INSERT INTO monthly_profit (facility_id, period_month, profit_amount, entered_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (facility_id, period_month)
       DO UPDATE SET profit_amount = EXCLUDED.profit_amount, notes = EXCLUDED.notes RETURNING id`,
      [facilityId, periodMonth, amount, 'Imported via investorImporter', notes]
    );
    const monthlyProfitId = mpRes.rows[0].id;
    counts.monthsInserted++;

    for (const inv of layout.investors) {
      const fi = facilityInvestorIds[inv.name];
      if (!fi) continue;
      const disbursedAmount = row[inv.amountCol];
      const status = row[inv.statusCol] || 'Pending';
      if (disbursedAmount === null || disbursedAmount === undefined) continue;

      await client.query(
        `INSERT INTO disbursements (facility_investor_id, monthly_profit_id, period_month, ownership_pct_used, disbursed_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (facility_investor_id, period_month)
         DO UPDATE SET disbursed_amount = EXCLUDED.disbursed_amount, status = EXCLUDED.status`,
        [fi.id, monthlyProfitId, periodMonth, fi.pct, disbursedAmount, status]
      );
      counts.disbursementsInserted++;
    }
    log.push(`${facilityCode}: ${periodMonth}${notes ? ' (combined month)' : ''}`);
  }
  counts.facilitiesProcessed++;
}

async function wipeInvestorTables(client) {
  await client.query('DELETE FROM disbursements');
  await client.query('DELETE FROM facility_investors');
  await client.query('DELETE FROM monthly_profit');
  await client.query('DELETE FROM investors');
}

async function importInvestors({ client, source, options = {} }) {
  const mode = options.mode || 'replace';
  const dryRun = !!options.dryRun;
  if (!['replace', 'upsert'].includes(mode)) throw new Error(`Invalid mode "${mode}". Use replace or upsert.`);

  const warnings = [];
  const log = [];
  const fileName = source.fileName || (source.path ? path.basename(source.path) : 'investor workbook');
  const workbook = readWorkbook(source);

  if (mode === 'replace') {
    const check = validateWorkbook(workbook);
    if (!check.ok) {
      return {
        ok: false, refused: true, mode, fileName,
        reason: 'Workbook failed validation — refusing to wipe existing investor data.',
        problems: check.problems, warnings, log
      };
    }
    log.push(`Validation passed: ${check.totalMonthRows} month rows across ${FACILITY_SHEETS.length} facilities.`);
  }

  const counts = { facilitiesProcessed: 0, monthsInserted: 0, disbursementsInserted: 0 };

  const runLoad = async (c) => {
    for (const { facilityCode, sheetName } of FACILITY_SHEETS) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) { warnings.push(`Missing sheet "${sheetName}" — ${facilityCode} skipped.`); continue; }
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      await loadSheet(c, facilityCode, rows, warnings, log, counts);
    }
  };

  if (dryRun) {
    const noop = {
      query: async (sql) => {
        if (/SELECT id FROM facilities/.test(sql)) return { rows: [{ id: -1 }] };
        if (/RETURNING id/.test(sql)) return { rows: [{ id: -1 }] };
        return { rows: [] };
      }
    };
    await runLoad(noop);
    return { ok: true, dryRun: true, mode, fileName, ...counts, warnings, log };
  }

  try {
    await client.query('BEGIN');
    if (mode === 'replace') await wipeInvestorTables(client);
    await runLoad(client);
    await client.query('COMMIT');
    return { ok: true, dryRun: false, mode, fileName, ...counts, warningCount: warnings.length, warnings, log };
  } catch (err) {
    await client.query('ROLLBACK');
    return {
      ok: false, mode, fileName,
      reason: `Import failed, rolled back — existing data unchanged: ${err.message}`, warnings, log
    };
  }
}

module.exports = {
  importInvestors,
  _internals: { detectLayout, validateWorkbook, parseMonthLabel, applyKnownFixes, toPeriodDate, isMonthLabel, stripShare },
};