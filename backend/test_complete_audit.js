/**
 * Comprehensive System & Integration Audit Script
 * D-GROW Marketing Agency - Digital Bill ERP
 */

const http = require('http');

const API_BASE = 'http://localhost:5000/api';
let adminToken = '';
let auditorToken = '';
let clientToken = '';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    let fullUrl;
    if (path.startsWith('http')) {
      fullUrl = path;
    } else if (path.startsWith('/login') || path.startsWith('/css') || path.startsWith('/js') || path.startsWith('/admin') || path.startsWith('/auditor') || path.startsWith('/index') || path.startsWith('/client/')) {
      fullUrl = `http://localhost:5000${path}`;
    } else if (path.startsWith('/api/')) {
      fullUrl = `http://localhost:5000${path}`;
    } else {
      fullUrl = `http://localhost:5000/api${path.startsWith('/') ? path : '/' + path}`;
    }
    
    const url = new URL(fullUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
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
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const auditResults = [];

function recordResult(category, testName, passed, details = '') {
  auditResults.push({ category, testName, passed, details });
  const statusSymbol = passed ? '[\x1b[32m✓\x1b[0m]' : '[\x1b[31m✗\x1b[0m]';
  console.log(`${statusSymbol} [${category}] ${testName} ${details ? '- ' + details : ''}`);
}

async function runComprehensiveAudit() {
  console.log('\n================================================================');
  console.log('       D-GROW DIGITAL BILL - FULL SYSTEM AUDIT & TEST SUITE     ');
  console.log('================================================================\n');

  try {
    // 1. HEALTH CHECK
    const health = await request('GET', '/health');
    recordResult('SYSTEM', 'Database & Server Health Check', health.status === 200 && health.body.status === 'UP', `Driver: ${health.body.db_driver}`);

    // 2. AUTHENTICATION MODULE
    const adminAuth = await request('POST', '/auth/login', { email: 'admin@dgrow.com', password: 'admin123' });
    adminToken = adminAuth.body?.token;
    recordResult('AUTH', 'Admin Login & JWT Token Generation', adminAuth.status === 200 && !!adminToken, `User: ${adminAuth.body?.user?.email}`);

    const auditorAuth = await request('POST', '/auth/login', { email: 'auditor@dgrow.com', password: 'auditor123' });
    auditorToken = auditorAuth.body?.token;
    recordResult('AUTH', 'Auditor Login & JWT Token Generation', auditorAuth.status === 200 && !!auditorToken, `User: ${auditorAuth.body?.user?.email}`);

    const clientAuth = await request('POST', '/auth/login', { email: 'client@marksbiotech.com', password: 'client123' });
    clientToken = clientAuth.body?.token;
    recordResult('AUTH', 'Client Portal Login & JWT Token Generation', clientAuth.status === 200 && !!clientToken, `User: ${clientAuth.body?.user?.email}`);

    const invalidAuth = await request('POST', '/auth/login', { email: 'admin@dgrow.com', password: 'wrongpassword' });
    recordResult('AUTH', 'Rejection of Invalid Credentials', invalidAuth.status === 401, 'Returned 401 Unauthorized');

    const tokenVerify = await request('GET', '/auth/me', null, adminToken);
    recordResult('AUTH', 'Token Identity Verification (/auth/me)', tokenVerify.status === 200 && tokenVerify.body?.user?.role === 'ADMIN', `Role: ${tokenVerify.body?.user?.role}`);

    // 3. SERVICES MASTER MODULE
    const servicesList = await request('GET', '/services', null, adminToken);
    recordResult('SERVICES', 'Fetch Services Catalog', servicesList.status === 200 && Array.isArray(servicesList.body?.services), `Total Services: ${servicesList.body?.services?.length}`);

    const newService = await request('POST', '/services', {
      name: 'Custom Digital Audit Service',
      sac_code: '998311',
      rate: 15000,
      gst_rate: 18,
      description: 'Audit service\n• Multi-detail point 1\n• Multi-detail point 2'
    }, adminToken);
    const serviceId = newService.body?.serviceId || newService.body?.id;
    recordResult('SERVICES', 'Create New Service with Multiline Details', (newService.status === 200 || newService.status === 201) && !!serviceId, `Service ID: ${serviceId}`);

    // 4. CLIENTS MASTER MODULE
    const uniqueEmail = `apex_${Date.now()}@apexbiotech.com`;
    const newClient = await request('POST', '/clients', {
      company_name: 'Apex Biotech Technologies',
      contact_person: 'Dr. Ramesh Kumar',
      mobile: '+91 9444123456',
      email: uniqueEmail,
      address: 'Plot 55, Tech Zone, Valasaravakkam',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600087',
      gstin: '33AABCT9876K1Z9',
      preset_services_json: [
        {
          description: 'SEO & Content Marketing\n• Technical SEO\n• Content Writing',
          hsn_sac: '998311',
          quantity: 1,
          rate: 25000,
          gst_rate: 18
        }
      ]
    }, adminToken);
    const clientId = newClient.body?.clientId || newClient.body?.client?.id || newClient.body?.insertId;
    if (!clientId) console.log('DEBUG newClient:', newClient);
    recordResult('CLIENTS', 'Create Client with Preset Services & Sub-details', (newClient.status === 200 || newClient.status === 201) && !!clientId, `Client ID: ${clientId}`);

    const clientSingle = await request('GET', `/clients/${clientId}`, null, adminToken);
    recordResult('CLIENTS', 'Fetch Single Client & Preset Snapshot', clientSingle.status === 200 && clientSingle.body?.client?.company_name === 'Apex Biotech Technologies', `Name: ${clientSingle.body?.client?.company_name}`);

    // 5. INVOICE AUTO-SEQUENCING & CREATION
    const nextGstNum = await request('GET', '/invoices/next-number?type=GST', null, adminToken);
    recordResult('INVOICES', 'Auto-Sequence Generator (GST Invoice)', nextGstNum.status === 200 && !!nextGstNum.body?.invoice_number, `Next: ${nextGstNum.body?.invoice_number}`);

    const newInvoice = await request('POST', '/invoices', {
      client_id: clientId,
      invoice_date: '2026-02-14',
      due_date: '2026-02-28',
      invoice_type: 'GST',
      place_of_supply: 'Tamil Nadu',
      items: [
        {
          service_id: serviceId,
          description: 'SEO & Content Marketing\n• Technical SEO\n• Keyword Optimization',
          hsn_sac: '998311',
          quantity: 1,
          rate: 20000,
          discount: 0,
          gst_rate: 18
        }
      ],
      payment_terms_text: '100% payment on receipt',
      notes: 'Thank you for your business!'
    }, adminToken);
    const invoiceId = newInvoice.body?.invoiceId || newInvoice.body?.invoice?.id || newInvoice.body?.insertId;
    recordResult('INVOICES', 'Create GST Invoice with Intra-State Tax Calculation', (newInvoice.status === 200 || newInvoice.status === 201) && !!invoiceId, `Invoice ID: ${invoiceId}`);

    const invoiceDetails = await request('GET', `/invoices/${invoiceId}`, null, adminToken);
    const inv = invoiceDetails.body?.invoice;
    const isTaxCorrect = inv && (parseFloat(inv.taxable_amount) === 20000) &&
                         (parseFloat(inv.cgst_amount) === 1800) &&
                         (parseFloat(inv.sgst_amount) === 1800) &&
                         (parseFloat(inv.grand_total) === 23600);
    recordResult('TAXATION', 'Verify GST Tax Breakdown (CGST 9% + SGST 9%)', isTaxCorrect, `Total: ₹${inv?.grand_total} (CGST: ₹${inv?.cgst_amount}, SGST: ₹${inv?.sgst_amount})`);

    // 6. PDF STREAM GENERATION
    const pdfStream = await request('GET', `/invoices/${invoiceId}/pdf`, null, adminToken);
    recordResult('PDF ENGINE', 'Download Invoice PDF Document Stream', pdfStream.status === 200 && pdfStream.headers['content-type']?.includes('pdf'), `PDF Stream Valid`);

    // 7. PAYMENTS MODULE
    const recordPayment = await request('POST', '/payments', {
      invoice_id: invoiceId,
      amount: 23600,
      payment_date: '2026-02-14',
      payment_method: 'GPay',
      reference_number: 'UPI202602148899',
      notes: 'Full payment cleared via GPay'
    }, adminToken);
    const paymentId = recordPayment.body?.paymentId || recordPayment.body?.id;
    recordResult('PAYMENTS', 'Record Full Invoice Payment', (recordPayment.status === 200 || recordPayment.status === 201) && !!paymentId, `Payment ID: ${paymentId}`);

    const invoicePaidCheck = await request('GET', `/invoices/${invoiceId}`, null, adminToken);
    recordResult('PAYMENTS', 'Verify Invoice Status Transition to PAID', invoicePaidCheck.body?.invoice?.status === 'PAID', `Status: ${invoicePaidCheck.body?.invoice?.status}`);

    // 8. REPORTS MODULE & DATE FILTER
    const salesReportAll = await request('GET', '/reports/sales', null, adminToken);
    recordResult('REPORTS', 'Sales Register Report (All Time)', salesReportAll.status === 200 && Array.isArray(salesReportAll.body?.report), `Records: ${salesReportAll.body?.report?.length}`);

    const salesReportMonth = await request('GET', '/reports/sales?month=02&year=2026', null, adminToken);
    recordResult('REPORTS', 'Sales Register Filtered by Month & Year (Feb 2026)', salesReportMonth.status === 200 && Array.isArray(salesReportMonth.body?.report), `Records: ${salesReportMonth.body?.report?.length}`);

    const gstReport = await request('GET', '/reports/gst?from_date=2026-02-01&to_date=2026-02-28', null, adminToken);
    recordResult('REPORTS', 'GST Return Filing Report with Date Range', gstReport.status === 200 && !!gstReport.body?.summary, `Taxable: ₹${gstReport.body?.summary?.taxable_value}, Tax: ₹${gstReport.body?.summary?.total_gst}`);

    const outstandingReport = await request('GET', '/reports/outstanding', null, adminToken);
    recordResult('REPORTS', 'Outstanding Receivables Aging Report', outstandingReport.status === 200 && Array.isArray(outstandingReport.body?.outstanding), `Open Invoices: ${outstandingReport.body?.outstanding?.length}`);

    // 9. AUDIT TRAIL LOGGING
    const auditLogs = await request('GET', '/audit-logs?limit=10', null, adminToken);
    recordResult('AUDIT LOGS', 'Admin Audit Trail Retrieval', auditLogs.status === 200 && Array.isArray(auditLogs.body?.logs), `Logs Retrieved: ${auditLogs.body?.logs?.length}`);

    // 10. ROLE-BASED ACCESS ENFORCEMENT
    const auditorGstAccess = await request('GET', '/reports/gst', null, auditorToken);
    recordResult('SECURITY', 'Auditor Role Access to Tax Reports', auditorGstAccess.status === 200, 'Auditor permitted');

    const clientForbidden = await request('GET', '/reports/gst', null, clientToken);
    recordResult('SECURITY', 'Client Role Access Barrier to Agency Reports', clientForbidden.status === 403, 'Returned 403 Forbidden');

    // 11. HTML PAGES & ASSET INTEGRITY (ALL 31 ASSETS)
    const pagesToCheck = [
      '/login.html',
      '/index.html',
      '/admin/dashboard.html',
      '/admin/invoices.html',
      '/admin/create-invoice.html',
      '/admin/invoice-view.html',
      '/admin/clients.html',
      '/admin/client-edit.html',
      '/admin/services.html',
      '/admin/payments.html',
      '/admin/reports.html',
      '/admin/audit.html',
      '/admin/settings.html',
      '/auditor/dashboard.html',
      '/auditor/invoices.html',
      '/auditor/invoice-view.html',
      '/auditor/reports.html',
      '/auditor/audit-log.html',
      '/client/dashboard.html',
      '/client/invoice-view.html',
      '/css/style.css',
      '/css/invoice.css',
      '/js/api.js',
      '/js/auth.js',
      '/js/dashboard.js',
      '/js/invoice.js',
      '/js/clients.js',
      '/js/services.js',
      '/js/payments.js',
      '/js/reports.js',
      '/js/audit.js',
      '/js/settings.js'
    ];

    let assetsPassed = 0;
    for (const page of pagesToCheck) {
      const pRes = await request('GET', page);
      if (pRes.status === 200) assetsPassed++;
    }
    recordResult('ASSETS', 'Static HTML, JS & CSS Integrity', assetsPassed === pagesToCheck.length, `${assetsPassed}/${pagesToCheck.length} assets returned HTTP 200 OK`);

    console.log('\n================================================================');
    const total = auditResults.length;
    const passed = auditResults.filter(r => r.passed).length;
    const failed = total - passed;
    console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${total} criteria.`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Audit execution error:', err);
    process.exit(1);
  }
}

runComprehensiveAudit();
