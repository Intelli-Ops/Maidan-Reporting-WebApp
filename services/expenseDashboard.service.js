'use strict';

const pool = require('../db/pool');
const { buildExpenseScope } = require('./expenseDashboard.filters');
const { getPreviousPeriodRange, pctChange } = require('./dashboard.filters');

// ---------------------------------------------------------------------------
// Date-math helpers for getDelta — all in UTC calendar days (expense_date is
// a DATE column with no time component) so period-length math never drifts
// across a DST boundary.
// ---------------------------------------------------------------------------
function toISODate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function diffDaysISO(aStr, bStr) {
  const a = new Date(`${aStr}T00:00:00Z`);
  const b = new Date(`${bStr}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

// ---------------------------------------------------------------------------
// 1. KPI totals
//    Metrics: #1 Total expense amount, #2 Total transactions,
//             #3 Cash vs cheque/bank split
//    All filters apply.
// ---------------------------------------------------------------------------
async function runKpiTotals(filters) {
  const { cte, params } = buildExpenseScope(filters);

  const sql = `
    ${cte},
    totals AS (
      SELECT
        COUNT(*)::integer                                                              AS total_transactions,
        COALESCE(SUM(amount), 0)::numeric(14,2)                                        AS total_expense_amount,
        COALESCE(SUM(amount) FILTER (WHERE LOWER(payment_method_name) = 'cash'), 0)::numeric(14,2) AS cash_amount
      FROM expense_scope
    )
    SELECT
      total_transactions,
      total_expense_amount,
      cash_amount,
      (total_expense_amount - cash_amount)::numeric(14,2)                              AS non_cash_amount,
      ROUND(cash_amount / NULLIF(total_expense_amount, 0) * 100, 2)                     AS cash_pct,
      ROUND((total_expense_amount - cash_amount) / NULLIF(total_expense_amount, 0) * 100, 2) AS non_cash_pct
    FROM totals
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

// total_transactions/cash_pct/non_cash_pct comparison — separate from
// getDelta below, which already covers total_expense_amount specifically
// (with its own "default to trailing 30 days" fallback for the top KPI
// card). This uses the plain getPreviousPeriodRange convention instead
// (null when the caller hasn't given a bounded range), matching Bookings/
// Investors. cash_pct/non_cash_pct are already percentages, so their delta
// is reported in percentage points, not a relative %.
async function getKpis(filters) {
  const current = await runKpiTotals(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return { ...current, comparison: null };
  }

  const previous = await runKpiTotals({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });

  const ppChange = (curr, prev) => {
    if (curr == null || prev == null) return null;
    return Math.round((Number(curr) - Number(prev)) * 10) / 10;
  };

  return {
    ...current,
    comparison: {
      startDate: prevRange.startDate,
      endDate: prevRange.endDate,
      total_transactions_change_pct: pctChange(current.total_transactions, previous.total_transactions),
      cash_pct_change_pp: ppChange(current.cash_pct, previous.cash_pct),
      non_cash_pct_change_pp: ppChange(current.non_cash_pct, previous.non_cash_pct),
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Expense + transactions by facility (snapshot)
//    Metrics: #4 Top facility by expense, #6 Facility share,
//             Facility Performance #1 (KMC vs Emaar vs Malir Cantt)
//    applyFacility: FALSE — always shows all 3 facilities (spec requirement;
//    the card is only meaningful in the "All facilities" view).
//    NOTE: weekly expense-limit-remaining was requested in the spec but there
//    is no budget/limit value anywhere in the schema, so it is intentionally
//    omitted here (see controller meta.notes).
// ---------------------------------------------------------------------------
async function runByFacility(filters) {
  const { cte, params } = buildExpenseScope(filters, { applyFacility: false });

  const sql = `
    ${cte},
    agg AS (
      SELECT
        f.id                                                AS facility_id,
        f.code                                               AS facility_code,
        f.name                                                AS facility_name,
        COUNT(es.id)::integer                                  AS expense_count,
        COALESCE(SUM(es.amount), 0)::numeric(14,2)              AS total_amount
      FROM facilities f
      LEFT JOIN expense_scope es ON es.facility_id = f.id
      GROUP BY f.id, f.code, f.name
    )
    SELECT
      facility_id,
      facility_code,
      facility_name,
      expense_count,
      total_amount,
      ROUND(total_amount / NULLIF(SUM(total_amount) OVER (), 0) * 100, 2) AS share_pct
    FROM agg
    ORDER BY facility_id
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Adds a per-row total_amount_change_pct vs the immediately preceding
// period of equal length — null when the caller hasn't given a bounded
// [startDate, endDate] to mirror (independent of getDelta's own "default to
// trailing 30 days" behavior below, which only feeds the single aggregate
// KPI delta, not this per-facility breakdown).
async function getByFacility(filters) {
  const rows = await runByFacility(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return rows.map((r) => ({ ...r, total_amount_change_pct: null }));
  }

  const prevRows = await runByFacility({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });
  const prevById = new Map(prevRows.map((r) => [r.facility_id, r]));

  return rows.map((r) => ({
    ...r,
    total_amount_change_pct: pctChange(r.total_amount, prevById.get(r.facility_id)?.total_amount),
  }));
}

// ---------------------------------------------------------------------------
// 3. Delta information (period-over-period movement)
//    Metric: #5
//    v1 heuristic (documented in controller meta.notes): compares the
//    requested [startDate, endDate] window (all other filters still apply)
//    against the immediately preceding window of equal length — this
//    generalizes both week-over-week and month-over-month depending on the
//    length of range the caller passes, without guessing calendar-week vs
//    calendar-month semantics. If no date range is given, defaults to a
//    trailing 30-day window ending on the latest expense_date in the table.
// ---------------------------------------------------------------------------
async function getDelta(filters) {
  let { startDate, endDate } = filters;

  if (!endDate) {
    const { rows } = await pool.query('SELECT MAX(expense_date) AS max_date FROM expenses');
    endDate = rows[0].max_date ? toISODate(rows[0].max_date) : toISODate(new Date());
  }
  if (!startDate) {
    startDate = addDaysISO(endDate, -29);
  }

  const lengthDays = diffDaysISO(endDate, startDate) + 1;
  const prevEnd = addDaysISO(startDate, -1);
  const prevStart = addDaysISO(prevEnd, -(lengthDays - 1));

  const periodTotals = async (periodStart, periodEnd) => {
    const { cte, params } = buildExpenseScope({ ...filters, startDate: periodStart, endDate: periodEnd });
    const sql = `
      ${cte}
      SELECT
        COUNT(*)::integer                             AS total_transactions,
        COALESCE(SUM(amount), 0)::numeric(14,2)        AS total_amount
      FROM expense_scope
    `;
    const { rows } = await pool.query(sql, params);
    return rows[0];
  };

  const [current, previous] = await Promise.all([
    periodTotals(startDate, endDate),
    periodTotals(prevStart, prevEnd),
  ]);

  const currentAmount = Number(current.total_amount);
  const previousAmount = Number(previous.total_amount);
  const deltaAmount = Number((currentAmount - previousAmount).toFixed(2));
  const deltaPct = previousAmount !== 0 ? Number(((deltaAmount / previousAmount) * 100).toFixed(2)) : null;

  return {
    currentPeriod: { startDate, endDate, totalAmount: currentAmount, totalTransactions: current.total_transactions },
    previousPeriod: { startDate: prevStart, endDate: prevEnd, totalAmount: previousAmount, totalTransactions: previous.total_transactions },
    deltaAmount,
    deltaPct,
  };
}

// ---------------------------------------------------------------------------
// 4. Expense trend over time
//    Metric: Trend Chart #1 — weekly and monthly only (daily intentionally
//    not supported per spec note).
//    All filters apply.
// ---------------------------------------------------------------------------
async function getExpenseTrend(filters, granularity) {
  const safe = granularity === 'monthly' ? 'monthly' : 'weekly';
  const periodExpr = safe === 'monthly'
    ? "date_trunc('month', es.expense_date)::date"
    : "date_trunc('week', es.expense_date)::date";

  const { cte, params } = buildExpenseScope(filters);

  const sql = `
    ${cte}
    SELECT
      ${periodExpr}                                    AS period,
      COUNT(*)::integer                                  AS expense_count,
      COALESCE(SUM(es.amount), 0)::numeric(14,2)           AS total_amount
    FROM expense_scope es
    GROUP BY period
    ORDER BY period
  `;

  const { rows } = await pool.query(sql, params);
  return { granularity: safe, rows };
}

// ---------------------------------------------------------------------------
// 5. Expense by payment method
//    Metric: Payment & Account #1
//    All filters apply.
// ---------------------------------------------------------------------------
async function runByPaymentMethod(filters) {
  const { cte, params } = buildExpenseScope(filters);

  const sql = `
    ${cte}
    SELECT
      COALESCE(es.payment_method_id, 0)                AS payment_method_id,
      COALESCE(es.payment_method_name, 'Unspecified')    AS payment_method_name,
      COUNT(*)::integer                                    AS expense_count,
      COALESCE(SUM(es.amount), 0)::numeric(14,2)             AS total_amount
    FROM expense_scope es
    GROUP BY es.payment_method_id, es.payment_method_name
    ORDER BY total_amount DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

async function getByPaymentMethod(filters) {
  const rows = await runByPaymentMethod(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return rows.map((r) => ({ ...r, total_amount_change_pct: null }));
  }

  const prevRows = await runByPaymentMethod({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });
  const prevById = new Map(prevRows.map((r) => [r.payment_method_id, r]));

  return rows.map((r) => ({
    ...r,
    total_amount_change_pct: pctChange(r.total_amount, prevById.get(r.payment_method_id)?.total_amount),
  }));
}

// ---------------------------------------------------------------------------
// 6. Expense + transactions by (top-level) category
//    Metric: Category Metrics #1 — baseline spend view.
//    Respects the category/subcategory filter (unlike #7 below); grouped at
//    the top-level-category rollup since every expense is recorded against a
//    leaf subcategory in practice.
// ---------------------------------------------------------------------------
async function runByCategory(filters) {
  const { cte, params } = buildExpenseScope(filters);

  const sql = `
    ${cte},
    agg AS (
      SELECT
        es.top_category_id,
        tc.name                                          AS category_name,
        COUNT(*)::integer                                   AS expense_count,
        COALESCE(SUM(es.amount), 0)::numeric(14,2)            AS total_amount
      FROM expense_scope es
      JOIN expense_categories tc ON tc.id = es.top_category_id
      GROUP BY es.top_category_id, tc.name
    )
    SELECT
      top_category_id,
      category_name,
      expense_count,
      total_amount,
      ROUND(total_amount / NULLIF(SUM(total_amount) OVER (), 0) * 100, 2) AS share_pct
    FROM agg
    ORDER BY total_amount DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

async function getByCategory(filters) {
  const rows = await runByCategory(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return rows.map((r) => ({ ...r, total_amount_change_pct: null }));
  }

  const prevRows = await runByCategory({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });
  const prevById = new Map(prevRows.map((r) => [r.top_category_id, r]));

  return rows.map((r) => ({
    ...r,
    total_amount_change_pct: pctChange(r.total_amount, prevById.get(r.top_category_id)?.total_amount),
  }));
}

// ---------------------------------------------------------------------------
// 7. Category share over time
//    Metric: Category Metrics #2
//    applyCategory: FALSE — always shows all top-level categories regardless
//    of the category/subcategory filter (spec requirement), still respects
//    date range + facility + payment/account filters.
//    v1 simplification (same pattern as the booking dashboard's
//    facilityShareOverTime): uses an inner JOIN, so a category with zero
//    expenses in a given period simply produces no row for that period
//    rather than an explicit zero.
// ---------------------------------------------------------------------------
async function getCategoryShareOverTime(filters, granularity) {
  const safe = granularity === 'monthly' ? 'monthly' : 'weekly';
  const periodExpr = safe === 'monthly'
    ? "date_trunc('month', es.expense_date)::date"
    : "date_trunc('week', es.expense_date)::date";

  const { cte, params } = buildExpenseScope(filters, { applyCategory: false });

  const sql = `
    ${cte},
    agg AS (
      SELECT
        ${periodExpr}                                    AS period,
        es.top_category_id,
        tc.name                                            AS category_name,
        COUNT(*)::integer                                    AS expense_count,
        COALESCE(SUM(es.amount), 0)::numeric(14,2)             AS total_amount
      FROM expense_scope es
      JOIN expense_categories tc ON tc.id = es.top_category_id
      GROUP BY period, es.top_category_id, tc.name
    )
    SELECT
      period,
      top_category_id,
      category_name,
      expense_count,
      total_amount,
      ROUND(total_amount / NULLIF(SUM(total_amount) OVER (PARTITION BY period), 0) * 100, 2) AS share_pct
    FROM agg
    ORDER BY period, top_category_id
  `;

  const { rows } = await pool.query(sql, params);
  return { granularity: safe, rows };
}

// ---------------------------------------------------------------------------
// 8. Like-for-like month comparison
//    Metric: Time Intelligence #1 — "every May vs every May"
//    Grouped by (month_number, year) so the frontend can plot one calendar
//    month's trend across consecutive years without a second round trip.
//    All filters apply.
// ---------------------------------------------------------------------------
async function getLikeForLikeMonth(filters) {
  const { cte, params } = buildExpenseScope(filters);

  const sql = `
    ${cte}
    SELECT
      EXTRACT(YEAR FROM es.expense_date)::integer       AS year,
      EXTRACT(MONTH FROM es.expense_date)::integer        AS month_number,
      TRIM(to_char(es.expense_date, 'Month'))               AS month_name,
      COUNT(*)::integer                                       AS expense_count,
      COALESCE(SUM(es.amount), 0)::numeric(14,2)                AS total_amount
    FROM expense_scope es
    GROUP BY 1, 2, 3
    ORDER BY month_number, year
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

module.exports = {
  getKpis,
  getByFacility,
  getDelta,
  getExpenseTrend,
  getByPaymentMethod,
  getByCategory,
  getCategoryShareOverTime,
  getLikeForLikeMonth,
};
