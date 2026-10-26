'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { dashboardValidation } = require('../middleware/validators/reporting.validators');
const dashboardController = require('../controllers/dashboard.controller');
const investorDashboardController = require('../controllers/investorDashboard.controller');
const expenseDashboardController = require('../controllers/expenseDashboard.controller');

// All dashboard routes require a valid JWT — same pattern as booking.routes.js
router.use(authenticateToken);

// GET /api/dashboard/bookings
// Returns all 16 booking-dashboard metrics in a single response.
router.get('/bookings', dashboardValidation, validate, dashboardController.getBookingsDashboard);

// GET /api/dashboard/investors
// Returns the investor-dashboard KPIs, trends, facility comparison,
// per-investor summary, and forecast in a single response.
router.get('/investors', dashboardValidation, validate, investorDashboardController.getInvestorDashboard);

// GET /api/dashboard/expenses
// Returns the expense-dashboard KPIs, facility/category/payment-method
// breakdowns, trend charts, and like-for-like month comparison in a single
// response.
router.get('/expenses', dashboardValidation, validate, expenseDashboardController.getExpensesDashboard);

// GET /api/dashboard/expenses/account-references
// Lookup for the expense dashboard's accountType/sourceBank filters — valid
// values plus the full raw-source_account -> normalized mapping.
router.get('/expenses/account-references', expenseDashboardController.getAccountReferences);

module.exports = router;
