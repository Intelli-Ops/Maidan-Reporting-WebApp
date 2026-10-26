const pool = require('../db/pool');
const { importBookings } = require('../scripts/lib/bookingImporter');
const { importExpenses } = require('../scripts/lib/expenseImporter');
const { importInvestors } = require('../scripts/lib/investorImporter');
const auditLog = require('../services/auditLog.service');

const VALID_TYPES = ['booking', 'expense', 'investor'];

async function upload(req, res, next) {
  const body = req.body || {};
  const { type } = body;
  const dryRun = body.dryRun === 'true' || body.dryRun === true;
  // Set by the client after the user accepts the blank-date prompt. Multipart
  // form fields arrive as strings, hence the loose comparison.
  const confirmUndated = body.confirmUndated === 'true' || body.confirmUndated === true;
  const files = req.files || [];

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded.',
    });
  }

  if (type === 'investor' && files.length > 1) {
    return res.status(400).json({
      success: false,
      error: 'Investor upload accepts exactly one workbook.',
    });
  }

  const client = await pool.connect();
  try {
    const opts = { dryRun };
    let result;

    if (type === 'booking') {
      const sources = files.map((f) => ({ buffer: f.buffer, fileName: f.originalname }));
      result = await importBookings({ client, sources, options: opts });
    } else if (type === 'expense') {
      const sources = files.map((f) => ({ buffer: f.buffer, fileName: f.originalname }));

      // A blank Date cell in these workbooks means "same day as the row
      // above", and the importer carries the previous date down. That is
      // usually right, but it is an inference — in the July 2026 upload it
      // covered 81 of 208 rows and PKR 965,769. Silently guessing dates for
      // that much money is not something to do on the user's behalf without
      // telling them.
      //
      // So a real import is preceded by a dry run. If it finds blank dates and
      // the user has not already agreed to the carry-down, nothing is written
      // and the response asks them to choose. A clean file costs one extra
      // parse and imports in the same request.
      if (!dryRun && !confirmUndated) {
        const probe = await importExpenses({ client, sources, options: { ...opts, dryRun: true } });
        if (probe.undatedCount > 0) {
          return res.json({
            success: true,
            data: {
              ...probe,
              needsConfirmation: true,
              // The client re-sends the same files with confirmUndated=true
              // to proceed. Nothing is held server-side between the two
              // requests, so there is no half-finished import to expire or
              // clean up if the user simply walks away.
              confirmField: 'confirmUndated',
            },
          });
        }
      }

      result = await importExpenses({ client, sources, options: opts });
    } else {
      const f = files[0];
      result = await importInvestors({
        client,
        source: { buffer: f.buffer, fileName: f.originalname },
        options: { mode: 'replace', dryRun },
      });

      // Investor imports fully replace the dataset — this is the one action
      // in the app with no other trace of who triggered it once done, so
      // it's worth recording even when the rest of the import pipeline
      // isn't otherwise audited.
      if (!dryRun) {
        auditLog.record({
          actorUserId: req.user.id,
          action: 'investors.replace',
          targetType: 'investor_import',
          metadata: { fileName: f.originalname, result },
        });
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { upload };
