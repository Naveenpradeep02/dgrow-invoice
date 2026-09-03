require('dotenv').config();
const db = require('./src/config/database');
const jwt = require('jsonwebtoken');
const http = require('http');

async function makeRequest({ path, method = 'GET', body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 8000,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {}),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('=================================================');
  console.log('         DELETE INVOICE AUTOMATED TESTS          ');
  console.log('=================================================');

  await db.initDatabase();

  // Create JWT for Admin
  const adminToken = jwt.sign(
    { id: 1, email: 'info@dgrowmarketing.com', role: 'ADMIN' },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  // Create JWT for Client
  const clientToken = jwt.sign(
    { id: 2, email: 'client@marksbiotech.com', role: 'CLIENT', client_id: 1 },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  // 1. Create a dummy test invoice directly in DB
  const testInvNum = `INVTEST_${Date.now()}`;
  const invRes = await db.query(`
    INSERT INTO invoices (
      invoice_number, invoice_type, client_id, client_snapshot_json, place_of_supply,
      invoice_date, due_date, payment_terms_text, subtotal, discount, taxable_amount,
      cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
      round_off, grand_total, amount_in_words, status, notes, created_by
    ) VALUES (
      ?, 'GST', 1, '{}', 'Tamil Nadu (33)',
      CURDATE(), CURDATE(), 'Advance', 1000.00, 0.00, 1000.00,
      9.00, 90.00, 9.00, 90.00, 0.00, 0.00,
      0.00, 1180.00, 'One Thousand One Hundred Eighty Only', 'ISSUED', 'Test invoice', 1
    )
  `, [testInvNum]);

  const testInvId = invRes.insertId;
  console.log(`[+] Created dummy test invoice #${testInvId} (${testInvNum})`);

  // Insert dummy item
  await db.query(`
    INSERT INTO invoice_items (invoice_id, description, quantity, rate, taxable_amount, total_amount)
    VALUES (?, 'Test Item', 1, 1000, 1000, 1180)
  `, [testInvId]);

  // Insert dummy payment
  await db.query(`
    INSERT INTO payments (invoice_id, payment_date, amount, payment_mode, created_by)
    VALUES (?, CURDATE(), 500.00, 'UPI', 1)
  `, [testInvId]);

  // Test 1: Unauthorized delete (No token)
  const t1 = await makeRequest({ path: `/invoices/${testInvId}`, method: 'DELETE' });
  if (t1.status === 401) {
    console.log('[✓] Test 1: Delete without auth returned 401 Unauthorized.');
  } else {
    console.error(`[✗] Test 1 Failed: Expected 401, got ${t1.status}`);
  }

  // Test 2: Forbidden delete (Client role)
  const t2 = await makeRequest({
    path: `/invoices/${testInvId}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${clientToken}` }
  });
  if (t2.status === 403) {
    console.log('[✓] Test 2: Client role attempting delete returned 403 Forbidden.');
  } else {
    console.error(`[✗] Test 2 Failed: Expected 403, got ${t2.status}`);
  }

  // Test 3: Authorized delete (Admin role)
  const t3 = await makeRequest({
    path: `/invoices/${testInvId}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (t3.status === 200 && t3.data.success) {
    console.log(`[✓] Test 3: Admin delete returned 200 OK: "${t3.data.message}"`);
  } else {
    console.error(`[✗] Test 3 Failed:`, t3);
  }

  // Test 4: Verify DB records deleted
  const checkInv = await db.query('SELECT * FROM invoices WHERE id = ?', [testInvId]);
  const checkItems = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [testInvId]);
  const checkPayments = await db.query('SELECT * FROM payments WHERE invoice_id = ?', [testInvId]);

  if (checkInv.length === 0 && checkItems.length === 0 && checkPayments.length === 0) {
    console.log('[✓] Test 4: Invoice, line items, and payments are completely removed from DB.');
  } else {
    console.error('[✗] Test 4 Failed: Leftover records found in DB!');
  }

  // Test 5: Verify Audit Log
  const checkAudit = await db.query('SELECT * FROM audit_logs WHERE entity_type = "INVOICE" AND entity_id = ? AND action = "DELETE"', [String(testInvId)]);
  if (checkAudit.length > 0) {
    console.log('[✓] Test 5: Audit log entry for DELETE action recorded successfully.');
  } else {
    console.error('[✗] Test 5 Failed: No audit log found for deletion.');
  }

  console.log('=================================================');
  console.log('           ALL DELETE TESTS COMPLETED            ');
  console.log('=================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('[!] Test Runner Error:', err);
  process.exit(1);
});
