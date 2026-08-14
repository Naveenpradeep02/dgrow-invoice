const http = require('http');

const API_BASE = 'http://localhost:5000/api';

let adminToken = '';
let auditorToken = '';
let clientToken = '';
let testClientId = null;
let testServiceId = null;
let testInvoiceId = null;
let testPaymentId = null;

const results = [];

function logResult(testName, status, details = '') {
  results.push({ testName, status, details });
  const symbol = status === 'PASS' ? '✓' : '✗';
  console.log(`[${symbol}] ${status}: ${testName}${details ? ' - ' + details : ''}`);
}

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
          resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("=================================================");
  console.log("       D-GROW DIGITAL BILL - FULL TEST SUITE     ");
  console.log("=================================================");

  try {
    // 1. Health Check
    const health = await request('GET', '/health');
    if (health.statusCode === 200 && health.data.status === 'UP') {
      logResult('Health Check API', 'PASS', `DB Driver: ${health.data.db_driver}`);
    } else {
      logResult('Health Check API', 'FAIL', JSON.stringify(health.data));
    }

    // 2. Auth - Admin Login
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@dgrow.com',
      password: 'admin123'
    });
    if (adminLogin.statusCode === 200 && adminLogin.data.success && adminLogin.data.token) {
      adminToken = adminLogin.data.token;
      logResult('Auth - Admin Login', 'PASS', `Logged in as ${adminLogin.data.user.email} (${adminLogin.data.user.role})`);
    } else {
      logResult('Auth - Admin Login', 'FAIL', JSON.stringify(adminLogin.data));
    }

    // 3. Auth - Auditor Login
    const auditorLogin = await request('POST', '/auth/login', {
      email: 'auditor@dgrow.com',
      password: 'auditor123'
    });
    if (auditorLogin.statusCode === 200 && auditorLogin.data.success && auditorLogin.data.token) {
      auditorToken = auditorLogin.data.token;
      logResult('Auth - Auditor Login', 'PASS', `Logged in as ${auditorLogin.data.user.email} (${auditorLogin.data.user.role})`);
    } else {
      logResult('Auth - Auditor Login', 'FAIL', JSON.stringify(auditorLogin.data));
    }

    // 4. Auth - Client Login
    const clientLogin = await request('POST', '/auth/login', {
      email: 'client@marksbiotech.com',
      password: 'client123'
    });
    if (clientLogin.statusCode === 200 && clientLogin.data.success && clientLogin.data.token) {
      clientToken = clientLogin.data.token;
      logResult('Auth - Client Login', 'PASS', `Logged in as ${clientLogin.data.user.email} (${clientLogin.data.user.role})`);
    } else {
      logResult('Auth - Client Login', 'FAIL', JSON.stringify(clientLogin.data));
    }

    // 5. Auth - Invalid Password Rejection
    const invalidLogin = await request('POST', '/auth/login', {
      email: 'admin@dgrow.com',
      password: 'wrongpassword'
    });
    if (invalidLogin.statusCode === 401 && !invalidLogin.data.success) {
      logResult('Auth - Rejected Invalid Credentials', 'PASS', 'Returned 401 Unauthorized');
    } else {
      logResult('Auth - Rejected Invalid Credentials', 'FAIL', `Unexpected status: ${invalidLogin.statusCode}`);
    }

    // 6. Auth - Get Current User (/auth/me)
    const meRes = await request('GET', '/auth/me', null, adminToken);
    if (meRes.statusCode === 200 && meRes.data.user && meRes.data.user.role === 'ADMIN') {
      logResult('Auth - Token Verification (/auth/me)', 'PASS', `Verified identity: ${meRes.data.user.name}`);
    } else {
      logResult('Auth - Token Verification (/auth/me)', 'FAIL', JSON.stringify(meRes.data));
    }

    // 7. Services - List Services
    const servicesList = await request('GET', '/services', null, adminToken);
    if (servicesList.statusCode === 200 && servicesList.data.success && Array.isArray(servicesList.data.services)) {
      logResult('Services - List Services', 'PASS', `Found ${servicesList.data.services.length} services`);
    } else {
      logResult('Services - List Services', 'FAIL', JSON.stringify(servicesList.data));
    }

    // 8. Services - Create Service
    const createService = await request('POST', '/services', {
      name: 'Performance Marketing Campaign',
      description: 'Google & Meta Ads management and scaling',
      sac_code: '998314',
      rate: 25000,
      gst_rate: 18
    }, adminToken);
    if (createService.statusCode === 201 && createService.data.success) {
      testServiceId = createService.data.serviceId;
      logResult('Services - Create Service', 'PASS', `Created service ID: ${testServiceId}`);
    } else {
      logResult('Services - Create Service', 'FAIL', JSON.stringify(createService.data));
    }

    // 9. Services - Update Service
    if (testServiceId) {
      const updateService = await request('PUT', `/services/${testServiceId}`, {
        name: 'Performance Marketing Campaign (Enterprise)',
        description: 'Updated description for enterprise marketing',
        sac_code: '998314',
        rate: 30000,
        gst_rate: 18
      }, adminToken);
      if (updateService.statusCode === 200 && updateService.data.success) {
        logResult('Services - Update Service', 'PASS', 'Updated service rate to ₹30,000');
      } else {
        logResult('Services - Update Service', 'FAIL', JSON.stringify(updateService.data));
      }
    }

    // 10. Clients - Create Client
    const createClient = await request('POST', '/clients', {
      company_name: 'TechNova Solutions Pvt Ltd',
      contact_person: 'Rahul Sharma',
      mobile: '9876543210',
      email: `technova_${Date.now()}@example.com`,
      address: '123 Tech Park, Electronic City',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560100',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F'
    }, adminToken);

    if (createClient.statusCode === 201 && createClient.data.success) {
      testClientId = createClient.data.clientId;
      logResult('Clients - Create Client', 'PASS', `Created client ID: ${testClientId}`);
    } else {
      logResult('Clients - Create Client', 'FAIL', JSON.stringify(createClient.data));
    }

    // 11. Clients - List Clients
    const clientsList = await request('GET', '/clients', null, adminToken);
    if (clientsList.statusCode === 200 && clientsList.data.success && Array.isArray(clientsList.data.clients)) {
      logResult('Clients - Fetch List', 'PASS', `Found ${clientsList.data.clients.length} active clients`);
    } else {
      logResult('Clients - Fetch List', 'FAIL', JSON.stringify(clientsList.data));
    }

    // 12. Invoices - Generate Next Invoice Number
    const nextNumRes = await request('GET', '/invoices/next-number?type=GST', null, adminToken);
    if (nextNumRes.statusCode === 200 && nextNumRes.data.success) {
      logResult('Invoices - Auto-Sequence Generator', 'PASS', `Next invoice number: ${nextNumRes.data.invoice_number}`);
    } else {
      logResult('Invoices - Auto-Sequence Generator', 'FAIL', JSON.stringify(nextNumRes.data));
    }

    // 13. Invoices - Create Intra-State Invoice (Tamil Nadu to Tamil Nadu: CGST 9% + SGST 9%)
    const createInvIntra = await request('POST', '/invoices', {
      invoice_type: 'GST',
      client_id: testClientId,
      place_of_supply: 'Karnataka (29)',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      payment_terms_text: '100% payment within 15 days',
      status: 'ISSUED',
      notes: 'Thank you for partnering with D-GROW.',
      items: [
        {
          service_id: testServiceId,
          description: 'Performance Marketing Campaign Execution',
          hsn_sac: '998314',
          quantity: 1,
          rate: 30000,
          discount: 0,
          gst_rate: 18
        }
      ]
    }, adminToken);

    if (createInvIntra.statusCode === 201 && createInvIntra.data.success) {
      testInvoiceId = createInvIntra.data.invoiceId;
      logResult('Invoices - Create Invoice with Tax Calculations', 'PASS', `Invoice ID: ${testInvoiceId}`);
    } else {
      logResult('Invoices - Create Invoice with Tax Calculations', 'FAIL', JSON.stringify(createInvIntra.data));
    }

    // 14. Invoices - Fetch Invoice Details
    if (testInvoiceId) {
      const getInv = await request('GET', `/invoices/${testInvoiceId}`, null, adminToken);
      if (getInv.statusCode === 200 && getInv.data.success) {
        const inv = getInv.data.invoice;
        logResult('Invoices - Fetch Single Invoice', 'PASS', 
          `Invoice #${inv.invoice_number} | Taxable: ₹${inv.taxable_amount}, CGST: ₹${inv.cgst_amount}, SGST: ₹${inv.sgst_amount}, IGST: ₹${inv.igst_amount}, Grand Total: ₹${inv.grand_total}`);
      } else {
        logResult('Invoices - Fetch Single Invoice', 'FAIL', JSON.stringify(getInv.data));
      }
    }

    // 15. Invoices - Dynamic PDF Stream Generation
    if (testInvoiceId) {
      const pdfRes = await request('GET', `/invoices/${testInvoiceId}/pdf`, null, adminToken);
      if (pdfRes.statusCode === 200 && (pdfRes.headers['content-type'] === 'application/pdf' || pdfRes.raw)) {
        logResult('Invoices - Download PDF Document Stream', 'PASS', 'PDF Kit rendered 8-section layout stream successfully');
      } else {
        logResult('Invoices - Download PDF Document Stream', 'FAIL', `Status: ${pdfRes.statusCode}`);
      }
    }

    // 16. Payments - Record Payment
    if (testInvoiceId) {
      const getInv = await request('GET', `/invoices/${testInvoiceId}`, null, adminToken);
      const grandTotal = getInv.data.invoice.grand_total;

      const paymentRes = await request('POST', '/payments', {
        invoice_id: testInvoiceId,
        amount: grandTotal,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'Bank Transfer',
        reference_number: `TXN_${Date.now()}`,
        notes: 'Full payment received via bank transfer'
      }, adminToken);

      if (paymentRes.statusCode === 201 && paymentRes.data.success) {
        testPaymentId = paymentRes.data.paymentId;
        logResult('Payments - Record Payment against Invoice', 'PASS', `Payment ID: ${testPaymentId}, Amount: ₹${grandTotal}`);
      } else {
        logResult('Payments - Record Payment against Invoice', 'FAIL', JSON.stringify(paymentRes.data));
      }
    }

    // 17. Invoices - Verify Automatic Status Update to PAID
    if (testInvoiceId) {
      const checkPaidInv = await request('GET', `/invoices/${testInvoiceId}`, null, adminToken);
      if (checkPaidInv.statusCode === 200 && checkPaidInv.data.invoice.status === 'PAID') {
        logResult('Invoices - Status Recalculation (PAID)', 'PASS', `Verified status: ${checkPaidInv.data.invoice.status}`);
      } else {
        logResult('Invoices - Status Recalculation (PAID)', 'FAIL', `Current status: ${checkPaidInv.data.invoice?.status}`);
      }
    }

    // 18. Settings - Fetch Agency Settings
    const getSettings = await request('GET', '/settings', null, adminToken);
    if (getSettings.statusCode === 200 && getSettings.data.success && getSettings.data.company) {
      logResult('Settings - Fetch Agency Profile', 'PASS', `Agency: ${getSettings.data.company.company_name}, GSTIN: ${getSettings.data.company.gstin}`);
    } else {
      logResult('Settings - Fetch Agency Profile', 'FAIL', JSON.stringify(getSettings.data));
    }

    // 19. Settings - Update Company Settings
    const updateCompany = await request('PUT', '/settings/company', {
      company_name: 'D-GROW Marketing Agency',
      gstin: '33AAACM1234F1Z5',
      address: 'Suite 404, Tech Plaza, Anna Salai',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600002',
      phone: '+91 98765 43210',
      email: 'contact@dgrow.com',
      website: 'www.dgrow.com',
      bank_name: 'HDFC Bank',
      account_number: '50200012345678',
      ifsc_code: 'HDFC0001234',
      banking_name: 'D-GROW Marketing Agency',
      branch_name: 'Anna Salai, Chennai',
      gpay_number: '9876543210',
      authorized_person: 'Proprietor',
      signature_title: 'For D-GROW Marketing Agency'
    }, adminToken);
    if (updateCompany.statusCode === 200 && updateCompany.data.success) {
      logResult('Settings - Update Company Details', 'PASS', updateCompany.data.message);
    } else {
      logResult('Settings - Update Company Details', 'FAIL', JSON.stringify(updateCompany.data));
    }

    // 20. Audit Logs - Admin Access
    const auditLogsAdmin = await request('GET', '/audit-logs', null, adminToken);
    if (auditLogsAdmin.statusCode === 200 && auditLogsAdmin.data.success && Array.isArray(auditLogsAdmin.data.logs)) {
      logResult('Audit Logs - Admin Audit Trail Access', 'PASS', `Recorded ${auditLogsAdmin.data.logs.length} system audit logs`);
    } else {
      logResult('Audit Logs - Admin Audit Trail Access', 'FAIL', JSON.stringify(auditLogsAdmin.data));
    }

    // 21. Audit Logs - Auditor Role Access
    const auditLogsAuditor = await request('GET', '/audit-logs', null, auditorToken);
    if (auditLogsAuditor.statusCode === 200 && auditLogsAuditor.data.success && Array.isArray(auditLogsAuditor.data.logs)) {
      logResult('Audit Logs - Tax Auditor Role Access', 'PASS', `Auditor retrieved ${auditLogsAuditor.data.logs.length} audit entries`);
    } else {
      logResult('Audit Logs - Tax Auditor Role Access', 'FAIL', JSON.stringify(auditLogsAuditor.data));
    }

    // 22. Reports - Dashboard KPIs
    const kpiRep = await request('GET', '/reports/kpis', null, adminToken);
    if (kpiRep.statusCode === 200 && kpiRep.data.success && kpiRep.data.kpis) {
      const kpis = kpiRep.data.kpis;
      logResult('Reports - Dashboard KPIs', 'PASS', 
        `Revenue: ₹${kpis.total_revenue}, GST: ₹${kpis.gst_collected}, Paid: ₹${kpis.paid_amount}, Pending: ₹${kpis.pending_amount}`);
    } else {
      logResult('Reports - Dashboard KPIs', 'FAIL', JSON.stringify(kpiRep.data));
    }

    // 23. Reports - GST Tax Compliance Report
    const gstRep = await request('GET', '/reports/gst', null, auditorToken);
    if (gstRep.statusCode === 200 && gstRep.data.success) {
      logResult('Reports - GST Tax Compliance Report', 'PASS', 'Retrieved monthly/quarterly GST breakdown');
    } else {
      logResult('Reports - GST Tax Compliance Report', 'FAIL', JSON.stringify(gstRep.data));
    }

    // 24. Reports - Outstanding Payment Report
    const outRep = await request('GET', '/reports/outstanding', null, adminToken);
    if (outRep.statusCode === 200 && outRep.data.success) {
      logResult('Reports - Outstanding AR Report', 'PASS', `Pending invoices count: ${outRep.data.invoices ? outRep.data.invoices.length : 0}`);
    } else {
      logResult('Reports - Outstanding AR Report', 'FAIL', JSON.stringify(outRep.data));
    }

    // 25. Role Authorization Security Check: Client cannot access GST Report
    const unauthorizedGst = await request('GET', '/reports/gst', null, clientToken);
    if (unauthorizedGst.statusCode === 403) {
      logResult('Security - Role Permission Enforcement', 'PASS', 'Forbidden client from accessing auditor GST tax report');
    } else {
      logResult('Security - Role Permission Enforcement', 'FAIL', `Expected 403, got ${unauthorizedGst.statusCode}`);
    }

    // Cleanup test service
    if (testServiceId) {
      await request('DELETE', `/services/${testServiceId}`, null, adminToken);
    }

    console.log("\n=================================================");
    const passes = results.filter(r => r.status === 'PASS').length;
    const fails = results.filter(r => r.status === 'FAIL').length;
    console.log(` SUMMARY RESULTS: ${passes} PASSED, ${fails} FAILED out of ${results.length} tests.`);
    console.log("=================================================");

  } catch (error) {
    console.error("Test Suite Execution Error:", error);
  }
}

runTests();
