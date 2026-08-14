const db = require('../config/database');
const { logAudit } = require('../services/auditService');

async function getAllPayments(req, res) {
  try {
    const { invoice_id = '' } = req.query;
    let sql = `
      SELECT p.*, i.invoice_number, c.company_name, u.name as recorded_by
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'CLIENT') {
      sql += ' AND i.client_id = ?';
      params.push(req.user.client_id || -1);
    }

    if (invoice_id) {
      sql += ' AND p.invoice_id = ?';
      params.push(invoice_id);
    }

    sql += ' ORDER BY p.payment_date DESC, p.created_at DESC';

    const payments = await db.query(sql, params);
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function recordPayment(req, res) {
  try {
    const { invoice_id, payment_date, amount, payment_mode = 'UPI', reference_number = '', notes = '' } = req.body;

    if (!invoice_id || !payment_date || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid Invoice ID, Payment Date, and positive Amount are required.' });
    }

    const invoices = await db.query('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
    const inv = invoices[0];
    if (!inv) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (inv.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot record payment for a CANCELLED invoice.' });
    }

    const paymentAmount = parseFloat(amount);

    // Calculate current total paid
    const existingPayments = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ?', [invoice_id]);
    const currentPaid = parseFloat(existingPayments[0].total || 0);
    const grandTotal = parseFloat(inv.grand_total);
    const newTotalPaid = currentPaid + paymentAmount;

    // Save payment record
    const result = await db.query(
      `INSERT INTO payments (invoice_id, payment_date, amount, payment_mode, reference_number, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [invoice_id, payment_date, paymentAmount, payment_mode, reference_number, notes, req.user.id]
    );

    // Determine new status
    let newStatus = inv.status;
    if (newTotalPaid >= grandTotal) {
      newStatus = 'PAID';
    } else if (newTotalPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    await db.query('UPDATE invoices SET status = ? WHERE id = ?', [newStatus, invoice_id]);

    await logAudit({
      user: req.user,
      action: 'PAYMENT',
      entity_type: 'PAYMENT',
      entity_id: result.insertId,
      new_data: { invoice_id, invoice_number: inv.invoice_number, amount: paymentAmount, payment_mode, newStatus },
      req
    });

    res.status(201).json({
      success: true,
      message: `Payment of ₹${paymentAmount.toLocaleString('en-IN')} recorded successfully.`,
      paymentId: result.insertId,
      newStatus,
      totalPaid: newTotalPaid,
      balance: Math.max(0, grandTotal - newTotalPaid)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllPayments,
  recordPayment
};
