const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getRealNotifications } = require('../controllers/notificationController');

// GET /api/notifications - Real invoice ready & payment pending alerts
router.get('/', authenticateToken, getRealNotifications);

module.exports = router;
