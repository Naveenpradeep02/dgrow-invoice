const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT'), meetingController.getAllMeetings);
router.get('/:id', authenticateToken, authorizeRoles('ADMIN', 'AUDITOR', 'CLIENT'), meetingController.getMeetingById);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), meetingController.createMeeting);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), meetingController.updateMeeting);
router.post('/:id/notes', authenticateToken, authorizeRoles('ADMIN'), meetingController.updateMeetingNotes);
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), meetingController.deleteMeeting);

module.exports = router;
