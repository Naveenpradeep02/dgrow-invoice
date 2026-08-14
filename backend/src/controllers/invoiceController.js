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
      sql += " AND i.invoice_type IN ('GST', 'GST_CLIENT')";
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
      place_of_supply,
      company_state: companyState
    });

    const clientSnapshotJson = JSON.stringify(client);

    // Transaction execution
    const newInvoiceId = await db.transaction(async (tx) => {
      // Fetch and increment sequence
      const seq = await tx.execute('SELECT * FROM invoice_sequences WHERE id = 1');
      const prefix = seq[0] ? seq[0].prefix : 'INV';
      const lastNum = seq[0] ? seq[0].last_number : 0;
      const nextNum = lastNum + 1;
      const padded = String(nextNum).padStart(4, '0');
      const invoiceNumber = `${prefix}${padded}`;

      await tx.execute('UPDATE invoice_sequences SET last_number = ? WHERE id = 1', [nextNum]);

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
      items = []
    } = req.body;

    const totals = calculateInvoiceTotals({
      invoice_type,
      items,
      place_of_supply
    });

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
          totals.grand_total, totals.amount_in_words, status, notes, id
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

module.exports = {
  seedSampleInvoiceIfEmpty,
  getNextInvoiceNumber,
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  cancelInvoice
};
