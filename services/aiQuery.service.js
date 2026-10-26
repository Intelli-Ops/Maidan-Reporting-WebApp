'use strict';

const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const pool = require('../db/pool');

// Thrown when the question can't be safely turned into an allowed read-only
// query — the controller maps this to a 422 with the message shown to the
// user, instead of a generic 500.
class UnanswerableQuestionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnanswerableQuestionError';
  }
}

let genAI = null;
function client() {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return genAI;
}

// Hand-written (not auto-introspected) so it only ever describes exactly the
// tables/columns the validator below whitelists — every table mentioned here
// is safe to expose read-only, and there's nothing sensitive (bank BIN
// discount tables, import-batch bookkeeping, password/auth columns) in it.
const SCHEMA_DESCRIPTION = `
Tables (Postgres):

facilities (id, code, name, location)
  -- code/name examples: 'KMC'/'Maidan KMC', 'EMAAR'/'Maidan Emaar', 'MALIR'/'Maidan Malir Cantt'

sport_types (id, name)
  -- name examples: 'Futsal', 'Padel'

expense_categories (id, name, parent_category_id)
  -- self-referencing rollup: parent_category_id points to another row's id, or NULL for a top-level category.
  -- every expense is recorded against a leaf (child) category.

payment_methods (id, name)
  -- name examples: 'Cash', 'Card', 'IBFT', 'Cheque', 'NA'

bookings (id, facility_id -> facilities.id, sport_type_id -> sport_types.id, booking_date, duration_hours,
          customer_name, per_hour_rate, gross_amount, discount_pct, discount_amount, net_amount,
          payment_method_id -> payment_methods.id, status, remarks, created_at,
          time_slot_raw, start_time, end_time, slot_start_hour, crosses_midnight, time_parse_status)
  -- net_amount is the actual revenue received. status examples: 'Done', 'Cancel', 'Academy'.
  -- TIME SLOTS. time_slot_raw is the slot exactly as staff typed it and is wildly inconsistent
     ('4:00pm to 6:00pm', '6 to 7', '5-6 pm', '10 pm to 11 pm' are all real values) — NEVER group by it.
     start_time/end_time (time), slot_start_hour (smallint 0-23) and crosses_midnight (boolean) are the
     PARSED slot derived from it, and are what every "which time slot / what time of day / busiest hour"
     question must use. Group by slot_start_hour and add "WHERE slot_start_hour IS NOT NULL" to drop the
     rows whose text could not be parsed.
  -- time_parse_status: 'exact' | 'relaxed' | 'inferred' | 'failed'. 'exact' is the slot text agreeing with
     duration_hours; 'inferred' was a best guess. NULL or 'failed' means unparsed.

expenses (id, facility_id -> facilities.id, expense_category_id -> expense_categories.id, expense_date,
          item, description, amount, payment_method_id -> payment_methods.id, cheque_number,
          source_account, source_bank, created_at)

investors (id, name, contact_info)

facility_investors (id, facility_id -> facilities.id, investor_id -> investors.id, investment_amount,
                     ownership_percentage, effective_from, effective_to)
  -- effective_to IS NULL means the ownership row is currently active.

monthly_profit (id, facility_id -> facilities.id, period_month, profit_amount, entered_by, notes)
  -- period_month is stored as the first day of the month, e.g. 2026-05-01.

disbursements (id, facility_investor_id -> facility_investors.id, monthly_profit_id -> monthly_profit.id,
               period_month, ownership_pct_used, disbursed_amount, status, disbursed_date)
  -- status examples: 'Pending', 'Disbursed'.
`.trim();

const ALLOWED_TABLES = new Set([
  'facilities',
  'sport_types',
  'expense_categories',
  'payment_methods',
  'bookings',
  'expenses',
  'investors',
  'facility_investors',
  'monthly_profit',
  'disbursements',
]);

// Whole-word tokens that must never appear in a generated query — covers
// every write/DDL/session/introspection statement type plus the SELECT...INTO
// footgun (creates a table) and comment markers (a comment could hide a
// second statement past a naive "no semicolon" check).
const FORBIDDEN_TOKENS = [
  'insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'grant', 'revoke',
  'create', 'copy', 'execute', 'call', 'merge', 'vacuum', 'comment', 'listen',
  'notify', 'refresh', 'into', 'pg_sleep', 'pg_read_file', 'dblink',
  'information_schema', 'pg_catalog', 'pg_proc',
];

