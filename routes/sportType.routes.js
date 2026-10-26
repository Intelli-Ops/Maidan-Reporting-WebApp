const express = require('express');
const router = express.Router();
const sportTypeController = require('../controllers/sportType.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, sportTypeController.getSportTypes);

module.exports = router;
