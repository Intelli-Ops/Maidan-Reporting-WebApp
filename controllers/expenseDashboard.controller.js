'use strict';

const { parseIdList } = require('../services/dashboard.filters');
const { getAccountReferenceData } = require('../services/expenseDashboard.filters');
const svc = require('../services/expenseDashboard.service');

/**
 * GET /api/dashboard/expenses
 *
 * Query params (all optional):
 *   startDate        YYYY-MM-DD
 *   endDate          YYYY-MM-DD
 *   facilityId       1  or  1,2  (multi-value; ignored by byFacility)
 *   categoryId       1  or  1,2  (top-level or leaf category id; rolls up to
 *                    include children; ignored by categoryShareOverTime)
 *   subcategoryId    1  or  1,2  (leaf category id, exact match only; ANDed
 *                    with categoryId; ignored by categoryShareOverTime)
 *   paymentMethodId  1,2  or  null  (literal 'null' = no payment method recorded)
 *   accountType      'Air Field' / 'Maidan Core'  or  null  (comma list;
 *                    'null' = no linked account, i.e. untracked/petty cash)
 *   sourceBank       bank name (comma list, case-insensitive)  or  null
 *   granularity      weekly | monthly  (expenseTrend + categoryShareOverTime; default weekly)
 *
 * Returns one JSON payload with all expense-dashboard metric sections + a
 * meta block documenting filter obedience and data-model limitations.
 */
async function getExpensesDashboard(req, res, next) {
  try {
    const {
      startDate       = null,
      endDate         = null,
      facilityId,
      categoryId,
      subcategoryId,
      paymentMethodId,
      accountType,
      sourceBank,
      granularity     = 'weekly',
    } = req.query;

    const filters = {
      startDate:         startDate || null,
      endDate:           endDate   || null,
      facilityIds:       parseIdList(facilityId),
      categoryIds:       parseIdList(categoryId),
      subcategoryIds:    parseIdList(subcategoryId),
      paymentMethodIds:  parseIdList(paymentMethodId),
      accountTypes:      parseIdList(accountType),
      bankNames:         parseIdList(sourceBank),
    };

    const safeGranularity = ['weekly', 'monthly'].includes(granularity) ? granularity : 'weekly';

    const [
      kpis,
      byFacility,
      delta,
      expenseTrend,
      byPaymentMethod,
      byCategory,
      categoryShareOverTime,
      likeForLikeMonth,
    ] = await Promise.all([
      svc.getKpis(filters),
      svc.getByFacility(filters),
      svc.getDelta(filters),
      svc.getExpenseTrend(filters, safeGranularity),
      svc.getByPaymentMethod(filters),
      svc.getByCategory(filters),
      svc.getCategoryShareOverTime(filters, safeGranularity),
      svc.getLikeForLikeMonth(filters),
    ]);

    const topFacility = byFacility.reduce(
      (best, row) => (!best || Number(row.total_amount) > Number(best.total_amount) ? row : best),
      null
    );

    res.json({
      success: true,
      data: {
        meta: {
          filters: {
            startDate:        filters.startDate,
            endDate:          filters.endDate,
            facilityId:       filters.facilityIds,
            categoryId:       filters.categoryIds,
            subcategoryId:    filters.subcategoryIds,
            paymentMethodId:  filters.paymentMethodIds,
            accountType:      filters.accountTypes,
            sourceBank:       filters.bankNames,
            granularity:      safeGranularity,
          },
          filterObedience: {
            byFacility:
              'ignores facilityId — always returns all facilities (spec requirement; only meaningful in the "All facilities" view)',
            categoryShareOverTime:
              'ignores categoryId/subcategoryId — always returns all top-level categories (spec requirement)',
          },
          notes: {
            omittedMetrics:
              "2 spec metrics are intentionally not implemented, by explicit product decision: (1) 'expense limit left this week' per facility — no budget/limit value exists anywhere in the schema; (2) 'Pending / unrecorded amount' — expenses.amount is NOT NULL and every live row has a real value, so there is nothing to compute.",
            accountTypeAndBank:
              "source_account is free text from the import pipeline (e.g. 'BAHL Airfield', 'DIB Maidan Core'), not a lookup table. It is normalized into accountType ('Air Field' / 'Maidan Core') and bankName via an exact-match table in expenseDashboard.filters.js (ACCOUNT_MAP) built from the 11 distinct raw values seen in the data; an unrecognized future raw value surfaces as null/null rather than being guessed. Cash expenses (no source_account) are null/null, matched by the 'null' filter token.",
            delta:
              'v1 heuristic: compares the requested [startDate, endDate] window to the immediately preceding window of equal length, so it generalizes both week-over-week and month-over-month depending on the range length the caller passes. Defaults to a trailing 30-day window ending on the latest expense_date in the table when no date range is given.',
            categoryRollup:
              'every expense in the live data is recorded against a leaf subcategory, never a parent category directly; categoryId therefore rolls up to include all of that category\'s children, and byCategory/likeForLikeMonth report at the top-level-category rollup.',
          },
        },

        kpis: {
          ...kpis,
          topFacility: topFacility
            ? { facilityId: topFacility.facility_id, facilityCode: topFacility.facility_code, facilityName: topFacility.facility_name, totalAmount: topFacility.total_amount }
            : null,
          delta,
        },
        byFacility,
        expenseTrend,
        byPaymentMethod,
        byCategory,
        categoryShareOverTime,
        likeForLikeMonth,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/expenses/account-references
 *
 * Lookup endpoint for the accountType/sourceBank filters on the expense
 * dashboard: the valid accountType values ('Air Field' / 'Maidan Core'), the
 * valid bankName values, and the full raw-source_account -> normalized
 * mapping, so the frontend never has to hardcode ACCOUNT_MAP itself.
 */
async function getAccountReferences(req, res, next) {
  try {
    res.json({
      success: true,
      data: getAccountReferenceData(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getExpensesDashboard, getAccountReferences };
