const db = require('../config/database');
const { logAudit } = require('../services/auditService');

// Helper to verify if a marketing user is authorized to access a specific client
async function checkMarketerClientAccess(user, client) {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase().trim();
  if (role === 'ADMIN' || role === 'AUDITOR') return true;
  if (role === 'CLIENT') return user.client_id === client.id;

  if (role === 'MARKETING') {
    // 1. Direct assignment to this user
    if (client.assigned_to && client.assigned_to === user.id) return true;
    // 2. Created by this marketer
    if (client.created_by && client.created_by === user.id) return true;
    // 3. Marketing person name match (case-insensitive substring/equality)
    if (client.marketing_person) {
      const cMkt = client.marketing_person.toLowerCase().trim();
      const uName = (user.name || '').toLowerCase().trim();
      if (cMkt === uName || cMkt.includes(uName) || uName.includes(cMkt)) return true;
    }
    // 4. Team assignment record
    const teamRows = await db.query(
      "SELECT id FROM team_assignments WHERE client_id = ? AND user_id = ? AND status = 'ACTIVE' LIMIT 1",
      [client.id, user.id]
    );
    if (teamRows && teamRows.length > 0) return true;

    // 5. Converted enquiry record owned/referred by this marketer
    const enqRows = await db.query(
      `SELECT id FROM enquiries 
       WHERE converted_client_id = ? 
         AND (created_by = ? OR LOWER(marketing_person) = LOWER(?) OR LOWER(marketing_person) LIKE LOWER(?)) 
       LIMIT 1`,
      [client.id, user.id, user.name, `%${user.name}%`]
    );
    if (enqRows && enqRows.length > 0) return true;

    return false;
  }
  return false;
}

