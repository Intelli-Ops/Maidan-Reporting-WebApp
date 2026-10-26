// lib/bookingImporter.js
// Core booking-import logic, callable from BOTH the CLI (import_bookings.js)
// and an HTTP upload endpoint. Does NOT read process.argv, create a pool, or
// print — caller supplies a pg client + options and receives a result object.
//
// Reads the Sales + Bank Details sheets only (all other sheets are legacy).
// The Date column inside Sales is authoritative for the booking date; the
// filename is used only for a soft sanity-check warning. Facility is inferred
// from Agent Name. Date-formatted numeric cells are recovered to their Excel
// serial. Status is normalised. All exactly as the original tested script.
//
// Feed it a workbook via either:
//   { path: '/abs/path/5 JUNE.xlsx' }              (CLI, from disk)
//   { buffer: <Buffer>, fileName: '5 JUNE.xlsx' }  (endpoint, from upload)

const path = require('path');
const XLSX = require('xlsx');
const { hashSource, findExistingBatch } = require('./sourceIdentity');

// ---------------------------------------------------------------------
// MAPPINGS (unchanged from the original script)
// ---------------------------------------------------------------------

const AGENT_FACILITY_MAP = {
  'supervisor-maidan kmc': 'KMC',
  'supervisor-emaar': 'EMAAR',
  'supervisor-maidan malir': 'MALIR',
};

const SPORT_MAP = {
  futsal: 'Futsal',
  padel: 'Padel',
  'padel neo': 'Padel',
  'padel kmc': 'Padel',
  'pickle ball': 'Pickleball',
  'multi purpose': 'Multi Purpose',
  football: 'Football',
  cricket: 'Cricket',
};

const PAYMENT_TEXT_MAP = {
  cash: 'Cash',
  card: 'Card',
  ibft: 'IBFT',
  gtcash: 'GT Cash',
  gtibft: 'GT IBFT',
  na: null,
};

// ---------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------

function normHeader(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function findSalesHeaderRowIdx(rows) {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const norms = (rows[i] || []).map(normHeader);
    if (norms.includes('date') && norms.some((h) => h.includes('customer'))) return i;
  }
  return 0;
}

function buildSalesColMap(headerRow) {
  const map = {};
  headerRow.forEach((raw, idx) => {
    const h = normHeader(raw);
    if (!h) return;
    if (map.date === undefined && h === 'date') { map.date = idx; return; }
    if (map.customerName === undefined && h.includes('customer')) { map.customerName = idx; return; }
    if (map.timings === undefined && h.includes('timing')) { map.timings = idx; return; }
    if (map.status === undefined && h === 'status') { map.status = idx; return; }
    if (map.perHourRate === undefined && h.includes('rate')) { map.perHourRate = idx; return; }
    if (map.hours === undefined && h.includes('hour')) { map.hours = idx; return; }
    if (map.discPct === undefined && h.includes('dis') && h.includes('%')) { map.discPct = idx; return; }
    if (map.discAmount === undefined && h.includes('disc') && (h.includes('amount') || h.includes('smount') || h.includes('amt'))) { map.discAmount = idx; return; }
    if (map.netAmount === undefined && h.includes('net') && (h.includes('amount') || h.includes('smount'))) { map.netAmount = idx; return; }
    if (map.amount === undefined && h === 'amount') { map.amount = idx; return; }
    if (map.agentName === undefined && h.includes('agent')) { map.agentName = idx; return; }
    if (map.income === undefined && h === 'income') { map.income = idx; return; }
    if (map.bin === undefined && h === 'bin') { map.bin = idx; return; }
    if (map.bankName === undefined && h.includes('bank')) { map.bankName = idx; return; }
    if (map.remarks === undefined && h.includes('remark')) { map.remarks = idx; return; }
  });
  return map;
}

function findBankDetailsDataRowIdx(rows) {
  return rows.findIndex((r) => typeof r[0] === 'number');
}

