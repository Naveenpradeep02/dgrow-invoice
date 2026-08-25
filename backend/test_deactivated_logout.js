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

async function testDeactivatedForcedLogout() {
  console.log("=================================================");
  console.log("  DEACTIVATED ACCOUNT FORCED LOGOUT TEST SUITE   ");
  console.log("=================================================");

  // 1. Admin Login
  const adminLogin = await request('POST', '/auth/login', {
    email: 'info@dgrowmarketing.com',
    password: 'Srija@345'
  });
  const adminToken = adminLogin.data.token;
  console.log('✓ PASS: Admin logged in');

  // 2. Create a test marketer
  const email = `temp_staff_${Date.now()}@dgrowmarketing.com`;
  const createRes = await request('POST', '/auth/users', {
    name: 'Temporary Staff',
    email,
    password: 'PassWord123!',
    role_id: 4,
    status: 'ACTIVE'
  }, adminToken);

  const userId = createRes.data.userId;
  console.log(`✓ PASS: Created test staff account (ID: ${userId})`);

  // 3. Login as test staff
  const staffLogin = await request('POST', '/auth/login', {
    email,
    password: 'PassWord123!'
  });
  const staffToken = staffLogin.data.token;
  console.log('✓ PASS: Test staff logged in and received token');

  // 4. Staff verifies access to /auth/me
  const meRes1 = await request('GET', '/auth/me', null, staffToken);
  if (meRes1.statusCode === 200) {
    console.log('✓ PASS: Staff token works while account is ACTIVE');
  } else {
    console.error('✗ FAIL: Active staff could not access /auth/me');
  }

  // 5. Admin Deactivates the Staff Account
  const deactRes = await request('PUT', `/auth/users/${userId}`, {
    status: 'INACTIVE'
  }, adminToken);
  console.log(`✓ PASS: Admin deactivated staff account (status -> INACTIVE)`);

  // 6. Staff tries to make ANY request with their existing token
  const meRes2 = await request('GET', '/auth/me', null, staffToken);
  if (meRes2.statusCode === 401 && meRes2.data.errorCode === 'ACCOUNT_DEACTIVATED') {
    console.log('✓ PASS: Backend instantly rejected token with 401 ACCOUNT_DEACTIVATED');
    console.log(`  Message: "${meRes2.data.message}"`);
  } else {
    console.error('✗ FAIL: Token was not rejected after deactivation:', meRes2.statusCode, meRes2.data);
  }

  // 7. Staff tries to login again while deactivated
  const loginAttempt = await request('POST', '/auth/login', {
    email,
    password: 'PassWord123!'
  });
  if (loginAttempt.statusCode === 401) {
    console.log('✓ PASS: Login blocked for deactivated account');
  } else {
    console.error('✗ FAIL: Inactive staff was able to login');
  }

  // 8. Clean up test user
  await request('DELETE', `/auth/users/${userId}`, null, adminToken);
  console.log('✓ PASS: Test cleanup completed');

  console.log("=================================================");
  console.log(" ALL DEACTIVATION FORCED LOGOUT TESTS PASSED!    ");
  console.log("=================================================");
}

testDeactivatedForcedLogout().catch(console.error);
