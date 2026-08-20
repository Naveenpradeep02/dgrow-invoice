const db = require('../config/database');
const { logAudit } = require('../services/auditService');

async function getAllClients(req, res) {
  try {
    const { search = '', status = '' } = req.query;
    let sql = 'SELECT * FROM clients WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR gstin LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY company_name ASC';

    const clients = await db.query(sql, params);
    res.json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getClientById(req, res) {
  try {
    const { id } = req.params;
    const clients = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!clients[0]) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.json({ success: true, client: clients[0] });
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
      payment_schedule_json
    } = req.body;

    if (!company_name || !mobile || !email || !address) {
      return res.status(400).json({ success: false, message: 'Company Name, Mobile, Email, and Address are required.' });
    }

    const presetJson = typeof preset_services_json === 'object' ? JSON.stringify(preset_services_json) : (preset_services_json || null);
    const scheduleJson = typeof payment_schedule_json === 'object' ? JSON.stringify(payment_schedule_json) : (payment_schedule_json || null);

    const result = await db.query(
      `INSERT INTO clients 
      (company_name, contact_person, mobile, email, address, city, state, pincode, gstin, pan, billing_address, shipping_address, preset_services_json, onboarding_date, status, payment_terms_type, payment_schedule_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        scheduleJson
      ]
    );

    const newClientId = result.insertId;

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'CLIENT',
      entity_id: newClientId,
      new_data: req.body,
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
      payment_schedule_json
    } = req.body;

    const presetJson = typeof preset_services_json === 'object' ? JSON.stringify(preset_services_json) : (preset_services_json !== undefined ? preset_services_json : oldClient[0].preset_services_json);
    const scheduleJson = typeof payment_schedule_json === 'object' ? JSON.stringify(payment_schedule_json) : (payment_schedule_json !== undefined ? payment_schedule_json : oldClient[0].payment_schedule_json);

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
        payment_schedule_json = ?
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
        id
      ]
    );

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'CLIENT',
      entity_id: id,
      old_data: oldClient[0],
      new_data: req.body,
      req
    });

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 360-Degree Comprehensive Client History
async function getClient360History(req, res) {
  try {
    const { id } = req.params;

    // 1. Client profile
    const clientRows = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!clientRows || !clientRows[0]) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    const client = clientRows[0];

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
  addClientCallLog,
  addClientAdCampaign,
  updateClientAdCampaign
};