function buildBankDetailsColMap(headerRow) {
  const map = {};
  headerRow.forEach((raw, idx) => {
    const h = normHeader(raw);
    if (!h) return;
    if (map.bankName === undefined && h === 'bank') { map.bankName = idx; return; }
    if (map.cardType === undefined && h.includes('card') && h.includes('type')) { map.cardType = idx; return; }
    if (map.bin === undefined && h === 'bin') { map.bin = idx; return; }
    if (map.discountPct === undefined && h.includes('discount') && h.includes('%')) { map.discountPct = idx; return; }
    if (map.discountCap === undefined && h.includes('discount') && h.includes('cap')) { map.discountCap = idx; return; }
    if (map.monthlyLimit === undefined && h.includes('monthly')) { map.monthlyLimit = idx; return; }
    if (map.dailyLimit === undefined && h.includes('daily')) { map.dailyLimit = idx; return; }
  });
  return map;
}

// Local Y/M/D — avoids the UTC off-by-one-day bug.
function toDateOnly(v) {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

// Slots are parsed AT INSERT, not left for scripts/parse_time_slots.js to pick
// up later. The July 2026 upload sat with 1,546 unparsed rows for three weeks
// because that script is a separate manual step nobody remembered to run —
// the dashboard's Time Slots tab showed the whole month as "Unknown" while
// every earlier month was correctly slotted.
const { parseTimeSlot, hhmm } = require('./timeSlotParser');

function cleanText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeStatus(v) {
  const s = cleanText(v);
  if (!s) return null;
  return s.replace(/\s+/g, ' ').toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Reverse of xlsx serial->Date, recovering a number typed into a date-formatted cell.
function excelSerialFromDate(d) {
  const epoch = Date.UTC(1899, 11, 30);
  const ms = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  let serial = (ms - epoch) / 86400000;
  if (serial <= 60) serial -= 1;
  return serial;
}

function cleanNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    const serial = excelSerialFromDate(v);
    return Number.isFinite(serial) ? serial : null;
  }
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function readWorkbook(source) {
  return source.buffer
    ? XLSX.read(source.buffer, { type: 'buffer', cellDates: true })
    : XLSX.readFile(source.path, { cellDates: true });
}

// ---------------------------------------------------------------------
// DB lookups — created per run so a server process doesn't leak ids.
// bankBinRefSet is reset PER FILE by the caller.
// ---------------------------------------------------------------------

function makeLookups(client) {
  const facilityIdCache = new Map();
  const sportTypeIdCache = new Map();
  const paymentMethodIdCache = new Map();
  return {
    async getFacilityId(code) {
      if (facilityIdCache.has(code)) return facilityIdCache.get(code);
      const res = await client.query('SELECT id FROM facilities WHERE code = $1', [code]);
      if (res.rows.length === 0) throw new Error(`No row in "facilities" with code = '${code}'. Create it before running this import.`);
      facilityIdCache.set(code, res.rows[0].id);
      return res.rows[0].id;
    },
    async getOrCreateSportTypeId(name) {
      if (sportTypeIdCache.has(name)) return sportTypeIdCache.get(name);
      const res = await client.query(
        `INSERT INTO sport_types (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name]
      );
      sportTypeIdCache.set(name, res.rows[0].id);
      return res.rows[0].id;
    },
    async getOrCreatePaymentMethodId(name) {
      if (paymentMethodIdCache.has(name)) return paymentMethodIdCache.get(name);
      const res = await client.query(
        `INSERT INTO payment_methods (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name]
      );
      paymentMethodIdCache.set(name, res.rows[0].id);
      return res.rows[0].id;
    },
  };
}

// ---------------------------------------------------------------------
// Bank Details -> bank_bin_reference upsert (populates bankBinRefSet)
// ---------------------------------------------------------------------

async function upsertBankDetails(client, workbook, warnings, dryRun, bankBinRefSet) {
  const sheet = workbook.Sheets['Bank Details'];
  if (!sheet) {
    warnings.push('No "Bank Details" sheet found — BIN lookups may fail for numeric BINs in this file.');
    return;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const dataStart = findBankDetailsDataRowIdx(rows);
  if (dataStart < 1) {
    warnings.push('Could not locate a data row in "Bank Details" (expected a numeric S.No. in column A). Skipping bank details for this file.');
    return;
  }
  const colMap = buildBankDetailsColMap(rows[dataStart - 1]);
  if (colMap.bin === undefined || colMap.bankName === undefined) {
    warnings.push('Could not confidently map BIN/Bank columns in "Bank Details". Skipping bank details for this file.');
    return;
  }

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const binNumber = cleanNumber(row[colMap.bin]);
    const bankName = cleanText(row[colMap.bankName]);
    if (binNumber === null || !bankName) continue;

    if (!dryRun) {
      await client.query(
        `INSERT INTO bank_bin_reference
           (bin_number, bank_name, card_type, discount_pct, discount_cap, monthly_txn_limit, daily_txn_limit)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (bin_number) DO UPDATE SET
           bank_name = EXCLUDED.bank_name, card_type = EXCLUDED.card_type,
           discount_pct = EXCLUDED.discount_pct, discount_cap = EXCLUDED.discount_cap,
           monthly_txn_limit = EXCLUDED.monthly_txn_limit, daily_txn_limit = EXCLUDED.daily_txn_limit,
           updated_at = now()`,
        [
          binNumber, bankName, cleanText(row[colMap.cardType]),
          cleanNumber(colMap.discountPct !== undefined ? row[colMap.discountPct] : null),
          cleanNumber(colMap.discountCap !== undefined ? row[colMap.discountCap] : null),
          cleanNumber(colMap.monthlyLimit !== undefined ? row[colMap.monthlyLimit] : null),
          cleanNumber(colMap.dailyLimit !== undefined ? row[colMap.dailyLimit] : null),
        ]
      );
    }
    bankBinRefSet.add(binNumber);
  }
}

// ---------------------------------------------------------------------
// Sales -> bookings
// ---------------------------------------------------------------------

async function processSales(client, workbook, importBatchId, fileName, warnings, dryRun, lookups, bankBinRefSet) {
  const sheet = workbook.Sheets['Sales'];
  if (!sheet) {
    warnings.push(`[${fileName}] No "Sales" sheet found — nothing imported from this file.`);
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerIdx = findSalesHeaderRowIdx(rows);
  const colMap = buildSalesColMap(rows[headerIdx]);

  if (colMap.date === undefined || colMap.agentName === undefined) {
    warnings.push(`[${fileName}] Could not confidently map Date/Agent Name columns in "Sales". Skipping file.`);
    return 0;
  }

  let inserted = 0;
  const seenDates = new Set();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const date = row[colMap.date];
    const agentRaw = colMap.agentName !== undefined ? row[colMap.agentName] : null;
    const customerRaw = colMap.customerName !== undefined ? row[colMap.customerName] : null;

    if (date === null && customerRaw === null && agentRaw === null) continue;

    const bookingDate = toDateOnly(date);
    const agentName = cleanText(agentRaw);
    const facilityCode = agentName ? AGENT_FACILITY_MAP[agentName.trim().toLowerCase()] : null;

    if (!bookingDate) {
      warnings.push(`[${fileName}] Row ${i + 1}: missing/unparseable Date — skipped.`);
      continue;
    }
    seenDates.add(bookingDate);

    if (!facilityCode) {
      warnings.push(`[${fileName}] Row ${i + 1}: UNRECOGNIZED agent name "${agentName}" — no facility mapping, row skipped.`);
      continue;
    }

    const incomeRaw = cleanText(colMap.income !== undefined ? row[colMap.income] : null);
    const sportKey = incomeRaw ? incomeRaw.replace(/^per hour booking-\s*/i, '').trim().toLowerCase() : '';
    let sportName = SPORT_MAP[sportKey];
    if (!sportName) {
      sportName = incomeRaw || 'Unknown';
      warnings.push(`[${fileName}] Row ${i + 1}: UNRECOGNIZED income/sport label "${incomeRaw}" — imported as sport_types."${sportName}", please review.`);
    }

    const hoursRaw = colMap.hours !== undefined ? row[colMap.hours] : null;
    const grossRaw = colMap.amount !== undefined ? row[colMap.amount] : null;
    const netRaw = colMap.netAmount !== undefined ? row[colMap.netAmount] : null;
    const hours = cleanNumber(hoursRaw);
    const grossAmount = cleanNumber(grossRaw);
    const netAmount = cleanNumber(netRaw);

    for (const [label, raw, val] of [
      ['No of Hours', hoursRaw, hours],
      ['Amount', grossRaw, grossAmount],
      ['Net amount', netRaw, netAmount],
    ]) {
      if (raw instanceof Date) {
        warnings.push(`[${fileName}] Row ${i + 1}: "${label}" was DATE-FORMATTED in Excel (shows as a date, not a number) — recovered underlying value ${val}. Please verify against the sheet.`);
      }
    }

    if (hours === null || grossAmount === null || netAmount === null) {
      warnings.push(`[${fileName}] Row ${i + 1}: missing hours/amount/net amount — row skipped (customer: ${cleanText(customerRaw) || 'n/a'}).`);
      continue;
    }

    if (hours <= 0 || hours > 24) {
      warnings.push(`[${fileName}] Row ${i + 1}: implausible duration_hours (${hours}) — row skipped (customer: ${cleanText(customerRaw) || 'n/a'}, status: ${cleanText(colMap.status !== undefined ? row[colMap.status] : null) || 'n/a'}).`);
      continue;
    }

    const binRaw = colMap.bin !== undefined ? row[colMap.bin] : null;
    const bankNameRaw = colMap.bankName !== undefined ? row[colMap.bankName] : null;
    let bankBin = null;
    let paymentMethodName = null;

    if (typeof binRaw === 'number') {
      bankBin = binRaw;
      paymentMethodName = 'Card';
      if (!bankBinRefSet.has(binRaw)) {
        warnings.push(`[${fileName}] Row ${i + 1}: BIN ${binRaw} not found in this file's Bank Details reference — bank_bin will be left blank.`);
        bankBin = null;
      }
    } else {
      const textKey = (cleanText(binRaw) || cleanText(bankNameRaw) || '').toLowerCase();
      if (textKey && Object.prototype.hasOwnProperty.call(PAYMENT_TEXT_MAP, textKey)) {
        paymentMethodName = PAYMENT_TEXT_MAP[textKey];
      } else if (textKey) {
        paymentMethodName = cleanText(binRaw) || cleanText(bankNameRaw);
        warnings.push(`[${fileName}] Row ${i + 1}: UNRECOGNIZED payment code "${textKey}" — imported as payment_methods."${paymentMethodName}", please review.`);
      }
    }

    if (dryRun) { inserted++; continue; }

    const facilityId = await lookups.getFacilityId(facilityCode);
    const sportTypeId = await lookups.getOrCreateSportTypeId(sportName);
    const paymentMethodId = paymentMethodName ? await lookups.getOrCreatePaymentMethodId(paymentMethodName) : null;

    // Resolved against `hours`, not guessed from the text: "11 to 1" alone
    // cannot say whether it means 11am-1pm or 11pm-1am, but duration_hours
    // settles it. A row whose slot text is unreadable stores NULL times and a
    // 'failed' status rather than a wrong hour.
    const timeSlotRaw = cleanText(colMap.timings !== undefined ? row[colMap.timings] : null);
    const slot = parseTimeSlot(timeSlotRaw, hours);
    const slotParsed = slot.status !== 'failed';
    // Every slot the parser could not read with confidence is reported back to
    // whoever ran the import, naming the row and the exact text, so the sheet
    // can be corrected and re-uploaded. The booking still imports either way —
    // a questionable hour is not a reason to lose the revenue row — but
    // nothing is silently guessed without saying so.
    //
    // A blank slot cell is NOT reported: that is a gap in the sheet rather
    // than a parser failure, and one warning per blank row would bury the few
    // that are genuinely malformed.
    if (timeSlotRaw) {
      const at = `[${fileName}] Row ${i + 1}`;
      const readAs = slotParsed ? `${hhmm(slot.sh, slot.sm)}-${hhmm(slot.eh, slot.em)}` : null;

      // Nothing is reported for 'exact' or 'stated'. A row that names its
      // am/pm is taken at its word, even when duration_hours disagrees —
      // that disagreement is how a split payment looks, not a mistake, and
      // flagging it told staff to "fix" sheets that were already right.
      if (!slotParsed) {
        warnings.push(`${at}: TIME SLOT ERROR — "${timeSlotRaw}" is not a readable time slot (${slot.reason}). The booking imported, but with no time, so it shows under "Unknown" on the Time Slots dashboard. Please correct this cell and re-upload the file.`);
      } else if (slot.status === 'inferred') {
        // No am/pm anywhere, and the duration did not narrow it to one
        // reading either — so the hour below is genuinely a guess.
        warnings.push(`${at}: TIME SLOT ERROR — "${timeSlotRaw}" has no am/pm and the ${hours}h duration does not show which is meant, so it could be read more than one way. Imported as ${readAs} (best guess). Please write it with am/pm, e.g. "9 pm to 10 pm", and re-upload the file.`);
      } else if (slot.status === 'relaxed') {
        // Partial am/pm that contradicts the duration: one end is stated, the
        // other is not, and honouring the stated one produces a span the
        // duration rules out. The duration wins; worth naming, because the
        // meridiem the sheet does give is being overruled.
        warnings.push(`${at}: TIME SLOT CORRECTED — "${timeSlotRaw}" does not agree with the ${hours}h duration on the same row; the am/pm as written was overridden and it imported as ${readAs}. Please check this cell.`);
      }
    }

    await client.query(
      `INSERT INTO bookings
         (facility_id, sport_type_id, booking_date, time_slot_raw, duration_hours, customer_name,
          per_hour_rate, gross_amount, discount_pct, discount_amount, net_amount,
          payment_method_id, bank_bin, status, remarks, agent_name_raw, income_raw, import_batch_id,
          start_time, end_time, slot_start_hour, crosses_midnight, time_parse_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        facilityId, sportTypeId, bookingDate,
        timeSlotRaw,
        hours, cleanText(customerRaw),
        cleanNumber(colMap.perHourRate !== undefined ? row[colMap.perHourRate] : null),
        grossAmount,
        cleanNumber(colMap.discPct !== undefined ? row[colMap.discPct] : null) ?? 0,
        cleanNumber(colMap.discAmount !== undefined ? row[colMap.discAmount] : null) ?? 0,
        netAmount, paymentMethodId, bankBin,
        normalizeStatus(colMap.status !== undefined ? row[colMap.status] : null) || 'Unknown',
        cleanText(colMap.remarks !== undefined ? row[colMap.remarks] : null),
        agentName, incomeRaw, importBatchId,
        slotParsed ? hhmm(slot.sh, slot.sm) : null,
        slotParsed ? hhmm(slot.eh, slot.em) : null,
        slotParsed ? slot.sh : null,
        slotParsed ? slot.crosses : false,
        slot.status,
      ]
    );
    inserted++;
  }

  if (seenDates.size > 1) {
    warnings.push(`[${fileName}] Sales rows span ${seenDates.size} distinct dates (${[...seenDates].join(', ')}) — expected a single-day file.`);
  } else if (seenDates.size === 1) {
    const [onlyDate] = [...seenDates];
    const base = path.basename(fileName, path.extname(fileName));
    const m = base.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s_-]*([A-Za-z]{3,})/);
    if (m) {
      const day = parseInt(m[1], 10);
      const monthName = m[2].toLowerCase();
      const [yy, mm, dd] = onlyDate.split('-').map(Number);
      const cellMonth = new Date(yy, mm - 1, dd).toLocaleString('en-US', { month: 'short' }).toLowerCase();
      if (day !== dd || !monthName.startsWith(cellMonth)) {
        warnings.push(`[${fileName}] DATE MISMATCH: filename suggests ${m[1]} ${m[2]}, but Sales data is dated ${onlyDate} — check this file is filed correctly / the date inside is right.`);
      }
    }
  }

  return inserted;
}

// ---------------------------------------------------------------------
// One file within its own transaction
// ---------------------------------------------------------------------

async function processOne(client, source, options, lookups, warnings, log) {
  const { dryRun, force } = options;
  const fileName = source.fileName || path.basename(source.path);
  // Content identity, computed once per file. Names repeat month to month
  // (1.xlsx ... 31.xlsx); the bytes do not.
  const sourceHash = hashSource(source);

  if (!dryRun) {
    // Identity is the file's content hash, not its name: the booking
    // workbooks are named 1.xlsx..31.xlsx and repeat every month, so a
    // name-based check would skip next month's files as "already imported".
    const existing = await findExistingBatch(client, 'booking', sourceHash, fileName);
    if (existing) {
      if (!force) {
        log.push(`SKIP (already imported): ${fileName}`);
        return { fileName, skipped: true, inserted: 0 };
      }
      const batchId = existing.id;
      await client.query('DELETE FROM bookings WHERE import_batch_id = $1', [batchId]);
      await client.query('DELETE FROM raw_import_batches WHERE id = $1', [batchId]);
    }
  }

  const workbook = readWorkbook(source);

  // BIN reference set is scoped to THIS file's Bank Details tab.
  const bankBinRefSet = new Set();
  await upsertBankDetails(client, workbook, warnings, dryRun, bankBinRefSet);

  let importBatchId = null;
  if (!dryRun) {
    const batchRes = await client.query(
      `INSERT INTO raw_import_batches (source_type, source_name, source_hash, row_count, notes)
       VALUES ('booking', $1, $2, 0, 'Imported via bookingImporter') RETURNING id`,
      [fileName, sourceHash]
    );
    importBatchId = batchRes.rows[0].id;
  }

  const inserted = await processSales(client, workbook, importBatchId, fileName, warnings, dryRun, lookups, bankBinRefSet);

  if (!dryRun) {
    await client.query('UPDATE raw_import_batches SET row_count = $1 WHERE id = $2', [inserted, importBatchId]);
  }

  log.push(`${dryRun ? '[dry-run] would insert' : 'inserted'} ${inserted} booking rows from ${fileName}`);
  return { fileName, skipped: false, inserted };
}

// ---------------------------------------------------------------------
// PUBLIC API
//
// importBookings({ client, sources, options }) -> result
//   sources : array of { path } and/or { buffer, fileName }
//   options : { dryRun=false, force=false }
// One transaction per file; result is JSON-serialisable.
// ---------------------------------------------------------------------

async function importBookings({ client, sources, options = {} }) {
  const opts = { dryRun: !!options.dryRun, force: !!options.force };
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

  return {
    ok: true,
    dryRun: opts.dryRun,
    filesProcessed: files.length,
    filesSkipped: skippedFiles,
    totalInserted,
    warningCount: warnings.length,
    files,
    warnings,
    log,
  };
}

module.exports = {
  importBookings,
  _internals: { toDateOnly, cleanNumber, excelSerialFromDate, normalizeStatus, buildSalesColMap, findSalesHeaderRowIdx, buildBankDetailsColMap, findBankDetailsDataRowIdx },
};
