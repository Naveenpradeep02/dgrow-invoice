const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function parseItemDetails(item) {
  const rawDesc = (item.description || item.name || '').trim();
  const lines = rawDesc.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  let serviceName = '';
  let subDetails = [];

  if (lines.length > 1) {
    serviceName = lines[0];
    subDetails = lines.slice(1);
  } else if (rawDesc.includes(':')) {
    const parts = rawDesc.split(':');
    serviceName = parts[0].trim();
    subDetails = parts.slice(1).join(':').split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
  } else {
    serviceName = rawDesc || 'Service';
    subDetails = [];
  }

  const cleanSubDetails = subDetails.map(d => d.replace(/^[•\-\*\+]\s*/, '').trim()).filter(d => d.length > 0);

  return {
    serviceName,
    subDetails: cleanSubDetails,
    hsnSac: (item.hsn_sac && item.hsn_sac !== '0' && item.hsn_sac !== 'null') ? item.hsn_sac : '-',
    amount: parseFloat(item.taxable_amount || item.total_amount || ((item.quantity || 1) * (item.rate || 0)) || 0)
  };
}

function hasValidGSTIN(clientGstin, agencyGstin = '') {
  if (!clientGstin) return false;
  const cleanClient = String(clientGstin).trim();
  const cleanAgency = String(agencyGstin || '').trim();

  if (!cleanClient || cleanClient === '-' || cleanClient.toLowerCase() === 'unregistered' || cleanClient.toLowerCase() === 'null' || cleanClient.toLowerCase() === 'undefined') {
    return false;
  }
  if (cleanClient === '33AAACM1234F1Z5' || (cleanAgency && cleanClient.toLowerCase() === cleanAgency.toLowerCase())) {
    return false;
  }
  return true;
}

