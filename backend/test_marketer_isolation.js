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

async function runIsolationTests() {
  console.log('===============================================================');
  console.log('  FIELD MARKETER ISOLATION & CLIENT ASSIGNMENT TEST SUITE      ');
  console.log('===============================================================');

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
  console.log('✓ PASS: Admin logged in');

  // 2. Fetch Sai and Siva user IDs
  const usersRes = await request('GET', '/auth/users', null, adminToken);
  const saiUser = usersRes.data.users.find(u => u.email === 'sai@dgrowmarketing.com');
  const sivaUser = usersRes.data.users.find(u => u.email === 'ikotsiva@dgrowmarketing.com');
  const angelUser = usersRes.data.users.find(u => u.email === 'angel@dgrowmarketing.com');

  console.log(`✓ Marketers identified: Sai (ID ${saiUser?.id}), Siva (ID ${sivaUser?.id}), Angel (ID ${angelUser?.id})`);

  if (!saiUser || !sivaUser) {
    console.error('✗ Sai or Siva user not found in DB');
    process.exit(1);
  }

  // 3. Admin creates 3 distinct clients: one for Sai, one for Siva, one for Angel
  const timestamp = Date.now();
  const saiClientRes = await request('POST', '/clients', {
    company_name: `Sai Exclusive Client ${timestamp}`,
    contact_person: 'Sai Referral Lead',
    mobile: '9840011111',
    email: `saiclient_${timestamp}@example.com`,
    address: '12 Sai Street, Chennai',
    assigned_to: saiUser.id,
    marketing_person: saiUser.name
  }, adminToken);

  const sivaClientRes = await request('POST', '/clients', {
    company_name: `Siva Exclusive Client ${timestamp}`,
    contact_person: 'Siva Referral Lead',
    mobile: '9840022222',
    email: `sivaclient_${timestamp}@example.com`,
    address: '34 Siva Avenue, Chennai',
    assigned_to: sivaUser.id,
    marketing_person: sivaUser.name
  }, adminToken);

  const angelClientRes = await request('POST', '/clients', {
    company_name: `Angel Exclusive Client ${timestamp}`,
    contact_person: 'Angel Referral Lead',
    mobile: '9840033333',
    email: `angelclient_${timestamp}@example.com`,
    address: '56 Angel Road, Chennai',
    assigned_to: angelUser?.id || null,
    marketing_person: angelUser?.name || 'Angel'
  }, adminToken);

  const saiClientId = saiClientRes.data.clientId;
  const sivaClientId = sivaClientRes.data.clientId;
  const angelClientId = angelClientRes.data.clientId;

  console.log(`✓ PASS: Admin created clients - Sai (#${saiClientId}), Siva (#${sivaClientId}), Angel (#${angelClientId})`);

  // 4. Log in as Sai
  const saiLogin = await request('POST', '/auth/login', {
    email: 'sai@dgrowmarketing.com',
    password: 'Dgrow@123'
  });
  if (saiLogin.statusCode !== 200 || !saiLogin.data.token) {
    console.error('✗ Sai Login Failed:', saiLogin.data);
    process.exit(1);
  }
  const saiToken = saiLogin.data.token;
  console.log('✓ PASS: Sai logged in as MARKETING role');

  // 5. Test Sai's client list
  const saiClients = await request('GET', '/clients', null, saiToken);
  const saiCanSeeSai = saiClients.data.clients.some(c => c.id === saiClientId);
  const saiCanSeeSiva = saiClients.data.clients.some(c => c.id === sivaClientId);
  const saiCanSeeAngel = saiClients.data.clients.some(c => c.id === angelClientId);

  if (saiCanSeeSai && !saiCanSeeSiva && !saiCanSeeAngel) {
    console.log('✓ PASS: In Sai\'s login, only Sai\'s clients are visible. Siva\'s and Angel\'s clients are completely HIDDEN.');
  } else {
    console.error('✗ FAIL: Data leakage in Sai\'s view:', { saiCanSeeSai, saiCanSeeSiva, saiCanSeeAngel });
    process.exit(1);
  }

  // 6. Test Direct Access / IDOR protection for Sai
  const saiAccessSivaClient = await request('GET', `/clients/${sivaClientId}`, null, saiToken);
  if (saiAccessSivaClient.statusCode === 403) {
    console.log('✓ PASS: Sai directly requesting Siva\'s client returned 403 Forbidden.');
  } else {
    console.error('✗ FAIL: Sai was able to access Siva\'s client directly:', saiAccessSivaClient.statusCode);
    process.exit(1);
  }

  const saiAccessSiva360 = await request('GET', `/clients/${sivaClientId}/360-history`, null, saiToken);
  if (saiAccessSiva360.statusCode === 403) {
    console.log('✓ PASS: Sai requesting Siva\'s 360° history returned 403 Forbidden.');
  } else {
    console.error('✗ FAIL: Sai was able to access Siva\'s 360° history directly:', saiAccessSiva360.statusCode);
    process.exit(1);
  }

  // 7. Log in as Siva (reset password to test if needed or use known hash)
  // Let's ensure Siva password is set to Dgrow@123 via admin update
  await request('PUT', `/auth/users/${sivaUser.id}`, {
    password: 'Dgrow@123'
  }, adminToken);

  const sivaLogin = await request('POST', '/auth/login', {
    email: 'ikotsiva@dgrowmarketing.com',
    password: 'Dgrow@123'
  });
  if (sivaLogin.statusCode !== 200 || !sivaLogin.data.token) {
    console.error('✗ Siva Login Failed:', sivaLogin.data);
    process.exit(1);
  }
  const sivaToken = sivaLogin.data.token;
  console.log('✓ PASS: Siva logged in as MARKETING role');

  // 8. Test Siva's client list
  const sivaClients = await request('GET', '/clients', null, sivaToken);
  const sivaCanSeeSiva = sivaClients.data.clients.some(c => c.id === sivaClientId);
  const sivaCanSeeSai = sivaClients.data.clients.some(c => c.id === saiClientId);
  const sivaCanSeeAngel = sivaClients.data.clients.some(c => c.id === angelClientId);

  if (sivaCanSeeSiva && !sivaCanSeeSai && !sivaCanSeeAngel) {
    console.log('✓ PASS: In Siva\'s login, only Siva\'s clients are visible. Sai\'s and Angel\'s clients are completely HIDDEN.');
  } else {
    console.error('✗ FAIL: Data leakage in Siva\'s view:', { sivaCanSeeSiva, sivaCanSeeSai, sivaCanSeeAngel });
    process.exit(1);
  }

  // 9. Test Direct Access / IDOR protection for Siva
  const sivaAccessSaiClient = await request('GET', `/clients/${saiClientId}`, null, sivaToken);
  if (sivaAccessSaiClient.statusCode === 403) {
    console.log('✓ PASS: Siva directly requesting Sai\'s client returned 403 Forbidden.');
  } else {
    console.error('✗ FAIL: Siva was able to access Sai\'s client directly:', sivaAccessSaiClient.statusCode);
    process.exit(1);
  }

  // 10. Admin assigns Sai's client to Siva: "unless untill i assign the client"
  const assignRes = await request('PUT', `/clients/${saiClientId}/assign`, {
    marketer_id: sivaUser.id
  }, adminToken);

  if (assignRes.statusCode === 200 && assignRes.data.success) {
    console.log(`✓ PASS: Admin assigned Sai's client (#${saiClientId}) to Siva.`);
  } else {
    console.error('✗ Assignment Failed:', assignRes.data);
    process.exit(1);
  }

  // 11. Verify Siva can now view the assigned client
  const sivaClientsAfterAssign = await request('GET', '/clients', null, sivaToken);
  const sivaNowSeesAssigned = sivaClientsAfterAssign.data.clients.some(c => c.id === saiClientId);
  const sivaAccessAfterAssign = await request('GET', `/clients/${saiClientId}`, null, sivaToken);

  if (sivaNowSeesAssigned && sivaAccessAfterAssign.statusCode === 200) {
    console.log('✓ PASS: Once Admin assigned the client to Siva, Siva CAN now see and access that client!');
  } else {
    console.error('✗ FAIL: Siva could not access client after admin assignment.');
    process.exit(1);
  }

  // 12. Test Enquiries Isolation
  const saiEnquiry = await request('POST', '/enquiries', {
    name: `Sai Lead ${timestamp}`,
    mobile: '9840099991',
    business_name: `Sai Enterprises ${timestamp}`,
    source: 'MARKETING_PERSON',
    marketing_person: 'Sai'
  }, saiToken);

  const sivaEnquiry = await request('POST', '/enquiries', {
    name: `Siva Lead ${timestamp}`,
    mobile: '9840099992',
    business_name: `Siva Textiles ${timestamp}`,
    source: 'MARKETING_PERSON',
    marketing_person: 'Ikot Siva'
  }, sivaToken);

  const saiEnqId = saiEnquiry.data.enquiryId;
  const sivaEnqId = sivaEnquiry.data.enquiryId;

  // Check Sai's enquiries
  const saiEnquiriesRes = await request('GET', '/enquiries', null, saiToken);
  const saiSeesHisOwnEnq = saiEnquiriesRes.data.enquiries.some(e => e.id === saiEnqId);
  const saiSeesSivaEnq = saiEnquiriesRes.data.enquiries.some(e => e.id === sivaEnqId);

  if (saiSeesHisOwnEnq && !saiSeesSivaEnq) {
    console.log('✓ PASS: Sai sees only Sai\'s enquiries, Siva\'s enquiries are isolated.');
  } else {
    console.error('✗ FAIL: Enquiry isolation failed for Sai:', { saiSeesHisOwnEnq, saiSeesSivaEnq });
    process.exit(1);
  }

  // Check Siva's enquiries
  const sivaEnquiriesRes = await request('GET', '/enquiries', null, sivaToken);
  const sivaSeesHisOwnEnq = sivaEnquiriesRes.data.enquiries.some(e => e.id === sivaEnqId);
  const sivaSeesSaiEnq = sivaEnquiriesRes.data.enquiries.some(e => e.id === saiEnqId);

  if (sivaSeesHisOwnEnq && !sivaSeesSaiEnq) {
    console.log('✓ PASS: Siva sees only Siva\'s enquiries, Sai\'s enquiries are isolated.');
  } else {
    console.error('✗ FAIL: Enquiry isolation failed for Siva:', { sivaSeesHisOwnEnq, sivaSeesSaiEnq });
    process.exit(1);
  }

  // Check direct enquiry access protection
  const sivaAccessSaiEnq = await request('GET', `/enquiries/${saiEnqId}`, null, sivaToken);
  if (sivaAccessSaiEnq.statusCode === 403) {
    console.log('✓ PASS: Siva attempting to view Sai\'s enquiry returned 403 Forbidden.');
  } else {
    console.error('✗ FAIL: Siva accessed Sai\'s enquiry directly:', sivaAccessSaiEnq.statusCode);
    process.exit(1);
  }

  console.log('===============================================================');
  console.log('  ALL FIELD MARKETER ISOLATION & ASSIGNMENT TESTS PASSED! ✓   ');
  console.log('===============================================================');
  process.exit(0);
}

runIsolationTests().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
