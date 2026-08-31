const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/change-password', authenticateToken, authController.changePassword);

// Admin-only User Management
router.get('/users', authenticateToken, authorizeRoles('ADMIN'), authController.getAllStaffUsers);
router.post('/users', authenticateToken, authorizeRoles('ADMIN'), authController.createStaffUser);
router.put('/users/:id', authenticateToken, authorizeRoles('ADMIN'), authController.updateStaffUser);
router.delete('/users/:id', authenticateToken, authorizeRoles('ADMIN'), authController.deleteStaffUser);

module.exports = router;
