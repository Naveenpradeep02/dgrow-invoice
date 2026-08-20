const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), clientController.getAllClients);
router.get('/:id', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT'), clientController.getClientById);
router.get('/:id/360-history', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT'), clientController.getClient360History);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), clientController.createClient);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), clientController.updateClient);
router.post('/:id/call-log', authenticateToken, authorizeRoles('ADMIN'), clientController.addClientCallLog);
router.post('/:id/ads', authenticateToken, authorizeRoles('ADMIN'), clientController.addClientAdCampaign);
router.put('/:id/ads/:adId', authenticateToken, authorizeRoles('ADMIN'), clientController.updateClientAdCampaign);

module.exports = router;
