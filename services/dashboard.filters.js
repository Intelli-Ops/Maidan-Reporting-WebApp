'use strict';

/**
 * Parse a raw query-param value that may be a comma-separated list of IDs.
 * Returns an array of string tokens, or null if nothing usable was provided.
 *
 * Examples:
 *   parseIdList('1')        → ['1']
 *   parseIdList('1,2,3')    → ['1', '2', '3']
 *   parseIdList('null')     → ['null']   (special: means IS NULL)
 *   parseIdList('1,null')   → ['1', 'null']
 *   parseIdList('')         → null
 *   parseIdList(undefined)  → null
 */
function parseIdList(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

/**
 * Build a SQL fragment for a column against a token list that may include the
 * literal string 'null' (case-insensitive), meaning "IS NULL".
 *
 * Non-numeric, non-null tokens are silently discarded (never a crash, never an
 * injection vector since numerics are parsed via parseInt, not interpolated raw).
 *
 * @param {string}   column    - SQL column reference, e.g. 'b.facility_id'
 * @param {string[]|null} tokens - output of parseIdList, or null
 * @param {number}   paramIdx  - next available $N placeholder index
 * @returns {{ clause: string, params: any[], nextParamIdx: number }|null}
 *          null when the token list produces no usable condition.
 */
function buildIdListClause(column, tokens, paramIdx) {
  if (!tokens) return null;

  // Clamped to int4, not merely "is a number": every id column here is a
  // Postgres integer, so a token like 99999999999999999999 parsed fine and
  // then blew up inside the driver with "value out of range for type
  // integer" — a 500 for what is really just an id that cannot match anything.
  // Out-of-range ids are dropped the same way non-numeric ones already were.
  const INT4_MIN = -2147483648;
  const INT4_MAX = 2147483647;
  const nums = tokens
    .filter((t) => t.toLowerCase() !== 'null')
    .map((t) => parseInt(t, 10))
    .filter((n) => Number.isInteger(n) && n >= INT4_MIN && n <= INT4_MAX);

  const wantsNull = tokens.some((t) => t.toLowerCase() === 'null');

  const parts = [];
  const params = [];
  let idx = paramIdx;

  if (nums.length) {
    parts.push(`${column} = ANY($${idx++}::int[])`);
    params.push(nums);
  }
  if (wantsNull) {
    parts.push(`${column} IS NULL`);
  }

  if (!parts.length) return null;

  return {
    clause: `(${parts.join(' OR ')})`,
    params,
    nextParamIdx: idx,
  };
}

/**
 * Central WHERE-clause builder used by every dashboard section.
 *
 * @param {object} filters
 * @param {string|null}   filters.startDate
 * @param {string|null}   filters.endDate
 * @param {string[]|null} filters.facilityIds
 * @param {string[]|null} filters.sportTypeIds
 * @param {string[]|null} filters.paymentMethodIds
 * @param {object} opts
 * @param {boolean} [opts.applyFacility=true]   - set false for "always all facilities" sections
 * @param {boolean} [opts.applySport=true]       - set false for bySport section
 * @param {boolean} [opts.applyPayment=true]
 * @returns {{ clauses: string[], params: any[], nextParamIdx: number }}
 */
function buildFilterClauses(filters, opts = {}) {
  const {
    applyFacility = true,
    applySport = true,
    applyPayment = true,
  } = opts;

  const { startDate, endDate, facilityIds, sportTypeIds, paymentMethodIds } =
    filters;

  const clauses = [];
  const params = [];
  let idx = 1;

  if (startDate) {
    clauses.push(`b.booking_date >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    clauses.push(`b.booking_date <= $${idx++}`);
    params.push(endDate);
  }

  if (applyFacility) {
    const r = buildIdListClause('b.facility_id', facilityIds, idx);
    if (r) {
      clauses.push(r.clause);
      params.push(...r.params);
      idx = r.nextParamIdx;
    }
  }

  if (applySport) {
    const r = buildIdListClause('b.sport_type_id', sportTypeIds, idx);
    if (r) {
      clauses.push(r.clause);
      params.push(...r.params);
      idx = r.nextParamIdx;
    }
  }

  if (applyPayment) {
    const r = buildIdListClause('b.payment_method_id', paymentMethodIds, idx);
    if (r) {
      clauses.push(r.clause);
      params.push(...r.params);
      idx = r.nextParamIdx;
    }
  }

  return { clauses, params, nextParamIdx: idx };
}

/**
 * Text-value counterpart to buildIdListClause — for filtering against derived
 * string columns (e.g. a normalized account_type/bank_name) rather than
 * numeric ids. Matching is case-insensitive; the literal token 'null'
 * (case-insensitive) means "IS NULL", same convention as buildIdListClause.
 *
 * @param {string}   column    - SQL column/expression, e.g. 'am.account_type'
 * @param {string[]|null} tokens - output of parseIdList, or null
 * @param {number}   paramIdx  - next available $N placeholder index
 * @returns {{ clause: string, params: any[], nextParamIdx: number }|null}
 */
function buildTextListClause(column, tokens, paramIdx) {
  if (!tokens) return null;

  const values = tokens
    .filter((t) => t.toLowerCase() !== 'null')
    .map((t) => t.toLowerCase());

  const wantsNull = tokens.some((t) => t.toLowerCase() === 'null');

  const parts = [];
  const params = [];
  let idx = paramIdx;

  if (values.length) {
    parts.push(`LOWER(${column}) = ANY($${idx++}::text[])`);
    params.push(values);
  }
  if (wantsNull) {
    parts.push(`${column} IS NULL`);
  }

  if (!parts.length) return null;

  return {
    clause: `(${parts.join(' OR ')})`,
    params,
    nextParamIdx: idx,
  };
}

// Immediately preceding period of equal length, e.g. [Jul 1, Jul 31] (31
// days) -> [May 31, Jun 30]. Null when either bound is missing — an
// open-ended range has no well-defined "previous period" to compare against.
// Shared by every dashboard service that offers a "vs previous period" KPI
// or row-level comparison (bookings, investors, expenses).
function getPreviousPeriodRange(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const spanMs = end.getTime() - start.getTime();
  if (Number.isNaN(spanMs) || spanMs < 0) return null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const prevEnd = new Date(start.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - spanMs);

  // A range starting at the very beginning of the calendar pushes the
  // previous period before year 1, which toISOString renders as an expanded
  // year ("-000001-12-...") that Postgres rejects as a date. Nothing sensible
  // to compare against there, so report no previous period rather than
  // handing the driver a value it will 500 on.
  if (prevStart.getUTCFullYear() < 1 || Number.isNaN(prevStart.getTime())) return null;

  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  };
}

// Percent change from `prev` to `curr`, one decimal. Null (rather than
// Infinity or a misleading 100%) when there's nothing to compare against.
function pctChange(curr, prev) {
  const c = Number(curr);
  const p = Number(prev);
  if (!p) return null;
  return Math.round(((c - p) / p) * 1000) / 10;
}

module.exports = {
  parseIdList,
  buildIdListClause,
  buildTextListClause,
  buildFilterClauses,
  getPreviousPeriodRange,
  pctChange,
};
