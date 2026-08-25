const http = require('http');

const BASE_URL = 'http://localhost:5000';

const pages = [
  '/login.html',
  '/index.html',
  '/admin/dashboard.html',
  '/admin/clients.html',
  '/admin/client-edit.html',
  '/admin/create-invoice.html',
  '/admin/invoice-view.html',
  '/admin/invoices.html',
  '/admin/payments.html',
  '/admin/reports.html',
  '/admin/services.html',
  '/admin/settings.html',
  '/admin/marketers.html',
  '/admin/audit.html',
  '/auditor/dashboard.html',
  '/auditor/audit-log.html',
  '/auditor/invoice-view.html',
  '/auditor/invoices.html',
  '/auditor/reports.html',
  '/client/dashboard.html',
  '/client/invoice-view.html',
  '/js/api.js',
  '/js/auth.js',
  '/js/clients.js',
  '/js/dashboard.js',
  '/js/invoice.js',
  '/js/payments.js',
  '/js/reports.js',
  '/js/services.js',
  '/js/settings.js',
  '/js/marketers.js',
  '/js/audit.js',
  '/css/styles.css'
];

function checkPage(path) {
  return new Promise((resolve) => {
    http.get(BASE_URL + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ path, statusCode: res.statusCode, length: data.length });
      });
    }).on('error', (err) => {
      resolve({ path, statusCode: 500, error: err.message });
    });
  });
}

async function runStaticTests() {
  console.log("=================================================");
  console.log("    FRONTEND ASSETS & HTML PAGE INTEGRITY TEST   ");
  console.log("=================================================");
  
  let passed = 0;
  let failed = 0;

  for (const page of pages) {
    const result = await checkPage(page);
    if (result.statusCode === 200 && result.length > 0) {
      console.log(`[✓] PASS 200 OK: ${result.path} (${result.length} bytes)`);
      passed++;
    } else {
      console.log(`[✗] FAIL ${result.statusCode}: ${result.path} - ${result.error || 'Empty response'}`);
      failed++;
    }
  }

  console.log("=================================================");
  console.log(` FRONTEND TEST RESULTS: ${passed} PASSED, ${failed} FAILED out of ${pages.length} assets.`);
  console.log("=================================================");
}

runStaticTests();
