const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'MARKETING'), serviceController.getAllServices);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), serviceController.createService);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), serviceController.updateService);

module.exports = router;
