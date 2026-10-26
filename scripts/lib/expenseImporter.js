// lib/expenseImporter.js
// Core expense-import logic, callable from BOTH the CLI (import_expenses.js)
// and an HTTP upload endpoint. It does NOT read process.argv, does NOT create a
// DB pool, and does NOT print — the caller supplies a pg client + options and
// receives a structured result object.
//
// The parsing/validation is identical to the original script (date
// reconciliation against the filename month, facility patterns, category tree,
// Excel-serial handling, undated-row policy). See the notes on each function.
//
// Two ways to feed it a workbook:
//   { path: '/abs/path/Expense - June 2026.xlsx' }         (CLI, from disk)
//   { buffer: <Buffer>, fileName: 'Expense - June 2026.xlsx' }  (endpoint, from upload)
// The fileName matters: the month/year is read from it and used to fix dates,
// so an uploaded file MUST keep a name like "Expense - June 2026.xlsx".

const path = require('path');
const XLSX = require('xlsx');
const { hashSource, findExistingBatch } = require('./sourceIdentity');

// ---------------------------------------------------------------------
// MAPPINGS
// ---------------------------------------------------------------------

const FACILITY_PATTERNS = [
  { code: 'KMC', test: (s) => s.includes('kmc') },
  { code: 'EMAAR', test: (s) => s.includes('emaar') },
  { code: 'MALIR', test: (s) => s.includes('malir') },
];

const PAYMENT_MAP = { cheque: 'Cheque', cash: 'Cash', ibft: 'IBFT', card: 'Card' };

const MONTH_NUMBERS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9,
  sept: 9, oct: 10, nov: 11, dec: 12,
};

const UNCATEGORIZED = 'Uncategorized';

// The agreed sheet names in the client's monthly expense workbook, one per
// facility. Used ONLY to warn when one is missing — sheet selection itself is
// driven by the header row, so an unexpected name still imports fine.
const EXPECTED_FACILITY_SHEETS = ['KMC', 'Emaar', 'Malir'];

// ---------------------------------------------------------------------
// Small helpers (pure)
// ---------------------------------------------------------------------

function normHeader(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function cleanText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length ? s : null;
}
function cleanNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}
const pad2 = (n) => String(n).padStart(2, '0');
const fmtDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
function titleCase(s) {
  return s.toLowerCase().split(' ').map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}
function cleanCategoryName(s) {
  return s.replace(/^\s*\d+\s*[.)-]\s*/, '').trim();
}

function periodFromFilename(fileName) {
  const base = path.basename(fileName, path.extname(fileName)).toLowerCase();
  let month = null;
  for (const [name, num] of Object.entries(MONTH_NUMBERS)) {
    if (new RegExp(`\\b${name}\\b`).test(base)) {
      if (month === null || name.length > month.name.length) month = { name, num };
    }
  }
  const y = base.match(/\b(20\d{2})\b/);
  return { month: month ? month.num : null, year: y ? parseInt(y[1], 10) : null };
}

// ---------------------------------------------------------------------
// Date resolution (filename month is authoritative — see original notes)
// ---------------------------------------------------------------------

function dateFromExcelSerial(n) {
  const ms = Math.round((n + (n <= 60 ? 1 : 0)) * 86400000) + Date.UTC(1899, 11, 30);
  const u = new Date(ms);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
}

/**
 * Forces a resolved date into the month the file is named for.
 *
 * Returns `resolved` untouched when it already sits in that month; otherwise
 * returns the 1st of the file's month and records a warning naming both the
 * original value and the replacement, since the original day is not stored
 * anywhere else once the row is written.
 *
 * Callers must have already attempted day/month transposition — this is the
 * last resort, not the first check. See the note in resolveDate.
 */
function clampToPeriod(resolved, expected, fileName, rowNum, warnings, describeOriginal) {
  const { month: expMonth, year: expYear } = expected;
  if (expMonth === null || expYear === null) return resolved;

  const [ry, rm] = resolved.split('-').map(Number);
  if (rm === expMonth && ry === expYear) return resolved;

  const clamped = fmtDate(expYear, expMonth, 1);
  warnings.push(
    `[${fileName}] Row ${rowNum}: ${describeOriginal} falls outside the file's month (${pad2(expMonth)}/${expYear}) and isn't a day/month transposition — moved to ${clamped}. The original day is discarded; open the source row if that matters.`
  );
  return clamped;
}

