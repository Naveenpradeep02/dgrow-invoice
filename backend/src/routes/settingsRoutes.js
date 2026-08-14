const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, settingsController.getSettings);
router.put('/company', authenticateToken, authorizeRoles('ADMIN'), settingsController.updateCompanySettings);
router.put('/terms', authenticateToken, authorizeRoles('ADMIN'), settingsController.updateTerms);

module.exports = router;
