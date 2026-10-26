const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controllers/paymentMethod.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, paymentMethodController.getPaymentMethods);

module.exports = router;
