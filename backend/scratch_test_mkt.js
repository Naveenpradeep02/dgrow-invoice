const http = require('http');

async function run() {
  function makeReq(options, postData) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      });
      req.on('error', reject);
      if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
      req.end();
    });
  }

  // 1. Admin login to create or verify marketing staff
  const adminLogin = await makeReq({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'info@dgrowmarketing.com', password: 'Srija@345' });

  const adminToken = adminLogin.data.token;
  const testEmail = `marketing_staff_${Date.now()}@dgrowmarketing.com`;

  // Create a marketing user
  const createMkt = await makeReq({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/users',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { name: 'Mkt Staff', email: testEmail, password: 'password123', role_id: 4, status: 'ACTIVE' });

  console.log('Create Mkt user status:', createMkt.status, createMkt.data?.message);

  // Marketing user login
  const mktLogin = await makeReq({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, password: 'password123' });

  console.log('Marketing login:', mktLogin.status, 'User Role:', mktLogin.data?.user?.role);
  const mktToken = mktLogin.data.token;

  // Test /api/meetings
  const meetRes = await makeReq({
    hostname: 'localhost',
    port: 5000,
    path: '/api/meetings',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${mktToken}` }
  });
  console.log('GET /api/meetings as Marketing:', meetRes.status, 'Count:', meetRes.data?.meetings?.length);

  // Test /api/clients
  const clientRes = await makeReq({
    hostname: 'localhost',
    port: 5000,
    path: '/api/clients',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${mktToken}` }
  });
  console.log('GET /api/clients as Marketing:', clientRes.status, 'Count:', clientRes.data?.clients?.length);

  // Test /api/services
  const srvRes = await makeReq({
    hostname: 'localhost',
    port: 5000,
    path: '/api/services',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${mktToken}` }
  });
  console.log('GET /api/services as Marketing:', srvRes.status, 'Count:', srvRes.data?.services?.length);

  // Test /api/proposals
  const propRes = await makeReq({
    hostname: 'localhost',
    port: 5000,
    path: '/api/proposals',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${mktToken}` }
  });
  console.log('GET /api/proposals as Marketing:', propRes.status, 'Count:', propRes.data?.proposals?.length);
}

run().catch(console.error);