function buildSqlPrompt(question, todayIso) {
  return `You are a SQL generator for a read-only Postgres reporting database at a sports-facility company.

${SCHEMA_DESCRIPTION}

Rules — follow all of them exactly:
1. Output ONLY a single SQL statement. No markdown code fences, no explanation, no comments.
2. The statement must start with SELECT or WITH, and must be a single statement (no semicolons except optionally one at the very end).
3. Only use the tables and columns listed above. Never reference any other table.
4. Never use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, or any statement that isn't a plain read (SELECT/WITH).
5. If the question cannot be answered using only the tables/columns above, output exactly: NOT_ANSWERABLE
6. Today's date is ${todayIso}. Resolve relative dates ("this month", "last week", "this year") against it.
7. Prefer a LIMIT clause (e.g. LIMIT 200) unless the query is a single-row aggregate.
8. For free-text fields (customer_name, item, description, remarks, notes, source_account, source_bank), match with case-insensitive partial matching (ILIKE '%value%') unless the question clearly gives a full, exact value — real data is entered inconsistently (e.g. "Ahmed" vs "Ahmed Ali" vs "Hussain Ahmed" are all distinct customer_name values). For fixed/enum-like fields (status, facilities.code, sport_types.name, payment_methods.name, expense_categories.name), match the exact value case-insensitively (ILIKE without wildcards, or lower(x) = lower('value')).
9. Day of week: use EXTRACT(DOW FROM booking_date) — 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday. Friday is 5. Return a readable label too (to_char(booking_date, 'FMDay')) rather than only the number.
10. Time-of-day / "which time slot" questions: GROUP BY slot_start_hour (never time_slot_raw), filter "slot_start_hour IS NOT NULL", and return slot_start_hour alongside the count so the answer can name the hour. For a LEAST/fewest/quietest question remember that an hour with zero bookings does not appear in a plain GROUP BY at all — LEFT JOIN generate_series(0,23) AS hour so empty hours show up as 0 instead of being invisible.
11. Counting bookings means counting rows. Exclude cancellations with "status NOT ILIKE 'Cancel'" unless the question is specifically about cancellations.

Question: ${question}`;
}

function buildAnswerPrompt(question, rows) {
  return `You are answering a user's question about business data using the exact query results below (JSON array of rows). Answer in 1-3 concise sentences, in plain language, using only this data. Do not mention SQL, databases, or queries. Numeric amounts have no currency stored — state them as plain numbers (e.g. "29,229,050"), never invent or assume a currency symbol like $. If the array is empty, say plainly that no matching records were found.

Question: ${question}

Query results (JSON):
${JSON.stringify(rows).slice(0, 8000)}`;
}

function stripCodeFence(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:sql)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

async function generateSql(question, todayIso, repair) {
  // On a repair pass the model is shown its own rejected query and the reason,
  // which is a far stronger signal than the schema alone — most rejections are
  // one wrong column or one unexposed table, not a misunderstood question.
  const contents = repair
    ? `${buildSqlPrompt(question, todayIso)}

You already answered this question with the query below, and it was REJECTED:

${repair.sql}

Reason: ${repair.reason}

Output a corrected single SQL statement that avoids that problem. Output only the SQL, or exactly NOT_ANSWERABLE if it genuinely cannot be answered from the tables above.`
    : buildSqlPrompt(question, todayIso);

  const response = await client().models.generateContent({
    model: config.geminiModel,
    contents,
    config: { temperature: 0 },
  });

  const raw = stripCodeFence(response.text || '');
  if (!raw || raw.toUpperCase() === 'NOT_ANSWERABLE') {
    throw new UnanswerableQuestionError(
      "I can only answer questions about bookings, expenses, and investor data recorded in the system. Try rephrasing your question."
    );
  }
  return raw;
}

// Blanks the CONTENTS of every single-quoted literal, keeping the same length
// so positions computed afterwards still line up with the original statement.
// A keyword inside a literal is data and cannot execute, but left in place it
// trips the scans below — "expenses with 'delete' in the remarks" would be
// rejected as a DELETE attempt, and a literal containing the word "from" would
// be read as a table reference.
function blankStringLiterals(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, (literal) => `'${' '.repeat(literal.length - 2)}'`);
}

