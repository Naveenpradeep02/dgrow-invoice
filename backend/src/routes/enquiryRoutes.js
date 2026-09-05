const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Metrics endpoint
router.get('/metrics', authenticateToken, enquiryController.getEnquiryMetrics);

// Enquiries CRUD
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MARKETING', 'AUDITOR'), enquiryController.getAllEnquiries);
router.get('/:id', authenticateToken, authorizeRoles('ADMIN', 'MARKETING', 'AUDITOR'), enquiryController.getEnquiryById);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), enquiryController.createEnquiry);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), enquiryController.updateEnquiry);
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), enquiryController.deleteEnquiry);

// Timeline event endpoint
router.post('/:id/timeline', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), enquiryController.addTimelineEvent);

// 1-Click Assign Marketer endpoint
router.put('/:id/assign', authenticateToken, authorizeRoles('ADMIN'), enquiryController.assignEnquiry);

// Convert to onboarded client
router.post('/:id/convert', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), enquiryController.convertToClient);

module.exports = router;