async function getAllClients(req, res) {
  try {
    const { search = '', status = '', marketer_id = '' } = req.query;
    let sql = `
      SELECT c.*, u.name as assigned_marketer_name, u.email as assigned_marketer_email
      FROM clients c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    // Marketing Profile Isolation:
    // Marketers only see their own referral or explicitly assigned clients!
    if (req.user && req.user.role === 'MARKETING') {
      const userWildcard = `%${req.user.name}%`;
      sql += ` AND (
        c.assigned_to = ?
        OR c.created_by = ?
        OR LOWER(c.marketing_person) = LOWER(?)
        OR LOWER(c.marketing_person) LIKE LOWER(?)
        OR c.id IN (SELECT client_id FROM team_assignments WHERE user_id = ? AND status = 'ACTIVE')
        OR c.id IN (SELECT converted_client_id FROM enquiries WHERE (created_by = ? OR LOWER(marketing_person) = LOWER(?) OR LOWER(marketing_person) LIKE LOWER(?)) AND converted_client_id IS NOT NULL)
      )`;
      params.push(req.user.id, req.user.id, req.user.name, userWildcard, req.user.id, req.user.id, req.user.name, userWildcard);
    } else if (req.user && req.user.role === 'ADMIN' && marketer_id) {
      // Admin filtering clients by assigned marketer
      sql += ` AND (c.assigned_to = ? OR c.id IN (SELECT client_id FROM team_assignments WHERE user_id = ? AND status = 'ACTIVE'))`;
      params.push(marketer_id, marketer_id);
    }

    if (search) {
      sql += ' AND (c.company_name LIKE ? OR c.contact_person LIKE ? OR c.email LIKE ? OR c.gstin LIKE ? OR c.marketing_person LIKE ? OR u.name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.company_name ASC';

    const clients = await db.query(sql, params);
    res.json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getClientById(req, res) {
  try {
    const { id } = req.params;
    const clients = await db.query(
      `SELECT c.*, u.name as assigned_marketer_name, u.email as assigned_marketer_email
       FROM clients c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.id = ?`,
      [id]
    );
    if (!clients[0]) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const client = clients[0];
    if (req.user && req.user.role === 'MARKETING') {
      const hasAccess = await checkMarketerClientAccess(req.user, client);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to view this client profile. Only your assigned/referred clients are visible.',
          errorCode: 'FORBIDDEN_CLIENT_ACCESS'
        });
      }
    }

    res.json({ success: true, client });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createClient(req, res) {
  try {
    const {
      company_name,
      contact_person,
      mobile,
      email,
      address,
      city,
      state = 'Tamil Nadu',
      pincode,
      gstin,
      pan,
      billing_address,
      shipping_address,
      preset_services_json,
      onboarding_date,
      status = 'ACTIVE',
      payment_terms_type = 'SINGLE',
      payment_schedule_json,
      assigned_to,
      marketing_person
    } = req.body;

    if (!company_name || !mobile || !email || !address) {
      return res.status(400).json({ success: false, message: 'Company Name, Mobile, Email, and Address are required.' });
    }

    const presetJson = typeof preset_services_json === 'object' ? JSON.stringify(preset_services_json) : (preset_services_json || null);
    const scheduleJson = typeof payment_schedule_json === 'object' ? JSON.stringify(payment_schedule_json) : (payment_schedule_json || null);

    let finalAssignedTo = null;
    let finalMarketingPerson = null;
    const createdBy = req.user ? req.user.id : null;

    if (req.user && req.user.role === 'MARKETING') {
      // Automatically assign to this marketer
      finalAssignedTo = req.user.id;
      finalMarketingPerson = req.user.name;
    } else {
      finalAssignedTo = assigned_to ? parseInt(assigned_to, 10) : null;
      finalMarketingPerson = marketing_person || null;
      if (finalAssignedTo && !finalMarketingPerson) {
        const u = await db.query('SELECT name FROM users WHERE id = ?', [finalAssignedTo]);
        if (u[0]) finalMarketingPerson = u[0].name;
      }
    }

    const result = await db.query(
      `INSERT INTO clients 
      (company_name, contact_person, mobile, email, address, city, state, pincode, gstin, pan, billing_address, shipping_address, preset_services_json, onboarding_date, status, payment_terms_type, payment_schedule_json, assigned_to, marketing_person, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company_name,
        contact_person || null,
        mobile,
        email,
        address,
        city || null,
        state || 'Tamil Nadu',
        pincode || null,
        gstin || null,
        pan || null,
        billing_address || address || null,
        shipping_address || address || null,
        presetJson,
        onboarding_date || null,
        status || 'ACTIVE',
        payment_terms_type || 'SINGLE',
        scheduleJson,
        finalAssignedTo,
        finalMarketingPerson,
        createdBy
      ]
    );

    const newClientId = result.insertId;

    // Record in team_assignments
    if (finalAssignedTo) {
      try {
        await db.query(
          "INSERT INTO team_assignments (client_id, user_id, role_type, status) VALUES (?, ?, 'MARKETING', 'ACTIVE')",
          [newClientId, finalAssignedTo]
        );
      } catch (e) {}
    }

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'CLIENT',
      entity_id: newClientId,
      new_data: { ...req.body, assigned_to: finalAssignedTo, marketing_person: finalMarketingPerson },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Client created successfully.',
      clientId: newClientId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const oldClient = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!oldClient[0]) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    if (req.user && req.user.role === 'MARKETING') {
      const hasAccess = await checkMarketerClientAccess(req.user, oldClient[0]);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to update this client.',
          errorCode: 'FORBIDDEN_CLIENT_ACCESS'
        });
      }
    }

    const {
      company_name,
      contact_person,
      mobile,
      email,
      address,
      city,
      state,
      pincode,
      gstin,
      pan,
      billing_address,
      shipping_address,
      preset_services_json,
      onboarding_date,
      status,
      payment_terms_type,
      payment_schedule_json,
      assigned_to,
      marketing_person
    } = req.body;

    const presetJson = typeof preset_services_json === 'object' ? JSON.stringify(preset_services_json) : (preset_services_json !== undefined ? preset_services_json : oldClient[0].preset_services_json);
    const scheduleJson = typeof payment_schedule_json === 'object' ? JSON.stringify(payment_schedule_json) : (payment_schedule_json !== undefined ? payment_schedule_json : oldClient[0].payment_schedule_json);

    let finalAssignedTo = oldClient[0].assigned_to;
    let finalMarketingPerson = oldClient[0].marketing_person;

    // Only Admin can assign/reassign client to another marketer
    if (req.user && req.user.role === 'ADMIN') {
      if (assigned_to !== undefined) {
        finalAssignedTo = assigned_to ? parseInt(assigned_to, 10) : null;
        if (finalAssignedTo) {
          const u = await db.query('SELECT name FROM users WHERE id = ?', [finalAssignedTo]);
          finalMarketingPerson = u[0] ? u[0].name : (marketing_person || finalMarketingPerson);
        } else {
          finalMarketingPerson = marketing_person !== undefined ? marketing_person : null;
        }
      } else if (marketing_person !== undefined) {
        finalMarketingPerson = marketing_person;
      }
    }

    await db.query(
      `UPDATE clients SET
        company_name = ?,
        contact_person = ?,
        mobile = ?,
        email = ?,
        address = ?,
        city = ?,
        state = ?,
        pincode = ?,
        gstin = ?,
        pan = ?,
        billing_address = ?,
        shipping_address = ?,
        preset_services_json = ?,
        onboarding_date = ?,
        status = ?,
        payment_terms_type = ?,
        payment_schedule_json = ?,
        assigned_to = ?,
        marketing_person = ?
      WHERE id = ?`,
      [
        company_name || oldClient[0].company_name,
        contact_person !== undefined ? contact_person : oldClient[0].contact_person,
        mobile || oldClient[0].mobile,
        email || oldClient[0].email,
        address || oldClient[0].address,
        city !== undefined ? city : oldClient[0].city,
        state !== undefined ? state : oldClient[0].state,
        pincode !== undefined ? pincode : oldClient[0].pincode,
        gstin !== undefined ? gstin : oldClient[0].gstin,
        pan !== undefined ? pan : oldClient[0].pan,
        billing_address !== undefined ? billing_address : oldClient[0].billing_address,
        shipping_address !== undefined ? shipping_address : oldClient[0].shipping_address,
        presetJson,
        onboarding_date !== undefined ? onboarding_date : oldClient[0].onboarding_date,
        status || oldClient[0].status || 'ACTIVE',
        payment_terms_type || oldClient[0].payment_terms_type || 'SINGLE',
        scheduleJson,
        finalAssignedTo,
        finalMarketingPerson,
        id
      ]
    );

    // Sync team_assignments if admin changed assignment
    if (req.user && req.user.role === 'ADMIN' && assigned_to !== undefined) {
      try {
        await db.query("UPDATE team_assignments SET status = 'INACTIVE' WHERE client_id = ?", [id]);
        if (finalAssignedTo) {
          await db.query(
            "INSERT INTO team_assignments (client_id, user_id, role_type, status) VALUES (?, ?, 'MARKETING', 'ACTIVE')",
            [id, finalAssignedTo]
          );
        }
      } catch (e) {}
    }

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'CLIENT',
      entity_id: id,
      old_data: oldClient[0],
      new_data: { ...req.body, assigned_to: finalAssignedTo, marketing_person: finalMarketingPerson },
      req
    });

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Admin 1-Click Client Assignment to Marketer
async function assignClient(req, res) {
  try {
    const { id } = req.params;
    const { marketer_id } = req.body;

    const clients = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!clients[0]) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    let marketerName = null;
    const mId = marketer_id ? parseInt(marketer_id, 10) : null;

    if (mId) {
      const users = await db.query('SELECT id, name FROM users WHERE id = ?', [mId]);
      if (!users[0]) {
        return res.status(400).json({ success: false, message: 'Selected marketer user not found.' });
      }
      marketerName = users[0].name;
    }

    await db.query(
      'UPDATE clients SET assigned_to = ?, marketing_person = ? WHERE id = ?',
      [mId, marketerName, id]
    );

    // Sync team_assignments
    try {
      await db.query("UPDATE team_assignments SET status = 'INACTIVE' WHERE client_id = ?", [id]);
      if (mId) {
        await db.query(
          "INSERT INTO team_assignments (client_id, user_id, role_type, status) VALUES (?, ?, 'MARKETING', 'ACTIVE')",
          [id, mId]
        );
      }
    } catch (e) {}

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'CLIENT',
      entity_id: id,
      new_data: { assigned_to: mId, marketing_person: marketerName },
      old_data: { assigned_to: clients[0].assigned_to, marketing_person: clients[0].marketing_person },
      req
    });

    res.json({
      success: true,
      message: mId ? `Client assigned to ${marketerName} successfully.` : 'Client unassigned successfully.',
      assigned_to: mId,
      marketing_person: marketerName
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 360-Degree Comprehensive Client History
async function getClient360History(req, res) {
  try {
    const { id } = req.params;

    // 1. Client profile
    const clientRows = await db.query(
      `SELECT c.*, u.name as assigned_marketer_name, u.email as assigned_marketer_email
       FROM clients c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.id = ?`,
      [id]
    );
    if (!clientRows || !clientRows[0]) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    const client = clientRows[0];

    // Marketing Role Access Protection
    if (req.user && req.user.role === 'MARKETING') {
      const hasAccess = await checkMarketerClientAccess(req.user, client);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to view 360° history for this client.',
          errorCode: 'FORBIDDEN_CLIENT_ACCESS'
        });
      }
    }

    // 2. Invoices & line items
    let invSql = `
      SELECT 
        i.*, 
        i.grand_total as total_amount,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count,
        COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as paid_amount
      FROM invoices i
      WHERE i.client_id = ?
    `;
    const invParams = [id];
    if (req.user.role === 'AUDITOR') {
      invSql += " AND i.invoice_type = 'GST'";
    }
    invSql += ' ORDER BY i.invoice_date DESC';

    const invoices = await db.query(invSql, invParams);

    // 3. Payments for this client's invoices
    let payments = [];
    if (invoices.length > 0) {
      const invIds = invoices.map(i => i.id);
      payments = await db.query(`
        SELECT p.*, i.invoice_number 
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE p.invoice_id IN (${invIds.map(() => '?').join(',')})
        ORDER BY p.payment_date DESC
      `, invIds);
    }

    // Compute financial summary
    let totalInvoiced = 0;
    let totalPaid = 0;
    invoices.forEach(inv => {
      const invTotal = parseFloat(inv.grand_total || inv.total_amount || 0);
      const invPaid = inv.status === 'PAID' ? invTotal : parseFloat(inv.paid_amount || 0);
      totalInvoiced += invTotal;
      totalPaid += Math.min(invTotal, invPaid);
    });
    const pendingDues = Math.max(0, totalInvoiced - totalPaid);

    // 4. Meetings linked to this client
    const meetings = await db.query(`
      SELECT * FROM meetings 
      WHERE client_id = ? OR client_name = ? OR client_name LIKE ?
      ORDER BY meeting_date DESC, meeting_time ASC
    `, [id, client.company_name, `%${client.company_name}%`]);

    // 5. Ad campaigns for this client
    const ads = await db.query(`
      SELECT * FROM client_ads 
      WHERE client_id = ?
      ORDER BY created_at DESC
    `, [id]);

    let activeAdsCount = 0;
    let totalAdBudget = 0;
    let totalAdSpent = 0;
    let totalLeadsGenerated = 0;

    ads.forEach(ad => {
      if (ad.status === 'ACTIVE') activeAdsCount++;
      totalAdBudget += parseFloat(ad.ad_fund_budget || 0);
      totalAdSpent += parseFloat(ad.spent_amount || 0);
      totalLeadsGenerated += parseInt(ad.leads_generated || 0, 10);
    });

    // 6. Call logs for this client
    let callLogs = await db.query(`
      SELECT * FROM client_call_logs
      WHERE client_id = ?
      ORDER BY created_at DESC
    `, [id]);

    // 7. Linked Enquiry (if converted from lead or matching name/mobile/email)
    const cleanMobile = (client.mobile || '').replace(/[^0-9]/g, '');
    const mobilePattern = cleanMobile.length >= 10 ? `%${cleanMobile.slice(-10)}%` : client.mobile;

    const enquiries = await db.query(`
      SELECT e.*, 
        (SELECT COUNT(*) FROM enquiry_timeline WHERE enquiry_id = e.id) as timeline_count
      FROM enquiries e
      WHERE e.converted_client_id = ? 
         OR e.mobile LIKE ? 
         OR (e.email = ? AND e.email IS NOT NULL AND e.email != '')
         OR e.business_name LIKE ?
      ORDER BY e.created_at DESC
    `, [id, mobilePattern, client.email || '', `%${client.company_name}%`]);

    let enquiryTimeline = [];
    if (enquiries.length > 0) {
      const enqIds = enquiries.map(e => e.id);
      enquiryTimeline = await db.query(`
        SELECT * FROM enquiry_timeline 
        WHERE enquiry_id IN (${enqIds.map(() => '?').join(',')})
        ORDER BY created_at DESC
      `, enqIds);

      // Merge enquiry calls into callLogs if not already present
      const enquiryCalls = enquiryTimeline.filter(t => t.event_type === 'CALL');
      enquiryCalls.forEach(ec => {
        callLogs.push({
          id: 'enq_' + ec.id,
          client_id: id,
          call_type: 'Lead Discovery Call',
          duration: '5 mins',
          outcome: 'Initial Consultation',
          title: ec.title,
          notes: ec.details,
          created_by_name: ec.created_by_name || 'Admin',
          created_at: ec.created_at
        });
      });
    }

    res.json({
      success: true,
      client,
      financials: {
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        pending_dues: pendingDues,
        invoices_count: invoices.length,
        paid_count: invoices.filter(i => i.status === 'PAID').length,
        unpaid_count: invoices.filter(i => i.status === 'UNPAID' || i.status === 'DUE').length,
        partial_count: invoices.filter(i => i.status === 'PARTIAL').length
      },
      ads_summary: {
        active_ads_count: activeAdsCount,
        total_campaigns: ads.length,
        total_budget: totalAdBudget,
        total_spent: totalAdSpent,
        total_leads: totalLeadsGenerated
      },
      invoices,
      payments,
      meetings,
      ads,
      call_logs: callLogs,
      enquiries,
      enquiry_timeline: enquiryTimeline
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Add manual call log for client
async function addClientCallLog(req, res) {
  try {
    const { id } = req.params;
    const { call_type = 'Outbound Call', duration = '5 mins', outcome, title, follow_up_date, notes } = req.body;

    if (!title || !outcome) {
      return res.status(400).json({ success: false, message: 'Title and Outcome are required.' });
    }

    const result = await db.query(`
      INSERT INTO client_call_logs 
      (client_id, call_type, duration, outcome, title, follow_up_date, notes, created_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      call_type,
      duration,
      outcome,
      title,
      follow_up_date || null,
      notes || null,
      req.user ? (req.user.name || 'Admin') : 'Admin'
    ]);

    res.status(201).json({ success: true, message: 'Call log saved successfully', logId: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Add Ad Campaign for client
async function addClientAdCampaign(req, res) {
  try {
    const { id } = req.params;
    const { campaign_name, platform = 'META', ad_fund_budget = 0, spent_amount = 0, status = 'ACTIVE', leads_generated = 0, start_date, end_date, notes } = req.body;

    if (!campaign_name) {
      return res.status(400).json({ success: false, message: 'Campaign name is required.' });
    }

    const result = await db.query(`
      INSERT INTO client_ads 
      (client_id, campaign_name, platform, ad_fund_budget, spent_amount, status, leads_generated, start_date, end_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      campaign_name,
      platform,
      parseFloat(ad_fund_budget) || 0,
      parseFloat(spent_amount) || 0,
      status,
      parseInt(leads_generated, 10) || 0,
      start_date || null,
      end_date || null,
      notes || null
    ]);

    res.status(201).json({ success: true, message: 'Ad campaign added successfully', adId: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update Ad Campaign
async function updateClientAdCampaign(req, res) {
  try {
    const { id, adId } = req.params;
    const { campaign_name, platform, ad_fund_budget, spent_amount, status, leads_generated, start_date, end_date, notes } = req.body;

    await db.query(`
      UPDATE client_ads SET
        campaign_name = COALESCE(?, campaign_name),
        platform = COALESCE(?, platform),
        ad_fund_budget = COALESCE(?, ad_fund_budget),
        spent_amount = COALESCE(?, spent_amount),
        status = COALESCE(?, status),
        leads_generated = COALESCE(?, leads_generated),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        notes = COALESCE(?, notes)
      WHERE id = ? AND client_id = ?
    `, [
      campaign_name || null,
      platform || null,
      ad_fund_budget !== undefined ? parseFloat(ad_fund_budget) : null,
      spent_amount !== undefined ? parseFloat(spent_amount) : null,
      status || null,
      leads_generated !== undefined ? parseInt(leads_generated, 10) : null,
      start_date || null,
      end_date || null,
      notes !== undefined ? notes : null,
      adId,
      id
    ]);

    res.json({ success: true, message: 'Ad campaign updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllClients,
  getClientById,
  getClient360History,
  createClient,
  updateClient,
  assignClient,
  addClientCallLog,
  addClientAdCampaign,
  updateClientAdCampaign
};
