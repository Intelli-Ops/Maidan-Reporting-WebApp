const express = require('express');
const { query } = require('express-validator');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { dateRangeValidation, listValidation } = require('../middleware/validators/reporting.validators');

const sportTypeIdValidation = [
  query('sportTypeId').optional().isInt({ min: 1 }).withMessage('sportTypeId must be a positive integer.'),
];

// Protect all booking routes with JWT authentication
router.use(authenticateToken);

router.get('/summary', [...dateRangeValidation, ...sportTypeIdValidation], validate, bookingController.getSummary);
router.get('/list', [...listValidation, ...sportTypeIdValidation], validate, bookingController.getList);

module.exports = router;
