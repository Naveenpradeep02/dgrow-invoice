const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), serviceController.getAllServices);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), serviceController.createService);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), serviceController.updateService);

module.exports = router;
