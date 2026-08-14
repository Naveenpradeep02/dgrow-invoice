const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, paymentController.getAllPayments);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), paymentController.recordPayment);

module.exports = router;
