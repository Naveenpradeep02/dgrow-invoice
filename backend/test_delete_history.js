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

async function runDeleteHistoryTests() {
  console.log('====================================================');
  console.log('       DELETE HISTORY & RESTORE AUTOMATED TESTS     ');
  console.log('====================================================');

  await db.initDatabase();

  const adminToken = jwt.sign(
    { id: 1, email: 'info@dgrowmarketing.com', name: 'D-GROW Admin', role: 'ADMIN' },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  const authHeader = { Authorization: `Bearer ${adminToken}` };

  // 1. Create a dummy test invoice
  const testInvNum = `DELTEST_${Date.now()}`;
  const invRes = await db.query(`
    INSERT INTO invoices (
      invoice_number, invoice_type, client_id, client_snapshot_json, place_of_supply,
      invoice_date, due_date, payment_terms_text, subtotal, discount, taxable_amount,
      cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
      round_off, grand_total, amount_in_words, status, notes, created_by
    ) VALUES (
      ?, 'GST', 1, '{"company_name":"Test Client Co"}', 'Tamil Nadu (33)',
      CURDATE(), CURDATE(), 'Advance', 2000.00, 100.00, 1900.00,
      9.00, 171.00, 9.00, 171.00, 0.00, 0.00,
      0.00, 2242.00, 'Two Thousand Two Hundred Forty Two Only', 'ISSUED', 'Test invoice notes', 1
    )
  `, [testInvNum]);

  const testInvId = invRes.insertId;
  console.log(`[+] Created test invoice #${testInvId} (${testInvNum})`);

  // Insert 2 dummy items
  await db.query(`
    INSERT INTO invoice_items (invoice_id, description, quantity, rate, taxable_amount, total_amount, item_order)
    VALUES (?, 'SEO Package', 1, 1000, 1000, 1180, 1),
           (?, 'Content Writing', 1, 900, 900, 1062, 2)
  `, [testInvId, testInvId]);

  // Insert 1 dummy payment
  await db.query(`
    INSERT INTO payments (invoice_id, payment_date, amount, payment_mode, created_by)
    VALUES (?, CURDATE(), 500.00, 'UPI', 1)
  `, [testInvId]);

  // Step 2: Delete invoice via API
  console.log('\n--- Test 1: Deleting invoice via API ---');
  const delRes = await makeRequest({
    path: `/invoices/${testInvId}`,
    method: 'DELETE',
    body: { reason: 'Unit Test Deletion' },
    headers: authHeader
  });

  if (delRes.status === 200 && delRes.data.success) {
    console.log(`[✓] Test 1: DELETE /invoices/${testInvId} returned 200: "${delRes.data.message}"`);
  } else {
    console.error(`[✗] Test 1 Failed:`, delRes);
    process.exit(1);
  }

  // Step 3: Verify active DB records are gone
  console.log('\n--- Test 2: Verify active DB records removed ---');
  const checkActiveInv = await db.query('SELECT * FROM invoices WHERE id = ?', [testInvId]);
  const checkActiveItems = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [testInvId]);
  const checkActivePayments = await db.query('SELECT * FROM payments WHERE invoice_id = ?', [testInvId]);

  if (checkActiveInv.length === 0 && checkActiveItems.length === 0 && checkActivePayments.length === 0) {
    console.log('[✓] Test 2: Active invoice, line items, and payments removed from active tables.');
  } else {
    console.error('[✗] Test 2 Failed: Residual records in active tables!', { checkActiveInv, checkActiveItems, checkActivePayments });
    process.exit(1);
  }

  // Step 4: Verify record in deleted_invoices
  console.log('\n--- Test 3: Verify record saved to deleted_invoices archive ---');
  const checkDelInv = await db.query('SELECT * FROM deleted_invoices WHERE invoice_number = ?', [testInvNum]);
  if (checkDelInv.length > 0) {
    const d = checkDelInv[0];
    console.log(`[✓] Test 3: Found in deleted_invoices (ID: ${d.id}, No: ${d.invoice_number}, Deleted By: ${d.deleted_by_name}, Reason: ${d.deletion_reason})`);
    
    const archivedItems = JSON.parse(d.items_json || '[]');
    const archivedPayments = JSON.parse(d.payments_json || '[]');
    if (archivedItems.length === 2 && archivedPayments.length === 1) {
      console.log(`[✓] Test 3b: Line items (${archivedItems.length}) and payments (${archivedPayments.length}) preserved in archive.`);
    } else {
      console.error('[✗] Test 3b Failed: Line items or payments missing in archive JSON!');
      process.exit(1);
    }
  } else {
    console.error('[✗] Test 3 Failed: Invoice NOT found in deleted_invoices table!');
    process.exit(1);
  }

  const archivedId = checkDelInv[0].id;

  // Step 5: Test GET /invoices/deleted-history
  console.log('\n--- Test 4: GET /invoices/deleted-history ---');
  const listRes = await makeRequest({
    path: `/invoices/deleted-history?search=${testInvNum}`,
    method: 'GET',
    headers: authHeader
  });

  if (listRes.status === 200 && listRes.data.success && listRes.data.deleted_invoices.length > 0) {
    console.log(`[✓] Test 4: Delete history list returned ${listRes.data.count} records matching search.`);
  } else {
    console.error('[✗] Test 4 Failed:', listRes);
    process.exit(1);
  }

  // Step 6: Test GET /invoices/deleted-history/:id
  console.log('\n--- Test 5: GET /invoices/deleted-history/:id ---');
  const singleRes = await makeRequest({
    path: `/invoices/deleted-history/${archivedId}`,
    method: 'GET',
    headers: authHeader
  });

  if (singleRes.status === 200 && singleRes.data.success && singleRes.data.invoice.invoice_number === testInvNum) {
    console.log(`[✓] Test 5: Fetched deleted invoice details for ${testInvNum} with parsed items (${singleRes.data.invoice.items.length}).`);
  } else {
    console.error('[✗] Test 5 Failed:', singleRes);
    process.exit(1);
  }

  // Step 7: Test Restore endpoint
  console.log('\n--- Test 6: POST /invoices/deleted-history/:id/restore ---');
  const restoreRes = await makeRequest({
    path: `/invoices/deleted-history/${archivedId}/restore`,
    method: 'POST',
    headers: authHeader
  });

  if (restoreRes.status === 200 && restoreRes.data.success) {
    console.log(`[✓] Test 6: Restore returned 200: "${restoreRes.data.message}"`);
    const newId = restoreRes.data.restored_invoice_id;

    // Verify it is back in active invoices
    const restoredInv = await db.query('SELECT * FROM invoices WHERE id = ?', [newId]);
    const restoredItems = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [newId]);
    const checkDeletedGone = await db.query('SELECT * FROM deleted_invoices WHERE id = ?', [archivedId]);

    if (restoredInv.length > 0 && restoredItems.length === 2 && checkDeletedGone.length === 0) {
      console.log(`[✓] Test 6b: Invoice successfully restored into active tables and removed from deleted_invoices.`);
    } else {
      console.error('[✗] Test 6b Failed: Restored verification mismatch!');
      process.exit(1);
    }
  } else {
    console.error('[✗] Test 6 Failed:', restoreRes);
    process.exit(1);
  }

  // Step 8: Clean up by re-deleting and testing purge
  console.log('\n--- Test 7: Re-delete and Test Permanent Purge ---');
  const reDel = await makeRequest({
    path: `/invoices/${testInvNum}`,
    method: 'DELETE',
    headers: authHeader
  });

  const checkReDel = await db.query('SELECT id FROM deleted_invoices WHERE invoice_number = ?', [testInvNum]);
  if (checkReDel.length > 0) {
    const purgeId = checkReDel[0].id;
    const purgeRes = await makeRequest({
      path: `/invoices/deleted-history/${purgeId}`,
      method: 'DELETE',
      headers: authHeader
    });

    if (purgeRes.status === 200 && purgeRes.data.success) {
      console.log(`[✓] Test 7: Permanent purge returned 200: "${purgeRes.data.message}"`);
      const finalCheck = await db.query('SELECT * FROM deleted_invoices WHERE id = ?', [purgeId]);
      if (finalCheck.length === 0) {
        console.log('[✓] Test 7b: Permanently purged from deleted_invoices.');
      }
    } else {
      console.error('[✗] Test 7 Failed:', purgeRes);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log('       ALL DELETE HISTORY TESTS PASSED (100%)       ');
  console.log('====================================================');
  process.exit(0);
}

runDeleteHistoryTests().catch(err => {
  console.error('[!] Test Runner Error:', err);
  process.exit(1);
});
