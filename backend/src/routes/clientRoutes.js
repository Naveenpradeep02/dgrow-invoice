const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), clientController.getAllClients);
router.get('/:id', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT'), clientController.getClientById);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), clientController.createClient);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), clientController.updateClient);

module.exports = router;
