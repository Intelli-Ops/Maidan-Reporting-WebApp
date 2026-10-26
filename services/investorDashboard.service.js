'use strict';

const pool = require('../db/pool');
const { buildInvestorScope } = require('./investorDashboard.filters');
const { buildIdListClause, getPreviousPeriodRange, pctChange } = require('./dashboard.filters');

// ---------------------------------------------------------------------------
// 1. KPI totals
//    Metrics: Total Investment, Total Amount Disbursed (+ %), Remaining Liability
//    Facility/investor/status filters apply; investment & remaining-liability
//    are always current-state (all-time), disbursed amount respects the date
//    range if given.
//
//    Only total_amount_disbursed gets a `comparison` block — it's the only
//    field here that's actually windowed by the date range. total_investment
//    and remaining_liability are running, all-time balances (see meta.notes
//    .snapshotVsWindowed in the controller); a "vs previous period" figure
//    for a running balance would be nonsensical, so those intentionally get
//    no comparison rather than a misleading one.
// ---------------------------------------------------------------------------
async function runKpis(filters) {
  const { cte, params } = buildInvestorScope(filters);

  const sql = `
    ${cte}
    SELECT
      COALESCE(SUM(investment_amount),   0)::numeric(14,2) AS total_investment,
      COALESCE(SUM(disbursed_in_range),  0)::numeric(14,2) AS total_amount_disbursed,
      ROUND(
        COALESCE(SUM(disbursed_in_range), 0)
        / NULLIF(SUM(investment_amount), 0) * 100
      , 2)                                                  AS disbursed_pct,
      COALESCE(SUM(pending_amount),      0)::numeric(14,2) AS remaining_liability
    FROM fi_scope
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

async function getKpis(filters) {
  const current = await runKpis(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return { ...current, comparison: null };
  }

  const previous = await runKpis({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });

  return {
    ...current,
    comparison: {
      startDate: prevRange.startDate,
      endDate: prevRange.endDate,
      total_amount_disbursed_change_pct: pctChange(current.total_amount_disbursed, previous.total_amount_disbursed),
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Highest pending investor
//    Investor with the largest remaining (pending) liability across their
//    matching stakes.
// ---------------------------------------------------------------------------
async function getHighestPendingInvestor(filters) {
  const { cte, params } = buildInvestorScope(filters);

  const sql = `
    ${cte}
    SELECT
      i.id                                       AS investor_id,
      i.name                                      AS investor_name,
      SUM(fs.pending_amount)::numeric(14,2)      AS pending_amount
    FROM fi_scope fs
    JOIN investors i ON i.id = fs.investor_id
    GROUP BY i.id, i.name
    ORDER BY pending_amount DESC NULLS LAST
    LIMIT 1
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// 3. Total profit generated, broken out by facility
//    Metric: Total Profit Generated ("filter out each facility so the
//    picture can be clear" — always show the per-facility breakdown, same
//    pattern as the booking dashboard's byFacility section).
//    Profit is a facility-level pool, not owned by a specific investor, so
//    this ignores investorId/status — only facility + date range apply.
// ---------------------------------------------------------------------------
async function runProfitByFacility(filters) {
  const { startDate, endDate, facilityIds } = filters;
  const params = [];
  let idx = 1;
  const clauses = [];

  if (startDate) {
    clauses.push(`mp.period_month >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    clauses.push(`mp.period_month <= $${idx++}`);
    params.push(endDate);
  }

  const facilityClause = buildIdListClause('mp.facility_id', facilityIds, idx);
  const onExtra = [];
  if (facilityClause) {
    onExtra.push(facilityClause.clause);
    params.push(...facilityClause.params);
    idx = facilityClause.nextParamIdx;
  }
  clauses.push(...onExtra);

  const onSql = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      f.id                                            AS facility_id,
      f.code                                           AS facility_code,
      f.name                                           AS facility_name,
      COALESCE(SUM(mp.profit_amount), 0)::numeric(14,2) AS total_profit
    FROM facilities f
    LEFT JOIN monthly_profit mp
      ON  mp.facility_id = f.id
      ${onSql}
    GROUP BY f.id, f.code, f.name
    ORDER BY f.id
  `;

  const { rows } = await pool.query(sql, params);
  const total = rows.reduce((sum, r) => sum + Number(r.total_profit), 0);
  return { total: Number(total.toFixed(2)), byFacility: rows };
}

// profit_amount is filtered by period_month range, so — unlike
// total_investment/remaining_liability above — this whole metric is a
// genuine period flow and a "vs previous period" comparison is meaningful
// both at the total level and per facility.
async function getProfitByFacility(filters) {
  const current = await runProfitByFacility(filters);

  const byFacilityWithShare = current.byFacility.map((r) => ({
    ...r,
    share_pct: current.total > 0 ? Number(((Number(r.total_profit) / current.total) * 100).toFixed(2)) : null,
  }));

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return { total: current.total, total_change_pct: null, byFacility: byFacilityWithShare.map((r) => ({ ...r, total_profit_change_pct: null })) };
  }

  const previous = await runProfitByFacility({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });
  const prevById = new Map(previous.byFacility.map((r) => [r.facility_id, r]));

  return {
    total: current.total,
    total_change_pct: pctChange(current.total, previous.total),
    byFacility: byFacilityWithShare.map((r) => ({
      ...r,
      total_profit_change_pct: pctChange(r.total_profit, prevById.get(r.facility_id)?.total_profit),
    })),
  };
}

// ---------------------------------------------------------------------------
// 4. Monthly disbursement trend
//    Metric: Monthly Disbursement Trend
//    Grouped by period_month across all disbursements belonging to
//    facility_investor stakes in scope; date range restricts which months
//    are returned (this is a windowed chart, unlike the snapshot KPIs).
// ---------------------------------------------------------------------------
async function getMonthlyDisbursementTrend(filters) {
  const { cte, params, nextParamIdx } = buildInvestorScope(filters);
  const { startDate, endDate } = filters;

  const extra = [];
  let idx = nextParamIdx;
  const extraParams = [];
  if (startDate) {
    extra.push(`d.period_month >= $${idx++}`);
    extraParams.push(startDate);
  }
  if (endDate) {
    extra.push(`d.period_month <= $${idx++}`);
    extraParams.push(endDate);
  }
  const whereSql = extra.length ? `WHERE ${extra.join(' AND ')}` : '';

  const sql = `
    ${cte}
    SELECT
      d.period_month,
      COALESCE(SUM(d.disbursed_amount), 0)::numeric(14,2) AS disbursed_amount
    FROM disbursements d
    JOIN fi_scope fs ON fs.facility_investor_id = d.facility_investor_id
    ${whereSql}
    GROUP BY d.period_month
    ORDER BY d.period_month
  `;

  const { rows } = await pool.query(sql, [...params, ...extraParams]);
  return rows;
}

// ---------------------------------------------------------------------------
// 5. Profit vs disbursement trend
//    Metric: Profit vs Disbursement Trend
//    Profit side scoped by facility + date range only (see getProfitByFacility);
//    disbursement side scoped by the full fi_scope (facility/investor/status).
// ---------------------------------------------------------------------------
async function getProfitVsDisbursementTrend(filters) {
  const { cte, params, nextParamIdx } = buildInvestorScope(filters);
  const { startDate, endDate, facilityIds } = filters;

  let idx = nextParamIdx;
  const extraParams = [];
  const profitClauses = [];
  if (startDate) {
    profitClauses.push(`mp.period_month >= $${idx++}`);
    extraParams.push(startDate);
  }
  if (endDate) {
    profitClauses.push(`mp.period_month <= $${idx++}`);
    extraParams.push(endDate);
  }
  const facilityClause = buildIdListClause('mp.facility_id', facilityIds, idx);
  if (facilityClause) {
    profitClauses.push(facilityClause.clause);
    extraParams.push(...facilityClause.params);
    idx = facilityClause.nextParamIdx;
  }
  const profitWhere = profitClauses.length ? `WHERE ${profitClauses.join(' AND ')}` : '';

  const disbClauses = [];
  if (startDate) {
    disbClauses.push(`d.period_month >= $${idx++}`);
    extraParams.push(startDate);
  }
  if (endDate) {
    disbClauses.push(`d.period_month <= $${idx++}`);
    extraParams.push(endDate);
  }
  const disbWhere = disbClauses.length ? `WHERE ${disbClauses.join(' AND ')}` : '';

  const sql = `
    ${cte},
    profit AS (
      SELECT mp.period_month, SUM(mp.profit_amount) AS profit_amount
      FROM monthly_profit mp
      ${profitWhere}
      GROUP BY mp.period_month
    ),
    disb AS (
      SELECT d.period_month, SUM(d.disbursed_amount) AS disbursed_amount
      FROM disbursements d
      JOIN fi_scope fs ON fs.facility_investor_id = d.facility_investor_id
      ${disbWhere}
      GROUP BY d.period_month
    )
    SELECT
      COALESCE(p.period_month, di.period_month)              AS period_month,
      COALESCE(p.profit_amount, 0)::numeric(14,2)             AS profit_amount,
      COALESCE(di.disbursed_amount, 0)::numeric(14,2)         AS disbursed_amount
    FROM profit p
    FULL OUTER JOIN disb di ON di.period_month = p.period_month
    ORDER BY period_month
  `;

  const { rows } = await pool.query(sql, [...params, ...extraParams]);
  return rows;
}

// ---------------------------------------------------------------------------
// 6. Remaining liability trend
//    Metric: Remaining Liability Trend
//    Cumulative disbursed is computed over FULL history (window function,
//    unrestricted by date range) so the running total is always correct;
//    the date range only limits which period rows are returned, not which
//    disbursements count toward the cumulative sum.
// ---------------------------------------------------------------------------
async function getRemainingLiabilityTrend(filters) {
  const { cte, params, nextParamIdx } = buildInvestorScope(filters);
  const { startDate, endDate } = filters;

  let idx = nextParamIdx;
  const extraParams = [];
  const displayClauses = [];
  if (startDate) {
    displayClauses.push(`period_month >= $${idx++}`);
    extraParams.push(startDate);
  }
  if (endDate) {
    displayClauses.push(`period_month <= $${idx++}`);
    extraParams.push(endDate);
  }
  const displayWhere = displayClauses.length ? `WHERE ${displayClauses.join(' AND ')}` : '';

  const sql = `
    ${cte},
    scope_totals AS (
      SELECT COALESCE(SUM(investment_amount), 0) AS total_investment FROM fi_scope
    ),
    monthly_disb AS (
      SELECT d.period_month, SUM(d.disbursed_amount) AS disbursed_amount
      FROM disbursements d
      JOIN fi_scope fs ON fs.facility_investor_id = d.facility_investor_id
      GROUP BY d.period_month
    ),
    cumulative AS (
      SELECT
        period_month,
        disbursed_amount,
        SUM(disbursed_amount) OVER (ORDER BY period_month) AS cumulative_disbursed
      FROM monthly_disb
    )
    SELECT
      c.period_month,
      c.cumulative_disbursed::numeric(14,2)                        AS cumulative_disbursed,
      (st.total_investment - c.cumulative_disbursed)::numeric(14,2) AS remaining_liability
    FROM cumulative c
    CROSS JOIN scope_totals st
    ${displayWhere}
    ORDER BY c.period_month
  `;

  const { rows } = await pool.query(sql, [...params, ...extraParams]);
  return rows;
}

// ---------------------------------------------------------------------------
// 7. Facility comparison
//    Metrics: Facility Comparison, Investment by Facility, Pending Liability
//    by Facility — one row per facility with investment/profit/pending/
//    completion %, all views frontend needs are columns of the same row.
// ---------------------------------------------------------------------------
async function runFacilityComparison(filters) {
  // facilityIds deliberately dropped: this is a COMPARISON, so it always
  // reports every facility — the same rule the bookings dashboard's
  // byFacility/discountBurdenByFacility sections follow, and what the card's
  // "All facilities" badge promises. Keeping the filter listed all three
  // facilities but zeroed the values of the ones filtered out, which reads as
  // "Emaar earned nothing" rather than "Emaar is filtered out".
  const { cte, params } = buildInvestorScope({ ...filters, facilityIds: [] });

  // No date clauses either. Every column here is a lifetime position — what
  // was put in, earned, paid back, and what remains — and the Investors tab
  // that renders it has no date filter at all. Windowing only profit and
  // disbursed produced rows that did not add up, with a windowed Disbursed
  // sitting beside an all-time Pending. With neither filter applied the
  // profit subquery needs no WHERE clause and no extra bind parameters.
  const profitWhere = '';

  const sql = `
    ${cte},
    agg AS (
      SELECT
        facility_id,
        SUM(investment_amount)   AS investment_amount,
        SUM(disbursed_all_time)  AS disbursed_amount,
        SUM(pending_amount)      AS pending_amount
      FROM fi_scope
      GROUP BY facility_id
    ),
    profit AS (
      SELECT mp.facility_id, SUM(mp.profit_amount) AS profit_amount
      FROM monthly_profit mp
      ${profitWhere}
      GROUP BY mp.facility_id
    )
    SELECT
      f.id                                                  AS facility_id,
      f.code                                                AS facility_code,
      f.name                                                AS facility_name,
      COALESCE(a.investment_amount, 0)::numeric(14,2)      AS investment_amount,
      COALESCE(p.profit_amount, 0)::numeric(14,2)          AS profit_amount,
      COALESCE(a.disbursed_amount, 0)::numeric(14,2)       AS disbursed_amount,
      COALESCE(a.pending_amount, 0)::numeric(14,2)         AS pending_amount,
      ROUND(
        COALESCE(a.disbursed_amount, 0) / NULLIF(a.investment_amount, 0) * 100
      , 2)                                                   AS completion_pct
    FROM facilities f
    LEFT JOIN agg a ON a.facility_id = f.id
    LEFT JOIN profit p ON p.facility_id = f.id
    ORDER BY f.id
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Every column is all-time, so there is no "previous period" to compare
// against and no change field is returned. The section used to run a second
// query over the preceding window purely to produce those percentages; with
// the date filter gone from the Investors tab, that query was comparing a
// lifetime total against itself.
async function getFacilityComparison(filters) {
  return runFacilityComparison(filters);
}

// ---------------------------------------------------------------------------
// 8. Investor summary
//    Metrics: Pending Amount per Investor, Completion Percentage per Investor
//    Aggregated across all of an investor's matching facility stakes (an
//    investor active at multiple facilities gets one combined row); status
//    is recomputed on the combined totals since a per-facility status can
//    differ from the investor's overall status.
// ---------------------------------------------------------------------------
async function getInvestorSummary(filters) {
  const { cte, params } = buildInvestorScope(filters);

  const sql = `
    ${cte}
    SELECT
      i.id                                                   AS investor_id,
      i.name                                                 AS investor_name,
      SUM(fs.investment_amount)::numeric(14,2)               AS investment_amount,
      SUM(fs.disbursed_all_time)::numeric(14,2)              AS disbursed_amount,
      SUM(fs.pending_amount)::numeric(14,2)                  AS pending_amount,
      ROUND(
        SUM(fs.disbursed_all_time) / NULLIF(SUM(fs.investment_amount), 0) * 100
      , 2)                                                    AS completion_pct,
      -- COALESCE, not a bare comparison: investment_amount is nullable, and
      -- SQL's NULL <= 0 is unknown rather than true, so a party with no
      -- recorded investment (the house's own profit share) fell through every
      -- branch and was labelled "Partially Disbursed" as if it were an
      -- investor awaiting repayment.
      CASE
        WHEN COALESCE(SUM(fs.investment_amount), 0) <= 0 THEN NULL
        WHEN SUM(fs.disbursed_all_time) >= SUM(fs.investment_amount) THEN 'Completed'
        WHEN SUM(fs.disbursed_all_time) <= 0 THEN 'Pending'
        ELSE 'Partially Disbursed'
      END                                                     AS status
    FROM fi_scope fs
    JOIN investors i ON i.id = fs.investor_id
    GROUP BY i.id, i.name
    ORDER BY pending_amount DESC NULLS LAST
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// ---------------------------------------------------------------------------
// 9. Forecast
//    Metrics: Estimated Completion Time, Required Monthly Profit,
//    Target Completion Calculator, Expected Completion Date — one combined
//    calculation. avgMonthlyDisbursement is the mean of the `trailingMonths`
//    most recent months with disbursement activity in scope; the
//    target-based figures use `targetMonths` (caller-supplied, e.g. from a
//    "finish in N months" calculator input) and assume the facility's future
//    monthly profit is split pro-rata across investors by ownership_percentage.
// ---------------------------------------------------------------------------
async function getForecast(filters, { targetMonths, trailingMonths }) {
  const { cte, params, nextParamIdx } = buildInvestorScope(filters);
  const idx = nextParamIdx;

  const sql = `
    ${cte},
    monthly_disb AS (
      SELECT d.period_month, SUM(d.disbursed_amount) AS disbursed_amount
      FROM disbursements d
      JOIN fi_scope fs ON fs.facility_investor_id = d.facility_investor_id
      GROUP BY d.period_month
      ORDER BY d.period_month DESC
      LIMIT $${idx}
    ),
    scope_totals AS (
      SELECT
        COALESCE(SUM(investment_amount), 0)      AS total_investment,
        COALESCE(SUM(pending_amount), 0)         AS remaining_liability,
        COALESCE(SUM(ownership_percentage), 0)   AS total_ownership_pct,
        COUNT(DISTINCT facility_id)              AS facility_count
      FROM fi_scope
    )
    SELECT
      (SELECT COALESCE(AVG(disbursed_amount), 0) FROM monthly_disb)::numeric(14,2) AS avg_monthly_disbursement,
      st.remaining_liability::numeric(14,2)                                       AS remaining_liability,
      st.total_ownership_pct::numeric(8,4)                                        AS total_ownership_pct,
      st.facility_count                                                           AS facility_count
    FROM scope_totals st
  `;

  const { rows } = await pool.query(sql, [...params, trailingMonths]);
  const row = rows[0];

  const avgMonthlyDisbursement = Number(row.avg_monthly_disbursement);
  const remainingLiability = Number(row.remaining_liability);
  const totalOwnershipPct = Number(row.total_ownership_pct);

  const estimatedMonthsRemaining =
    avgMonthlyDisbursement > 0 ? Number((remainingLiability / avgMonthlyDisbursement).toFixed(2)) : null;

  let expectedCompletionDate = null;
  if (estimatedMonthsRemaining !== null) {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.ceil(estimatedMonthsRemaining));
    expectedCompletionDate = d.toISOString().slice(0, 10);
  }

  // ownership_percentage is a per-facility fraction (0.5697 = 56.97% of that
  // facility's profit) and sums to 1.0 within each facility — so summing it
  // across N facilities in scope yields N, not a meaningful share. Dividing by
  // that raw sum understated the answer by exactly the facility count (3x on
  // the unfiltered dashboard). The average ownership share per facility is
  // what converts "rupees owed to investors" into "profit the facilities must
  // earn": if investors collectively take 100% of profit, the facilities must
  // earn the full amount owed.
  const facilityCount = Number(row.facility_count);
  const avgOwnershipShare = facilityCount > 0 ? totalOwnershipPct / facilityCount : 0;

  const requiredMonthlyProfitForTarget =
    avgOwnershipShare > 0
      ? Number((remainingLiability / targetMonths / avgOwnershipShare).toFixed(2))
      : null;

  return {
    avgMonthlyDisbursement,
    remainingLiability,
    estimatedMonthsRemaining,
    expectedCompletionDate,
    trailingMonths,
    targetMonths,
    requiredMonthlyProfitForTarget,
  };
}

module.exports = {
  getKpis,
  getHighestPendingInvestor,
  getProfitByFacility,
  getMonthlyDisbursementTrend,
  getProfitVsDisbursementTrend,
  getRemainingLiabilityTrend,
  getFacilityComparison,
  getInvestorSummary,
  getForecast,
};
