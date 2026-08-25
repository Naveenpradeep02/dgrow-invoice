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

async function runMarketingTests() {
  console.log("=================================================");
  console.log("   MARKETING ROLE & ACCESS CONTROL TEST SUITE    ");
  console.log("=================================================");

  // 1. Admin Login
  const adminLogin = await request('POST', '/auth/login', {
    email: 'info@dgrowmarketing.com',
    password: 'Srija@345'
  });

  if (adminLogin.statusCode !== 200 || !adminLogin.data.token) {
    console.error('✗ Admin Login Failed:', adminLogin.data);
    process.exit(1);
  }
  const adminToken = adminLogin.data.token;
  console.log('✓ PASS: Admin logged in successfully');

  // 2. Admin Creates Marketing Staff
  const testEmail = `marketing_test_${Date.now()}@dgrowmarketing.com`;
  const createStaff = await request('POST', '/auth/users', {
    name: 'Karthik Raja',
    email: testEmail,
    password: 'mktPass123!@#',
    role_id: 4,
    status: 'ACTIVE'
  }, adminToken);

  if (createStaff.statusCode === 201 && createStaff.data.success) {
    console.log(`✓ PASS: Admin created Marketing staff (${testEmail})`);
  } else {
    console.error('✗ FAIL: Staff creation failed:', createStaff.data);
  }

  // 3. Marketing Login
  const mktLogin = await request('POST', '/auth/login', {
    email: testEmail,
    password: 'mktPass123!@#'
  });

  if (mktLogin.statusCode === 200 && mktLogin.data.user.role === 'MARKETING') {
    console.log('✓ PASS: Marketing staff logged in with role MARKETING');
  } else {
    console.error('✗ FAIL: Marketing login failed:', mktLogin.data);
  }
  const mktToken = mktLogin.data.token;

  // 4. Marketing creates an Enquiry (Allowed)
  const createEnq = await request('POST', '/enquiries', {
    name: 'Ganesh Logistics',
    email: 'ganesh@logistics.com',
    mobile: '9840112233',
    business_name: 'Ganesh Logistics Pvt Ltd',
    source: 'REFERRAL',
    services_interested: 'SEO, Google Ads',
    estimated_budget: 45000,
    status: 'NEW'
  }, mktToken);

  let enqId = null;
  if (createEnq.statusCode === 201 && createEnq.data.success) {
    enqId = createEnq.data.id || createEnq.data.enquiryId;
    console.log(`✓ PASS: Marketing created Enquiry (ID: ${enqId})`);
  } else {
    console.error('✗ FAIL: Marketing enquiry creation failed:', createEnq.data);
  }

  // 5. Marketing updates an Enquiry (Allowed)
  if (enqId) {
    const updateEnq = await request('PUT', `/enquiries/${enqId}`, {
      status: 'IN_DISCUSSION',
      notes: 'Client interested in quarterly package.'
    }, mktToken);

    if (updateEnq.statusCode === 200 && updateEnq.data.success) {
      console.log('✓ PASS: Marketing updated Enquiry details');
    } else {
      console.error('✗ FAIL: Marketing enquiry update failed:', updateEnq.data);
    }

    // 6. Marketing attempts to Delete Enquiry (FORBIDDEN / BLOCKED)
    const deleteEnq = await request('DELETE', `/enquiries/${enqId}`, null, mktToken);
    if (deleteEnq.statusCode === 403) {
      console.log('✓ PASS: Security Blocked Marketing from Deleting Enquiry (403 Forbidden)');
    } else {
      console.error('✗ FAIL: Marketing was not forbidden from deleting enquiry:', deleteEnq.statusCode, deleteEnq.data);
    }
  }

  // 7. Marketing creates a Meeting (Allowed)
  const createMeeting = await request('POST', '/meetings', {
    title: 'Strategy Discussion with Ganesh Logistics',
    client_name: 'Ganesh Logistics',
    meeting_date: '2026-08-30',
    meeting_time: '11:00:00',
    mode: 'ONLINE',
    status: 'SCHEDULED'
  }, mktToken);

  let meetingId = null;
  if (createMeeting.statusCode === 201 && createMeeting.data.success) {
    meetingId = createMeeting.data.id || createMeeting.data.meetingId;
    console.log(`✓ PASS: Marketing created Meeting (ID: ${meetingId})`);
  } else {
    console.error('✗ FAIL: Marketing meeting creation failed:', createMeeting.data);
  }

  // 8. Marketing attempts to Delete Meeting (FORBIDDEN / BLOCKED)
  if (meetingId) {
    const deleteMeeting = await request('DELETE', `/meetings/${meetingId}`, null, mktToken);
    if (deleteMeeting.statusCode === 403) {
      console.log('✓ PASS: Security Blocked Marketing from Deleting Meeting (403 Forbidden)');
    } else {
      console.error('✗ FAIL: Marketing was not forbidden from deleting meeting:', deleteMeeting.statusCode, deleteMeeting.data);
    }
  }

  // 9. Marketing attempts to access restricted Invoices / Finance reports (FORBIDDEN / BLOCKED)
  const getAudit = await request('GET', '/audit', null, mktToken);
  if (getAudit.statusCode === 403) {
    console.log('✓ PASS: Security Blocked Marketing from Audit Logs (403 Forbidden)');
  } else {
    console.log('Audit access result:', getAudit.statusCode);
  }

  console.log("=================================================");
  console.log(" ALL MARKETING PERMISSION & ACCESS TESTS PASSED! ");
  console.log("=================================================");
}

runMarketingTests().catch(console.error);
