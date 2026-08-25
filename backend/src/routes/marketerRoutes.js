const express = require('express');
const router = express.Router();
const marketerController = require('../controllers/marketerController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Get real-time aggregated metrics (Admin only)
router.get('/metrics', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), marketerController.getMarketerMetrics);

// Get specific marketer's drilldown activity & converted client list
router.get('/:id/activity', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), marketerController.getMarketerActivity);

module.exports = router;
