const express = require('express');
const router = express.Router();
const proposalController = require('../controllers/proposalController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Public Client Routes (No Token Header Required)
router.get('/public/:token', proposalController.getPublicProposal);
router.post('/public/:token/confirm', proposalController.confirmPublicPackage);

// Authenticated CRM Routes (Admin & Auditor)
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), proposalController.getAllProposals);
router.get('/:id', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR'), proposalController.getProposalById);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), proposalController.createProposal);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), proposalController.updateProposal);
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), proposalController.deleteProposal);
router.get('/quotations/list', authenticateToken, authorizeRoles('ADMIN', 'MARKETING', 'AUDITOR'), proposalController.getAllQuotations);
router.post('/:id/convert-quotation', authenticateToken, authorizeRoles('ADMIN'), proposalController.convertProposalToQuotation);

module.exports = router;
