const crypto = require('crypto');
const db = require('../config/database');
const { logAudit } = require('../services/auditService');

// Helper to generate clean unique proposal code (e.g., PROP001)
async function generateNextProposalCode() {
  try {
    const rows = await db.query('SELECT proposal_code FROM package_proposals ORDER BY id DESC LIMIT 1');
    if (!rows || rows.length === 0 || !rows[0].proposal_code) {
      return 'PROP001';
    }
    const lastCode = rows[0].proposal_code;
    const match = lastCode.match(/^PROP(\d+)$/i);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `PROP${String(nextNum).padStart(3, '0')}`;
    }
    return `PROP${Date.now().toString().slice(-4)}`;
  } catch (err) {
    return `PROP${Date.now().toString().slice(-4)}`;
  }
}

// 1. Get All Proposals (Admin / Marketing)
async function getAllProposals(req, res) {
  try {
    const { search = '', status = '' } = req.query;
    let sql = `
      SELECT p.*, u.name as created_by_name
      FROM package_proposals p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (p.client_name LIKE ? OR p.contact_person LIKE ? OR p.mobile LIKE ? OR p.proposal_code LIKE ? OR p.title LIKE ?)`;
      params.push(term, term, term, term, term);
    }

    if (status && status !== 'ALL') {
      sql += ` AND p.status = ?`;
      params.push(status);
    }

    // Marketing profile isolation
    if (req.user && req.user.role === 'MARKETING') {
      const wildcard = `%${req.user.name}%`;
      sql += ` AND (
        p.created_by = ?
        OR p.client_id IN (
          SELECT id FROM clients 
          WHERE assigned_to = ? OR created_by = ? OR LOWER(marketing_person) = LOWER(?) OR LOWER(marketing_person) LIKE LOWER(?)
             OR id IN (SELECT client_id FROM team_assignments WHERE user_id = ? AND status = 'ACTIVE')
        )
      )`;
      params.push(req.user.id, req.user.id, req.user.id, req.user.name, wildcard, req.user.id);
    }

    sql += ` ORDER BY p.id DESC`;

    const proposals = await db.query(sql, params);

    // Parse packages_json for each proposal
    const formatted = (proposals || []).map(p => {
      let packages = [];
      try {
        packages = typeof p.packages_json === 'string' ? JSON.parse(p.packages_json) : (p.packages_json || []);
      } catch (e) {
        packages = [];
      }
      return {
        ...p,
        packages
      };
    });

    res.json({
      success: true,
      proposals: formatted
    });
  } catch (err) {
    console.error('[getAllProposals Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Get Proposal by ID (Admin / Marketing)
async function getProposalById(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query(
      `SELECT p.*, u.name as created_by_name
       FROM package_proposals p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposal not found.' });
    }

    const proposal = rows[0];
    let packages = [];
    try {
      packages = typeof proposal.packages_json === 'string' ? JSON.parse(proposal.packages_json) : (proposal.packages_json || []);
    } catch (e) {
      packages = [];
    }

    res.json({
      success: true,
      proposal: {
        ...proposal,
        packages
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Create 3-Tier Package Proposal
async function createProposal(req, res) {
  try {
    const {
      client_id = null,
      client_name,
      contact_person = '',
      mobile,
      email = '',
      title = 'Digital Marketing Growth Proposal',
      valid_until = null,
      currency = 'INR',
      billing_cycle = 'Monthly',
      packages = []
    } = req.body;

    if (!client_name || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Client / Business Name and Mobile number are required.'
      });
    }

    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least 1 package tier is required (typically 3 packages: Starter, Pro, Growth).'
      });
    }

    const proposalCode = await generateNextProposalCode();
    // Unique secure random token for client public link
    const shareToken = crypto.randomBytes(16).toString('hex');

    const packagesJson = JSON.stringify(packages);

    const result = await db.query(
      `INSERT INTO package_proposals 
       (proposal_code, share_token, client_id, client_name, contact_person, mobile, email, title, valid_until, currency, billing_cycle, packages_json, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?)`,
      [
        proposalCode,
        shareToken,
        client_id ? parseInt(client_id) : null,
        client_name.trim(),
        (contact_person || '').trim(),
        mobile.trim(),
        (email || '').trim(),
        (title || 'Digital Marketing Growth Proposal').trim(),
        valid_until || null,
        currency || 'INR',
        billing_cycle || 'Monthly',
        packagesJson,
        req.user ? req.user.id : 1
      ]
    );

    const newId = result.insertId;

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'USER',
      entity_id: String(newId),
      new_data: { id: newId, proposal_code: proposalCode, client_name, title, tiers_count: packages.length },
      req
    });

    res.status(201).json({
      success: true,
      message: '3-Tier Package Proposal created successfully.',
      proposalId: newId,
      proposalCode,
      shareToken
    });
  } catch (err) {
    console.error('[createProposal Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Update Proposal
async function updateProposal(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM package_proposals WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposal not found.' });
    }

    const oldProposal = rows[0];
    const {
      client_id = oldProposal.client_id,
      client_name = oldProposal.client_name,
      contact_person = oldProposal.contact_person,
      mobile = oldProposal.mobile,
      email = oldProposal.email,
      title = oldProposal.title,
      valid_until = oldProposal.valid_until,
      currency = oldProposal.currency,
      billing_cycle = oldProposal.billing_cycle,
      packages = null,
      status = oldProposal.status
    } = req.body;

    const packagesJson = packages ? JSON.stringify(packages) : oldProposal.packages_json;

    await db.query(
      `UPDATE package_proposals SET
         client_id = ?, client_name = ?, contact_person = ?, mobile = ?, email = ?,
         title = ?, valid_until = ?, currency = ?, billing_cycle = ?, packages_json = ?, status = ?
       WHERE id = ?`,
      [
        client_id ? parseInt(client_id) : null,
        client_name.trim(),
        (contact_person || '').trim(),
        mobile.trim(),
        (email || '').trim(),
        (title || '').trim(),
        valid_until || null,
        currency || 'INR',
        billing_cycle || 'Monthly',
        packagesJson,
        status,
        id
      ]
    );

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'USER',
      entity_id: String(id),
      old_data: oldProposal,
      new_data: { id, client_name, title, status },
      req
    });

    res.json({
      success: true,
      message: 'Proposal updated successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 5. Delete Proposal (Admin only)
async function deleteProposal(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM package_proposals WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposal not found.' });
    }

    await db.query('DELETE FROM package_proposals WHERE id = ?', [id]);

    await logAudit({
      user: req.user,
      action: 'CANCEL',
      entity_type: 'USER',
      entity_id: String(id),
      old_data: rows[0],
      req
    });

    res.json({
      success: true,
      message: 'Proposal deleted successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 6. Public Client View: Get Proposal by Share Token (NO AUTH REQUIRED)
async function getPublicProposal(req, res) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Invalid proposal link token.' });
    }

    const rows = await db.query(
      `SELECT id, proposal_code, share_token, client_name, contact_person, mobile, email,
              title, valid_until, currency, billing_cycle, packages_json,
              selected_package_index, selected_package_name, confirmed_at, status, created_at
       FROM package_proposals
       WHERE share_token = ?`,
      [token]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'This proposal link does not exist or has expired.' });
    }

    const proposal = rows[0];

    // Auto update status to VIEWED if currently in SENT status
    if (proposal.status === 'SENT') {
      await db.query("UPDATE package_proposals SET status = 'VIEWED' WHERE id = ?", [proposal.id]);
      proposal.status = 'VIEWED';
    }

    let packages = [];
    try {
      packages = typeof proposal.packages_json === 'string' ? JSON.parse(proposal.packages_json) : (proposal.packages_json || []);
    } catch (e) {
      packages = [];
    }

    // Fetch company agency profile info for branding
    const company = await db.query('SELECT company_name, phone, email, website, logo_url, upi_id FROM company_settings WHERE id = 1');

    res.json({
      success: true,
      proposal: {
        id: proposal.id,
        proposal_code: proposal.proposal_code,
        share_token: proposal.share_token,
        client_name: proposal.client_name,
        contact_person: proposal.contact_person,
        mobile: proposal.mobile,
        email: proposal.email,
        title: proposal.title,
        valid_until: proposal.valid_until,
        currency: proposal.currency,
        billing_cycle: proposal.billing_cycle,
        packages,
        selected_package_index: proposal.selected_package_index,
        selected_package_name: proposal.selected_package_name,
        confirmed_at: proposal.confirmed_at,
        status: proposal.status,
        created_at: proposal.created_at
      },
      company: company[0] || {
        company_name: 'D-GROW MARKETING AGENCY',
        phone: '+91 9600401582 | +91 7373509585',
        email: 'info@dgrowmarketing.com',
        website: 'www.dgrowmarketing.com'
      }
    });
  } catch (err) {
    console.error('[getPublicProposal Error]', err);
    res.status(500).json({ success: false, message: 'Unable to load proposal details.' });
  }
}

// 7. Public Client Confirm Chosen Package (NO AUTH REQUIRED)
async function confirmPublicPackage(req, res) {
  try {
    const { token } = req.params;
    const { package_index, package_name, notes = '', client_note = '' } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Invalid token.' });
    }

    const rows = await db.query('SELECT * FROM package_proposals WHERE share_token = ?', [token]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposal not found.' });
    }

    const proposal = rows[0];
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    let packages = [];
    try {
      packages = typeof proposal.packages_json === 'string' ? JSON.parse(proposal.packages_json) : [];
    } catch (e) {}

    const selectedIdx = parseInt(package_index);
    const selectedPkg = (!isNaN(selectedIdx) && packages[selectedIdx]) ? packages[selectedIdx] : { name: package_name };
    const chosenName = selectedPkg.name || package_name || `Package #${selectedIdx + 1}`;

    const now = new Date();

    await db.query(
      `UPDATE package_proposals SET
         selected_package_index = ?,
         selected_package_name = ?,
         confirmed_at = NOW(),
         client_confirmed_ip = ?,
         status = 'ACCEPTED'
       WHERE id = ?`,
      [isNaN(selectedIdx) ? 0 : selectedIdx, chosenName, clientIp, proposal.id]
    );

    // If there is an associated enquiry or client, record timeline event
    try {
      const enq = await db.query('SELECT id FROM enquiries WHERE mobile = ? OR name = ? LIMIT 1', [proposal.mobile, proposal.client_name]);
      if (enq && enq.length > 0) {
        await db.query(
          `INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name)
           VALUES (?, 'STATUS_CHANGE', ?, ?, ?)`,
          [
            enq[0].id,
            `Package Confirmed: ${chosenName}`,
            `Client confirmed package tier "${chosenName}" via proposal link #${proposal.proposal_code}. Price: ${selectedPkg.price_formatted || selectedPkg.price || ''}.`,
            'Client (Online)'
          ]
        );
      }
    } catch (timelineErr) {}

    res.json({
      success: true,
      message: `Thank you! You have successfully selected and confirmed the "${chosenName}" package. Our team will get in touch with you right away.`,
      proposal: {
        proposal_code: proposal.proposal_code,
        selected_package_name: chosenName,
        confirmed_at: now
      }
    });
  } catch (err) {
    console.error('[confirmPublicPackage Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// 8. Convert Confirmed Package into Official Quotation in CRM
async function convertProposalToQuotation(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM package_proposals WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposal not found.' });
    }

    const proposal = rows[0];
    let packages = [];
    try {
      packages = typeof proposal.packages_json === 'string' ? JSON.parse(proposal.packages_json) : [];
    } catch (e) {}

    let selectedPkg = null;
    if (proposal.selected_package_index !== null && proposal.selected_package_index !== undefined) {
      const sIdx = parseInt(proposal.selected_package_index, 10);
      if (!isNaN(sIdx) && packages[sIdx]) {
        selectedPkg = packages[sIdx];
      }
    }

    if (!selectedPkg && proposal.selected_package_name) {
      selectedPkg = packages.find(p => p.name && p.name.trim().toLowerCase() === proposal.selected_package_name.trim().toLowerCase());
    }

    if (!selectedPkg) {
      selectedPkg = packages.find(p => p.badge_type === 'RECOMMENDED' || p.is_recommended) || packages[0];
    }

    if (!selectedPkg) {
      return res.status(400).json({ success: false, message: 'No package details found to convert.' });
    }

    // Convert package items into separate line items for quotation
    const rawPrice = parseFloat(String(selectedPkg.price || selectedPkg.rate || '0').replace(/[^0-9.]/g, '')) || 0;
    const servicesList = selectedPkg.services || selectedPkg.features || [];

    let lineItems = [];
    if (Array.isArray(servicesList) && servicesList.length > 0) {
      lineItems = servicesList.map((s, sIdx) => {
        let serviceTitle = '';
        let subPoints = [];

        if (typeof s === 'string') {
          const lines = s.split('\n').map(l => l.trim()).filter(Boolean);
          serviceTitle = lines[0] || `Service #${sIdx + 1}`;
          subPoints = lines.slice(1).map(l => l.replace(/^[•\-\*]\s*/, ''));
        } else if (typeof s === 'object') {
          serviceTitle = s.title || s.name || `Service #${sIdx + 1}`;
          subPoints = Array.isArray(s.sub_items) 
            ? s.sub_items 
            : (s.subDetails ? (Array.isArray(s.subDetails) ? s.subDetails : [s.subDetails]) : []);
        }

        return {
          description: serviceTitle.replace(/^\d+[\.\)]\s*/, ''),
          subDetails: subPoints,
          hsnSac: '998311',
          qty: 1,
          rate: (sIdx === 0) ? rawPrice : 0
        };
      });
    }

    if (lineItems.length === 0) {
      lineItems = [{
        description: `${selectedPkg.name || 'Digital Marketing Plan'} (${proposal.billing_cycle || 'Monthly'})`,
        subDetails: [],
        hsnSac: '998311',
        qty: 1,
        rate: rawPrice
      }];
    }

    // Generate quotation number (e.g. QUO004)
    const quoteRows = await db.query('SELECT quote_number FROM quotations ORDER BY id DESC LIMIT 1');
    let nextQuoteNum = 'QUO001';
    if (quoteRows && quoteRows.length > 0 && quoteRows[0].quote_number) {
      const match = quoteRows[0].quote_number.match(/^QUO(\d+)$/i);
      if (match) {
        nextQuoteNum = `QUO${String(parseInt(match[1], 10) + 1).padStart(3, '0')}`;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const validUntilStr = proposal.valid_until || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 15);
      return d.toISOString().split('T')[0];
    })();

    const taxableAmount = rawPrice;
    const gstRate = 18.0;
    const gstAmount = Math.round((taxableAmount * gstRate) / 100);
    const grandTotal = taxableAmount + gstAmount;

    const result = await db.query(
      `INSERT INTO quotations 
       (quote_number, client_id, client_name, contact_person, mobile, email, is_lead, quote_date, valid_until, subtotal, negotiation_percent, negotiation_amount, taxable_amount, gst_rate, gst_amount, grand_total, status, items_json, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)`,
      [
        nextQuoteNum,
        proposal.client_id || null,
        proposal.client_name,
        proposal.contact_person || '',
        proposal.mobile,
        proposal.email || '',
        proposal.client_id ? 0 : 1,
        todayStr,
        validUntilStr,
        rawPrice,
        taxableAmount,
        gstRate,
        gstAmount,
        grandTotal,
        JSON.stringify(lineItems),
        `Generated from 3-Tier Proposal #${proposal.proposal_code} (Selected: ${selectedPkg.name}).`,
        req.user ? req.user.id : 1
      ]
    );

    const quotationId = result.insertId;

    // Update package proposal status
    await db.query(
      "UPDATE package_proposals SET status = 'CONVERTED', converted_quotation_id = ? WHERE id = ?",
      [quotationId, id]
    );

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'USER',
      entity_id: String(quotationId),
      new_data: { quotation_id: quotationId, quote_number: nextQuoteNum, proposal_id: id, client_name: proposal.client_name },
      req
    });

    res.json({
      success: true,
      message: `Proposal successfully converted to Official Quotation #${nextQuoteNum}!`,
      quotationId,
      quoteNumber: nextQuoteNum,
      quotation: {
        id: quotationId,
        quoteNumber: nextQuoteNum,
        client: proposal.client_name,
        contactPerson: proposal.contact_person || '',
        mobile: proposal.mobile,
        email: proposal.email || '',
        address: '',
        gstin: '',
        isLead: !proposal.client_id,
        enquiryId: null,
        date: todayStr,
        validUntil: validUntilStr,
        items: lineItems.map(item => ({
          desc: item.description,
          hsn: item.hsnSac,
          qty: item.qty,
          rate: item.rate,
          subDetails: (item.subDetails || []).map(s => typeof s === 'string' ? s : (s.title || s.name || '')).join(', ')
        })),
        negotiationPercent: 0,
        negotiationAmount: 0,
        gstRate: gstRate,
        notes: `Generated from 3-Tier Proposal #${proposal.proposal_code} (Selected: ${selectedPkg.name}).`,
        status: 'APPROVED'
      }
    });
  } catch (err) {
    console.error('[convertProposalToQuotation Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getAllQuotations(req, res) {
  try {
    let sql = 'SELECT * FROM quotations WHERE 1=1';
    const params = [];
    if (req.user && req.user.role === 'MARKETING') {
      const wildcard = `%${req.user.name}%`;
      sql += ` AND (
        created_by = ? 
        OR client_id IN (
          SELECT id FROM clients 
          WHERE assigned_to = ? OR created_by = ? OR LOWER(marketing_person) = LOWER(?) OR LOWER(marketing_person) LIKE LOWER(?)
             OR id IN (SELECT client_id FROM team_assignments WHERE user_id = ? AND status = 'ACTIVE')
        )
      )`;
      params.push(req.user.id, req.user.id, req.user.id, req.user.name, wildcard, req.user.id);
    }
    sql += ' ORDER BY id DESC';
    const quotations = await db.query(sql, params);
    res.json({ success: true, quotations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllProposals,
  getProposalById,
  createProposal,
  updateProposal,
  deleteProposal,
  getPublicProposal,
  confirmPublicPackage,
  convertProposalToQuotation,
  getAllQuotations
};
