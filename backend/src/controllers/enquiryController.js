const db = require('../config/database');
const { logAudit } = require('../services/auditService');

// Helper to calculate date boundaries
function getDateRange(timeFilter, fromDate, toDate) {
  const now = new Date();
  let start = null;
  let end = null;

  if (timeFilter === 'weekly') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    start = d.toISOString().split('T')[0] + ' 00:00:00';
    end = now.toISOString().split('T')[0] + ' 23:59:59';
  } else if (timeFilter === 'monthly') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    start = d.toISOString().split('T')[0] + ' 00:00:00';
    end = now.toISOString().split('T')[0] + ' 23:59:59';
  } else if (timeFilter === 'custom' && fromDate && toDate) {
    start = fromDate + ' 00:00:00';
    end = toDate + ' 23:59:59';
  }

  return { start, end };
}

// 1. Get All Enquiries with Filtering
async function getAllEnquiries(req, res) {
  try {
    const {
      search = '',
      source = '',
      status = '',
      time_filter = '',
      from_date = '',
      to_date = ''
    } = req.query;

    let sql = `
      SELECT e.*, c.company_name as onboarded_client_name
      FROM enquiries e
      LEFT JOIN clients c ON e.converted_client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (e.name LIKE ? OR e.business_name LIKE ? OR e.email LIKE ? OR e.mobile LIKE ? OR e.services_interested LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (source && source !== 'ALL') {
      sql += ` AND e.source = ?`;
      params.push(source);
    }

    if (status && status !== 'ALL') {
      sql += ` AND e.status = ?`;
      params.push(status);
    }

    const { start, end } = getDateRange(time_filter, from_date, to_date);
    if (start && end) {
      sql += ` AND e.created_at >= ? AND e.created_at <= ?`;
      params.push(start, end);
    }

    sql += ` ORDER BY e.created_at DESC`;

    const enquiries = await db.query(sql, params);

    res.json({
      success: true,
      count: enquiries.length,
      enquiries
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Get Single Enquiry with Timeline and Linked Quotations
async function getEnquiryById(req, res) {
  try {
    const { id } = req.params;

    const enquiries = await db.query(
      `SELECT e.*, c.company_name as onboarded_client_name, c.mobile as client_mobile, c.email as client_email
       FROM enquiries e
       LEFT JOIN clients c ON e.converted_client_id = c.id
       WHERE e.id = ?`,
      [id]
    );

    const enquiry = enquiries[0];
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    const timeline = await db.query(
      `SELECT * FROM enquiry_timeline WHERE enquiry_id = ? ORDER BY created_at DESC, id DESC`,
      [id]
    );

    res.json({
      success: true,
      enquiry,
      timeline
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Create New Enquiry
async function createEnquiry(req, res) {
  try {
    const {
      name,
      email = '',
      mobile,
      business_name,
      source = 'WEBSITE',
      marketing_person = '',
      services_interested = '',
      estimated_budget = 0,
      status = 'NEW',
      notes = ''
    } = req.body;

    if (!name || !mobile || !business_name) {
      return res.status(400).json({
        success: false,
        message: 'Name, Mobile Number, and Business Name are required.'
      });
    }

    const result = await db.query(
      `INSERT INTO enquiries 
       (name, email, mobile, business_name, source, marketing_person, services_interested, estimated_budget, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        (email || '').trim(),
        mobile.trim(),
        business_name.trim(),
        source,
        (marketing_person || '').trim(),
        (services_interested || '').trim(),
        parseFloat(estimated_budget || 0),
        status,
        (notes || '').trim(),
        req.user ? req.user.id : 1
      ]
    );

    const enquiryId = result.insertId;

    // Record initial timeline event
    await db.query(
      `INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name)
       VALUES (?, 'NOTE', 'Enquiry Created', ?, ?)`,
      [
        enquiryId,
        `Lead created from source: ${source}. Initial status set to ${status}. ${notes ? `Notes: ${notes}` : ''}`,
        req.user ? req.user.name : 'Admin'
      ]
    );

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'ENQUIRY',
      entity_id: enquiryId,
      new_data: { id: enquiryId, name, business_name, source, status },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Enquiry created successfully.',
      enquiryId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Update Enquiry Details
async function updateEnquiry(req, res) {
  try {
    const { id } = req.params;
    const oldEnquiries = await db.query('SELECT * FROM enquiries WHERE id = ?', [id]);
    const oldEnquiry = oldEnquiries[0];

    if (!oldEnquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    const {
      name = oldEnquiry.name,
      email = oldEnquiry.email,
      mobile = oldEnquiry.mobile,
      business_name = oldEnquiry.business_name,
      source = oldEnquiry.source,
      marketing_person = oldEnquiry.marketing_person,
      services_interested = oldEnquiry.services_interested,
      estimated_budget = oldEnquiry.estimated_budget,
      status = oldEnquiry.status,
      notes = oldEnquiry.notes
    } = req.body;

    await db.query(
      `UPDATE enquiries SET
        name = ?, email = ?, mobile = ?, business_name = ?, source = ?, marketing_person = ?,
        services_interested = ?, estimated_budget = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        name.trim(),
        (email || '').trim(),
        mobile.trim(),
        business_name.trim(),
        source,
        (marketing_person || '').trim(),
        (services_interested || '').trim(),
        parseFloat(estimated_budget || 0),
        status,
        (notes || '').trim(),
        id
      ]
    );

    // If status changed, record timeline event automatically
    if (status !== oldEnquiry.status) {
      await db.query(
        `INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name)
         VALUES (?, 'STATUS_CHANGE', ?, ?, ?)`,
        [
          id,
          `Status Changed: ${status}`,
          `Lead status moved from ${oldEnquiry.status} to ${status}.`,
          req.user ? req.user.name : 'Admin'
        ]
      );
    }

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'ENQUIRY',
      entity_id: id,
      old_data: oldEnquiry,
      new_data: req.body,
      req
    });

    res.json({
      success: true,
      message: 'Enquiry updated successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 5. Add Timeline / Negotiation Event
async function addTimelineEvent(req, res) {
  try {
    const { id } = req.params;
    const { event_type = 'NOTE', title, details = '' } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Event title / summary is required.' });
    }

    const enquiries = await db.query('SELECT * FROM enquiries WHERE id = ?', [id]);
    if (!enquiries[0]) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    await db.query(
      `INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        event_type,
        title.trim(),
        (details || '').trim(),
        req.user ? req.user.name : 'Admin'
      ]
    );

    // If event is NEGOTIATION and status is not ONBOARDED or LOST, optionally update status to NEGOTIATION
    if (event_type === 'NEGOTIATION' && enquiries[0].status !== 'ONBOARDED') {
      await db.query(`UPDATE enquiries SET status = 'NEGOTIATION' WHERE id = ?`, [id]);
    }

    res.status(201).json({
      success: true,
      message: 'Timeline record added successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 6. Convert Enquiry to Onboarded Client (1-Click Conversion)
async function convertToClient(req, res) {
  try {
    const { id } = req.params;
    const enquiries = await db.query('SELECT * FROM enquiries WHERE id = ?', [id]);
    const enq = enquiries[0];

    if (!enq) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    if (enq.converted_client_id) {
      return res.status(400).json({
        success: false,
        message: 'This enquiry has already been converted to an onboarded client.',
        clientId: enq.converted_client_id
      });
    }

    // Check if client with this email already exists
    let clientId = null;
    if (enq.email) {
      const existingClient = await db.query('SELECT id FROM clients WHERE email = ?', [enq.email]);
      if (existingClient[0]) {
        clientId = existingClient[0].id;
      }
    }

    if (!clientId) {
      const cRes = await db.query(
        `INSERT INTO clients 
         (company_name, contact_person, mobile, email, address, city, state, pincode, onboarding_date, status, payment_terms_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'SINGLE')`,
        [
          enq.business_name,
          enq.name,
          enq.mobile,
          enq.email || `client_${Date.now()}@dgrow.com`,
          'Address pending verification',
          'Chennai',
          'Tamil Nadu',
          '600001',
          new Date().toISOString().split('T')[0]
        ]
      );
      clientId = cRes.insertId;
    }

    // Mark enquiry as ONBOARDED
    await db.query(
      `UPDATE enquiries SET status = 'ONBOARDED', converted_client_id = ?, onboarded_at = NOW() WHERE id = ?`,
      [clientId, id]
    );

    // Record ONBOARDED timeline event
    await db.query(
      `INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name)
       VALUES (?, 'ONBOARDED', 'Client Onboarded Successfully', ?, ?)`,
      [
        id,
        `Enquiry converted into Client Master record #${clientId} (${enq.business_name}).`,
        req.user ? req.user.name : 'Admin'
      ]
    );

    await logAudit({
      user: req.user,
      action: 'CONVERT_LEAD',
      entity_type: 'ENQUIRY',
      entity_id: id,
      new_data: { enquiry_id: id, client_id: clientId, business_name: enq.business_name },
      req
    });

    res.json({
      success: true,
      message: `Enquiry successfully converted to Client Master #${clientId} (${enq.business_name})!`,
      clientId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 7. Delete Enquiry
async function deleteEnquiry(req, res) {
  try {
    const { id } = req.params;
    const oldEnquiries = await db.query('SELECT * FROM enquiries WHERE id = ?', [id]);
    if (!oldEnquiries[0]) return res.status(404).json({ success: false, message: 'Enquiry not found.' });

    await db.query('DELETE FROM enquiries WHERE id = ?', [id]);

    await logAudit({
      user: req.user,
      action: 'DELETE',
      entity_type: 'ENQUIRY',
      entity_id: id,
      old_data: oldEnquiries[0],
      req
    });

    res.json({ success: true, message: 'Enquiry deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 8. Lead & Conversion Metrics (Weekly, Monthly, Custom Range Analytics)
async function getEnquiryMetrics(req, res) {
  try {
    const { time_filter = 'monthly', from_date = '', to_date = '' } = req.query;
    const { start, end } = getDateRange(time_filter, from_date, to_date);

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (start && end) {
      whereClause += ' AND created_at >= ? AND created_at <= ?';
      params.push(start, end);
    }

    const allLeads = await db.query(`SELECT * FROM enquiries ${whereClause}`, params);

    const totalLeads = allLeads.length;
    let onboardedCount = 0;
    let inDiscussionCount = 0;
    let quotationSentCount = 0;
    let negotiationCount = 0;
    let newCount = 0;
    let lostCount = 0;
    let totalBudget = 0;

    const sources = {
      WEBSITE: { total: 0, onboarded: 0, label: 'Websites' },
      CALL: { total: 0, onboarded: 0, label: 'Phone Call' },
      GMB: { total: 0, onboarded: 0, label: 'Google My Business' },
      ADS: { total: 0, onboarded: 0, label: 'Paid Ads' },
      MARKETING_PERSON: { total: 0, onboarded: 0, label: 'Marketing Person' },
      REFERRAL: { total: 0, onboarded: 0, label: 'Referral' },
      OTHER: { total: 0, onboarded: 0, label: 'Other Sources' }
    };

    allLeads.forEach(l => {
      const bud = parseFloat(l.estimated_budget || 0);
      totalBudget += bud;

      if (l.status === 'ONBOARDED') onboardedCount++;
      else if (l.status === 'IN_DISCUSSION') inDiscussionCount++;
      else if (l.status === 'QUOTATION_SENT') quotationSentCount++;
      else if (l.status === 'NEGOTIATION') negotiationCount++;
      else if (l.status === 'NEW') newCount++;
      else if (l.status === 'LOST') lostCount++;

      const src = l.source || 'OTHER';
      if (!sources[src]) {
        sources[src] = { total: 0, onboarded: 0, label: src };
      }
      sources[src].total++;
      if (l.status === 'ONBOARDED') {
        sources[src].onboarded++;
      }
    });

    const conversionRate = totalLeads > 0 ? ((onboardedCount / totalLeads) * 100).toFixed(1) : '0.0';

    // Source breakdown with percentage
    const sourceBreakdown = Object.keys(sources).map(key => {
      const item = sources[key];
      const sRate = item.total > 0 ? ((item.onboarded / item.total) * 100).toFixed(1) : '0.0';
      const shareOfTotal = totalLeads > 0 ? ((item.total / totalLeads) * 100).toFixed(1) : '0.0';
      return {
        source_key: key,
        label: item.label,
        total: item.total,
        onboarded: item.onboarded,
        conversion_rate: sRate,
        share_of_total: shareOfTotal
      };
    });

    res.json({
      success: true,
      period: time_filter,
      date_range: { start, end },
      summary: {
        total_entry_leads: totalLeads,
        onboarded_leads: onboardedCount,
        conversion_rate: parseFloat(conversionRate),
        in_negotiation: negotiationCount + inDiscussionCount,
        quotations_sent: quotationSentCount,
        new_leads: newCount,
        lost_leads: lostCount,
        total_pipeline_value: totalBudget
      },
      source_breakdown: sourceBreakdown
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllEnquiries,
  getEnquiryById,
  createEnquiry,
  updateEnquiry,
  addTimelineEvent,
  convertToClient,
  deleteEnquiry,
  getEnquiryMetrics
};
