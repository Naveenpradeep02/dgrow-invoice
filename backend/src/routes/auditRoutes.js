const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), auditController.getAuditLogs);
router.get('/invoice/:invoiceId', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), auditController.getInvoiceAuditHistory);

module.exports = router;
