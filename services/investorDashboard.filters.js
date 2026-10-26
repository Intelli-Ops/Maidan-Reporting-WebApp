'use strict';

const { parseIdList, buildIdListClause } = require('./dashboard.filters');

const VALID_STATUSES = ['Completed', 'Partially Disbursed', 'Pending'];

/**
 * Parse a comma-separated status query param against the 3 canonical labels
 * (case-insensitive), discarding anything that doesn't match.
 */
function parseStatusList(raw) {
  if (!raw) return null;
  const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  const valid = parts
    .map((p) => VALID_STATUSES.find((v) => v.toLowerCase() === p.toLowerCase()))
    .filter(Boolean);
  return valid.length ? valid : null;
}

/**
 * Builds the `fi_scope` CTE chain that every investor-dashboard query is
 * built on top of: one row per currently-active facility_investor stake,
 * annotated with its all-time disbursed total, in-range disbursed total
 * (via FILTER, not a restricted join, so snapshot columns stay correct even
 * when a date range is set), pending/remaining liability, and a derived
 * status (Completed / Partially Disbursed / Pending — disbursements.status
 * in the DB is free-text from the source spreadsheet and can't be trusted
 * as a controlled vocabulary, so status is computed from disbursed vs
 * investment amount instead). Facility/investor/status filters are applied
 * once here so they cascade identically into every downstream metric.
 *
 * Callers append their own SELECT (or further CTEs) after the returned
 * `cte` string, referencing the `fi_scope` relation it defines.
 */
function buildInvestorScope(filters, paramOffset = 0) {
  const { startDate, endDate, facilityIds, investorIds, statuses } = filters;
  const params = [];
  let idx = paramOffset + 1;

  const rangeParts = [];
  if (startDate) {
    rangeParts.push(`period_month >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    rangeParts.push(`period_month <= $${idx++}`);
    params.push(endDate);
  }
  const rangeCondition = rangeParts.length ? rangeParts.join(' AND ') : 'TRUE';

  const scopeClauses = ['fi.effective_to IS NULL'];

  const facilityClause = buildIdListClause('fi.facility_id', facilityIds, idx);
  if (facilityClause) {
    scopeClauses.push(facilityClause.clause);
    params.push(...facilityClause.params);
    idx = facilityClause.nextParamIdx;
  }

  const investorClause = buildIdListClause('fi.investor_id', investorIds, idx);
  if (investorClause) {
    scopeClauses.push(investorClause.clause);
    params.push(...investorClause.params);
    idx = investorClause.nextParamIdx;
  }

  let statusParamIdx = null;
  if (statuses && statuses.length) {
    statusParamIdx = idx++;
    params.push(statuses);
  }

  const cte = `
    WITH disb_agg AS (
      SELECT
        facility_investor_id,
        SUM(disbursed_amount) AS disbursed_all_time,
        SUM(disbursed_amount) FILTER (WHERE ${rangeCondition}) AS disbursed_in_range
      FROM disbursements
      GROUP BY facility_investor_id
    ),
    fi_scope_raw AS (
      SELECT
        fi.id                                                       AS facility_investor_id,
        fi.facility_id,
        fi.investor_id,
        fi.investment_amount,
        fi.ownership_percentage,
        COALESCE(da.disbursed_all_time, 0)                          AS disbursed_all_time,
        COALESCE(da.disbursed_in_range, 0)                          AS disbursed_in_range,
        (COALESCE(fi.investment_amount, 0) - COALESCE(da.disbursed_all_time, 0)) AS pending_amount,
        CASE
          WHEN COALESCE(fi.investment_amount, 0) <= 0 THEN NULL
          WHEN COALESCE(da.disbursed_all_time, 0) >= fi.investment_amount THEN 'Completed'
          WHEN COALESCE(da.disbursed_all_time, 0) <= 0 THEN 'Pending'
          ELSE 'Partially Disbursed'
        END                                                          AS status
      FROM facility_investors fi
      LEFT JOIN disb_agg da ON da.facility_investor_id = fi.id
      WHERE ${scopeClauses.join(' AND ')}
    ),
    fi_scope AS (
      SELECT * FROM fi_scope_raw
      ${statusParamIdx ? `WHERE status = ANY($${statusParamIdx}::text[])` : ''}
    )
  `;

  return { cte, params, nextParamIdx: idx };
}

module.exports = { parseStatusList, buildInvestorScope, VALID_STATUSES };
