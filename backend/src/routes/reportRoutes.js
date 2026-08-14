const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/kpis', authenticateToken, reportController.getDashboardKPIs);
router.get('/sales', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), reportController.getSalesReport);
router.get('/gst', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), reportController.getGstReport);
router.get('/outstanding', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT'), reportController.getOutstandingReport);

module.exports = router;
