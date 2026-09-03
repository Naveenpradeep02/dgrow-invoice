const db = require('../config/database');
const { calculateInvoiceTotals } = require('../services/taxService');
const { logAudit } = require('../services/auditService');

// Seed initial INV0026 sample invoice matching the prompt details if db is empty
async function seedSampleInvoiceIfEmpty() {
  try {
    const invoices = await db.query('SELECT COUNT(*) as cnt FROM invoices');
    const cnt = invoices[0] ? (invoices[0].cnt !== undefined ? invoices[0].cnt : invoices[0]['COUNT(*)']) : 0;

    if (cnt === 0) {
      // Ensure Marks Biotech client exists
      let clients = await db.query('SELECT * FROM clients LIMIT 1');
      if (!clients[0]) {
        const cRes = await db.query(
          `INSERT INTO clients 
           (company_name, contact_person, mobile, email, address, city, state, pincode, gstin, pan, billing_address, shipping_address)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'Marks Biotech',
            'Dr. Marks',
            '+91 9819893250',
            'contact@marksbiotech.com',
            '104/5, 6th street, S-1, 2nd floor, The Brown CLS Building, Radha Avenue, Valasaravakkam',
            'Chennai',
            'Tamil Nadu',
            '600087',
            NULL,
            'AAACM1234F',
            '104/5, 6th street, S-1, 2nd floor, Valasaravakkam, Chennai-600087',
            '104/5, 6th street, S-1, 2nd floor, Valasaravakkam, Chennai-600087'
          ]
        );
        clients = await db.query('SELECT * FROM clients WHERE id = ?', [cRes.insertId]);
      }

      const client = clients[0];
      const users = await db.query('SELECT id FROM users LIMIT 1');
      const userId = users[0] ? users[0].id : 1;

      const sampleItems = [
        { description: 'Email Marketing Tool Buying', hsn_sac: '998311', quantity: 1, rate: 5800, discount: 0, gst_rate: 18 },
        { description: 'Email Credits Buying', hsn_sac: '998311', quantity: 1, rate: 1500, discount: 0, gst_rate: 18 },
        { description: 'WhatsApp API Tool Purchase', hsn_sac: '998313', quantity: 1, rate: 2000, discount: 0, gst_rate: 18 },
        { description: 'WhatsApp Messaging Credits', hsn_sac: '998313', quantity: 1, rate: 2000, discount: 0, gst_rate: 18 }
      ];

      const totals = calculateInvoiceTotals({
        invoice_type: 'GST',
        items: sampleItems,
        place_of_supply: 'Tamil Nadu (33)'
      });

      const clientSnapshot = JSON.stringify(client);

      const sqlInv = `
        INSERT INTO invoices (
          invoice_number, invoice_type, client_id, client_snapshot_json, place_of_supply,
          invoice_date, due_date, payment_terms_text, subtotal, discount, taxable_amount,
          cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
          round_off, grand_total, amount_in_words, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await db.query(sqlInv, [
        'INV0001',
        'GST',
        client.id,
        clientSnapshot,
        'Tamil Nadu (33)',
        '2026-08-07',
        '2026-08-07',
        '100% payment in advance',
        totals.subtotal,
        totals.discount,
        totals.taxable_amount,
        totals.cgst_rate,
        totals.cgst_amount,
        totals.sgst_rate,
        totals.sgst_amount,
        totals.igst_rate,
        totals.igst_amount,
        totals.round_off,
        totals.grand_total,
        totals.amount_in_words,
        'ISSUED',
        'Thanks for your business.',
        userId
      ]);

      const invoiceId = result.insertId;

      for (let i = 0; i < totals.items.length; i++) {
        const item = totals.items[i];
        await db.query(
          `INSERT INTO invoice_items (invoice_id, description, hsn_sac, quantity, rate, discount, gst_rate, taxable_amount, tax_amount, total_amount, item_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [invoiceId, item.description, item.hsn_sac, item.quantity, item.rate, item.discount, item.gst_rate, item.taxable_amount, item.tax_amount, item.total_amount, item.item_order]
        );
      }

      console.log('[Invoice Seed] Sample invoice INV0001 seeded for Marks Biotech.');
    }
  } catch (err) {
    console.error('[Invoice Seed Warning]', err.message);
  }
}

// Generate Next Invoice Number based on Type (GST = INV00.., GST_CLIENT = INC00.., NON_GST = IND00..)
async function getNextInvoiceNumber(req, res) {
  try {
    const { type = 'GST' } = req.query;
    let prefix = 'INV';
    let searchPattern = 'INV%';

    if (type === 'GST_CLIENT') {
      prefix = 'INC';
      searchPattern = 'INC%';
    } else if (type === 'NON_GST') {
      prefix = 'IND';
      searchPattern = 'IND%';
    } else {
      prefix = 'INV';
      searchPattern = 'INV%';
    }

    const rows = await db.query('SELECT invoice_number FROM invoices WHERE invoice_number LIKE ?', [searchPattern]);
    
    let maxNum = 0;
    if (rows && rows.length > 0) {
      rows.forEach(r => {
        if (r.invoice_number) {
          const numStr = r.invoice_number.replace(/^[A-Z]+/, '');
          const n = parseInt(numStr, 10);
          if (!isNaN(n) && n > maxNum) {
            maxNum = n;
          }
        }
      });
    }

    const nextNum = maxNum + 1;
    const padded = String(nextNum).padStart(4, '0');
    const invoiceNumber = `${prefix}${padded}`;

    res.json({
      success: true,
      invoice_number: invoiceNumber,
      next_sequence: nextNum
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// List all invoices with filtering & client protection
async function getAllInvoices(req, res) {
  try {
    const { search = '', status = '', invoice_type = '', from_date = '', to_date = '' } = req.query;

    let sql = `
      SELECT i.*, c.company_name, c.email as client_email,
             (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id) as paid_amount
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // Client role protection
    if (req.user.role === 'CLIENT') {
      sql += ' AND i.client_id = ?';
      params.push(req.user.client_id || -1);
    }

    // Auditor role protection: Tax Auditors only see GST Invoices
    if (req.user.role === 'AUDITOR') {
      sql += " AND i.invoice_type = 'GST'";
    }

    // Marketing role protection: Field Marketers only see invoices of their assigned/referred clients
    if (req.user.role === 'MARKETING') {
      const wildcard = `%${req.user.name}%`;
      sql += ` AND i.client_id IN (
        SELECT id FROM clients 
        WHERE assigned_to = ? OR created_by = ? OR LOWER(marketing_person) = LOWER(?) OR LOWER(marketing_person) LIKE LOWER(?)
           OR id IN (SELECT client_id FROM team_assignments WHERE user_id = ? AND status = 'ACTIVE')
      )`;
      params.push(req.user.id, req.user.id, req.user.name, wildcard, req.user.id);
    }

    if (search) {
      sql += ' AND (i.invoice_number LIKE ? OR c.company_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term);
    }

    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }

    if (invoice_type) {
      sql += ' AND i.invoice_type = ?';
      params.push(invoice_type);
    }

    if (from_date) {
      sql += ' AND i.invoice_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      sql += ' AND i.invoice_date <= ?';
      params.push(to_date);
    }

    sql += ' ORDER BY i.created_at DESC';

    const invoices = await db.query(sql, params);

    // Calculate dynamic balance for each invoice
    const formattedInvoices = invoices.map(inv => {
      const paid = parseFloat(inv.paid_amount || 0);
      const grandTotal = parseFloat(inv.grand_total || 0);
      const balance = Math.max(0, grandTotal - paid);

      // Determine real dynamic status if partially paid or fully paid
      let currentStatus = inv.status;
      if (inv.status !== 'CANCELLED' && inv.status !== 'DRAFT') {
        if (paid >= grandTotal && grandTotal > 0) {
          currentStatus = 'PAID';
        } else if (paid > 0 && paid < grandTotal) {
          currentStatus = 'PARTIALLY_PAID';
        }
      }

      return {
        ...inv,
        status: currentStatus,
        paid_amount: paid,
        balance_amount: balance
      };
    });

    res.json({ success: true, invoices: formattedInvoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Get Single Invoice with details, items, client snapshot, company & terms settings
async function getInvoiceById(req, res) {
  try {
    const { id } = req.params;

    const invoices = await db.query(
      `SELECT i.*, 
              (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id) as paid_amount
       FROM invoices i WHERE i.id = ? OR i.invoice_number = ?`,
      [id, id]
    );

    const invoice = invoices[0];
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Role check for client
    if (req.user.role === 'CLIENT' && invoice.client_id !== req.user.client_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to invoice.' });
    }

    // Role check for auditor: Tax Auditors only see GST Invoices
    if (req.user.role === 'AUDITOR' && invoice.invoice_type !== 'GST') {
      return res.status(403).json({ success: false, message: 'Unauthorized access to non-GST invoice.' });
    }

    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_order ASC', [invoice.id]);
    const payments = await db.query('SELECT p.*, u.name as created_by_name FROM payments p LEFT JOIN users u ON p.created_by = u.id WHERE p.invoice_id = ? ORDER BY p.payment_date DESC', [invoice.id]);
    const company = await db.query('SELECT * FROM company_settings WHERE id = 1');
    const terms = await db.query('SELECT * FROM invoice_terms WHERE id = 1');

    const clientSnapshot = invoice.client_snapshot_json ? JSON.parse(invoice.client_snapshot_json) : {};
    const paid = parseFloat(invoice.paid_amount || 0);
    const grandTotal = parseFloat(invoice.grand_total || 0);
    const balance = Math.max(0, grandTotal - paid);

    let currentStatus = invoice.status;
    if (invoice.status !== 'CANCELLED' && invoice.status !== 'DRAFT') {
      if (paid >= grandTotal && grandTotal > 0) {
        currentStatus = 'PAID';
      } else if (paid > 0 && paid < grandTotal) {
        currentStatus = 'PARTIALLY_PAID';
      }
    }

    res.json({
      success: true,
      invoice: {
        ...invoice,
        status: currentStatus,
        paid_amount: paid,
        balance_amount: balance,
        client_snapshot: clientSnapshot
      },
      items,
      payments,
      company: company[0] || {},
      terms: terms[0] || {}
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Create Invoice
async function createInvoice(req, res) {
  try {
    const {
      invoice_type = 'GST',
      client_id,
      place_of_supply = 'Tamil Nadu',
      invoice_date,
      due_date,
      payment_terms_text = '100% payment in advance',
      status = 'ISSUED',
      notes = '',
      discount = 0,
      items = []
    } = req.body;

    if (!client_id || !invoice_date || !due_date || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Client, invoice date, due date, and at least one item are required.' });
    }

    // Get client for snapshot
    const clients = await db.query('SELECT * FROM clients WHERE id = ?', [client_id]);
    const client = clients[0];
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    // Get company state
    const companySettings = await db.query('SELECT state FROM company_settings WHERE id = 1');
    const companyState = companySettings[0] ? companySettings[0].state : 'Tamil Nadu';

    // Calculate totals server-side
    const totals = calculateInvoiceTotals({
      invoice_type,
      items,
      discount,
      place_of_supply,
      company_state: companyState
    });

    const clientSnapshotJson = JSON.stringify(client);

    // Transaction execution
    const newInvoiceId = await db.transaction(async (tx) => {
      // Determine prefix based on invoice_type
      let prefix = 'INV';
      let searchPattern = 'INV%';

      if (invoice_type === 'GST_CLIENT') {
        prefix = 'INC';
        searchPattern = 'INC%';
      } else if (invoice_type === 'NON_GST') {
        prefix = 'IND';
        searchPattern = 'IND%';
      } else {
        prefix = 'INV';
        searchPattern = 'INV%';
      }

      // Fetch existing invoices for this prefix to calculate next sequence accurately
      const rows = await tx.execute('SELECT invoice_number FROM invoices WHERE invoice_number LIKE ?', [searchPattern]);
      let maxNum = 0;
      if (rows && rows.length > 0) {
        rows.forEach(r => {
          if (r.invoice_number) {
            const numStr = r.invoice_number.replace(/^[A-Z]+/, '');
            const n = parseInt(numStr, 10);
            if (!isNaN(n) && n > maxNum) {
              maxNum = n;
            }
          }
        });
      }

      const nextNum = maxNum + 1;
      const padded = String(nextNum).padStart(4, '0');
      const invoiceNumber = `${prefix}${padded}`;

      if (prefix === 'INV') {
        try {
          await tx.execute('UPDATE invoice_sequences SET last_number = ? WHERE id = 1', [nextNum]);
        } catch (seqErr) {
          // Sequence table update
        }
      }

      const sqlInv = `
        INSERT INTO invoices (
          invoice_number, invoice_type, client_id, client_snapshot_json, place_of_supply,
          invoice_date, due_date, payment_terms_text, subtotal, discount, taxable_amount,
          cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
          round_off, grand_total, amount_in_words, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await tx.execute(sqlInv, [
        invoiceNumber,
        invoice_type,
        client_id,
        clientSnapshotJson,
        place_of_supply,
        invoice_date,
        due_date,
        payment_terms_text,
        totals.subtotal,
        totals.discount,
        totals.taxable_amount,
        totals.cgst_rate,
        totals.cgst_amount,
        totals.sgst_rate,
        totals.sgst_amount,
        totals.igst_rate,
        totals.igst_amount,
        totals.round_off,
        totals.grand_total,
        totals.amount_in_words,
        status,
        notes,
        req.user.id
      ]);

      const invId = result.insertId;

      for (let i = 0; i < totals.items.length; i++) {
        const item = totals.items[i];
        await tx.execute(
          `INSERT INTO invoice_items (invoice_id, service_id, description, hsn_sac, quantity, rate, discount, gst_rate, taxable_amount, tax_amount, total_amount, item_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [invId, item.service_id, item.description, item.hsn_sac, item.quantity, item.rate, item.discount, item.gst_rate, item.taxable_amount, item.tax_amount, item.total_amount, item.item_order]
        );
      }

      return invId;
    });

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'INVOICE',
      entity_id: newInvoiceId,
      new_data: { id: newInvoiceId, totals, items },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoiceId: newInvoiceId
    });
  } catch (err) {
    console.error('[Create Invoice Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update Draft Invoice
async function updateInvoice(req, res) {
  try {
    const { id } = req.params;

    const oldInvoices = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
    const oldInv = oldInvoices[0];

    if (!oldInv) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (oldInv.status !== 'DRAFT' && req.user.role !== 'ADMIN') {
      return res.status(400).json({ success: false, message: 'Issued invoices cannot be edited. Only DRAFT invoices can be updated.' });
    }

    const {
      invoice_type = oldInv.invoice_type,
      place_of_supply = oldInv.place_of_supply,
      invoice_date = oldInv.invoice_date,
      due_date = oldInv.due_date,
      payment_terms_text = oldInv.payment_terms_text,
      status = oldInv.status,
      notes = oldInv.notes,
      discount = oldInv.discount || 0,
      items = []
    } = req.body;

    const companySettings = await db.query('SELECT state FROM company_settings WHERE id = 1');
    const companyState = companySettings[0] ? companySettings[0].state : 'Tamil Nadu';

    const totals = calculateInvoiceTotals({
      invoice_type,
      items,
      discount,
      place_of_supply,
      company_state: companyState
    });

    const paidSoFar = parseFloat(oldInv.paid_amount) || 0;
    const newBalance = Math.max(0, totals.grand_total - paidSoFar);
    let newStatus = status || oldInv.status;
    if (paidSoFar >= totals.grand_total && totals.grand_total > 0) {
      newStatus = 'PAID';
    } else if (paidSoFar > 0 && newStatus !== 'CANCELLED') {
      newStatus = 'PARTIALLY_PAID';
    }

    await db.transaction(async (tx) => {
      await tx.execute(
        `UPDATE invoices SET
          invoice_type = ?, place_of_supply = ?, invoice_date = ?, due_date = ?, payment_terms_text = ?,
          subtotal = ?, discount = ?, taxable_amount = ?, cgst_rate = ?, cgst_amount = ?,
          sgst_rate = ?, sgst_amount = ?, igst_rate = ?, igst_amount = ?, round_off = ?,
          grand_total = ?, amount_in_words = ?, status = ?, notes = ?
         WHERE id = ?`,
        [
          invoice_type, place_of_supply, invoice_date, due_date, payment_terms_text,
          totals.subtotal, totals.discount, totals.taxable_amount, totals.cgst_rate, totals.cgst_amount,
          totals.sgst_rate, totals.sgst_amount, totals.igst_rate, totals.igst_amount, totals.round_off,
          totals.grand_total, totals.amount_in_words, newStatus, notes, id
        ]
      );

      // Re-insert items
      await tx.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
      for (let i = 0; i < totals.items.length; i++) {
        const item = totals.items[i];
        await tx.execute(
          `INSERT INTO invoice_items (invoice_id, service_id, description, hsn_sac, quantity, rate, discount, gst_rate, taxable_amount, tax_amount, total_amount, item_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, item.service_id, item.description, item.hsn_sac, item.quantity, item.rate, item.discount, item.gst_rate, item.taxable_amount, item.tax_amount, item.total_amount, item.item_order]
        );
      }
    });

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'INVOICE',
      entity_id: id,
      old_data: oldInv,
      new_data: req.body,
      req
    });

    res.json({ success: true, message: 'Invoice updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Cancel Invoice (No Physical Delete!)
async function cancelInvoice(req, res) {
  try {
    const { id } = req.params;
    const oldInv = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!oldInv[0]) return res.status(404).json({ success: false, message: 'Invoice not found' });

    await db.query('UPDATE invoices SET status = "CANCELLED" WHERE id = ?', [id]);

    await logAudit({
      user: req.user,
      action: 'CANCEL',
      entity_type: 'INVOICE',
      entity_id: id,
      old_data: oldInv[0],
      new_data: { status: 'CANCELLED' },
      req
    });

    res.json({ success: true, message: `Invoice ${oldInv[0].invoice_number} cancelled successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Delete Invoice with Archive to Delete History (Admin Only)
async function deleteInvoice(req, res) {
  try {
    const { id } = req.params;
    const oldInv = await db.query('SELECT * FROM invoices WHERE id = ? OR invoice_number = ?', [id, id]);
    if (!oldInv || !oldInv[0]) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoice = oldInv[0];
    const invoiceId = invoice.id;

    // Fetch line items
    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_order ASC, id ASC', [invoiceId]);

    // Fetch payments
    const payments = await db.query('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date ASC, created_at ASC', [invoiceId]);
    const paidAmount = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    // Fetch client company name
    let clientName = '';
    if (invoice.client_id) {
      const clientRow = await db.query('SELECT company_name FROM clients WHERE id = ?', [invoice.client_id]);
      if (clientRow && clientRow[0]) {
        clientName = clientRow[0].company_name;
      }
    }
    if (!clientName && invoice.client_snapshot_json) {
      try {
        const snap = JSON.parse(invoice.client_snapshot_json);
        clientName = snap.company_name || snap.contact_person || '';
      } catch (e) {}
    }

    const deletionReason = req.body?.reason || 'Moved to delete history by admin';
    const deletedByName = req.user?.name || req.user?.email || 'Admin';
    const deletedById = req.user?.id || null;

    // Archive complete snapshot to deleted_invoices history table
    await db.query(`
      INSERT INTO deleted_invoices (
        original_invoice_id, invoice_number, invoice_type, client_id, client_name, client_snapshot_json,
        place_of_supply, invoice_date, due_date, payment_terms_text, subtotal, discount, taxable_amount,
        cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, round_off, grand_total,
        paid_amount, amount_in_words, status_at_deletion, notes, items_json, payments_json,
        invoice_snapshot_json, deleted_by, deleted_by_name, deletion_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceId,
      invoice.invoice_number,
      invoice.invoice_type || 'GST',
      invoice.client_id || null,
      clientName,
      invoice.client_snapshot_json || '{}',
      invoice.place_of_supply || 'Tamil Nadu (33)',
      invoice.invoice_date,
      invoice.due_date,
      invoice.payment_terms_text,
      invoice.subtotal || 0,
      invoice.discount || 0,
      invoice.taxable_amount || 0,
      invoice.cgst_rate || 0,
      invoice.cgst_amount || 0,
      invoice.sgst_rate || 0,
      invoice.sgst_amount || 0,
      invoice.igst_rate || 0,
      invoice.igst_amount || 0,
      invoice.round_off || 0,
      invoice.grand_total || 0,
      paidAmount,
      invoice.amount_in_words || '',
      invoice.status || 'ISSUED',
      invoice.notes || '',
      JSON.stringify(items || []),
      JSON.stringify(payments || []),
      JSON.stringify(invoice),
      deletedById,
      deletedByName,
      deletionReason
    ]);

    // Delete associated payments first to respect foreign keys
    await db.query('DELETE FROM payments WHERE invoice_id = ?', [invoiceId]);

    // Delete associated invoice line items
    await db.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

    // Delete the invoice record
    await db.query('DELETE FROM invoices WHERE id = ?', [invoiceId]);

    // Log audit trail
    await logAudit({
      user: req.user,
      action: 'DELETE',
      entity_type: 'INVOICE',
      entity_id: String(invoiceId),
      old_data: invoice,
      req
    });

    res.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} has been moved to Delete History.`
    });
  } catch (err) {
    console.error('[Delete Invoice Error]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to delete invoice.' });
  }
}

// List all deleted invoices from archive (Admin Only)
async function getDeletedInvoices(req, res) {
  try {
    const { search = '' } = req.query;
    let sql = 'SELECT * FROM deleted_invoices WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (invoice_number LIKE ? OR client_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY deleted_at DESC';

    const deletedInvoices = await db.query(sql, params);

    res.json({
      success: true,
      deleted_invoices: deletedInvoices,
      count: deletedInvoices.length
    });
  } catch (err) {
    console.error('[Get Deleted Invoices Error]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch delete history.' });
  }
}

// Get single deleted invoice details with items (Admin Only)
async function getDeletedInvoiceById(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM deleted_invoices WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deleted invoice record not found.' });
    }

    const inv = rows[0];
    inv.items = [];
    inv.payments = [];
    inv.client_snapshot = {};

    try { inv.items = JSON.parse(inv.items_json || '[]'); } catch (e) {}
    try { inv.payments = JSON.parse(inv.payments_json || '[]'); } catch (e) {}
    try { inv.client_snapshot = JSON.parse(inv.client_snapshot_json || '{}'); } catch (e) {}
    const company = await db.query('SELECT * FROM company_settings WHERE id = 1');
    const terms = await db.query('SELECT * FROM invoice_terms WHERE id = 1');

    res.json({
      success: true,
      invoice: inv,
      items: inv.items,
      company: company[0] || {},
      terms: terms[0] || {}
    });
  } catch (err) {
    console.error('[Get Deleted Invoice By ID Error]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch invoice details.' });
  }
}

// Restore invoice from Delete History back to active invoices (Admin Only)
async function restoreInvoice(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM deleted_invoices WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deleted invoice not found in history.' });
    }

    const delInv = rows[0];

    // Check if an active invoice already uses this invoice number
    const conflict = await db.query('SELECT id, invoice_number FROM invoices WHERE invoice_number = ?', [delInv.invoice_number]);
    if (conflict && conflict.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot restore: an active invoice with number "${delInv.invoice_number}" already exists.`
      });
    }

    // Resolve or fallback client_id
    let clientId = delInv.client_id;
    if (clientId) {
      const clientCheck = await db.query('SELECT id FROM clients WHERE id = ?', [clientId]);
      if (!clientCheck || clientCheck.length === 0) {
        clientId = null;
      }
    }
    if (!clientId) {
      const found = await db.query('SELECT id FROM clients WHERE company_name = ? LIMIT 1', [delInv.client_name]);
      if (found && found.length > 0) {
        clientId = found[0].id;
      } else {
        const firstClient = await db.query('SELECT id FROM clients ORDER BY id ASC LIMIT 1');
        clientId = firstClient[0]?.id || 1;
      }
    }

    // Insert back into active invoices table
    const invRes = await db.query(`
      INSERT INTO invoices (
        invoice_number, invoice_type, client_id, client_snapshot_json, place_of_supply,
        invoice_date, due_date, payment_terms_text, subtotal, discount, taxable_amount,
        cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
        round_off, grand_total, amount_in_words, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      delInv.invoice_number,
      delInv.invoice_type || 'GST',
      clientId,
      delInv.client_snapshot_json || '{}',
      delInv.place_of_supply || 'Tamil Nadu (33)',
      delInv.invoice_date,
      delInv.due_date,
      delInv.payment_terms_text || '100% payment in advance',
      delInv.subtotal || 0,
      delInv.discount || 0,
      delInv.taxable_amount || 0,
      delInv.cgst_rate || 0,
      delInv.cgst_amount || 0,
      delInv.sgst_rate || 0,
      delInv.sgst_amount || 0,
      delInv.igst_rate || 0,
      delInv.igst_amount || 0,
      delInv.round_off || 0,
      delInv.grand_total || 0,
      delInv.amount_in_words || '',
      delInv.status_at_deletion || 'ISSUED',
      delInv.notes || '',
      req.user?.id || 1
    ]);

    const newInvoiceId = invRes.insertId;

    // Restore line items
    let items = [];
    try { items = JSON.parse(delInv.items_json || '[]'); } catch (e) {}

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.query(`
        INSERT INTO invoice_items (
          invoice_id, service_id, description, hsn_sac, quantity, rate, discount,
          gst_rate, taxable_amount, tax_amount, total_amount, item_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newInvoiceId,
        it.service_id || null,
        it.description || 'Restored Item',
        it.hsn_sac || '998311',
        it.quantity || 1,
        it.rate || 0,
        it.discount || 0,
        it.gst_rate || 0,
        it.taxable_amount || 0,
        it.tax_amount || 0,
        it.total_amount || 0,
        it.item_order || (i + 1)
      ]);
    }

    // Delete record from deleted_invoices archive
    await db.query('DELETE FROM deleted_invoices WHERE id = ?', [id]);

    // Log audit trail
    await logAudit({
      user: req.user,
      action: 'RESTORE',
      entity_type: 'INVOICE',
      entity_id: String(newInvoiceId),
      new_data: { invoice_number: delInv.invoice_number, from_deleted_id: id },
      req
    });

    res.json({
      success: true,
      message: `Invoice ${delInv.invoice_number} has been restored successfully to active invoices.`,
      restored_invoice_id: newInvoiceId
    });
  } catch (err) {
    console.error('[Restore Invoice Error]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to restore invoice.' });
  }
}

// Permanently purge deleted invoice from history (Admin Only)
async function purgeDeletedInvoice(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM deleted_invoices WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deleted invoice not found in history.' });
    }

    const inv = rows[0];
    await db.query('DELETE FROM deleted_invoices WHERE id = ?', [id]);

    // Log audit trail
    await logAudit({
      user: req.user,
      action: 'PERMANENT_DELETE',
      entity_type: 'INVOICE',
      entity_id: String(id),
      old_data: inv,
      req
    });

    res.json({
      success: true,
      message: `Invoice ${inv.invoice_number} has been permanently purged from Delete History.`
    });
  } catch (err) {
    console.error('[Purge Deleted Invoice Error]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to purge record.' });
  }
}

module.exports = {
  seedSampleInvoiceIfEmpty,
  getNextInvoiceNumber,
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  cancelInvoice,
  deleteInvoice,
  getDeletedInvoices,
  getDeletedInvoiceById,
  restoreInvoice,
  purgeDeletedInvoice
};


