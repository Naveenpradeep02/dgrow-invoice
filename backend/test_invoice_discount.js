require('dotenv').config();
const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- Testing Invoice Discount Feature ---');

  // 1. Login as Admin
  const adminLogin = await request('POST', '/auth/login', {
    email: 'info@dgrowmarketing.com',
    password: 'Srija@345'
  });
  if (!adminLogin.data || !adminLogin.data.token) {
    console.error('Failed to log in as Admin:', adminLogin);
    process.exit(1);
  }
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin login successful');

  // 2. Fetch clients to get a client ID
  const clientsRes = await request('GET', '/clients', null, adminToken);
  const clients = clientsRes.data.clients || [];
  if (clients.length === 0) {
    console.error('No clients found in database');
    process.exit(1);
  }
  const testClient = clients[0];
  console.log(`✓ Using test client: ${testClient.company_name} (ID: ${testClient.id})`);

  // 3. Create an invoice with an overall discount
  // Item: Qty 1, Rate 10,000, GST 18%
  // Discount: 2,000
  // Taxable: 8,000
  // CGST (9%): 720, SGST (9%): 720
  // Grand Total: 8,000 + 1,440 = 9,440
  const invoicePayload = {
    client_id: testClient.id,
    invoice_type: 'GST',
    invoice_date: '2026-08-31',
    due_date: '2026-09-07',
    place_of_supply: 'Tamil Nadu',
    payment_terms_text: '100% payment in advance',
    notes: 'Test discount invoice',
    discount: 2000,
    items: [
      {
        description: 'SEO & Performance Marketing',
        hsn_sac: '998311',
        quantity: 1,
        rate: 10000,
        gst_rate: 18,
        item_order: 1
      }
    ]
  };

  const createRes = await request('POST', '/invoices', invoicePayload, adminToken);
  console.log('Create invoice status:', createRes.statusCode, createRes.data);
  if (createRes.statusCode !== 201 && createRes.statusCode !== 200) {
    console.error('FAILED to create invoice with discount');
    process.exit(1);
  }
  const createdInvId = createRes.data.invoiceId;
  console.log(`✓ Invoice created with ID: ${createdInvId}`);

  // 4. Fetch the created invoice and verify totals
  const getRes = await request('GET', `/invoices/${createdInvId}`, null, adminToken);
  const inv = getRes.data.invoice;
  console.log('Invoice details:', {
    subtotal: inv.subtotal,
    discount: inv.discount,
    taxable_amount: inv.taxable_amount,
    cgst_amount: inv.cgst_amount,
    sgst_amount: inv.sgst_amount,
    grand_total: inv.grand_total
  });

  if (parseFloat(inv.discount) !== 2000) {
    console.error(`FAIL: Expected discount 2000, got ${inv.discount}`);
    process.exit(1);
  }
  if (parseFloat(inv.subtotal) !== 10000) {
    console.error(`FAIL: Expected subtotal 10000, got ${inv.subtotal}`);
    process.exit(1);
  }
  if (parseFloat(inv.taxable_amount) !== 8000) {
    console.error(`FAIL: Expected taxable_amount 8000, got ${inv.taxable_amount}`);
    process.exit(1);
  }
  if (parseFloat(inv.grand_total) !== 9440) {
    console.error(`FAIL: Expected grand_total 9440, got ${inv.grand_total}`);
    process.exit(1);
  }
  console.log('✓ Overall discount calculation and persistence verified 100%');

  // 5. Test item-level discount update
  // Update with Item 1: 5000 (discount 500), Item 2: 5000 (discount 500) -> total discount 1000
  // Taxable: 9000, GST 18%: 1620 -> Grand Total: 10620
  const updatePayload = {
    client_id: testClient.id,
    invoice_type: 'GST',
    invoice_date: '2026-08-31',
    due_date: '2026-09-07',
    place_of_supply: 'Tamil Nadu',
    payment_terms_text: '100% payment in advance',
    notes: 'Updated item-level discount test',
    status: 'DRAFT',
    discount: 1000,
    items: [
      {
        description: 'Item A',
        hsn_sac: '998311',
        quantity: 1,
        rate: 5000,
        discount: 500,
        gst_rate: 18,
        item_order: 1
      },
      {
        description: 'Item B',
        hsn_sac: '998311',
        quantity: 1,
        rate: 5000,
        discount: 500,
        gst_rate: 18,
        item_order: 2
      }
    ]
  };

  // Temporarily set invoice to DRAFT so we can update it
  const db = require('./src/config/database');
  await db.initDatabase();
  await db.query("UPDATE invoices SET status = 'DRAFT' WHERE id = ?", [createdInvId]);

  const updateRes = await request('PUT', `/invoices/${createdInvId}`, updatePayload, adminToken);
  console.log('Update invoice status:', updateRes.statusCode);

  const getUpdated = await request('GET', `/invoices/${createdInvId}`, null, adminToken);
  const updatedInv = getUpdated.data.invoice;
  const updatedItems = getUpdated.data.items;

  console.log('Updated invoice details:', {
    subtotal: updatedInv.subtotal,
    discount: updatedInv.discount,
    taxable_amount: updatedInv.taxable_amount,
    grand_total: updatedInv.grand_total,
    itemCount: updatedItems.length,
    itemDiscounts: updatedItems.map(i => i.discount)
  });

  if (parseFloat(updatedInv.discount) !== 1000) {
    console.error(`FAIL: Expected updated discount 1000, got ${updatedInv.discount}`);
    process.exit(1);
  }
  if (parseFloat(updatedInv.taxable_amount) !== 9000) {
    console.error(`FAIL: Expected taxable 9000, got ${updatedInv.taxable_amount}`);
    process.exit(1);
  }
  if (parseFloat(updatedInv.grand_total) !== 10620) {
    console.error(`FAIL: Expected grand total 10620, got ${updatedInv.grand_total}`);
    process.exit(1);
  }
  console.log('✓ Item-level discount update and calculations verified 100%');

  // Clean up test invoice
  await db.query('DELETE FROM invoice_items WHERE invoice_id = ?', [createdInvId]);
  await db.query('DELETE FROM invoices WHERE id = ?', [createdInvId]);
  console.log('✓ Cleaned up test invoice');

  console.log('\n======================================');
  console.log('ALL INVOICE DISCOUNT TESTS PASSED 100%');
  console.log('======================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
