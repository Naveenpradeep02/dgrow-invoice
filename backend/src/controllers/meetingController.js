const db = require('../config/database');
const { logAudit } = require('../services/auditService');

// Get all meetings with filtering & search
async function getAllMeetings(req, res) {
  try {
    const { status = '', meeting_mode = '', client_id = '', search = '', from_date = '', to_date = '' } = req.query;
    let sql = `
      SELECT m.*, c.company_name as client_company, c.contact_person, c.mobile as client_phone, c.email as client_email
      FROM meetings m
      LEFT JOIN clients c ON m.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      sql += ' AND m.status = ?';
      params.push(status);
    }

    if (meeting_mode && meeting_mode !== 'ALL') {
      sql += ' AND m.meeting_mode = ?';
      params.push(meeting_mode);
    }

    if (client_id) {
      sql += ' AND m.client_id = ?';
      params.push(client_id);
    }

    if (from_date) {
      sql += ' AND m.meeting_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      sql += ' AND m.meeting_date <= ?';
      params.push(to_date);
    }

    if (search) {
      sql += ' AND (m.title LIKE ? OR m.client_name LIKE ? OR m.location LIKE ? OR c.company_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY m.meeting_date DESC, m.meeting_time ASC';

    const meetings = await db.query(sql, params);

    // Compute metrics
    const [counts] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduled_count,
        SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count
      FROM meetings
    `);

    res.json({
      success: true,
      meetings,
      metrics: {
        total: counts ? (counts.total || 0) : 0,
        scheduled: counts ? (counts.scheduled_count || 0) : 0,
        completed: counts ? (counts.completed_count || 0) : 0,
        cancelled: counts ? (counts.cancelled_count || 0) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Get single meeting by ID
async function getMeetingById(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query(`
      SELECT m.*, c.company_name as client_company, c.contact_person, c.mobile as client_phone, c.email as client_email
      FROM meetings m
      LEFT JOIN clients c ON m.client_id = c.id
      WHERE m.id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    res.json({ success: true, meeting: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Create new meeting
async function createMeeting(req, res) {
  try {
    const {
      title,
      client_id,
      client_name,
      enquiry_id,
      meeting_mode = 'ONLINE',
      meeting_date,
      meeting_time,
      location,
      status = 'SCHEDULED',
      agenda,
      minutes_notes
    } = req.body;

    if (!title || !meeting_date || !meeting_time) {
      return res.status(400).json({ success: false, message: 'Title, Meeting Date, and Time are required.' });
    }

    let resolvedClientName = client_name || '';
    if (client_id && !resolvedClientName) {
      const clientRows = await db.query('SELECT company_name FROM clients WHERE id = ?', [client_id]);
      if (clientRows && clientRows[0]) {
        resolvedClientName = clientRows[0].company_name;
      }
    }

    const result = await db.query(`
      INSERT INTO meetings 
      (title, client_id, client_name, enquiry_id, meeting_mode, meeting_date, meeting_time, location, status, agenda, minutes_notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      client_id || null,
      resolvedClientName || null,
      enquiry_id || null,
      meeting_mode || 'ONLINE',
      meeting_date,
      meeting_time,
      location || null,
      status || 'SCHEDULED',
      agenda || null,
      minutes_notes || null,
      req.user ? req.user.id : null
    ]);

    await logAudit({
      user: req.user,
      action: 'CREATE_MEETING',
      entity: 'MEETING',
      entity_id: result.insertId,
      details: { title, client_id, meeting_date, meeting_mode }
    });

    res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      meetingId: result.insertId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update existing meeting
async function updateMeeting(req, res) {
  try {
    const { id } = req.params;
    const {
      title,
      client_id,
      client_name,
      meeting_mode,
      meeting_date,
      meeting_time,
      location,
      status,
      agenda,
      minutes_notes
    } = req.body;

    let resolvedClientName = client_name || '';
    if (client_id && !resolvedClientName) {
      const clientRows = await db.query('SELECT company_name FROM clients WHERE id = ?', [client_id]);
      if (clientRows && clientRows[0]) {
        resolvedClientName = clientRows[0].company_name;
      }
    }

    await db.query(`
      UPDATE meetings SET
        title = COALESCE(?, title),
        client_id = COALESCE(?, client_id),
        client_name = COALESCE(?, client_name),
        meeting_mode = COALESCE(?, meeting_mode),
        meeting_date = COALESCE(?, meeting_date),
        meeting_time = COALESCE(?, meeting_time),
        location = COALESCE(?, location),
        status = COALESCE(?, status),
        agenda = COALESCE(?, agenda),
        minutes_notes = COALESCE(?, minutes_notes)
      WHERE id = ?
    `, [
      title || null,
      client_id || null,
      resolvedClientName || null,
      meeting_mode || null,
      meeting_date || null,
      meeting_time || null,
      location || null,
      status || null,
      agenda !== undefined ? agenda : null,
      minutes_notes !== undefined ? minutes_notes : null,
      id
    ]);

    await logAudit({
      user: req.user,
      action: 'UPDATE_MEETING',
      entity: 'MEETING',
      entity_id: id,
      details: { title, status, meeting_date }
    });

    res.json({ success: true, message: 'Meeting updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update Post-Meeting Minutes & Notes
async function updateMeetingNotes(req, res) {
  try {
    const { id } = req.params;
    const { minutes_notes, mark_done = false } = req.body;

    if (!minutes_notes && minutes_notes !== '') {
      return res.status(400).json({ success: false, message: 'Minutes/Notes are required.' });
    }

    let statusSql = '';
    const params = [minutes_notes];
    if (mark_done) {
      statusSql = ", status = 'DONE'";
    }
    params.push(id);

    await db.query(`UPDATE meetings SET minutes_notes = ? ${statusSql} WHERE id = ?`, params);

    res.json({ success: true, message: 'Meeting minutes updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Delete meeting
async function deleteMeeting(req, res) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM meetings WHERE id = ?', [id]);

    await logAudit({
      user: req.user,
      action: 'DELETE_MEETING',
      entity: 'MEETING',
      entity_id: id,
      details: { id }
    });

    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  updateMeetingNotes,
  deleteMeeting
};
