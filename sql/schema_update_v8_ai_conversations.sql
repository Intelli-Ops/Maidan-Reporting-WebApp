-- =====================================================================
-- SCHEMA UPDATE v8 — Saved AI chat history
-- Run this AFTER schema_update_v7_ai_chat_rights.sql has been applied.
--
-- /api/ai/ask was stateless: it answered a question and kept nothing, so
-- every panel open started blank. These two tables give the assistant a
-- history that belongs to the user account rather than to a browser, so it
-- follows them across machines and survives clearing site data.
--
-- Conversations are per-user and never shared: every query in
-- aiConversation.service.js filters on user_id, and ON DELETE CASCADE means
-- deactivating/removing a user takes their history with them rather than
-- orphaning rows that still hold their questions.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Derived from the first question (truncated), not asked for — a titling
    -- round-trip to Gemini would double the cost of every new conversation.
    title       TEXT NOT NULL,
    -- Which dashboard the conversation started from ('bookings' / 'expenses'
    -- / 'investors'), or NULL when started from the Ask AI screen. Only used
    -- to label the row in the history list.
    scope       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The history list is always "my conversations, most recently used first",
-- so the index carries updated_at rather than leaving it to a sort.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
    ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
    id               BIGSERIAL PRIMARY KEY,
    conversation_id  BIGINT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content          TEXT NOT NULL,

    -- Assistant rows only: the audit trail the UI shows under an answer.
    -- Stored rather than recomputed because the same question re-asked later
    -- can generate different SQL — the record has to be what actually ran.
    sql_text         TEXT,
    row_count        INTEGER,
    rows_json        JSONB,

    -- Set instead of the three columns above when the question failed
    -- (unanswerable, upstream error). Kept in the thread so reopening a
    -- conversation shows what was asked and that it didn't land, rather than
    -- silently dropping the turn.
    error            TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON ai_messages(conversation_id, id);
