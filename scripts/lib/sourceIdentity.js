// lib/sourceIdentity.js
//
// Identifies an import source by the CONTENT of its workbook rather than by
// its file name. See sql/schema_update_v13_import_batch_hash.sql for the full
// reasoning; the short version is that the booking workbooks are named
// 1.xlsx ... 31.xlsx and those names repeat every month, so a name-based
// "have I already imported this?" check silently skips the next month.
//
// Works for both callers: the CLI passes { path }, the upload endpoint passes
// { buffer, fileName }.

const fs = require('fs');
const crypto = require('crypto');

/** SHA-256 of the workbook bytes, hex encoded. */
function hashSource(source) {
  const bytes = source.buffer ? source.buffer : fs.readFileSync(source.path);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/**
 * Finds an existing batch for this source.
 *
 * Matches on hash first. Falls back to source_name ONLY for legacy rows that
 * predate the hash column — without that fallback, every file imported before
 * v13 would look new and re-import, duplicating historical data.
 *
 * Returns the batch row ({ id, source_hash }) or null.
 */
async function findExistingBatch(client, sourceType, sourceHash, sourceName) {
  const byHash = await client.query(
    'SELECT id, source_hash FROM raw_import_batches WHERE source_type = $1 AND source_hash = $2',
    [sourceType, sourceHash]
  );
  if (byHash.rows.length > 0) return byHash.rows[0];

  const legacy = await client.query(
    'SELECT id, source_hash FROM raw_import_batches WHERE source_type = $1 AND source_name = $2 AND source_hash IS NULL',
    [sourceType, sourceName]
  );
  return legacy.rows[0] || null;
}

module.exports = { hashSource, findExistingBatch };
