const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investor.controller');
const { authenticateToken } = require('../middleware/auth');

// Investor names are business-sensitive, unlike facility/category/payment-method
// labels — this lookup requires auth (same as the investor dashboard itself),
// breaking from the public pattern used by the other reference endpoints.
router.use(authenticateToken);

router.get('/', investorController.getInvestors);

module.exports = router;
