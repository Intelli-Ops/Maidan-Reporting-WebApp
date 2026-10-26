'use strict';

const { buildIdListClause, buildTextListClause } = require('./dashboard.filters');

// ---------------------------------------------------------------------------
// source_account is free text from the import pipeline, not a lookup table.
// Live data has exactly these 11 distinct non-null raw values, each encoding
// an account (Air Field / Maidan Core) and sometimes a bank prefix (e.g.
// 'BAHL Airfield' = Bank Al Habib + Air Field). This is an EXACT-MATCH map,
// not a substring/regex guess — an unrecognized raw value (e.g. a new one
// introduced by a future import) surfaces as account_type/bank_name = NULL
// ("Unmapped") instead of being silently misclassified. Extend this list if
// new raw values show up.
//
// Rows with source_account IS NULL are all-cash entries with no linked
// account (326 of 1195 rows) — they stay NULL/NULL, which is what the
// account_type / bank_name filters' 'null' token targets.
// ---------------------------------------------------------------------------
const ACCOUNT_MAP = [
  { raw: 'Air Field', accountType: 'Air Field', bankName: null },
  { raw: 'Maidan Core', accountType: 'Maidan Core', bankName: null },
  { raw: 'BAHL Airfield', accountType: 'Air Field', bankName: 'Bank Al Habib' },
  { raw: 'BAHL Maidan Core', accountType: 'Maidan Core', bankName: 'Bank Al Habib' },
  { raw: 'Faysal Core', accountType: 'Maidan Core', bankName: 'Faysal Bank' },
  { raw: 'Faysal Airfield', accountType: 'Air Field', bankName: 'Faysal Bank' },
  { raw: 'DIB Maidan Core', accountType: 'Maidan Core', bankName: 'Dubai Islamic' },
  { raw: 'Meezan Airfield', accountType: 'Air Field', bankName: 'Meezan Bank' },
  { raw: 'Meezan Maidan Core', accountType: 'Maidan Core', bankName: 'Meezan Bank' },
  { raw: 'UBL Maidan Core', accountType: 'Maidan Core', bankName: 'United Bank Limited' },
  { raw: 'Bank Alfalah Maidan Core', accountType: 'Maidan Core', bankName: 'Bank Al Falah' },
];

// Builds a literal SQL VALUES list for ACCOUNT_MAP. Safe to inline directly
// (not parameterized) because ACCOUNT_MAP is a fixed in-code constant, never
// user input.
function accountMapValuesSql() {
  const esc = (s) => s.replace(/'/g, "''");
  return ACCOUNT_MAP.map(
    (m) => `('${esc(m.raw)}', '${esc(m.accountType)}', ${m.bankName ? `'${esc(m.bankName)}'` : 'NULL'})`
  ).join(',\n        ');
}

/**
 * Builds the `expense_scope` CTE chain every expense-dashboard query runs on
 * top of: one row per expense, joined to its normalized account_type/bank
 * (see ACCOUNT_MAP above), its payment method name, and its top-level
 * category id — with every filter applied once here so it cascades
 * identically into every downstream metric.
 *
 * Category/subcategory semantics: in the live data every expense is recorded
 * against a leaf (sub)category, never a parent — so `categoryIds` rolls up
 * to include all children of the requested id(s) automatically, while
 * `subcategoryIds` (if given) narrows to an exact leaf match, ANDed with the
 * category rollup.
 *
 * @param {object} filters
 * @param {object} opts
 * @param {boolean} [opts.applyFacility=true]  - set false for "always all facilities" sections
 * @param {boolean} [opts.applyCategory=true]   - set false for "always all categories" sections
 */
function buildExpenseScope(filters, opts = {}) {
  const { applyFacility = true, applyCategory = true } = opts;

  const {
    startDate,
    endDate,
    facilityIds,
    categoryIds,
    subcategoryIds,
    paymentMethodIds,
    accountTypes,
    bankNames,
  } = filters;

  const clauses = [];
  const params = [];
  let idx = 1;

  if (startDate) {
    clauses.push(`e.expense_date >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    clauses.push(`e.expense_date <= $${idx++}`);
    params.push(endDate);
  }

  if (applyFacility) {
    const r = buildIdListClause('e.facility_id', facilityIds, idx);
    if (r) {
      clauses.push(r.clause);
      params.push(...r.params);
      idx = r.nextParamIdx;
    }
  }

  if (applyCategory) {
    if (categoryIds) {
      const nums = categoryIds.map((t) => parseInt(t, 10)).filter((n) => !Number.isNaN(n));
      if (nums.length) {
        clauses.push(
          `e.expense_category_id IN (
            SELECT id FROM expense_categories
            WHERE id = ANY($${idx}::int[]) OR parent_category_id = ANY($${idx}::int[])
          )`
        );
        params.push(nums);
        idx++;
      }
    }

    const subR = buildIdListClause('e.expense_category_id', subcategoryIds, idx);
    if (subR) {
      clauses.push(subR.clause);
      params.push(...subR.params);
      idx = subR.nextParamIdx;
    }
  }

  const payR = buildIdListClause('e.payment_method_id', paymentMethodIds, idx);
  if (payR) {
    clauses.push(payR.clause);
    params.push(...payR.params);
    idx = payR.nextParamIdx;
  }

  const acctTypeR = buildTextListClause('am.account_type', accountTypes, idx);
  if (acctTypeR) {
    clauses.push(acctTypeR.clause);
    params.push(...acctTypeR.params);
    idx = acctTypeR.nextParamIdx;
  }

  const bankR = buildTextListClause('COALESCE(e.source_bank, am.bank_name)', bankNames, idx);
  if (bankR) {
    clauses.push(bankR.clause);
    params.push(...bankR.params);
    idx = bankR.nextParamIdx;
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const cte = `
    WITH account_map(raw, account_type, bank_name) AS (
      VALUES
        ${accountMapValuesSql()}
    ),
    expense_scope AS (
      SELECT
        e.id,
        e.facility_id,
        e.expense_category_id,
        COALESCE(c.parent_category_id, c.id)   AS top_category_id,
        e.expense_date,
        e.item,
        e.amount,
        e.payment_method_id,
        pm.name                                 AS payment_method_name,
        e.cheque_number,
        e.source_account,
        am.account_type,
        COALESCE(e.source_bank, am.bank_name)   AS bank_name
      FROM expenses e
      JOIN expense_categories c ON c.id = e.expense_category_id
      LEFT JOIN account_map am ON am.raw = e.source_account
      LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
      ${whereSql}
    )
  `;

  return { cte, params, nextParamIdx: idx };
}

/**
 * Derives the valid accountType/bankName filter values from ACCOUNT_MAP, plus
 * the full raw-value mapping, so the frontend can populate the source
 * account/bank filter dropdowns without hardcoding the mapping itself.
 */
function getAccountReferenceData() {
  const accountTypes = [...new Set(ACCOUNT_MAP.map((m) => m.accountType))];
  const bankNames = [...new Set(ACCOUNT_MAP.filter((m) => m.bankName).map((m) => m.bankName))].sort();

  return {
    accountTypes,
    bankNames,
    mapping: ACCOUNT_MAP,
  };
}

module.exports = { buildExpenseScope, ACCOUNT_MAP, getAccountReferenceData };
