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
      assigned_to = '',
      time_filter = '',
      from_date = '',
      to_date = ''
    } = req.query;

    let sql = `
      SELECT e.*, c.company_name as onboarded_client_name, u.name as assigned_marketer_name, u.email as assigned_marketer_email,
        (SELECT COUNT(*) FROM enquiry_timeline WHERE enquiry_id = e.id AND event_type = 'CALL') as total_calls,
        (SELECT COUNT(*) FROM enquiry_timeline WHERE enquiry_id = e.id AND event_type = 'NEGOTIATION') as total_negotiations,
        (SELECT COUNT(*) FROM enquiry_timeline WHERE enquiry_id = e.id AND event_type = 'QUOTATION') as total_quotations,
        (SELECT details FROM enquiry_timeline WHERE enquiry_id = e.id ORDER BY created_at DESC, id DESC LIMIT 1) as latest_timeline_detail,
        (SELECT event_type FROM enquiry_timeline WHERE enquiry_id = e.id ORDER BY created_at DESC, id DESC LIMIT 1) as latest_timeline_type,
        (SELECT created_at FROM enquiry_timeline WHERE enquiry_id = e.id ORDER BY created_at DESC, id DESC LIMIT 1) as latest_activity_at
      FROM enquiries e
      LEFT JOIN clients c ON e.converted_client_id = c.id
      LEFT JOIN users u ON e.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (e.name LIKE ? OR e.business_name LIKE ? OR e.email LIKE ? OR e.mobile LIKE ? OR e.services_interested LIKE ? OR u.name LIKE ? OR e.marketing_person LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term, term);
    }

    if (source && source !== 'ALL') {
      sql += ` AND e.source = ?`;
      params.push(source);
    }

    if (status && status !== 'ALL') {
      sql += ` AND e.status = ?`;
      params.push(status);
    }

    if (assigned_to && assigned_to !== 'ALL') {
      if (assigned_to === 'unassigned') {
        sql += ` AND e.assigned_to IS NULL`;
      } else if (assigned_to === 'assigned') {
        sql += ` AND e.assigned_to IS NOT NULL`;
      } else {
        sql += ` AND e.assigned_to = ?`;
        params.push(parseInt(assigned_to, 10));
      }
    }

    // Marketing Profile Isolation:
    // Marketers only see their own assigned/referred enquiries
    if (req.user && req.user.role === 'MARKETING') {
      sql += ` AND (e.assigned_to = ? OR e.created_by = ? OR LOWER(e.marketing_person) = LOWER(?) OR LOWER(e.marketing_person) LIKE LOWER(?))`;
      params.push(req.user.id, req.user.id, req.user.name, `%${req.user.name}%`);
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
      `SELECT e.*, c.company_name as onboarded_client_name, c.mobile as client_mobile, c.email as client_email,
              u.name as assigned_marketer_name, u.email as assigned_marketer_email
       FROM enquiries e
       LEFT JOIN clients c ON e.converted_client_id = c.id
       LEFT JOIN users u ON e.assigned_to = u.id
       WHERE e.id = ?`,
      [id]
    );

    const enquiry = enquiries[0];
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    // Access check for field marketer
    if (req.user && req.user.role === 'MARKETING') {
      const isOwner = (enquiry.assigned_to === req.user.id) ||
        (enquiry.created_by === req.user.id) ||
        (enquiry.marketing_person && (
          enquiry.marketing_person.toLowerCase().trim() === req.user.name.toLowerCase().trim() ||
          enquiry.marketing_person.toLowerCase().includes(req.user.name.toLowerCase().trim()) ||
          req.user.name.toLowerCase().includes(enquiry.marketing_person.toLowerCase().trim())
        ));
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to view this enquiry. Only your own or assigned leads are accessible.',
          errorCode: 'FORBIDDEN_ENQUIRY_ACCESS'
        });
      }
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
      assigned_to = null,
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

    let finalAssignedTo = assigned_to ? parseInt(assigned_to, 10) : null;
    let finalMarketingPerson = (marketing_person || '').trim();

    if (req.user && req.user.role === 'MARKETING') {
      finalAssignedTo = req.user.id;
      if (source === 'MARKETING_PERSON' && !finalMarketingPerson) {
        finalMarketingPerson = req.user.name;
      }
    }

    const result = await db.query(
      `INSERT INTO enquiries 
       (name, email, mobile, business_name, source, marketing_person, services_interested, estimated_budget, status, notes, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        (email || '').trim(),
        mobile.trim(),
        business_name.trim(),
        source,
        finalMarketingPerson || null,
        (services_interested || '').trim(),
        parseFloat(estimated_budget || 0),
        status,
        (notes || '').trim(),
        finalAssignedTo || null,
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
        `Lead created from source: ${source}. Initial status set to ${status}.${finalMarketingPerson ? ` Assigned to marketing executive: ${finalMarketingPerson}.` : ''} ${notes ? `Notes: ${notes}` : ''}`,
        req.user ? req.user.name : 'Admin'
      ]
    );

    if (finalAssignedTo && finalMarketingPerson) {
      await db.query(
        `INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name)
         VALUES (?, 'NOTE', ?, ?, ?)`,
        [
          enquiryId,
          `Assigned to Marketing Employee: ${finalMarketingPerson}`,
          `Enquiry assigned to marketing executive ${finalMarketingPerson} to follow up with client.`,
          req.user ? req.user.name : 'Admin'
        ]
      );
    }

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'ENQUIRY',
      entity_id: enquiryId,
      new_data: { id: enquiryId, name, business_name, source, status, assigned_to: finalAssignedTo, marketing_person: finalMarketingPerson },
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

    if (req.user && req.user.role === 'MARKETING') {
      const isOwner = (oldEnquiry.assigned_to === req.user.id) ||
        (oldEnquiry.created_by === req.user.id) ||
        (oldEnquiry.marketing_person && (
          oldEnquiry.marketing_person.toLowerCase().trim() === req.user.name.toLowerCase().trim() ||
          oldEnquiry.marketing_person.toLowerCase().includes(req.user.name.toLowerCase().trim()) ||
          req.user.name.toLowerCase().includes(oldEnquiry.marketing_person.toLowerCase().trim())
        ));
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to modify this enquiry.',
          errorCode: 'FORBIDDEN_ENQUIRY_ACCESS'
        });
      }
    }

    const {
      name = oldEnquiry.name,
      email = oldEnquiry.email,
      mobile = oldEnquiry.mobile,
      business_name = oldEnquiry.business_name,
      source = oldEnquiry.source,
      marketing_person = oldEnquiry.marketing_person,
      assigned_to = oldEnquiry.assigned_to,
      services_interested = oldEnquiry.services_interested,
      estimated_budget = oldEnquiry.estimated_budget,
      status = oldEnquiry.status,
      notes = oldEnquiry.notes
    } = req.body;

    let finalAssignedTo = oldEnquiry.assigned_to;
    let finalMarketingPerson = (marketing_person !== undefined ? marketing_person : oldEnquiry.marketing_person) || '';

    // Admin can assign/reassign
    if (req.user && req.user.role === 'ADMIN') {
      if (assigned_to !== undefined) {
        finalAssignedTo = assigned_to ? parseInt(assigned_to, 10) : null;
      }
    }

    await db.query(
      `UPDATE enquiries SET
        name = ?, email = ?, mobile = ?, business_name = ?, source = ?, marketing_person = ?,
        assigned_to = ?, services_interested = ?, estimated_budget = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        name.trim(),
        (email || '').trim(),
        mobile.trim(),
        business_name.trim(),
        source,
        finalMarketingPerson ? finalMarketingPerson.trim() : null,
        finalAssignedTo || null,
        (services_interested || '').trim(),
        parseFloat(estimated_budget || 0),
        status,
        (notes || '').trim(),
        id
      ]
    );

    // If assigned marketer changed, record timeline event
    if (finalAssignedTo !== oldEnquiry.assigned_to) {
      let assignedUserName = '';
      if (finalAssignedTo) {
        const u = await db.query('SELECT name FROM users WHERE id = ?', [finalAssignedTo]);
        if (u[0]) assignedUserName = u[0].name;
      }
      await db.query(
        `INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name)
         VALUES (?, 'NOTE', ?, ?, ?)`,
        [
          id,
          finalAssignedTo ? `Lead Reassigned to: ${assignedUserName}` : 'Lead Unassigned',
          finalAssignedTo 
            ? `Lead assigned to marketing executive ${assignedUserName} by Admin to follow up with client.`
            : `Lead unassigned by Admin.`,
          req.user ? req.user.name : 'Admin'
        ]
      );
    }

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

    // Determine assigned marketer from enquiry
    let marketerId = enq.assigned_to || enq.created_by;
    let marketerName = enq.marketing_person;
    if (!marketerId && marketerName) {
      const mUser = await db.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1', [marketerName.trim()]);
      if (mUser[0]) marketerId = mUser[0].id;
    }
    if (!marketerId && req.user && req.user.role === 'MARKETING') {
      marketerId = req.user.id;
      marketerName = req.user.name;
    }

    if (!clientId) {
      const cRes = await db.query(
        `INSERT INTO clients 
         (company_name, contact_person, mobile, email, address, city, state, pincode, onboarding_date, status, payment_terms_type, assigned_to, marketing_person, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'SINGLE', ?, ?, ?)`,
        [
          enq.business_name,
          enq.name,
          enq.mobile,
          enq.email || `client_${Date.now()}@dgrow.com`,
          'Address pending verification',
          'Chennai',
          'Tamil Nadu',
          '600001',
          new Date().toISOString().split('T')[0],
          marketerId || null,
          marketerName || null,
          req.user ? req.user.id : null
        ]
      );
      clientId = cRes.insertId;

      if (marketerId) {
        try {
          await db.query(
            "INSERT INTO team_assignments (client_id, user_id, role_type, status) VALUES (?, ?, 'MARKETING', 'ACTIVE')",
            [clientId, marketerId]
          );
        } catch (e) {}
      }
    } else {
      // Update existing client with assigned marketer if unassigned
      await db.query(
        "UPDATE clients SET assigned_to = COALESCE(assigned_to, ?), marketing_person = COALESCE(marketing_person, ?) WHERE id = ?",
        [marketerId || null, marketerName || null, clientId]
      );
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

// 8. Admin 1-Click Enquiry Assignment to Marketing Employee
async function assignEnquiry(req, res) {
  try {
    const { id } = req.params;
    const rawId = req.body.marketer_id !== undefined ? req.body.marketer_id : req.body.assigned_to;

    const enquiries = await db.query('SELECT * FROM enquiries WHERE id = ?', [id]);
    if (!enquiries[0]) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    let marketerName = null;
    const mId = (rawId !== null && rawId !== undefined && rawId !== '') ? parseInt(rawId, 10) : null;

    if (mId) {
      const users = await db.query('SELECT id, name, email FROM users WHERE id = ?', [mId]);
      if (!users[0]) {
        return res.status(400).json({ success: false, message: 'Selected marketing employee not found.' });
      }
      marketerName = users[0].name;
    }

    // ONLY update assigned_to. DO NOT touch marketing_person (which stores original lead source person/rep)!
    await db.query(
      'UPDATE enquiries SET assigned_to = ? WHERE id = ?',
      [mId, id]
    );

    // Record timeline event
    await db.query(
      `INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name)
       VALUES (?, 'NOTE', ?, ?, ?)`,
      [
        id,
        mId ? `Lead Assigned to ${marketerName}` : 'Lead Unassigned',
        mId 
          ? `Enquiry assigned to marketing executive ${marketerName} by ${req.user ? req.user.name : 'Admin'} to follow up with client.`
          : `Enquiry unassigned by ${req.user ? req.user.name : 'Admin'}.`,
        req.user ? req.user.name : 'Admin'
      ]
    );

    // Also update converted client if already onboarded
    if (enquiries[0].converted_client_id) {
      await db.query(
        'UPDATE clients SET assigned_to = ? WHERE id = ?',
        [mId, enquiries[0].converted_client_id]
      );
    }

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'ENQUIRY',
      entity_id: id,
      new_data: { assigned_to: mId },
      old_data: { assigned_to: enquiries[0].assigned_to },
      req
    });

    res.json({
      success: true,
      message: mId 
        ? `Enquiry assigned to ${marketerName} successfully. They can now follow up with the client.`
        : 'Enquiry unassigned successfully.',
      assigned_to: mId,
      assigned_marketer_name: marketerName,
      enquiry: {
        id: parseInt(id, 10),
        assigned_to: mId,
        assigned_marketer_name: marketerName,
        source: enquiries[0].source,
        marketing_person: enquiries[0].marketing_person
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 9. Lead & Conversion Metrics (Weekly, Monthly, Custom Range Analytics)
async function getEnquiryMetrics(req, res) {
  try {
    const { time_filter = 'monthly', from_date = '', to_date = '' } = req.query;
    const { start, end } = getDateRange(time_filter, from_date, to_date);

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Marketing Role Isolation for metrics
    if (req.user && req.user.role === 'MARKETING') {
      whereClause += ' AND (assigned_to = ? OR created_by = ? OR LOWER(marketing_person) = LOWER(?) OR LOWER(marketing_person) LIKE LOWER(?))';
      params.push(req.user.id, req.user.id, req.user.name, `%${req.user.name}%`);
    }

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
  assignEnquiry,
  addTimelineEvent,
  convertToClient,
  deleteEnquiry,
  getEnquiryMetrics
};
