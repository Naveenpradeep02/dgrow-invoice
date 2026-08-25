const db = require('../config/database');

// Helper to construct date condition
function getDateRange(period = 'monthly', fromDate = '', toDate = '') {
  const now = new Date();
  let startStr = '';
  let endStr = '';

  if (period === 'daily') {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    startStr = `${yyyy}-${mm}-${dd} 00:00:00`;
    endStr = `${yyyy}-${mm}-${dd} 23:59:59`;
  } else if (period === 'weekly') {
    const day = now.getDay(); // 0 is Sunday, 1 is Monday
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    startStr = `${yyyy}-${mm}-${dd} 00:00:00`;
  } else if (period === 'monthly') {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    startStr = `${yyyy}-${mm}-01 00:00:00`;
  } else if (period === 'custom' && fromDate) {
    startStr = `${fromDate} 00:00:00`;
    if (toDate) endStr = `${toDate} 23:59:59`;
  }

  return { startStr, endStr };
}

// Get all marketers with aggregated performance metrics for the given period
async function getMarketerMetrics(req, res) {
  try {
    const { period = 'monthly', from_date = '', to_date = '' } = req.query;
    const { startStr, endStr } = getDateRange(period, from_date, to_date);

    // 1. Fetch all marketing users
    const marketers = await db.query(
      `SELECT u.id, u.name, u.email, u.status, u.created_at, r.name as role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE r.name = 'MARKETING' OR u.role_id = 4 
       ORDER BY u.name ASC`
    );

    // 2. Fetch enquiries in period
    let enqSql = 'SELECT * FROM enquiries WHERE 1=1';
    const enqParams = [];
    if (startStr) {
      enqSql += ' AND created_at >= ?';
      enqParams.push(startStr);
    }
    if (endStr) {
      enqSql += ' AND created_at <= ?';
      enqParams.push(endStr);
    }
    const enquiries = await db.query(enqSql, enqParams);

    // 3. Fetch meetings in period
    let meetSql = 'SELECT * FROM meetings WHERE 1=1';
    const meetParams = [];
    if (startStr) {
      meetSql += ' AND meeting_date >= ?';
      meetParams.push(startStr.split(' ')[0]);
    }
    if (endStr) {
      meetSql += ' AND meeting_date <= ?';
      meetParams.push(endStr.split(' ')[0]);
    }
    const meetings = await db.query(meetSql, meetParams);

    // 4. Calculate individual performance
    let totalEnquiriesAll = enquiries.length;
    let totalMeetingsAll = meetings.length;
    let totalConvertedClientsAll = 0;
    let totalConvertedRevenueAll = 0;

    const marketerStats = marketers.map(m => {
      const marketerNameLower = m.name.toLowerCase().trim();

      // Match enquiries by marketing_person name or created_by id
      const mktEnquiries = enquiries.filter(e => {
        const empName = (e.marketing_person || '').toLowerCase().trim();
        return (empName && (empName === marketerNameLower || marketerNameLower.includes(empName) || empName.includes(marketerNameLower))) ||
               (e.created_by === m.id);
      });

      const totalEnq = mktEnquiries.length;
      const convertedEnq = mktEnquiries.filter(e => e.status === 'ONBOARDED');
      const inDiscussionEnq = mktEnquiries.filter(e => e.status === 'IN_DISCUSSION' || e.status === 'QUOTATION_SENT' || e.status === 'NEGOTIATION');
      const newEnq = mktEnquiries.filter(e => e.status === 'NEW');
      const lostEnq = mktEnquiries.filter(e => e.status === 'LOST');

      const convertedCount = convertedEnq.length;
      totalConvertedClientsAll += convertedCount;

      const convertedValue = convertedEnq.reduce((sum, e) => sum + parseFloat(e.estimated_budget || 0), 0);
      totalConvertedRevenueAll += convertedValue;

      const activePipelineValue = inDiscussionEnq.reduce((sum, e) => sum + parseFloat(e.estimated_budget || 0), 0);

      const conversionRate = totalEnq > 0 ? Math.round((convertedCount / totalEnq) * 100) : 0;

      // Match meetings
      const mktMeetings = meetings.filter(meet => {
        const notes = (meet.notes || '').toLowerCase();
        const clientName = (meet.client_name || '').toLowerCase();
        const matchesEnq = mktEnquiries.some(e => clientName.includes(e.name.toLowerCase()) || clientName.includes((e.business_name || '').toLowerCase()));
        return matchesEnq || notes.includes(marketerNameLower) || (meet.created_by === m.id);
      });

      const completedMeetings = mktMeetings.filter(meet => meet.status === 'DONE').length;

      return {
        id: m.id,
        name: m.name,
        email: m.email,
        status: m.status,
        joined_at: m.created_at,
        period,
        enquiries_count: totalEnq,
        enquiries_new: newEnq.length,
        enquiries_in_discussion: inDiscussionEnq.length,
        enquiries_converted: convertedCount,
        enquiries_lost: lostEnq.length,
        converted_clients_count: convertedCount,
        converted_revenue: convertedValue,
        pipeline_value: activePipelineValue,
        conversion_rate_percent: conversionRate,
        meetings_total: mktMeetings.length,
        meetings_completed: completedMeetings
      };
    });

    // Sort by converted_revenue desc
    marketerStats.sort((a, b) => b.converted_revenue - a.converted_revenue || b.converted_clients_count - a.converted_clients_count);

    res.json({
      success: true,
      period,
      start_date: startStr,
      end_date: endStr,
      summary: {
        total_marketers: marketers.length,
        active_marketers: marketers.filter(m => m.status === 'ACTIVE').length,
        total_enquiries: totalEnquiriesAll,
        total_meetings: totalMeetingsAll,
        total_converted_clients: totalConvertedClientsAll,
        total_converted_revenue: totalConvertedRevenueAll
      },
      marketers: marketerStats
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Get specific marketer drilldown activity
async function getMarketerActivity(req, res) {
  try {
    const marketerId = parseInt(req.params.id);
    const { period = 'all', from_date = '', to_date = '' } = req.query;
    const { startStr, endStr } = getDateRange(period, from_date, to_date);

    const user = await db.query('SELECT id, name, email, status, created_at FROM users WHERE id = ?', [marketerId]);
    if (!user || user.length === 0) {
      return res.status(404).json({ success: false, message: 'Marketer not found.' });
    }

    const marketerNameLower = user[0].name.toLowerCase().trim();

    // Fetch marketer's enquiries
    let enqSql = 'SELECT * FROM enquiries WHERE 1=1';
    const enqParams = [];
    if (startStr) {
      enqSql += ' AND created_at >= ?';
      enqParams.push(startStr);
    }
    if (endStr) {
      enqSql += ' AND created_at <= ?';
      enqParams.push(endStr);
    }
    enqSql += ' ORDER BY created_at DESC';

    const allEnquiries = await db.query(enqSql, enqParams);
    const marketerEnquiries = allEnquiries.filter(e => {
      const empName = (e.marketing_person || '').toLowerCase().trim();
      return (empName && (empName === marketerNameLower || marketerNameLower.includes(empName) || empName.includes(marketerNameLower))) ||
             (e.created_by === marketerId);
    });

    // Converted clients
    const convertedClients = marketerEnquiries.filter(e => e.status === 'ONBOARDED');

    // Fetch meetings
    const allMeetings = await db.query('SELECT * FROM meetings ORDER BY meeting_date DESC');
    const marketerMeetings = allMeetings.filter(meet => {
      const clientName = (meet.client_name || '').toLowerCase();
      const notes = (meet.notes || '').toLowerCase();
      const matchesEnq = marketerEnquiries.some(e => clientName.includes(e.name.toLowerCase()) || clientName.includes((e.business_name || '').toLowerCase()));
      return matchesEnq || notes.includes(marketerNameLower) || (meet.created_by === marketerId);
    });

    res.json({
      success: true,
      marketer: user[0],
      period,
      summary: {
        total_enquiries: marketerEnquiries.length,
        converted_clients: convertedClients.length,
        total_revenue: convertedClients.reduce((sum, e) => sum + parseFloat(e.estimated_budget || 0), 0),
        meetings_count: marketerMeetings.length
      },
      converted_clients: convertedClients,
      enquiries: marketerEnquiries,
      meetings: marketerMeetings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getMarketerMetrics,
  getMarketerActivity
};
