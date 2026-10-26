# Maidan — Data Import Libraries: Backend Integration Guide

This document is for whoever is wiring the **admin file-upload feature** into the
main backend. The data-parsing/validation work is already done and lives in three
importer libraries. Your job is to expose them through a protected upload endpoint.
You do **not** need to understand the Excel parsing — just how to call these
functions and what they give back.

---

## 1. The three libraries

All live in `scripts/lib/` and share the same calling shape.

| File | Export | Data type | Behaviour on upload |
|------|--------|-----------|---------------------|
| `lib/bookingImporter.js`  | `importBookings`  | Daily booking files | **Append.** Idempotent per file — re-uploading a file already loaded is skipped. |
| `lib/expenseImporter.js`  | `importExpenses`  | Monthly expense files | **Append.** Same per-file idempotency. |
| `lib/investorImporter.js` | `importInvestors` | The single investor workbook | **Replace.** Wipes all investor tables and rebuilds, in one transaction, after a safety check. |

Each also has a CLI wrapper (`import_*.js`) used for manual terminal runs — you
can ignore those; the endpoint calls the **library** directly.

---

## 2. What every function needs

All three take a `client` (a connected `pg` client — **you** own its lifecycle),
one or more `sources`, and an `options` object. All three **return a plain
JSON-serialisable result** and never print or exit.

A **source** is how you hand over an uploaded file. Two forms:

```js
{ path: '/abs/path/on/disk.xlsx' }            // from the filesystem (CLI uses this)
{ buffer: <Buffer>, fileName: 'original.xlsx' } // from an upload (you use this)
```

**Use the buffer form.** An uploaded file arrives in memory as a Buffer; there's
no file on disk. `fileName` is required alongside it because the expense importer
reads the **month/year from the filename** to correct dates — so the original
filename (e.g. `Expense - June 2026.xlsx`) must be preserved and passed through.

> Multer note: with `multer.memoryStorage()`, each file is `req.file.buffer`
> (single) or `req.files[i].buffer` (multiple), and the original name is
> `req.file.originalname`. That maps directly to `{ buffer, fileName }`.

---

## 3. Calling each one

### Bookings (append, multiple files at once)

```js
const { importBookings } = require('./lib/bookingImporter');

const sources = req.files.map(f => ({ buffer: f.buffer, fileName: f.originalname }));

const result = await importBookings({
  client,
  sources,                       // array — bookings come many-at-a-time
  options: { dryRun: false },    // force: true only to re-do an already-loaded file
});
```

### Expenses (append, usually one file)

```js
const { importExpenses } = require('./lib/expenseImporter');

const result = await importExpenses({
  client,
  sources: [{ buffer: req.file.buffer, fileName: req.file.originalname }],
  options: { dryRun: false },    // undatedPolicy defaults to 'month-start'
});
```

### Investors (replace — wipes and rebuilds)

```js
const { importInvestors } = require('./lib/investorImporter');

const result = await importInvestors({
  client,
  source: { buffer: req.file.buffer, fileName: req.file.originalname }, // NOTE: singular `source`
  options: { mode: 'replace', dryRun: false },
});
```

**Investor is different in three ways**, all deliberate:
- It takes `source` (singular), not `sources` — there's only ever one investor workbook.
- `mode: 'replace'` deletes ALL investor data and rebuilds. This matches the
  client's monthly workflow ("delete and re-enter").
- Before deleting anything it runs a **validation guard**. If the uploaded file
  is the wrong file, empty, or its layout is unreadable, it does **not** wipe —
  it returns `{ ok: false, refused: true, problems: [...] }` and the database is
  untouched. Surface `problems` to the admin so they know the upload was rejected
  and why.

---

## 4. The result object (all three)

```js
{
  ok: true,                 // false if the whole thing failed/was refused
  dryRun: false,
  filesProcessed: 1,        // bookings/expenses
  filesSkipped: 0,          // already-imported files that were skipped
  totalInserted: 146,       // rows written
  warningCount: 8,
  files: [ { fileName, skipped, inserted } ],  // per-file breakdown
  warnings: [ '…human-readable strings…' ],    // every skipped row / correction
  log: [ '…per-file summary lines…' ],
}
```

