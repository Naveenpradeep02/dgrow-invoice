const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT', 'MARKETING'), meetingController.getAllMeetings);
router.get('/:id', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT', 'MARKETING'), meetingController.getMeetingById);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), meetingController.createMeeting);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), meetingController.updateMeeting);
router.post('/:id/notes', authenticateToken, authorizeRoles('ADMIN', 'MARKETING'), meetingController.updateMeetingNotes);
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), meetingController.deleteMeeting);

module.exports = router;
