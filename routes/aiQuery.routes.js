'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAiChatAccess } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { askQuestionValidation, conversationIdValidation } = require('../middleware/validators/aiQuery.validators');
const { aiQueryLimiter } = require('../middleware/rateLimiter');
const aiQueryController = require('../controllers/aiQuery.controller');

// Gated the same way file uploads are: a per-user can_use_ai_chat flag,
// granted at approval time or later by an admin — admins always have access
// regardless of the flag (see requireAiChatAccess).
router.use(authenticateToken, requireAiChatAccess);

router.post('/ask', aiQueryLimiter, askQuestionValidation, validate, aiQueryController.askQuestion);

// History routes deliberately skip aiQueryLimiter: that limiter exists to cap
// spend on Gemini calls, and reading or deleting saved conversations costs
// nothing upstream. Rate-limiting them would throttle simply opening the Ask
// AI screen.
router.get('/conversations', aiQueryController.listConversations);
router.get('/conversations/:id', conversationIdValidation, validate, aiQueryController.getConversation);
router.delete('/conversations/:id', conversationIdValidation, validate, aiQueryController.deleteConversation);

module.exports = router;
