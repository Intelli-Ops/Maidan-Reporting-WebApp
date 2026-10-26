const { query } = require('express-validator');

// Shared by booking/expense summary + list endpoints — all of them accept
// the same date-range + facility/category filters, and list additionally
// paginates. Query params are already safe from injection (parameterized
// everywhere downstream), but unclamped values still reach Postgres directly:
// a negative page produces a negative OFFSET, an unbounded limit can pull
// the whole table into memory, and a malformed date throws a raw driver
// error. Rejecting bad input here is what keeps that from ever reaching the
// DB at all.
const dateRangeValidation = [
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date (YYYY-MM-DD).'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date (YYYY-MM-DD).'),
  query('facilityId').optional().isInt({ min: 1 }).withMessage('facilityId must be a positive integer.'),
];

const listValidation = [
  ...dateRangeValidation,
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500.'),
];

// The /api/dashboard/* endpoints had no validation at all, unlike the
// summary/list endpoints above — so a date the user could simply type into a
// filter box ("notadate", or a year outside what a Postgres date can hold)
// went straight into a query parameter and came back as a 500 with a driver
// error, not a 400. The id-list params don't need a rule here: they are
// comma-separated and may contain the literal 'null', and buildIdListClause
// discards anything that isn't a usable integer.
//
// Deliberately stricter than isISO8601(), which also accepts full timestamps
// and year 0000 — these columns are DATE, so YYYY-MM-DD in a sane calendar
// range is the only shape that is ever meaningful.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDateParam(name) {
  return query(name)
    .optional({ values: 'falsy' })
    .matches(ISO_DATE)
    .withMessage(`${name} must be a date in YYYY-MM-DD format.`)
    .bail()
    .custom((value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) throw new Error(`${name} is not a real calendar date.`);
      // Rebuilding the string catches a well-formed but non-existent date
      // (2026-02-31), which Date happily rolls forward into March.
      if (parsed.toISOString().slice(0, 10) !== value) {
        throw new Error(`${name} is not a real calendar date.`);
      }
      const year = Number(value.slice(0, 4));
      if (year < 1970 || year > 2999) throw new Error(`${name} must be between 1970 and 2999.`);
      return true;
    });
}

const dashboardValidation = [
  isoDateParam('startDate'),
  isoDateParam('endDate'),
  // A reversed range used to return 200 with every section empty, which reads
  // as "no data" rather than "you typed the dates backwards".
  query('endDate').custom((value, { req }) => {
    const start = req.query.startDate;
    if (start && value && String(value) < String(start)) {
      throw new Error('endDate must be on or after startDate.');
    }
    return true;
  }),
];

module.exports = { dateRangeValidation, listValidation, dashboardValidation };