// Marks every character sitting at the ARGUMENT level of a function that uses
// FROM/IN as syntax rather than as a table reference:
//
//   EXTRACT(DOW FROM booking_date)   SUBSTRING(remarks FROM 1 FOR 5)
//   TRIM(BOTH ' ' FROM item)         POSITION('x' IN remarks)
//
// Without this the table scan reads "FROM booking_date" as a table named
// booking_date and rejects the query — which silently killed every
// "by day of week", "by month" and "by hour" question, the exact shape of
// question this assistant exists to answer.
//
// Only the call's own argument level is masked (depth 1). A subquery nested
// deeper inside one still has its FROM scanned as a real table reference, so
// this cannot be used to smuggle an unexposed table past the whitelist.
function argumentLevelMask(sql) {
  const mask = new Array(sql.length).fill(false);
  const calls = /\b(?:extract|substring|trim|position|overlay)\s*\(/gi;

  let call;
  while ((call = calls.exec(sql)) !== null) {
    const open = call.index + call[0].length - 1;
    let depth = 0;
    for (let i = open; i < sql.length; i++) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
      if (depth === 1) mask[i] = true;
    }
  }
  return mask;
}

// Set-returning functions that are legitimate FROM targets. Both are pure
// value generators — they read no table, so exposing them grants no data the
// whitelist is withholding. generate_series in particular is how you ask for
// "every hour of the day" including the ones with no rows at all, which is
// exactly what a "which slot was LEAST booked" question needs.
const ALLOWED_FROM_FUNCTIONS = new Set(['generate_series', 'unnest']);

// Defense-in-depth validator. The model is instructed to only ever produce a
// safe read-only query, but nothing stops a cleverly-worded question from
// trying to coax it into something else — this is the actual safety
// boundary, not the prompt wording above.
function validateSql(sql) {
  let statement = sql.trim().replace(/;+\s*$/, '');

  if (/;/.test(statement)) {
    throw new UnanswerableQuestionError('Only a single query is allowed.');
  }
  if (/--|\/\*/.test(statement)) {
    throw new UnanswerableQuestionError('Comments are not allowed in the generated query.');
  }
  // Dollar quoting lets a literal span anything at all, and blankStringLiterals
  // only understands ordinary single quotes — so refuse it outright rather
  // than scanning a statement we cannot read reliably.
  if (/\$[a-zA-Z_0-9]*\$/.test(statement)) {
    throw new UnanswerableQuestionError('Dollar-quoted strings are not allowed in the generated query.');
  }
  if (!/^(select|with)\b/i.test(statement)) {
    throw new UnanswerableQuestionError('Only read-only SELECT queries are allowed.');
  }

  // Every check below reads structure only, never literal text.
  const scannable = blankStringLiterals(statement);

  for (const token of FORBIDDEN_TOKENS) {
    if (new RegExp(`\b${token}\b`, 'i').test(scannable)) {
      throw new UnanswerableQuestionError(
        `The generated query used a disallowed keyword ("${token}"). Try rephrasing your question.`
      );
    }
  }

  // A WITH clause's own CTE names (e.g. "WITH recent AS (...) SELECT * FROM
  // recent") aren't real tables, but they do show up as a FROM/JOIN target —
  // collect them so the loop below doesn't reject a query for referencing
  // its own CTE.
  const cteNames = new Set(
    [...scannable.matchAll(/(?:\bwith\s+|,\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(/gi)].map((m) => m[1].toLowerCase())
  );

  const argumentLevel = argumentLevelMask(scannable);

  const tableMatches = [...scannable.matchAll(/\b(?:from|join)\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*(\()?/gi)];
  for (const match of tableMatches) {
    if (argumentLevel[match.index]) continue;

    const table = match[1].toLowerCase();
    if (match[2] && ALLOWED_FROM_FUNCTIONS.has(table)) continue;
    if (!ALLOWED_TABLES.has(table) && !cteNames.has(table)) {
      throw new UnanswerableQuestionError(
        `The generated query referenced a table that isn't exposed to the chatbot ("${table}").`
      );
    }
  }

  if (!/\blimit\b/i.test(scannable)) {
    statement += ' LIMIT 200';
  }

  return statement;
}

// Runs inside a read-only transaction with a short statement timeout, on its
// own client (not pool.query) — SET LOCAL only applies within the
// transaction it's issued in.
async function runReadOnlyQuery(sql) {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    await dbClient.query("SET LOCAL statement_timeout = '5s'");
    await dbClient.query('SET TRANSACTION READ ONLY');
    const result = await dbClient.query(sql);
    await dbClient.query('COMMIT');
    return result.rows;
  } catch (err) {
    await dbClient.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    dbClient.release();
  }
}

// The date span the data actually covers. Cached because it moves only when
// a new sheet is imported, and it is needed on the empty-result path where a
// second round-trip would be pure latency. It turns the dead-end "no matching
// records" into something the user can act on: the single most common reason a
// well-formed question returns nothing is that it asked about a period the
// imported data does not reach.
let coverageCache = null;
async function dataCoverage() {
  if (coverageCache && Date.now() - coverageCache.at < 5 * 60_000) return coverageCache.value;

  try {
    const { rows } = await pool.query(
      `SELECT to_char(min(booking_date), 'DD Mon YYYY') AS first_booking,
              to_char(max(booking_date), 'DD Mon YYYY') AS last_booking
         FROM bookings`
    );
    coverageCache = { at: Date.now(), value: rows[0] || null };
  } catch {
    coverageCache = { at: Date.now(), value: null };
  }
  return coverageCache.value;
}

async function summarizeResult(question, rows) {
  if (rows.length === 0) {
    const coverage = await dataCoverage();
    return coverage && coverage.first_booking
      ? `No records matched that question. Booking data currently runs from ${coverage.first_booking} to ${coverage.last_booking}, so a period outside that range will come back empty.`
      : 'No matching records were found for that question.';
  }

  const response = await client().models.generateContent({
    model: config.geminiModel,
    contents: buildAnswerPrompt(question, rows),
    config: { temperature: 0.3 },
  });

  return (response.text || '').trim() || 'Here are the matching results.';
}

// One generate -> validate -> run cycle. Returns the rows and the exact SQL
// that produced them, or throws with the reason the attempt failed so the
// caller can hand that reason back to the model.
async function attemptQuery(question, todayIso, repair) {
  const rawSql = await generateSql(question, todayIso, repair);

  let safeSql;
  try {
    safeSql = validateSql(rawSql);
  } catch (err) {
    // A rejection is the most repairable failure there is — the model gets the
    // exact rule it broke plus the query that broke it. Carrying the context
    // out on the error is what lets answerQuestion retry rather than give up.
    err.repairReason = err.message;
    err.repairSql = rawSql;
    throw err;
  }

  try {
    return { sql: safeSql, rows: await runReadOnlyQuery(safeSql) };
  } catch (err) {
    // Postgres' own message ("column b.slot_start_hourr does not exist") is
    // the most useful possible repair hint, so it is kept for the retry — but
    // it is never surfaced to the user.
    console.error('AI query failed to execute:', err.message, '| SQL:', safeSql);
    const failure = new UnanswerableQuestionError(
      'The generated query could not be run against the database. Try rephrasing your question.'
    );
    failure.repairReason = err.message;
    failure.repairSql = safeSql;
    throw failure;
  }
}

async function answerQuestion(question) {
  const todayIso = new Date().toISOString().slice(0, 10);

  let result;
  try {
    result = await attemptQuery(question, todayIso);
  } catch (err) {
    // A rejected or broken query used to be the end of the road, which is what
    // made ordinary questions look unanswerable. Give the model one shot at
    // fixing its own query with the reason in hand before giving up. Only
    // repairable failures qualify: a genuine NOT_ANSWERABLE carries no reason
    // and is not retried, so an off-topic question still fails fast.
    const reason = err.repairReason || (err instanceof UnanswerableQuestionError ? err.message : null);
    const previousSql = err.repairSql;
    if (!previousSql || !reason) throw err;

    result = await attemptQuery(question, todayIso, { sql: previousSql, reason });
  }

  const { sql: safeSql, rows } = result;

  const answer = await summarizeResult(question, rows);

  return {
    question,
    answer,
    sql: safeSql,
    rowCount: rows.length,
    rows: rows.slice(0, 50),
  };
}

module.exports = {
  answerQuestion,
  UnanswerableQuestionError,
};