Investor's result instead carries `facilitiesProcessed`, `monthsInserted`,
`disbursementsInserted`, and (on failure) `refused` + `problems`.

**Return the whole thing to the frontend.** The `warnings` array is the important
part for the admin — it lists every skipped row, auto-corrected date, and
unrecognised value. A non-technical manager needs to see "146 imported, 8 skipped
(no amount)" rather than a bare "success", or they'll never know rows were
dropped.

---

## 5. The endpoint (minimal Express example)

Adapt the auth to whatever the project already uses — the point is: **admin-only,
handle the file in memory, call the library, return the result.**

```js
const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');

const upload = multer({ storage: multer.memoryStorage() });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { importBookings } = require('./lib/bookingImporter');
const { importExpenses } = require('./lib/expenseImporter');
const { importInvestors } = require('./lib/investorImporter');

const router = express.Router();

// requireAdmin: replace with the project's actual auth middleware.
// Must reject non-admins BEFORE the upload is processed.
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

// `type` = 'booking' | 'expense' | 'investor'; `dryRun` optional (preview mode)
router.post('/api/admin/upload', requireAdmin, upload.array('files'), async (req, res) => {
  const { type, dryRun } = req.body;
  const files = req.files || [];
  if (files.length === 0) return res.status(400).json({ error: 'No file uploaded' });

  const client = await pool.connect();
  try {
    let result;
    const opts = { dryRun: dryRun === 'true' };

    if (type === 'booking') {
      const sources = files.map(f => ({ buffer: f.buffer, fileName: f.originalname }));
      result = await importBookings({ client, sources, options: opts });

    } else if (type === 'expense') {
      const sources = files.map(f => ({ buffer: f.buffer, fileName: f.originalname }));
      result = await importExpenses({ client, sources, options: opts });

    } else if (type === 'investor') {
      const f = files[0]; // investor is always one workbook
      result = await importInvestors({
        client,
        source: { buffer: f.buffer, fileName: f.originalname },
        options: { mode: 'replace', dryRun: opts.dryRun },
      });

    } else {
      return res.status(400).json({ error: 'Unknown type' });
    }

    res.json(result);           // frontend renders result.warnings etc.
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();           // ALWAYS release, even on error
  }
});

module.exports = router;
```

---

## 6. Preview-then-commit (recommended)

Every library supports `dryRun: true` — it parses and reports exactly what it
*would* do, writing nothing (investor also runs its validation guard but skips the
wipe). Wire the screen as two steps:

1. Admin uploads → call with `dryRun: true` → show the summary + warnings.
2. Admin reviews, clicks **Confirm** → call again with `dryRun: false`.

This lets the manager catch a bad file (wrong month, missing column) before it
lands, and it maps onto behaviour that already exists — no extra logic needed in
the libraries.

---

## 7. Things to get right

- **Transactions are internal.** Each library opens/commits/rolls back its own
  transactions per file. Do **not** wrap the call in your own `BEGIN`/`COMMIT` —
  just give it a connected client and release it when done.
- **One client per request** is fine. Get it from the pool, pass it in, release
  it in `finally`.
- **`facilities` must be pre-seeded** with codes `KMC`, `EMAAR`, `MALIR`. All
  importers look these up and error if missing. (Already seeded in the DB.)
- **Auth before upload.** The `requireAdmin` check must run before the file is
  parsed — never let a non-admin reach the import.
- **File size limit.** Add a multer `limits: { fileSize: ... }` so a huge upload
  can't exhaust memory (these files are small — a few MB cap is plenty).
- **`.xlsx` only.** Reject other extensions early; the parser expects Excel.
- **Same database.** These libraries read/write the same Postgres the rest of the
  app uses — confirm the upload endpoint points at the same `DATABASE_URL`.

---

## 8. Quick reference

| | Bookings | Expenses | Investors |
|--|----------|----------|-----------|
| Export | `importBookings` | `importExpenses` | `importInvestors` |
| Sources arg | `sources` (array) | `sources` (array) | `source` (single) |
| On upload | append, skip dupes | append, skip dupes | **replace all** |
| Multi-file | yes | usually one | no (one workbook) |
| Safety | per-file txn | per-file txn | validate-before-wipe |
| Key option | `force` | `undatedPolicy` | `mode` |
