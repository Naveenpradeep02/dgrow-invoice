const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Metrics endpoint
router.get('/metrics', authenticateToken, enquiryController.getEnquiryMetrics);

// Enquiries CRUD
router.get('/', authenticateToken, enquiryController.getAllEnquiries);
router.get('/:id', authenticateToken, enquiryController.getEnquiryById);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), enquiryController.createEnquiry);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), enquiryController.updateEnquiry);
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), enquiryController.deleteEnquiry);

// Timeline event endpoint
router.post('/:id/timeline', authenticateToken, authorizeRoles('ADMIN'), enquiryController.addTimelineEvent);

// Convert to onboarded client
router.post('/:id/convert', authenticateToken, authorizeRoles('ADMIN'), enquiryController.convertToClient);

module.exports = router;
