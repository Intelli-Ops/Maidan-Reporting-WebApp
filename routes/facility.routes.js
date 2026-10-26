const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facility.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, facilityController.getFacilities);

module.exports = router;
