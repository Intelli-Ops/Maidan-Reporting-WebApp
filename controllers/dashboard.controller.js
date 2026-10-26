'use strict';

const { parseIdList } = require('../services/dashboard.filters');
const svc = require('../services/dashboard.service');

/**
 * GET /api/dashboard/bookings
 *
 * Query params (all optional):
 *   startDate        YYYY-MM-DD
 *   endDate          YYYY-MM-DD
 *   facilityId       1  or  1,2  (multi-value; ignored by byFacility/
 *                    facilityShareOverTime/discountBurdenByFacility sections)
 *   sportTypeId      1  or  1,3  (ignored by bySport section)
 *   paymentMethodId  1,2  or  null  (literal 'null' = bookings with no payment method)
 *   granularity      daily | weekly | monthly  (revenueTrend only; defaults daily)
 *   binLimit         integer (underusedHighValueBins only; default 10, max 100).
 *                    A display hint for how many rows the client shows before
 *                    "show all" — the payload always carries every BIN.
 *
 * Returns one JSON payload with all 12 metric sections + a meta block that
 * documents which sections ignore which filters.
 */
async function getBookingsDashboard(req, res, next) {
  try {
    // ------------------------------------------------------------------
    // Parse & validate query params
    // ------------------------------------------------------------------
    const {
      startDate     = null,
      endDate       = null,
      facilityId,
      sportTypeId,
      paymentMethodId,
      granularity   = 'daily',
      binLimit      = '10',
    } = req.query;

    const filters = {
      startDate:        startDate  || null,
      endDate:          endDate    || null,
      facilityIds:      parseIdList(facilityId),
      sportTypeIds:     parseIdList(sportTypeId),
      paymentMethodIds: parseIdList(paymentMethodId),
    };

    // Validate granularity (fall back silently rather than 400 per spec)
    const safeGranularity = ['daily', 'weekly', 'monthly'].includes(granularity)
      ? granularity
      : 'daily';

    // ------------------------------------------------------------------
    // Fire all 12 queries in parallel
    // ------------------------------------------------------------------
    const [
      kpis,
      revenueTrend,
      revenueHeatmap,
      byFacility,
      facilityShareOverTime,
      discountBurdenByFacility,
      bankVsMaidanDiscountShare,
      underusedHighValueBins,
      bySport,
      likeForLikeDay,
      byPaymentMethod,
      byTimeSlot,
    ] = await Promise.all([
      svc.getKpis(filters),
      svc.getRevenueTrend(filters, safeGranularity),
      svc.getRevenueHeatmap(filters),
      svc.getByFacility(filters),
      svc.getFacilityShareOverTime(filters),
      svc.getDiscountBurdenByFacility(filters),
      svc.getBankVsMaidanDiscountShare(filters),
      svc.getUnderusedHighValueBins(filters, binLimit),
      svc.getBySport(filters),
      svc.getLikeForLikeDay(filters),
      svc.getByPaymentMethod(filters),
      svc.getByTimeSlot(filters),
    ]);

    // ------------------------------------------------------------------
    // Build response
    // ------------------------------------------------------------------
    res.json({
      success: true,
      data: {
        /**
         * meta: self-documenting block so callers understand non-obvious
         * filter behaviours without reading the source.
         */
        meta: {
          filters: {
            startDate:       filters.startDate,
            endDate:         filters.endDate,
            facilityId:      filters.facilityIds,
            sportTypeId:     filters.sportTypeIds,
            paymentMethodId: filters.paymentMethodIds,
            granularity:     safeGranularity,
          },
          filterObedience: {
            byFacility:
              'ignores facilityId — always returns all facilities (spec requirement)',
            facilityShareOverTime:
              'ignores facilityId — always returns all facilities (spec requirement)',
            discountBurdenByFacility:
              'ignores facilityId — always returns all facilities (spec requirement)',
            bySport:
              'ignores sportTypeId — always returns all activities (spec requirement)',
          },
          notes: {
            revenueHeatmap:
              'calendar heatmap grouped by booking_date; time_slot_raw is unstructured text and is not used',
            bankVsMaidanDiscountShare:
              'scoped to bookings with a recorded bank_bin only; rows without a BIN are excluded',
            // These two strings surface verbatim as captions under the charts,
            // so they are written for the person reading the dashboard. The
            // full implementation notes live in services/dashboard.service.js.
            underusedHighValueBins:
              'Cards in the top quarter by discount rate, least-used first. Includes cards with no bookings at all in the period.',
            likeForLikeDay:
              'Each weekday\'s average revenue per occurrence — e.g. total Saturday revenue divided by the number of Saturdays in the range — against the same figure for the period immediately before.',
            byTimeSlot:
              'Grouped by the hour the slot starts, parsed from the free-text time slot. Bookings whose slot text could not be parsed are grouped under a null hour and shown as "Unknown".',
          },
        },

        // KPI cards
        kpis,

        // Charts & breakdowns
        revenueTrend,
        revenueHeatmap,
        byFacility,
        facilityShareOverTime,
        discountBurdenByFacility,
        bankVsMaidanDiscountShare,
        underusedHighValueBins,
        bySport,
        likeForLikeDay,
        byPaymentMethod,
        byTimeSlot,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBookingsDashboard };
