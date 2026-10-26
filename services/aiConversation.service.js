'use strict';

const pool = require('../db/pool');

// Long questions make unusable sidebar entries, so the title is the first
// question clipped at a word boundary. Deriving it locally rather than asking
// Gemini for a summary keeps a new conversation to exactly one model call.
const TITLE_MAX = 60;

function deriveTitle(question) {
  const clean = String(question).trim().replace(/\s+/g, ' ');
  if (clean.length <= TITLE_MAX) return clean;
  const clipped = clean.slice(0, TITLE_MAX);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 30 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

const VALID_SCOPES = ['bookings', 'expenses', 'investors'];
const normalizeScope = (scope) => (VALID_SCOPES.includes(scope) ? scope : null);

function mapMessage(row) {
  return {
    id: String(row.id),
    role: row.role,
    content: row.content,
    sql: row.sql_text,
    rowCount: row.row_count,
    rows: row.rows_json ?? undefined,
    error: row.error,
    createdAt: row.created_at,
  };
}

function mapConversation(row) {
  return {
    id: String(row.id),
    title: row.title,
    scope: row.scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count !== undefined ? Number(row.message_count) : undefined,
  };
}

async function listConversations(userId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.scope, c.created_at, c.updated_at,
            COUNT(m.id) AS message_count
     FROM ai_conversations c
     LEFT JOIN ai_messages m ON m.conversation_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.updated_at DESC
     LIMIT 100`,
    [userId]
  );
  return rows.map(mapConversation);
}

/**
 * Returns null rather than throwing when the conversation doesn't exist OR
 * belongs to someone else — the caller turns both into the same 404, so a
 * probe can't distinguish "no such id" from "not yours" and enumerate other
 * users' conversation ids.
 */
async function getConversation(userId, conversationId) {
  const { rows } = await pool.query(
    `SELECT id, title, scope, created_at, updated_at
     FROM ai_conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  if (!rows.length) return null;

  const { rows: messages } = await pool.query(
    `SELECT id, role, content, sql_text, row_count, rows_json, error, created_at
     FROM ai_messages WHERE conversation_id = $1 ORDER BY id`,
    [conversationId]
  );

  return { ...mapConversation(rows[0]), messages: messages.map(mapMessage) };
}

/**
 * Ownership check without loading the thread — used before spending a model
 * call, so a bad conversationId costs nothing.
 */
async function ownsConversation(userId, conversationId) {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM ai_conversations WHERE id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  return rowCount > 0;
}

async function deleteConversation(userId, conversationId) {
  const { rowCount } = await pool.query(
    'DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  return rowCount > 0;
}

/**
 * Persists one question/answer exchange, creating the conversation on the
 * first turn. `answer` is the aiQuery.service result, or `errorMessage` is set
 * when the question failed — a failed turn is still recorded so reopening the
 * thread shows what was asked rather than silently dropping it.
 *
 * Both rows and the parent's updated_at move together in a transaction: a
 * half-written exchange would render as a question with no reply and no way
 * to retry it.
 */
async function appendExchange({ userId, conversationId, scope, question, answer, errorMessage }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let id = conversationId;
    if (id) {
      // Re-checks ownership inside the transaction — without it, passing
      // someone else's conversationId would append to their thread.
      const { rows } = await client.query(
        'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId]
      );
      if (!rows.length) {
        await client.query('ROLLBACK');
        return null;
      }
    } else {
      const { rows } = await client.query(
        'INSERT INTO ai_conversations (user_id, title, scope) VALUES ($1, $2, $3) RETURNING id',
        [userId, deriveTitle(question), normalizeScope(scope)]
      );
      id = rows[0].id;
    }

    await client.query(
      'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [id, 'user', question]
    );

    if (errorMessage) {
      await client.query(
        'INSERT INTO ai_messages (conversation_id, role, content, error) VALUES ($1, $2, $3, $4)',
        [id, 'assistant', '', errorMessage]
      );
    } else {
      await client.query(
        `INSERT INTO ai_messages (conversation_id, role, content, sql_text, row_count, rows_json)
         VALUES ($1, 'assistant', $2, $3, $4, $5)`,
        [id, answer.answer, answer.sql, answer.rowCount, JSON.stringify(answer.rows ?? [])]
      );
    }

    await client.query('UPDATE ai_conversations SET updated_at = now() WHERE id = $1', [id]);
    await client.query('COMMIT');

    return String(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listConversations,
  getConversation,
  ownsConversation,
  deleteConversation,
  appendExchange,
  deriveTitle,
};
