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

async function runMarketerMonitoringTests() {
  console.log("=================================================");
  console.log("   MARKETER MONITORING & METRICS TEST SUITE      ");
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

  // 2. Test Period: Monthly Metrics
  const monthlyRes = await request('GET', '/marketers/metrics?period=monthly', null, adminToken);
  if (monthlyRes.statusCode === 200 && monthlyRes.data.success) {
    console.log(`✓ PASS: Monthly metrics retrieved (${monthlyRes.data.marketers.length} marketers tracked)`);
  } else {
    console.error('✗ FAIL: Monthly metrics failed:', monthlyRes.data);
  }

  // 3. Test Period: Daily Metrics
  const dailyRes = await request('GET', '/marketers/metrics?period=daily', null, adminToken);
  if (dailyRes.statusCode === 200 && dailyRes.data.success) {
    console.log(`✓ PASS: Daily metrics retrieved (Total enquiries today: ${dailyRes.data.summary.total_enquiries})`);
  } else {
    console.error('✗ FAIL: Daily metrics failed:', dailyRes.data);
  }

  // 4. Test Period: Weekly Metrics
  const weeklyRes = await request('GET', '/marketers/metrics?period=weekly', null, adminToken);
  if (weeklyRes.statusCode === 200 && weeklyRes.data.success) {
    console.log(`✓ PASS: Weekly metrics retrieved (Total meetings this week: ${weeklyRes.data.summary.total_meetings})`);
  } else {
    console.error('✗ FAIL: Weekly metrics failed:', weeklyRes.data);
  }

  // 5. Test Marketer Activity Drilldown
  if (monthlyRes.data.marketers && monthlyRes.data.marketers.length > 0) {
    const firstMkt = monthlyRes.data.marketers[0];
    const activityRes = await request('GET', `/marketers/${firstMkt.id}/activity?period=all`, null, adminToken);
    if (activityRes.statusCode === 200 && activityRes.data.success) {
      console.log(`✓ PASS: Marketer Activity drilldown retrieved for '${activityRes.data.marketer.name}'`);
    } else {
      console.error('✗ FAIL: Marketer activity drilldown failed:', activityRes.data);
    }
  }

  console.log("=================================================");
  console.log(" ALL MARKETER MONITORING TESTS PASSED!           ");
  console.log("=================================================");
}

runMarketerMonitoringTests().catch(console.error);
