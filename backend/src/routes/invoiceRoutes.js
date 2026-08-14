const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { generateInvoicePDF } = require('../services/pdfService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/next-number', authenticateToken, authorizeRoles('ADMIN'), invoiceController.getNextInvoiceNumber);
router.get('/', authenticateToken, invoiceController.getAllInvoices);
router.get('/:id', authenticateToken, invoiceController.getInvoiceById);

// PDF Download Route
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = require('../config/database');
    const invoices = await db.query('SELECT * FROM invoices WHERE id = ? OR invoice_number = ?', [id, id]);
    const invoice = invoices[0];
    if (!invoice) return res.status(404).send('Invoice not found');

    if (req.user.role === 'CLIENT' && invoice.client_id !== req.user.client_id) {
      return res.status(403).send('Unauthorized');
    }

    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_order ASC', [invoice.id]);
    const company = await db.query('SELECT * FROM company_settings WHERE id = 1');
    const terms = await db.query('SELECT * FROM invoice_terms WHERE id = 1');
    const clientSnapshot = invoice.client_snapshot_json ? JSON.parse(invoice.client_snapshot_json) : {};

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${invoice.invoice_number}.pdf`);

    generateInvoicePDF(res, {
      invoice: { ...invoice, client_snapshot: clientSnapshot },
      items,
      company: company[0] || {},
      terms: terms[0] || {}
    });
  } catch (err) {
    res.status(500).send('PDF Generation Error: ' + err.message);
  }
});

router.post('/', authenticateToken, authorizeRoles('ADMIN'), invoiceController.createInvoice);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), invoiceController.updateInvoice);
router.post('/:id/cancel', authenticateToken, authorizeRoles('ADMIN'), invoiceController.cancelInvoice);

module.exports = router;