function generateInvoicePDF(res, invoiceData) {
  const { invoice, items = [], company = {}, terms = {} } = invoiceData;

  const doc = new PDFDocument({ margin: 30, size: 'A4' });

  // Stream directly to HTTP response
  doc.pipe(res);

  const primaryColor = '#111827';
  const lightBg = '#F9FAFB';
  const borderColor = '#E5E7EB';

  // --- HEADER SECTION WITH LOGO ---
  const logoPath = path.join(__dirname, '../../../frontend/assets/Logo.png');
  let startX = 30;
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, 30, 28, { width: 100 });
      startX = 145;
    } catch (e) {
      startX = 30;
    }
  }

  // Agency Details Header
  doc.fillColor(primaryColor).fontSize(13).font('Helvetica-Bold').text(company.company_name || 'D-GROW MARKETING AGENCY', startX, 30);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#374151').text(`GSTIN Number: ${company.gstin || '33OUUPS5195G1ZJ'}`, startX, 46);

  doc.fontSize(7.5).font('Helvetica').fillColor('#4B5563');
  doc.text(`Address: ${company.address || 'SF No: 14/3, Plot No. 141, Radha Ave Main Rd, Ganga Nagar, Valasaravakkam'}, ${company.city || 'Chennai'} - ${company.pincode || '600087'}`, startX, 58, { width: 250 });
  doc.text(`Contact No: ${company.phone || '+91 9600401582'}`, startX, 76);
  doc.text(`Email: ${company.email || 'dgrowmarketing@gmail.com'}`, startX, 88);

  // Large INVOICE Title on right
  doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text('INVOICE', 400, 32, { align: 'right' });

  // Divider Line
  doc.moveTo(30, 110).lineTo(565, 110).strokeColor(borderColor).lineWidth(1).stroke();

  // --- INVOICE INFO & BILL TO BOXES ---
  let y = 118;

  // Invoice Details Grid
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151');
  doc.text('# Invoice', 35, y);
  doc.text(': ' + invoice.invoice_number, 100, y);

  doc.text('Date', 35, y + 14);
  doc.text(': ' + formatDate(invoice.invoice_date), 100, y + 14);

  doc.text('Terms', 35, y + 28);
  doc.text(': ' + (invoice.payment_terms_text || '100% payment in advance'), 100, y + 28);

  doc.text('Due Date', 35, y + 42);
  doc.text(': ' + formatDate(invoice.due_date), 100, y + 42);

  // Place of Supply
  doc.text('Place of Supply', 300, y);
  doc.font('Helvetica').text(': ' + (invoice.place_of_supply || 'Tamil Nadu').replace(/\s*\(\d+\)/g, ''), 380, y);

  // Bill To Box Header
  // --- BILL TO SECTION ---
  y += 62;
  doc.rect(30, y, 535, 18).fill('#f1f5f9').strokeColor('#d1d5db').lineWidth(0.5).stroke();
  doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Bill To', 38, y + 4);

  const client = invoice.client_snapshot || {};
  
  let leftY = y + 24;
  let boxY = y + 18;

  // Left Column
  doc.fontSize(8.5).fillColor('#111827');
  doc.font('Helvetica').text('Dear,', 38, leftY);
  leftY += 12;
  
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(client.company_name || 'Client Name', 38, leftY);
  leftY += 13;

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text('Address:', 38, leftY);
  leftY += 12;

  let fullAddrStr = `${client.address || ''}`;
  if (client.city || client.pincode) {
    fullAddrStr += `\n${client.city || ''}${client.pincode ? '-' + client.pincode + '.' : ''}`;
  }
  fullAddrStr += `\n${(client.state || 'Tamil Nadu').replace(/\s*\(\d+\)/g, '')}, India.`;

  doc.font('Helvetica').fontSize(8.5).fillColor('#1f2937').text(fullAddrStr, 38, leftY, { width: 300, lineGap: 2 });

  // Right Column
  let rightY = y + 24;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text('Mobile Number: ', 350, rightY, { continued: true });
  doc.font('Helvetica').text(client.mobile || '');
  rightY += 14;

  if (hasValidGSTIN(client.gstin, company.gstin)) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text('GSTIN: ', 350, rightY, { continued: true });
    doc.font('Helvetica').text(client.gstin);
    rightY += 14;
  }

  const boxHeight = Math.max(68, (leftY + 45) - boxY);
  doc.rect(30, boxY, 535, boxHeight).strokeColor('#d1d5db').lineWidth(0.5).stroke();

  y = boxY + boxHeight + 10;

  // --- SERVICE TABLE ---
  y += 35;
  doc.rect(30, y, 535, 20).fill('#2d2d2d');
  doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
  doc.text('No', 32, y + 6, { width: 30, align: 'center' });
  doc.text('Service', 68, y + 6, { width: 135 });
  doc.text('HSN/SAC', 208, y + 6, { width: 65, align: 'center' });
  doc.text('Details', 278, y + 6, { width: 175 });
  doc.text('Amount', 458, y + 6, { width: 102, align: 'right' });

  y += 20;

  items.forEach((item, index) => {
    const parsed = parseItemDetails(item);
    const detailLinesCount = Math.max(1, parsed.subDetails.length);
    const rowHeight = Math.max(28, 14 + detailLinesCount * 13);

    // Row Outer Border
    doc.strokeColor('#d1d5db').lineWidth(0.5).rect(30, y, 535, rowHeight).stroke();

    // Vertical Column Divider Lines matching user screenshot table design
    doc.moveTo(64, y).lineTo(64, y + rowHeight).stroke();
    doc.moveTo(205, y).lineTo(205, y + rowHeight).stroke();
    doc.moveTo(275, y).lineTo(275, y + rowHeight).stroke();
    doc.moveTo(455, y).lineTo(455, y + rowHeight).stroke();

    // No Column
    doc.fillColor('#111827').fontSize(8.5).font('Helvetica-Bold').text(String(index + 1), 32, y + 8, { width: 30, align: 'center' });

    // Service Column (Bold Title)
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(parsed.serviceName, 68, y + 8, { width: 132 });

    // HSN/SAC Column
    doc.font('Helvetica').fontSize(8).fillColor('#374151').text(parsed.hsnSac, 208, y + 8, { width: 65, align: 'center' });

    // Details Column (Bulleted Sub-services)
    if (parsed.subDetails.length > 0) {
      let dy = y + 7;
      parsed.subDetails.forEach(detail => {
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b').text(`•  ${detail}`, 278, dy, { width: 172 });
        dy += 12;
      });
    } else {
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af').text('-', 278, y + 8);
    }

    // Amount Column
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(`₹${formatMoney(parsed.amount)}`, 458, y + 8, { width: 102, align: 'right' });

    y += rowHeight;
  });

  // --- TOTALS & AMOUNT IN WORDS SECTION ---
  y += 10;
  const totalsBoxY = y;

  // Amount In Words (Left Column)
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151').text('Total In Words', 35, y);
  doc.fontSize(8).font('Helvetica-BoldOblique').fillColor('#1F2937').text(invoice.amount_in_words || 'Rupees Eleven Thousand Three Hundred Only.', 35, y + 12, { width: 280 });

  if (invoice.notes) {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151').text('Notes:', 35, y + 42);
    doc.fontSize(8).font('Helvetica').fillColor('#4B5563').text(invoice.notes, 35, y + 54, { width: 280 });
  }

  // Subtotal & Taxes Breakdown
  rightY = totalsBoxY;
  doc.fontSize(8.5).font('Helvetica').fillColor('#374151');

  doc.text('Sub Total', 370, rightY);
  doc.text(`₹${formatMoney(invoice.subtotal)}`, 450, rightY, { width: 105, align: 'right' });
  rightY += 14;

  if (invoice.invoice_type === 'GST') {
    if (invoice.cgst_amount > 0) {
      doc.text(`CGST ${invoice.cgst_rate}%`, 370, rightY);
      doc.text(`₹${formatMoney(invoice.cgst_amount)}`, 450, rightY, { width: 105, align: 'right' });
      rightY += 14;
    }
    if (invoice.sgst_amount > 0) {
      doc.text(`SGST ${invoice.sgst_rate}%`, 370, rightY);
      doc.text(`₹${formatMoney(invoice.sgst_amount)}`, 450, rightY, { width: 105, align: 'right' });
      rightY += 14;
    }
    if (invoice.igst_amount > 0) {
      doc.text(`IGST ${invoice.igst_rate}%`, 370, rightY);
      doc.text(`₹${formatMoney(invoice.igst_amount)}`, 450, rightY, { width: 105, align: 'right' });
      rightY += 14;
    }
  }

  if (invoice.round_off !== 0) {
    doc.text('Round Off', 370, rightY);
    doc.text(`₹${formatMoney(invoice.round_off)}`, 450, rightY, { width: 105, align: 'right' });
    rightY += 14;
  }

  // Grand Total Lines (double underline styling)
  doc.moveTo(370, rightY).lineTo(555, rightY).strokeColor('#0f172a').lineWidth(1).stroke();
  rightY += 6;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
  doc.text('Total', 370, rightY);
  doc.text(`₹${formatMoney(invoice.grand_total)}`, 450, rightY, { width: 105, align: 'right' });
  rightY += 16;
  doc.moveTo(370, rightY).lineTo(555, rightY).strokeColor('#0f172a').lineWidth(1.5).stroke();

  // --- TERMS & PAYMENT DETAILS / SIGNATURE ---
  y = Math.max(rightY + 25, totalsBoxY + 80);

  doc.moveTo(30, y).lineTo(565, y).strokeColor(borderColor).lineWidth(0.8).stroke();
  y += 12;

  // Left Column: Terms & Conditions
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827').text('Terms & Conditions', 35, y);
  let termY = y + 14;

  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Scope of Work', 35, termY);
  doc.font('Helvetica').fillColor('#4B5563').text(terms.scope_of_work || '1. Services include the specific digital marketing services mentioned in the invoice', 35, termY + 10, { width: 280 });
  termY += 26;

  doc.font('Helvetica-Bold').fillColor('#374151').text('Payment Terms', 35, termY);
  doc.font('Helvetica').fillColor('#4B5563').text(terms.payment_terms || '1. Full payment should be made every month in advance.', 35, termY + 10, { width: 280 });
  termY += 22;

  doc.font('Helvetica-Bold').fillColor('#374151').text('Ownership and Usage', 35, termY);
  doc.font('Helvetica').fillColor('#4B5563').text(terms.ownership_usage || '1. The client receives ownership rights to the final deliverables upon full payment.\n2. The service provider retains the right to use completed work for portfolio and marketing purposes.', 35, termY + 10, { width: 280 });
  termY += 34;

  doc.font('Helvetica-Bold').fillColor('#374151').text('Confidentiality', 35, termY);
  doc.font('Helvetica').fillColor('#4B5563').text(terms.confidentiality || '1. Both parties agree to keep confidential any proprietary information shared during the project.', 35, termY + 10, { width: 280 });
  termY += 26;

  doc.font('Helvetica-Bold').fillColor('#374151').text('Cancellation Policy', 35, termY);
  doc.font('Helvetica').fillColor('#4B5563').text(terms.cancellation_policy || '1. The client will be billed for any work completed up to the cancellation date.', 35, termY + 10, { width: 280 });

  // Right Column: Payment Details Box
  let bankY = y + 14;
  doc.roundedRect(330, bankY - 4, 235, 95, 4).fillAndStroke('#f8fafc', borderColor);

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('Payment Details:', 340, bankY);
  bankY += 14;

  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151');
  doc.text('Ac Number', 340, bankY); doc.font('Helvetica').text(`: ${company.account_number || '50200090154952'}`, 410, bankY);
  bankY += 12;
  doc.font('Helvetica-Bold').text('IFSC Code', 340, bankY); doc.font('Helvetica').text(`: ${company.ifsc_code || 'HDFC0000444'}`, 410, bankY);
  bankY += 12;
  doc.font('Helvetica-Bold').text('Banking Name', 340, bankY); doc.font('Helvetica').text(`: ${company.banking_name || 'D Grow Marketing Agency'}`, 410, bankY);
  bankY += 12;
  doc.font('Helvetica-Bold').text('Bank Name', 340, bankY); doc.font('Helvetica').text(`: ${company.bank_name || 'HDFC Bank'}`, 410, bankY);
  bankY += 12;
  doc.font('Helvetica-Bold').text('Branch', 340, bankY); doc.font('Helvetica').text(`: ${company.branch_name || 'Velachery'}`, 410, bankY);
  bankY += 12;
  doc.font('Helvetica-Bold').text('GPay', 340, bankY); doc.font('Helvetica-Bold').text(`: ${company.gpay_number || '7373509585'}`, 410, bankY);

  // Signature Block
  const sealPath = path.join(__dirname, '../../../frontend/assets/seel.png');
  if (fs.existsSync(sealPath)) {
    try {
      doc.image(sealPath, 390, bankY + 12, { fit: [120, 65], align: 'center', valign: 'center' });
      bankY += 80;
    } catch (e) {
      bankY += 35;
    }
  } else {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e3a8a').text(`For ${company.company_name || 'D-GROW MARKETING AGENCY'}`, 340, bankY + 12, { width: 220, align: 'center' });
    bankY += 45;
  }

  doc.fontSize(7.5).font('Helvetica').fillColor('#6b7280').text('Authorized Signature', 340, bankY, { width: 220, align: 'center' });

  doc.end();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatMoney(amount) {
  const val = parseFloat(amount || 0);
  return val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

module.exports = {
  generateInvoicePDF
};
