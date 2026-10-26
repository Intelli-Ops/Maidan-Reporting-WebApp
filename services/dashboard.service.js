'use strict';

const pool = require('../db/pool');
const { buildFilterClauses, getPreviousPeriodRange, pctChange } = require('./dashboard.filters');
const { normalizeCardType } = require('./cardType');

// ---------------------------------------------------------------------------
// Helper: build a WHERE or ON clause string from the clauses array
// ---------------------------------------------------------------------------
function toWhere(clauses) {
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

// ---------------------------------------------------------------------------
// 1. KPI totals
//    Metrics: #1 Total Bookings, #2 Cancellation Rate,
//             #12 Gross Amount, #13 Net Revenue, #14 Total Discount Given
//    All filters apply.
//
//    Also returns a `comparison` block against the immediately preceding
//    period of equal length (e.g. selected range Jul 1-31 -> compared
//    against Jun 1-30), so KPI cards can show real "vs previous period"
//    movement instead of a static number. Omitted (null) when the filter
//    has no bounded date range to mirror.
// ---------------------------------------------------------------------------
async function runKpiTotals(filters) {
  const { clauses, params } = buildFilterClauses(filters);
  const whereSql = toWhere(clauses);

  const sql = `
    SELECT
      COUNT(*)::integer                                                          AS total_bookings,
      COUNT(*) FILTER (WHERE b.status = 'Cancel')::integer                      AS cancelled_bookings,
      ROUND(
        COUNT(*) FILTER (WHERE b.status = 'Cancel')::numeric
        / NULLIF(COUNT(*), 0) * 100
      , 2)                                                                       AS cancellation_rate_pct,
      COALESCE(SUM(b.net_amount),      0)::numeric(14,2)                        AS total_net_revenue,
      COALESCE(SUM(b.gross_amount),    0)::numeric(14,2)                        AS total_gross_amount,
      COALESCE(SUM(b.discount_amount), 0)::numeric(14,2)                        AS total_discount_amount,
      COALESCE(SUM(b.duration_hours),  0)::numeric(10,2)                        AS total_hours
    FROM bookings b
    ${whereSql}
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

async function getKpis(filters) {
  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);

  const [current, previous] = await Promise.all([
    runKpiTotals(filters),
    prevRange ? runKpiTotals({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate }) : null,
  ]);

  if (!previous) {
    return { ...current, comparison: null };
  }

  return {
    ...current,
    comparison: {
      startDate: prevRange.startDate,
      endDate: prevRange.endDate,
      total_bookings_change_pct: pctChange(current.total_bookings, previous.total_bookings),
      total_net_revenue_change_pct: pctChange(current.total_net_revenue, previous.total_net_revenue),
      total_gross_amount_change_pct: pctChange(current.total_gross_amount, previous.total_gross_amount),
      total_discount_amount_change_pct: pctChange(current.total_discount_amount, previous.total_discount_amount),
      cancellation_rate_change_pct: pctChange(current.cancellation_rate_pct, previous.cancellation_rate_pct),
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Revenue trend over time
//    Metric: #3
//    granularity: 'daily' | 'weekly' | 'monthly'  (anything else → daily)
//    All filters apply.
// ---------------------------------------------------------------------------
async function getRevenueTrend(filters, granularity) {
  const VALID = { daily: true, weekly: true, monthly: true };
  const safe = VALID[granularity] ? granularity : 'daily';

  const periodExpr = {
    daily:   'b.booking_date',
    weekly:  "date_trunc('week',  b.booking_date)::date",
    monthly: "date_trunc('month', b.booking_date)::date",
  }[safe];

  const { clauses, params } = buildFilterClauses(filters);
  const whereSql = toWhere(clauses);

  const sql = `
    SELECT
      ${periodExpr}                                                AS period,
      COUNT(*)::integer                                            AS booking_count,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2)               AS net_revenue,
      COALESCE(SUM(b.discount_amount), 0)::numeric(14,2)          AS discount_amount
    FROM bookings b
    ${whereSql}
    GROUP BY period
    ORDER BY period
  `;

  const { rows } = await pool.query(sql, params);
  return { granularity: safe, rows };
}

// ---------------------------------------------------------------------------
// 3. Revenue heatmap (calendar grid — NOT hour-of-day; time_slot_raw is
//    unstructured text and is intentionally not used here)
//    Metric: #4
//    All filters apply.
// ---------------------------------------------------------------------------
async function getRevenueHeatmap(filters) {
  const { clauses, params } = buildFilterClauses(filters);
  const whereSql = toWhere(clauses);

  const sql = `
    SELECT
      b.booking_date,
      EXTRACT(ISODOW FROM b.booking_date)::integer                AS iso_weekday,
      COUNT(*)::integer                                            AS booking_count,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2)               AS net_revenue
    FROM bookings b
    ${whereSql}
    GROUP BY b.booking_date
    ORDER BY b.booking_date
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// ---------------------------------------------------------------------------
// 4. Revenue + bookings by facility (snapshot)
//    Metrics: #5 Revenue by facility, #15 Facility share %
//    applyFacility: FALSE — always shows all facilities.
//    Filter clauses go in the JOIN ON, not WHERE, to preserve zero-booking
//    facilities (a WHERE would silently turn this into an inner join).
// ---------------------------------------------------------------------------
async function runByFacility(filters) {
  const { clauses, params } = buildFilterClauses(filters, {
    applyFacility: false,
  });

  // Build the ON predicate (may be empty string if no other filters apply)
  const onExtra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

  // CTE pattern: aggregate first, then compute the window share on clean rows.
  // Avoids SUM(SUM()) nested aggregate which some PG versions reject.
  const sql = `
    WITH agg AS (
      SELECT
        f.id                                                        AS facility_id,
        f.code                                                      AS facility_code,
        f.name                                                      AS facility_name,
        COUNT(b.id)::integer                                        AS booking_count,
        COALESCE(SUM(b.net_amount),   0)::numeric(14,2)            AS net_revenue,
        COALESCE(SUM(b.gross_amount), 0)::numeric(14,2)            AS gross_amount
      FROM facilities f
      LEFT JOIN bookings b
        ON  b.facility_id = f.id
        ${onExtra}
      GROUP BY f.id, f.code, f.name
    )
    SELECT
      facility_id,
      facility_code,
      facility_name,
      booking_count,
      net_revenue,
      gross_amount,
      ROUND(
        gross_amount / NULLIF(SUM(gross_amount) OVER (), 0) * 100
      , 2) AS gross_share_pct
    FROM agg
    ORDER BY facility_id
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Adds a per-row net_revenue_change_pct vs the immediately preceding period
// of equal length (same convention as getByPaymentMethod), so the facility
// breakdown can show growth/decline even though it always covers every
// facility regardless of the facility filter. Null when there's no bounded
// date range to mirror, or a facility has no prior-period revenue.
async function getByFacility(filters) {
  const rows = await runByFacility(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return rows.map((r) => ({ ...r, net_revenue_change_pct: null }));
  }

  const prevRows = await runByFacility({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });
  const prevById = new Map(prevRows.map((r) => [r.facility_id, r]));

  return rows.map((r) => ({
    ...r,
    net_revenue_change_pct: pctChange(r.net_revenue, prevById.get(r.facility_id)?.net_revenue),
  }));
}

// ---------------------------------------------------------------------------
// 5. Facility revenue share over time (weekly time-series)
//    Metric: #6
//    applyFacility: FALSE — always shows all facilities.
//    Uses a normal JOIN (not LEFT JOIN) — a facility with zero bookings in a
//    given week produces no row for that week (v1 documented simplification;
//    no generate_series calendar grid in this pass).
// ---------------------------------------------------------------------------
async function getFacilityShareOverTime(filters) {
  const { clauses, params } = buildFilterClauses(filters, {
    applyFacility: false,
  });
  const whereSql = toWhere(clauses);

  // CTE: aggregate by week+facility first, then apply PARTITION BY week_start
  // in the outer query on clean aggregated columns (no raw b.booking_date reference
  // in the window OVER clause, which PostgreSQL rejects in GROUP BY context).
  const sql = `
    WITH agg AS (
      SELECT
        date_trunc('week', b.booking_date)::date                   AS week_start,
        f.id                                                        AS facility_id,
        f.code                                                      AS facility_code,
        f.name                                                      AS facility_name,
        COUNT(b.id)::integer                                        AS booking_count,
        COALESCE(SUM(b.net_amount), 0)::numeric(14,2)              AS net_revenue
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      ${whereSql}
      GROUP BY date_trunc('week', b.booking_date)::date, f.id, f.code, f.name
    )
    SELECT
      week_start,
      facility_id,
      facility_code,
      facility_name,
      booking_count,
      net_revenue,
      ROUND(
        net_revenue / NULLIF(SUM(net_revenue) OVER (PARTITION BY week_start), 0) * 100
      , 2) AS revenue_share_pct
    FROM agg
    ORDER BY week_start, facility_id
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// ---------------------------------------------------------------------------
// 6. Discount burden by facility (snapshot)
//    Metric: #7
//    applyFacility: FALSE — always shows all facilities.
//    Uses LEFT JOIN (same reasoning as getByFacility: zero-booking facilities
//    must still appear with 0 discount).
// ---------------------------------------------------------------------------
async function runDiscountBurdenByFacility(filters) {
  const { clauses, params } = buildFilterClauses(filters, {
    applyFacility: false,
  });
  const onExtra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      f.id                                                          AS facility_id,
      f.code                                                        AS facility_code,
      f.name                                                        AS facility_name,
      COALESCE(SUM(b.discount_amount), 0)::numeric(14,2)           AS total_discount_amount,
      COALESCE(SUM(b.gross_amount),    0)::numeric(14,2)           AS total_gross_amount,
      ROUND(
        COALESCE(
          SUM(b.discount_amount) / NULLIF(SUM(b.gross_amount), 0) * 100
        , 0)
      , 2)                                                          AS discount_burden_pct
    FROM facilities f
    LEFT JOIN bookings b
      ON  b.facility_id = f.id
      ${onExtra}
    GROUP BY f.id, f.code, f.name
    ORDER BY f.id
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Adds a per-row discount_burden_pct_change_pp (percentage-point change,
// not relative %, since burden is already a percentage) vs the immediately
// preceding period of equal length. Null when there's no bounded date range
// to mirror.
async function getDiscountBurdenByFacility(filters) {
  const rows = await runDiscountBurdenByFacility(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return rows.map((r) => ({ ...r, discount_burden_pct_change_pp: null }));
  }

  const prevRows = await runDiscountBurdenByFacility({
    ...filters,
    startDate: prevRange.startDate,
    endDate: prevRange.endDate,
  });
  const prevById = new Map(prevRows.map((r) => [r.facility_id, r]));

  return rows.map((r) => {
    const prev = prevById.get(r.facility_id);
    const change = prev ? Number(r.discount_burden_pct) - Number(prev.discount_burden_pct) : null;
    return {
      ...r,
      discount_burden_pct_change_pp: change === null ? null : Math.round(change * 10) / 10,
    };
  });
}

// ---------------------------------------------------------------------------
// 7. Bank vs Maidan discount share
//    Metric: #8
//    Scoped to bookings that have a recorded bank_bin — inner JOIN is correct
//    here (not a bug; rows with no BIN are simply out of scope for this metric).
//    COALESCE(r.bank_discount_share, 0): if no share is recorded for a BIN,
//    Maidan is treated as absorbing 100% of that discount (conservative default).
//    All filters apply.
// ---------------------------------------------------------------------------
async function getBankVsMaidanDiscountShare(filters) {
  const { clauses, params } = buildFilterClauses(filters);
  const whereSql = toWhere(clauses);

  const sql = `
    SELECT
      COUNT(b.id)::integer                                                              AS bookings_with_bin,
      COALESCE(SUM(b.discount_amount), 0)::numeric(14,2)                               AS total_discount_amount,
      COALESCE(
        SUM(b.discount_amount * COALESCE(r.bank_discount_share, 0))
      , 0)::numeric(14,2)                                                               AS bank_absorbed_amount,
      COALESCE(
        SUM(b.discount_amount * (1 - COALESCE(r.bank_discount_share, 0)))
      , 0)::numeric(14,2)                                                               AS maidan_absorbed_amount
    FROM bookings b
    JOIN bank_bin_reference r ON b.bank_bin = r.bin_number
    ${whereSql}
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

// ---------------------------------------------------------------------------
// 8. Underused high-value BINs
//    Metric: #9
//    No threshold is defined in the spec, so this uses a v2 heuristic
//    (documented here and surfaced in the API meta block):
//      - EVERY BIN in the reference table is returned, including ones with
//        zero bookings in the period. A 50%-discount card nobody has ever
//        used is the most underused card there is; v1 excluded exactly those.
//        It also lets the frontend offer a bank search across the full
//        catalogue without a second request (68 BINs — the whole table is
//        smaller than one page of bookings).
//      - is_high_value = top quartile (NTILE 1) of discount_pct across all
//        BINs. Ranked ascending by usage_count within that, so the
//        least-used-yet-highest-discount BINs surface first.
//      - avg_saving is what the card is ACTUALLY worth per booking:
//        AVG(gross - net) measured from real bookings where the BIN was used,
//        falling back to a modelled LEAST(discount_pct x period avg gross,
//        discount_cap) where it wasn't. discount_cap on its own badly
//        overstates the offer — caps run to PKR 15,000 against an average
//        gross booking near PKR 9,000, so the percentage binds and the cap
//        essentially never does.
//    binLimit: how many rows the client shows before "show all"; default 10,
//      clamped to 100. It no longer truncates the payload.
//    All filters apply (applied on the bookings JOIN side).
// ---------------------------------------------------------------------------
async function runUnderusedHighValueBins(filters) {
  const { clauses, params } = buildFilterClauses(filters);

  // Filters go in the LEFT JOIN ON, not a WHERE: a WHERE on b.* would drop
  // every BIN with no matching booking and silently turn this back into an
  // inner join, losing precisely the zero-usage rows this metric now wants.
  const onExtra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';
  const whereSql = toWhere(clauses);

  const sql = `
    WITH period AS (
      SELECT COALESCE(AVG(b.gross_amount), 0)::numeric(14,2) AS avg_gross
      FROM bookings b
      ${whereSql}
    ),
    usage AS (
      SELECT
        r.bin_number,
        r.bank_name,
        r.card_type,
        r.discount_pct,
        r.discount_cap,
        COUNT(b.id)::integer                      AS usage_count,
        AVG(b.gross_amount - b.net_amount)        AS measured_saving
      FROM bank_bin_reference r
      LEFT JOIN bookings b
        ON  b.bank_bin = r.bin_number
        ${onExtra}
      GROUP BY r.bin_number, r.bank_name, r.card_type, r.discount_pct, r.discount_cap
    ),
    ranked AS (
      SELECT
        *,
        NTILE(4) OVER (ORDER BY discount_pct DESC NULLS LAST) AS pct_quartile
      FROM usage
    )
    SELECT
      bin_number,
      bank_name,
      card_type,
      discount_pct,
      discount_cap,
      usage_count,
      (pct_quartile = 1)                          AS is_high_value,
      (measured_saving IS NOT NULL)               AS saving_is_measured,
      ROUND(
        COALESCE(
          measured_saving,
          -- LEAST() ignores NULL operands, so a NULL discount_pct would
          -- silently fall through to the cap and advertise a saving the card
          -- cannot deliver. Guard it explicitly.
          CASE WHEN discount_pct IS NULL THEN NULL
               ELSE LEAST(discount_pct * (SELECT avg_gross FROM period), discount_cap)
          END
        )
      , 2)                                        AS avg_saving
    FROM ranked
    ORDER BY (pct_quartile = 1) DESC, usage_count ASC, discount_pct DESC NULLS LAST
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// usage_count for a fixed list of BINs over an arbitrary date range — used to
// compare the current period's underused BINs against themselves in the
// immediately preceding period (not a re-ranked quartile of that prior
// period; the question is "is usage of these specific cards trending up or
// down," not "were they also underused back then").
async function getUsageCountForBins(binNumbers, filters) {
  if (!binNumbers.length) return new Map();

  const { clauses, params } = buildFilterClauses(filters);
  const binIdx = params.length + 1;
  params.push(binNumbers);
  // bank_bin/bin_number are BIGINT columns; node-postgres returns BIGINT as
  // strings (precision safety, same reason NUMERIC comes back as strings —
  // see lib/types/bookingsDashboard.ts), so binNumbers here is string[] and
  // needs a ::bigint[] cast, not ::text[] (bigint = text has no operator).
  const whereParts = [`b.bank_bin = ANY($${binIdx}::bigint[])`, ...clauses];

  const sql = `
    SELECT b.bank_bin AS bin_number, COUNT(*)::integer AS usage_count
    FROM bookings b
    WHERE ${whereParts.join(' AND ')}
    GROUP BY b.bank_bin
  `;

  const { rows } = await pool.query(sql, params);
  return new Map(rows.map((r) => [r.bin_number, r.usage_count]));
}

async function getUnderusedHighValueBins(filters, binLimit) {
  const safeLimit = Math.min(Math.max(parseInt(binLimit, 10) || 10, 1), 100);
  const rows = await runUnderusedHighValueBins(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  const prevByBin =
    prevRange && rows.length
      ? await getUsageCountForBins(
          rows.map((r) => r.bin_number),
          { ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate }
        )
      : null;

  const decorated = rows.map((r) => ({
    ...r,
    // Tier/network/funding are derived server-side so the ladder is defined
    // in exactly one place rather than re-guessed by every consumer.
    ...normalizeCardType(r.card_type),
    usage_count_change_pct: prevByBin ? pctChange(r.usage_count, prevByBin.get(r.bin_number) ?? 0) : null,
  }));

  return {
    binLimit: safeLimit,
    highValueCount: decorated.filter((r) => r.is_high_value).length,
    rows: decorated,
  };
}

// ---------------------------------------------------------------------------
// 9. Revenue share by activity / sport
//    Metric: #10
//    applySport: FALSE — always shows all activities regardless of sportTypeId.
//    Uses LEFT JOIN from sport_types so every sport appears even at 0 bookings.
// ---------------------------------------------------------------------------
async function runBySport(filters) {
  const { clauses, params } = buildFilterClauses(filters, {
    applySport: false,
  });
  const onExtra = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

  // CTE: aggregate first, then compute revenue_share_pct via window in outer query.
  const sql = `
    WITH agg AS (
      SELECT
        s.id                                                        AS sport_type_id,
        s.name                                                      AS sport_name,
        COUNT(b.id)::integer                                        AS booking_count,
        COALESCE(SUM(b.net_amount), 0)::numeric(14,2)              AS net_revenue
      FROM sport_types s
      LEFT JOIN bookings b
        ON  b.sport_type_id = s.id
        ${onExtra}
      GROUP BY s.id, s.name
    )
    SELECT
      sport_type_id,
      sport_name,
      booking_count,
      net_revenue,
      ROUND(
        net_revenue / NULLIF(SUM(net_revenue) OVER (), 0) * 100
      , 2) AS revenue_share_pct
    FROM agg
    ORDER BY net_revenue DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Adds a per-row net_revenue_change_pct vs the immediately preceding period
// of equal length (same convention as getByFacility/getByPaymentMethod).
// Null when there's no bounded date range to mirror, or a sport has no
// prior-period revenue.
async function getBySport(filters) {
  const rows = await runBySport(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return rows.map((r) => ({ ...r, net_revenue_change_pct: null }));
  }

  const prevRows = await runBySport({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });
  const prevById = new Map(prevRows.map((r) => [r.sport_type_id, r]));

  return rows.map((r) => ({
    ...r,
    net_revenue_change_pct: pctChange(r.net_revenue, prevById.get(r.sport_type_id)?.net_revenue),
  }));
}

// ---------------------------------------------------------------------------
// 10. Like-for-like day comparison
//     Metric: #11
//     "Every Friday vs every Friday" — the selected period's average revenue
//     per Friday against the SAME average over the immediately preceding
//     period of equal length.
//
//     Why per-occurrence and not per-week: getPreviousPeriodRange shifts by
//     span, not by whole weeks, so the two windows rarely start on the same
//     weekday and rarely contain the same number of Fridays (Jun 1-30 -> May
//     2-31 has 4 Fridays vs 5). Totals would therefore compare unequal
//     numbers of days. Dividing by the weekday's actual occurrence count in
//     each window is the only denominator that makes the two sides
//     comparable.
//
//     This also fixes a silent understatement in the previous
//     first-half/second-half rendering, which divided each weekday's revenue
//     by the number of WEEKS in the half. Partial weeks at the range
//     boundaries contain no occurrence of some weekdays, and those weeks were
//     counted as zero-revenue rather than skipped — deflating the displayed
//     average by up to 33% on a one-month range.
//
//     Returns both the weekday summary (for the comparison) and the raw
//     week x weekday grid (so the frontend can sparkline every week in range
//     without a second round trip).
//     All filters apply.
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// How many times ISO weekday `isoDow` (1=Mon..7=Sun) falls inside the
// inclusive calendar range. Counted from the range itself rather than from
// the data, so a weekday that earned nothing still divides by its real
// occurrence count instead of vanishing from the average.
function countWeekdayOccurrences(startDate, endDate, isoDow) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  const DAY_MS = 86400000;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const startDow = ((start.getUTCDay() + 6) % 7) + 1; // JS 0=Sun -> ISO 1=Mon
  const offset = (isoDow - startDow + 7) % 7;
  if (offset >= totalDays) return 0;
  return Math.floor((totalDays - offset - 1) / 7) + 1;
}

// Per-weekday totals for the selected window AND the preceding one, in a
// single round trip.
//
// Deliberately not two queries in a Promise.all: this database is a pooled
// instance capped at 15 client connections, and the controller already fans
// out 11 dashboard sections concurrently. Fetching both windows separately
// pushed the request over that ceiling and 500'd the whole dashboard. The two
// ranges are always contiguous (prevEnd is the day before startDate), so one
// scan over the union with a CASE tag gets both for the price of one
// connection.
//
// `active_days` is the fallback denominator for open-ended ranges, which have
// no calendar span to count occurrences from.
async function runWeekdayTotals(filters, prevRange) {
  // Non-date predicates only — the date bounds are rebuilt below to span both
  // windows rather than just the selected one.
  const { clauses, params } = buildFilterClauses({ ...filters, startDate: null, endDate: null });
  const parts = [...clauses];

  const nextIdx = () => params.length + 1;
  let windowExpr = `'current'`;

  if (filters.startDate) {
    // Widen the lower bound to the previous window's start when there is one.
    const lo = prevRange ? prevRange.startDate : filters.startDate;
    parts.push(`b.booking_date >= $${nextIdx()}`);
    params.push(lo);
  }
  if (filters.endDate) {
    parts.push(`b.booking_date <= $${nextIdx()}`);
    params.push(filters.endDate);
  }
  if (prevRange) {
    windowExpr = `CASE WHEN b.booking_date >= $${nextIdx()} THEN 'current' ELSE 'previous' END`;
    params.push(filters.startDate);
  }

  const whereSql = parts.length ? `WHERE ${parts.join(' AND ')}` : '';

  const sql = `
    SELECT
      ${windowExpr}                                               AS window_key,
      EXTRACT(ISODOW FROM b.booking_date)::integer                 AS iso_weekday,
      COUNT(*)::integer                                            AS booking_count,
      COUNT(DISTINCT b.booking_date)::integer                      AS active_days,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2)               AS net_revenue
    FROM bookings b
    ${whereSql}
    GROUP BY 1, 2
    ORDER BY 2
  `;

  const { rows } = await pool.query(sql, params);
  return {
    current: rows.filter((r) => r.window_key === 'current'),
    previous: rows.filter((r) => r.window_key === 'previous'),
  };
}

// The week x weekday grid, unchanged from the original query — drives the
// per-weekday sparkline.
async function runWeekdayByWeek(filters) {
  const { clauses, params } = buildFilterClauses(filters);
  const whereSql = toWhere(clauses);

  const sql = `
    SELECT
      date_trunc('week', b.booking_date)::date                     AS week_start,
      EXTRACT(ISODOW FROM b.booking_date)::integer                 AS iso_weekday,
      TRIM(to_char(b.booking_date, 'Day'))                         AS weekday_label,
      COUNT(*)::integer                                            AS booking_count,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2)               AS net_revenue
    FROM bookings b
    ${whereSql}
    GROUP BY 1, 2, 3
    ORDER BY iso_weekday, week_start
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Shape one window's rows into a weekday -> { revenue, occurrences, avg } map.
function summarizeWeekday(rows, startDate, endDate) {
  const bounded = Boolean(startDate && endDate);
  const byDow = new Map();

  for (let dow = 1; dow <= 7; dow += 1) {
    const row = rows.find((r) => r.iso_weekday === dow);
    const occurrences = bounded
      ? countWeekdayOccurrences(startDate, endDate, dow)
      : (row ? row.active_days : 0);
    const netRevenue = row ? Number(row.net_revenue) : 0;

    byDow.set(dow, {
      booking_count: row ? row.booking_count : 0,
      occurrences,
      net_revenue: netRevenue.toFixed(2),
      avg_per_occurrence: occurrences > 0 ? (netRevenue / occurrences).toFixed(2) : null,
    });
  }

  return byDow;
}

async function getLikeForLikeDay(filters) {
  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);

  // Sequential, not Promise.all — see the connection-ceiling note on
  // runWeekdayTotals. This section holds at most one pooled connection.
  const totals = await runWeekdayTotals(filters, prevRange);
  const byWeek = await runWeekdayByWeek(filters);

  const current = summarizeWeekday(totals.current, filters.startDate, filters.endDate);
  const previous = prevRange
    ? summarizeWeekday(totals.previous, prevRange.startDate, prevRange.endDate)
    : null;

  const weekdays = [];
  for (let dow = 1; dow <= 7; dow += 1) {
    const cur = current.get(dow);
    const prev = previous ? previous.get(dow) : null;

    weekdays.push({
      iso_weekday: dow,
      weekday_label: WEEKDAY_LABELS[dow - 1],
      current: cur,
      previous: prev,
      // Compared on the per-occurrence average, never the raw total — see
      // the header comment on unequal weekday counts between windows.
      change_pct:
        prev && prev.avg_per_occurrence != null && cur.avg_per_occurrence != null
          ? pctChange(Number(cur.avg_per_occurrence), Number(prev.avg_per_occurrence))
          : null,
    });
  }

  return {
    comparison: prevRange ? { startDate: prevRange.startDate, endDate: prevRange.endDate } : null,
    weekdays,
    byWeek,
  };
}

// ---------------------------------------------------------------------------
// 11. Revenue by payment method
//     Metric: #16
//     NULL payment_method_id is bucketed as "Unspecified" (id=0, a synthetic
//     value; 0 is never a real SERIAL id from the payment_methods table).
//     All filters apply.
// ---------------------------------------------------------------------------
async function runByPaymentMethod(filters) {
  const { clauses, params } = buildFilterClauses(filters);
  const whereSql = toWhere(clauses);

  const sql = `
    SELECT
      COALESCE(pm.id,   0)             AS payment_method_id,
      COALESCE(pm.name, 'Unspecified') AS payment_method_name,
      COUNT(b.id)::integer             AS booking_count,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2) AS net_revenue
    FROM bookings b
    LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
    ${whereSql}
    GROUP BY pm.id, pm.name
    ORDER BY net_revenue DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Adds a per-row net_revenue_change_pct vs the immediately preceding period
// of equal length (same convention as getKpis' comparison block), so the
// table can show which payment methods are actually growing vs shrinking.
// Null when there's no bounded date range to mirror, or a method has no
// prior-period revenue to compare against.
async function getByPaymentMethod(filters) {
  const rows = await runByPaymentMethod(filters);

  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);
  if (!prevRange) {
    return rows.map((r) => ({ ...r, net_revenue_change_pct: null }));
  }

  const prevRows = await runByPaymentMethod({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate });
  const prevById = new Map(prevRows.map((r) => [r.payment_method_id, r]));

  return rows.map((r) => ({
    ...r,
    net_revenue_change_pct: pctChange(r.net_revenue, prevById.get(r.payment_method_id)?.net_revenue),
  }));
}

// ---------------------------------------------------------------------------
// 12. Bookings by time slot, split by status
//     Metrics: #17 slot x status mix, #18 slot vs previous period
//     All filters apply.
//
//     Grouped by slot_start_hour (0-23), the hour-of-day denormalised from
//     start_time by scripts/parse_time_slots.js. Rows whose free-text
//     time_slot_raw never parsed have slot_start_hour NULL and are returned
//     as a single `slot_start_hour: null` bucket rather than dropped — about
//     15% of bookings, enough that silently omitting them would make the
//     slot totals disagree with the Total Bookings KPI on the same page.
//
//     Returned at HOUR resolution deliberately, even though the chart shows
//     2- or 3-hour blocks: the client regroups hours into blocks locally, so
//     changing the block width is instant and never refetches. 24 hours x 7
//     statuses is ~170 rows at worst, well under the cost of a second query.
//
//     `previous` covers the immediately preceding period of equal length
//     (same convention as getKpis), which is what the slot-comparison chart
//     reads — "how many bookings were there last month in the 6-9 slot".
//     Null when the range is open-ended and has no window to mirror.
// ---------------------------------------------------------------------------
async function runByTimeSlot(filters) {
  const { clauses, params } = buildFilterClauses(filters);
  const whereSql = toWhere(clauses);

  const sql = `
    SELECT
      b.slot_start_hour                              AS slot_start_hour,
      b.status                                       AS status,
      COUNT(*)::integer                              AS booking_count,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2)  AS net_revenue,
      COALESCE(SUM(b.duration_hours), 0)::numeric(10,2) AS total_hours
    FROM bookings b
    ${whereSql}
    GROUP BY b.slot_start_hour, b.status
    ORDER BY b.slot_start_hour NULLS LAST, booking_count DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

async function getByTimeSlot(filters) {
  const prevRange = getPreviousPeriodRange(filters.startDate, filters.endDate);

  // Sequential rather than Promise.all: this section is one of eleven already
  // fanning out on a pool capped below the Supabase pooler's client ceiling
  // (see db/pool.js), and a second concurrent connection here buys nothing
  // measurable on a query this small.
  const current = await runByTimeSlot(filters);
  const previous = prevRange
    ? await runByTimeSlot({ ...filters, startDate: prevRange.startDate, endDate: prevRange.endDate })
    : null;

  // Every status appearing in EITHER window, busiest first. The client uses
  // this for stacking order and legend order, so it must be stable across the
  // two windows — deriving it per-window would reorder the legend whenever a
  // rare status showed up in one period and not the other. Status is free
  // text normalised at import (scripts/lib/bookingImporter.js), so the set is
  // whatever the sheets contain rather than a fixed enum.
  const totals = new Map();
  for (const r of [...current, ...(previous ?? [])]) {
    totals.set(r.status, (totals.get(r.status) ?? 0) + r.booking_count);
  }
  const statuses = [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([status]) => status);

  return {
    comparison: prevRange ? { startDate: prevRange.startDate, endDate: prevRange.endDate } : null,
    statuses,
    current,
    previous,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  getKpis,
  getRevenueTrend,
  getRevenueHeatmap,
  getByFacility,
  getFacilityShareOverTime,
  getDiscountBurdenByFacility,
  getBankVsMaidanDiscountShare,
  getUnderusedHighValueBins,
  getBySport,
  getLikeForLikeDay,
  getByPaymentMethod,
  getByTimeSlot,
};
