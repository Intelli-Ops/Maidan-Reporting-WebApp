'use strict';

const config = require('../config');
const aiQueryService = require('../services/aiQuery.service');
const aiConversationService = require('../services/aiConversation.service');

function notConfigured(res) {
  return res.status(503).json({
    success: false,
    error: 'The AI chatbot is not configured yet. Set GEMINI_API_KEY to enable it.',
  });
}

// POST /api/ai/ask
// Body: { question, conversationId?, scope? }. Constrained text-to-SQL: the
// question is turned into a single validated, read-only SQL query (see
// aiQuery.service.js), run against the reporting tables, and summarized back
// in plain language.
//
// The exchange is persisted to the caller's history, creating a conversation
// when no conversationId is given. Persistence never changes the outcome of
// the question: a storage failure is logged and the answer still returns,
// because losing a history row is a much smaller problem than throwing away an
// answer the user already waited on and paid a model call for.
async function askQuestion(req, res, next) {
  try {
    if (!config.geminiApiKey) return notConfigured(res);

    const { question, conversationId, scope } = req.body;

    // Checked before the model call, not after: appending to a thread the
    // caller doesn't own has to fail, and finding that out afterwards would
    // mean paying for an answer that then has nowhere to be stored.
    if (conversationId && !(await aiConversationService.ownsConversation(req.user.id, conversationId))) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    let result;
    try {
      result = await aiQueryService.answerQuestion(question);
    } catch (err) {
      if (err instanceof aiQueryService.UnanswerableQuestionError) {
        // Recorded too — reopening the thread should show the question that
        // didn't land, not a gap.
        await aiConversationService
          .appendExchange({
            userId: req.user.id,
            conversationId: conversationId || null,
            scope,
            question,
            errorMessage: err.message,
          })
          .catch((e) => console.error('Failed to persist unanswerable question:', e.message));

        return res.status(422).json({ success: false, error: err.message });
      }
      throw err;
    }

    let savedConversationId = null;
    try {
      savedConversationId = await aiConversationService.appendExchange({
        userId: req.user.id,
        conversationId: conversationId || null,
        scope,
        question,
        answer: result,
      });
    } catch (err) {
      console.error('Failed to persist AI exchange:', err.message);
    }

    res.json({ success: true, data: { ...result, conversationId: savedConversationId } });
  } catch (err) {
    next(err);
  }
}

// GET /api/ai/conversations
async function listConversations(req, res, next) {
  try {
    const conversations = await aiConversationService.listConversations(req.user.id);
    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
}

// GET /api/ai/conversations/:id
async function getConversation(req, res, next) {
  try {
    const conversation = await aiConversationService.getConversation(req.user.id, req.params.id);
    // Same 404 whether the id doesn't exist or belongs to another user, so
    // the response can't be used to enumerate other people's conversations.
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/ai/conversations/:id
async function deleteConversation(req, res, next) {
  try {
    const deleted = await aiConversationService.deleteConversation(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }
    res.json({ success: true, message: 'Conversation deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { askQuestion, listConversations, getConversation, deleteConversation };
