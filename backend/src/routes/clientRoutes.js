const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'MARKETING'), clientController.getAllClients);
router.get('/:id', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT', 'MARKETING'), clientController.getClientById);
router.get('/:id/360-history', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT', 'MARKETING'), clientController.getClient360History);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), clientController.createClient);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), clientController.updateClient);
router.post('/:id/call-log', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), clientController.addClientCallLog);
router.post('/:id/ads', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), clientController.addClientAdCampaign);
router.put('/:id/ads/:adId', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), clientController.updateClientAdCampaign);

module.exports = router;