function resolveDate(raw, expected, fileName, rowNum, warnings) {
  const { month: expMonth, year: expYear } = expected;

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    raw = dateFromExcelSerial(raw);
  }

  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = raw.getMonth() + 1;
    const d = raw.getDate();
    if (expMonth === null) return fmtDate(y, m, d);
    if (m === expMonth && (expYear === null || y === expYear)) return fmtDate(y, m, d);
    if (d === expMonth && (expYear === null || y === expYear)) {
      warnings.push(`[${fileName}] Row ${rowNum}: date read as ${fmtDate(y, m, d)} but this is a month-${expMonth} file — day/month were transposed, corrected to ${fmtDate(y, d, m)}.`);
      return fmtDate(y, d, m);
    }
    // Neither this file's month nor a recoverable transposition, so the day
    // cannot be trusted — clamp to the 1st of the month the file is named for.
    //
    // This branch used to import the date as-is with a warning, which is how
    // 20 payroll rows dated 30-Jun-2026 rode into the database inside a July
    // workbook and inflated June by PKR 659,260 against the client's own June
    // sheet. A file named for a month is a statement that its contents belong
    // to that month; anything that disagrees is a data-entry error, not a
    // cross-month transaction to preserve.
    //
    // Note this runs AFTER the transposition attempt above, never before. In
    // the June 2026 workbook Excel had stored days 1-12 as months (1/6/26 read
    // as 6-Jan, 2/6/26 as 6-Feb, ...) — 164 rows that all look out-of-month on
    // their face. Transposition recovers their real days; clamping first would
    // collapse every one of them onto the 1st and destroy the day detail.
    //
    // The day is discarded rather than guessed. This warning is the only
    // record of what the cell originally said, so it names both dates.
    return clampToPeriod(fmtDate(y, m, d), expected, fileName, rowNum, warnings, `date ${fmtDate(y, m, d)}`);
  }

  if (typeof raw === 'string') {
    const s = raw.trim();
    const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (m) {
      let day = parseInt(m[1], 10);
      let mon = parseInt(m[2], 10);
      let yr = parseInt(m[3], 10);
      if (yr < 100) yr += 2000;
      if (expMonth !== null && mon !== expMonth && day === expMonth) {
        const t = day; day = mon; mon = t;
        warnings.push(`[${fileName}] Row ${rowNum}: text date "${s}" read as day/month transposed, corrected to ${fmtDate(yr, mon, day)}.`);
      }
      if (mon < 1 || mon > 12 || day < 1 || day > 31) {
        warnings.push(`[${fileName}] Row ${rowNum}: text date "${s}" is not a valid date — row skipped.`);
        return null;
      }
      // Same clamp as the Date branch, applied after the transposition swap
      // above has had its chance. Text dates are how these sheets store any
      // day past the 12th (Excel cannot read "15-6-26" as a date), so this
      // path carries just as much of the month as the serial path does.
      return clampToPeriod(fmtDate(yr, mon, day), expected, fileName, rowNum, warnings, `text date "${s}"`);
    }
    warnings.push(`[${fileName}] Row ${rowNum}: unrecognised date format "${s}" — row skipped.`);
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------
// Header + column mapping
// ---------------------------------------------------------------------

function findHeaderRowIdx(rows) {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const norms = (rows[i] || []).map(normHeader);
    if (norms.includes('date') && norms.includes('amount')) return i;
  }
  return -1;
}

function buildColMap(headerRow) {
  const map = {};
  headerRow.forEach((raw, idx) => {
    const h = normHeader(raw);
    if (!h) return;
    if (map.date === undefined && h === 'date') { map.date = idx; return; }
    if (map.facility === undefined && h === 'facility') { map.facility = idx; return; }
    if (map.item === undefined && h === 'item') { map.item = idx; return; }
    if (map.subCategory === undefined && h.includes('sub') && h.includes('category')) { map.subCategory = idx; return; }
    if (map.category === undefined && h === 'category') { map.category = idx; return; }
    if (map.paymentMethod === undefined && h.includes('payment')) { map.paymentMethod = idx; return; }
    if (map.chequeNumber === undefined && h.includes('cheque')) { map.chequeNumber = idx; return; }
    if (map.amount === undefined && h === 'amount') { map.amount = idx; return; }
    if (map.description === undefined && (h.includes('description') || h.includes('comment'))) { map.description = idx; return; }
    if (map.sourceAccount === undefined && h.includes('source') && h.includes('account')) { map.sourceAccount = idx; return; }
    if (map.sourceBank === undefined && h.includes('source') && h.includes('bank')) { map.sourceBank = idx; return; }
  });
  return map;
}

