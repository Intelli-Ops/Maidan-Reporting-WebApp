const express = require('express');
const { query } = require('express-validator');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { dateRangeValidation, listValidation } = require('../middleware/validators/reporting.validators');

const categoryIdValidation = [
  query('categoryId').optional().isInt({ min: 1 }).withMessage('categoryId must be a positive integer.'),
];

router.use(authenticateToken);

router.get('/summary', [...dateRangeValidation, ...categoryIdValidation], validate, expenseController.getSummary);
router.get('/list', [...listValidation, ...categoryIdValidation], validate, expenseController.getList);

module.exports = router;
