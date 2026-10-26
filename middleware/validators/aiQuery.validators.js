const { body, param } = require('express-validator');

// isInt with no ceiling accepts 99999999999999999999, which is a perfectly
// good integer and a perfectly bad bigint — it reached Postgres and came back
// as a 500 instead of the 400 every other malformed id already got.
const MAX_ID = Number.MAX_SAFE_INTEGER;

const askQuestionValidation = [
  body('question')
    .trim()
    .notEmpty()
    .withMessage('A question is required.')
    .isLength({ max: 500 })
    .withMessage('Question must be under 500 characters.'),
  // Absent on the first turn of a new conversation, so optional rather than
  // required — but when present it has to be an id, since it goes into a
  // lookup that decides which thread gets appended to.
  body('conversationId')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: MAX_ID })
    .withMessage('conversationId must be a positive integer.'),
  body('scope')
    .optional({ values: 'falsy' })
    .isIn(['bookings', 'expenses', 'investors'])
    .withMessage('scope must be bookings, expenses or investors.'),
];

const conversationIdValidation = [
  param('id').isInt({ min: 1, max: MAX_ID }).withMessage('Invalid conversation id.'),
];

module.exports = { askQuestionValidation, conversationIdValidation };