// ---------------------------------------------------------------------
// DB lookups — caches are created PER RUN (inside importExpenses) rather than
// as module globals, so a long-lived server process doesn't leak stale ids
// across imports or between users.
// ---------------------------------------------------------------------

function makeLookups(client) {
  const facilityIdCache = new Map();
  const paymentMethodIdCache = new Map();
  const categoryIdCache = new Map();

  return {
    async getFacilityId(code) {
      if (facilityIdCache.has(code)) return facilityIdCache.get(code);
      const res = await client.query('SELECT id FROM facilities WHERE code = $1', [code]);
      if (res.rows.length === 0) {
        throw new Error(`No row in "facilities" with code = '${code}'. Create it before running this import.`);
      }
      facilityIdCache.set(code, res.rows[0].id);
      return res.rows[0].id;
    },
    async getOrCreatePaymentMethodId(name) {
      if (paymentMethodIdCache.has(name)) return paymentMethodIdCache.get(name);
      const res = await client.query(
        `INSERT INTO payment_methods (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name]
      );
      paymentMethodIdCache.set(name, res.rows[0].id);
      return res.rows[0].id;
    },
    async getOrCreateCategoryId(name, parentId) {
      const key = `${name}::${parentId ?? 'root'}`;
      if (categoryIdCache.has(key)) return categoryIdCache.get(key);
      const res = await client.query(
        `INSERT INTO expense_categories (name, parent_category_id) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, parent_category_id`,
        [name, parentId]
      );
      categoryIdCache.set(key, res.rows[0].id);
      return res.rows[0].id;
    },
  };
}

// ---------------------------------------------------------------------
// Read a workbook from either a path or an in-memory buffer
// ---------------------------------------------------------------------

// Reads EVERY sheet that looks like an expense table, not just the first.
//
// The July 2026 upload arrived split one sheet per facility (KMC / Emaar /
// Malir) where earlier files were a single sheet with a Facility column.
// Reading only SheetNames[0] silently imported KMC and dropped the other two
// — no error, just missing money. Every sheet carries its own Facility
// column, so concatenating them is equivalent to the old single-sheet layout.
//
// A sheet is included only if its header row matches the first one's, so a
// stray notes/summary tab cannot shift column positions and write values into
// the wrong fields. Mismatches are reported rather than ignored.
function readWorkbookRows(source, warnings, fileName) {
  const wb = source.buffer
    ? XLSX.read(source.buffer, { type: 'buffer', cellDates: true })
    : XLSX.readFile(source.path, { cellDates: true });

  const combined = [];
  let headerSignature = null;
  const accepted = [];

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
    const headerIdx = findHeaderRowIdx(rows);
    if (headerIdx === -1) continue; // not a data sheet (notes, summary, ...)

    const signature = (rows[headerIdx] || []).map(normHeader).join('|');
    if (headerSignature === null) {
      headerSignature = signature;
      combined.push(rows[headerIdx]); // keep exactly one header for buildColMap
    } else if (signature !== headerSignature) {
      warnings.push(
        `[${fileName}] Sheet "${sheetName}" has different columns from the first sheet — skipped rather than risk mapping values into the wrong fields.`
      );
      continue;
    }

    let taken = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      combined.push(rows[i]);
      taken++;
    }
    accepted.push(sheetName);
    if (wb.SheetNames.length > 1) {
      warnings.push(`[${fileName}] Sheet "${sheetName}": ${taken} row(s) read.`);
    }
  }

  // The client's agreed layout is one sheet per facility, named KMC / Emaar /
  // Malir. Sheets are still matched on their HEADER ROW rather than their
  // name, so renaming a tab does not break the import — but a facility whose
  // sheet never arrived would otherwise just be absent from the totals with
  // nothing to show for it, which is the same silent-loss failure this
  // function was written to end. Warn by name so it is obvious.
  const seen = accepted.map((n) => n.trim().toLowerCase());
  for (const expectedSheet of EXPECTED_FACILITY_SHEETS) {
    if (!seen.includes(expectedSheet.toLowerCase())) {
      warnings.push(
        `[${fileName}] No sheet named "${expectedSheet}" was read. Expected one sheet per facility (${EXPECTED_FACILITY_SHEETS.join(', ')}) — check whether it is missing, empty, or has different columns.`
      );
    }
  }

  return combined;
}

// ---------------------------------------------------------------------
// Process ONE file/buffer within an already-open transaction.
// Returns { fileName, skipped, inserted }.
// ---------------------------------------------------------------------

async function processOne(client, source, options, lookups, warnings, log) {
  const { dryRun, force, undatedPolicy } = options;
  const fileName = source.fileName || path.basename(source.path);
  // Content identity, computed once per file. Names repeat month to month
  // (1.xlsx ... 31.xlsx); the bytes do not.
  const sourceHash = hashSource(source);
  const expected = periodFromFilename(fileName);

  // A month AND year in the filename are mandatory, not advisory.
  //
  // Everything this importer does to defend the Date column — the
  // transposition fix, the clamp, the fallback for undated rows — is anchored
  // to the period in the file name. Without it none of them can fire, so a
  // workbook whose dates are transposed or belong to another month imports
  // silently and wrongly, and looks like a clean run.
  //
  // That is not hypothetical: "Expense Sheet.xlsx" (the July 2026 upload) had
  // no month in its name, so its 20 rows dated 30-Jun-2026 were written to
  // June and left the June dashboard 659,260 above the client's own June
  // workbook. Refusing the file costs a rename; accepting it costs a
  // reconciliation nobody notices for weeks.
  //
  // Returned as a rejection rather than thrown so a multi-file upload reports
  // this file and still imports the correctly-named ones alongside it.
  if (expected.month === null || expected.year === null) {
    warnings.push(
      `[${fileName}] REJECTED — no month and year in the filename, so dates cannot be validated or corrected and a wrong month would import silently. Rename it like "Expense - June 2026.xlsx" and upload again.`
    );
    return { fileName, skipped: false, rejected: true, inserted: 0 };
  }

  if (!dryRun) {
    // Content hash, not file name — see lib/sourceIdentity.js.
    const existing = await findExistingBatch(client, 'expense', sourceHash, fileName);
    if (existing) {
      if (!force) {
        log.push(`SKIP (already imported): ${fileName}`);
        return { fileName, skipped: true, inserted: 0 };
      }
      const batchId = existing.id;
      await client.query('DELETE FROM expenses WHERE import_batch_id = $1', [batchId]);
      await client.query('DELETE FROM raw_import_batches WHERE id = $1', [batchId]);
    }
  }

  const rows = readWorkbookRows(source, warnings, fileName);
  const headerIdx = findHeaderRowIdx(rows);
  if (headerIdx === -1) {
    warnings.push(`[${fileName}] Could not find a header row containing both "Date" and "Amount" — file skipped.`);
    return { fileName, skipped: false, inserted: 0 };
  }
  const colMap = buildColMap(rows[headerIdx]);
  if (colMap.amount === undefined || colMap.facility === undefined) {
    warnings.push(`[${fileName}] Header found but "Amount" or "Facility" column is missing — file skipped.`);
    return { fileName, skipped: false, inserted: 0 };
  }

  let importBatchId = null;
  if (!dryRun) {
    const batchRes = await client.query(
      `INSERT INTO raw_import_batches (source_type, source_name, source_hash, row_count, notes)
       VALUES ('expense', $1, $2, 0, 'Imported via expenseImporter') RETURNING id`,
      [fileName, sourceHash]
    );
    importBatchId = batchRes.rows[0].id;
  }

  let inserted = 0;
  let lastSeenDate = null;
  let undatedCount = 0;
  let undatedTotal = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const rowNum = i + 1;
    const get = (k) => (colMap[k] !== undefined ? row[colMap[k]] : null);

    const rawDate = get('date');
    const amount = cleanNumber(get('amount'));
    const facilityRaw = cleanText(get('facility'));
    const item = cleanText(get('item'));

    if (rawDate === null && amount === null && !facilityRaw && !item) continue;

    if (amount === null) {
      warnings.push(`[${fileName}] Row ${rowNum}: no Amount — row skipped (item: ${item || 'n/a'}).`);
      continue;
    }

    let expenseDate;
    const dateIsBlank = rawDate === null || rawDate === undefined || String(rawDate).trim() === '';
    if (dateIsBlank) {
      if (undatedPolicy === 'skip') {
        warnings.push(`[${fileName}] Row ${rowNum}: no date — row skipped (item: ${item || 'n/a'}, amount: ${amount}).`);
        continue;
      }
      // Carry is checked BEFORE the month-start fallback because it does not
      // depend on the filename period at all — it reuses a date already
      // parsed from a row above in this same sheet. Previously the
      // `expected.month === null` guard sat in front of this, so a workbook
      // named without a month ("Expense Sheet.xlsx") skipped every undated
      // row no matter which policy was set. That silently dropped 40 rows
      // worth PKR 188,665 from the July upload.
      //
      // Carrying the last seen date matches how these sheets are actually
      // filled in: the date is typed once and left blank on the following
      // rows for the same day.
      if (undatedPolicy === 'carry' && lastSeenDate) {
        expenseDate = lastSeenDate;
      } else if (expected.month !== null && expected.year !== null) {
        expenseDate = fmtDate(expected.year, expected.month, 1);
      } else {
        // Nothing to carry (an undated row before any dated row) and no
        // period in the filename — inventing a date here would be a guess,
        // so this stays a skip rather than silently landing in a wrong month.
        warnings.push(
          `[${fileName}] Row ${rowNum}: no date, no earlier date to carry, and no month in the filename — row skipped (item: ${item || 'n/a'}, amount: ${amount}).`
        );
        continue;
      }
      undatedCount++;
      undatedTotal += amount;
    } else {
      expenseDate = resolveDate(rawDate, expected, fileName, rowNum, warnings);
      if (!expenseDate) {
        warnings.push(`[${fileName}] Row ${rowNum}: no usable date — row skipped (item: ${item || 'n/a'}, amount: ${amount}).`);
        continue;
      }
      lastSeenDate = expenseDate;
    }

    let facilityCode = null;
    if (facilityRaw) {
      const f = facilityRaw.toLowerCase();
      const hit = FACILITY_PATTERNS.find((p) => p.test(f));
      if (hit) facilityCode = hit.code;
    }
    if (!facilityCode) {
      warnings.push(`[${fileName}] Row ${rowNum}: UNRECOGNISED facility "${facilityRaw}" — row skipped (item: ${item || 'n/a'}, amount: ${amount}).`);
      continue;
    }

    const parentRaw = cleanText(get('category'));
    const childRaw = cleanText(get('subCategory'));
    const parentName = parentRaw && parentRaw.length > 1 ? cleanCategoryName(parentRaw) : null;
    const childName = childRaw && childRaw.length > 1 ? childRaw : null;

    let paymentMethodName = null;
    const pmRaw = cleanText(get('paymentMethod'));
    if (pmRaw) {
      const key = pmRaw.toLowerCase();
      paymentMethodName = PAYMENT_MAP[key] || titleCase(pmRaw);
      if (!PAYMENT_MAP[key]) {
        warnings.push(`[${fileName}] Row ${rowNum}: UNRECOGNISED payment method "${pmRaw}" — imported as "${paymentMethodName}", please review.`);
      }
    }

    if (dryRun) { inserted++; continue; }

    const facilityId = await lookups.getFacilityId(facilityCode);
    let categoryId;
    if (parentName) {
      const parentId = await lookups.getOrCreateCategoryId(parentName, null);
      categoryId = childName ? await lookups.getOrCreateCategoryId(childName, parentId) : parentId;
    } else {
      categoryId = await lookups.getOrCreateCategoryId(UNCATEGORIZED, null);
    }
    const paymentMethodId = paymentMethodName ? await lookups.getOrCreatePaymentMethodId(paymentMethodName) : null;

    const chequeRaw = get('chequeNumber');
    const chequeNumber = chequeRaw === null || chequeRaw === undefined ? null : String(chequeRaw).trim() || null;

    await client.query(
      `INSERT INTO expenses
         (facility_id, expense_category_id, expense_date, item, description, amount,
          payment_method_id, cheque_number, source_account, source_bank, import_batch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        facilityId, categoryId, expenseDate, item, cleanText(get('description')), amount,
        paymentMethodId, chequeNumber, cleanText(get('sourceAccount')), cleanText(get('sourceBank')), importBatchId,
      ]
    );
    inserted++;
  }

  if (undatedCount > 0) {
    const where = undatedPolicy === 'carry'
      ? "dated by carrying down the previous row's date"
      : `dated to the 1st of ${pad2(expected.month)}/${expected.year}`;
    // Only the month-start branch invents a day; carry reuses a real one
    // from the sheet, so the "day is a placeholder" caveat does not apply.
    const caveat = undatedPolicy === 'carry'
      ? 'Verify with the client that blank meant "same day as above".'
      : 'The month is right; the day is a placeholder.';
    warnings.push(`[${fileName}] UNDATED ROWS: ${undatedCount} row(s) totalling ${undatedTotal.toLocaleString()} had no date and were ${where}. ${caveat}`);
  }

  if (!dryRun) {
    await client.query('UPDATE raw_import_batches SET row_count = $1 WHERE id = $2', [inserted, importBatchId]);
  }

  log.push(`${dryRun ? '[dry-run] would insert' : 'inserted'} ${inserted} expense rows from ${fileName}`);
  // undatedCount/undatedTotal are returned as fields, not just described in a
  // warning string: the upload flow has to decide whether to stop and ask the
  // user, and parsing prose to make that decision would be fragile.
  return { fileName, skipped: false, inserted, undatedCount, undatedTotal };
}

// ---------------------------------------------------------------------
// PUBLIC API
//
// importExpenses({ client, sources, options }) -> result
//   client   : a connected pg client (caller owns its lifecycle)
//   sources  : array of { path } and/or { buffer, fileName }
//   options  : { dryRun=false, force=false, undatedPolicy='carry' }
//
// Each source is processed in its OWN transaction, exactly like the original
// script: a bad file rolls back alone and the rest still load. The result
// object is JSON-serialisable so an endpoint can return it straight to the UI.
// ---------------------------------------------------------------------

async function importExpenses({ client, sources, options = {} }) {
  const opts = {
    dryRun: !!options.dryRun,
    force: !!options.force,
    // 'carry' is the default because it matches how these workbooks are
    // filled in: the date is typed once and left blank on the following rows
    // for the same day. 'month-start' remains available for sheets whose
    // blanks are not that pattern, and 'skip' for a strict run.
    undatedPolicy: options.undatedPolicy || 'carry',
  };
  if (!['month-start', 'carry', 'skip'].includes(opts.undatedPolicy)) {
    throw new Error(`Invalid undatedPolicy "${opts.undatedPolicy}". Use month-start, carry, or skip.`);
  }

  const warnings = [];
  const log = [];
  const files = [];
  const lookups = makeLookups(client);

  for (const source of sources) {
    if (!opts.dryRun) await client.query('BEGIN');
    try {
      const r = await processOne(client, source, opts, lookups, warnings, log);
      files.push(r);
      if (!opts.dryRun) await client.query('COMMIT');
    } catch (err) {
      if (!opts.dryRun) await client.query('ROLLBACK');
      const name = source.fileName || path.basename(source.path || 'unknown');
      warnings.push(`[${name}] FILE FAILED, rolled back: ${err.message}`);
    }
  }

  const totalInserted = files.reduce((s, r) => s + (r.inserted || 0), 0);
  const skippedFiles = files.filter((r) => r.skipped).length;
  // Rejections are counted separately from skips: a skip means "already
  // imported, nothing to do", while a rejection means "this file needs fixing
  // and its data is NOT in the database". Collapsing them into one number
  // would let a rejected upload read as a successful no-op.
  const rejectedFiles = files.filter((r) => r.rejected).length;
  const undatedCount = files.reduce((s, r) => s + (r.undatedCount || 0), 0);
  const undatedTotal = files.reduce((s, r) => s + (r.undatedTotal || 0), 0);

  return {
    ok: true,
    dryRun: opts.dryRun,
    filesProcessed: files.length,
    filesSkipped: skippedFiles,
    filesRejected: rejectedFiles,
    totalInserted,
    undatedCount,
    undatedTotal,
    undatedPolicy: opts.undatedPolicy,
    warningCount: warnings.length,
    files,     // per-file [{ fileName, skipped, inserted }]
    warnings,  // full warning strings
    log,       // human-readable per-file lines
  };
}

module.exports = {
  importExpenses,
  // exported for unit tests / reuse
  _internals: { resolveDate, periodFromFilename, buildColMap, findHeaderRowIdx, dateFromExcelSerial, cleanNumber, cleanText, clampToPeriod },
};
