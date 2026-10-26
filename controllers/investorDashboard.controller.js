'use strict';

const { parseIdList } = require('../services/dashboard.filters');
const { parseStatusList } = require('../services/investorDashboard.filters');
const svc = require('../services/investorDashboard.service');

/**
 * GET /api/dashboard/investors
 *
 * Query params (all optional):
 *   startDate       YYYY-MM-DD
 *   endDate         YYYY-MM-DD
 *   facilityId      1  or  1,2  (multi-value; ignored by profitByFacility's
 *                   totals-per-facility breakdown, ignored by facilityComparison
 *                   per-row grouping — see meta.filterObedience)
 *   investorId      1  or  1,2  (ignored by profitByFacility — profit is a
 *                   facility-level pool, not owned by a specific investor)
 *   status          Completed | Partially Disbursed | Pending  (comma list;
 *                   derived from disbursed-vs-investment, not a stored field)
 *   targetMonths    integer, default 12, clamped 1-120 (forecast calculator input)
 *   trailingMonths  integer, default 6, clamped 1-36 (forecast historical pace window)
 *
 * Returns one JSON payload with KPIs, trend charts, facility comparison,
 * per-investor summary, and a forecast block — mirroring the booking
 * dashboard's single-round-trip shape.
 */
async function getInvestorDashboard(req, res, next) {
  try {
    const {
      startDate      = null,
      endDate        = null,
      facilityId,
      investorId,
      status,
      targetMonths   = '12',
      trailingMonths = '6',
    } = req.query;

    const filters = {
      startDate:   startDate || null,
      endDate:     endDate   || null,
      facilityIds: parseIdList(facilityId),
      investorIds: parseIdList(investorId),
      statuses:    parseStatusList(status),
    };

    const safeTargetMonths = Math.min(Math.max(parseInt(targetMonths, 10) || 12, 1), 120);
    const safeTrailingMonths = Math.min(Math.max(parseInt(trailingMonths, 10) || 6, 1), 36);

    const [
      kpis,
      highestPendingInvestor,
      profitByFacility,
      monthlyDisbursementTrend,
      profitVsDisbursementTrend,
      remainingLiabilityTrend,
      facilityComparison,
      investors,
      forecast,
    ] = await Promise.all([
      svc.getKpis(filters),
      svc.getHighestPendingInvestor(filters),
      svc.getProfitByFacility(filters),
      svc.getMonthlyDisbursementTrend(filters),
      svc.getProfitVsDisbursementTrend(filters),
      svc.getRemainingLiabilityTrend(filters),
      svc.getFacilityComparison(filters),
      svc.getInvestorSummary(filters),
      svc.getForecast(filters, { targetMonths: safeTargetMonths, trailingMonths: safeTrailingMonths }),
    ]);

    res.json({
      success: true,
      data: {
        meta: {
          filters: {
            startDate:      filters.startDate,
            endDate:        filters.endDate,
            facilityId:     filters.facilityIds,
            investorId:     filters.investorIds,
            status:         filters.statuses,
            targetMonths:   safeTargetMonths,
            trailingMonths: safeTrailingMonths,
          },
          filterObedience: {
            profitByFacility:
              'ignores investorId and status — profit is a facility-level pool, not owned by a specific investor',
          },
          notes: {
            status:
              "derived, not a stored field: Completed = disbursed >= investment; Pending = 0 disbursed; Partially Disbursed = otherwise. Computed per facility-investor stake and re-aggregated per investor in the investors[] section.",
            snapshotVsWindowed:
              'kpis.total_investment, kpis.remaining_liability, and every pending_amount/completion_pct figure are current-state (all-time) and ignore the date range; only disbursed-amount and trend-chart figures are windowed by startDate/endDate.',
            remainingLiabilityTrend:
              'cumulative_disbursed is computed over full history; the date range only limits which period rows are returned, not which disbursements count toward the running total',
            forecast:
              'avgMonthlyDisbursement is the mean of the trailingMonths most recent months with activity in scope; requiredMonthlyProfitForTarget assumes future facility profit is split pro-rata across investors by ownership_percentage',
          },
        },

        kpis: {
          ...kpis,
          highestPendingInvestor,
        },
        profitByFacility,
        trends: {
          monthlyDisbursement:   monthlyDisbursementTrend,
          profitVsDisbursement:  profitVsDisbursementTrend,
          remainingLiability:    remainingLiabilityTrend,
        },
        facilityComparison,
        investors,
        forecast,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getInvestorDashboard };
