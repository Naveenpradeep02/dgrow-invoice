require('dotenv').config();
const db = require('./src/config/database');
const authController = require('./src/controllers/authController');

const BASE_URL = 'http://localhost:5000/api';

async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('--- STARTING ADMIN CHANGE PASSWORD TEST SUITE ---');

  try {
    await db.initDatabase();

    // 1. Get current admin from database
    const adminRows = await db.query("SELECT id, email, password_hash FROM users WHERE role_id = 1 OR email = 'info@dgrowmarketing.com' LIMIT 1");
    if (!adminRows[0]) {
      throw new Error('Admin user not found in DB');
    }
    const admin = adminRows[0];
    console.log(`Found admin user ID: ${admin.id}, Email: ${admin.email}`);

    // Try logging in with Srija@345 or test password
    let initialPassword = 'Srija@345';
    let token = null;
    let loginRes = await apiRequest('/auth/login', 'POST', {
      email: admin.email,
      password: initialPassword
    });

    if (loginRes.ok) {
      token = loginRes.data.token;
      console.log('✓ Successfully logged in with initial password (Srija@345)');
    } else {
      console.log('Initial password Srija@345 failed, trying NewAdminPass@2026...');
      loginRes = await apiRequest('/auth/login', 'POST', {
        email: admin.email,
        password: 'NewAdminPass@2026'
      });
      if (!loginRes.ok) throw new Error('Could not log in with either password');
      token = loginRes.data.token;
      initialPassword = 'NewAdminPass@2026';
      console.log('✓ Successfully logged in with NewAdminPass@2026');
    }

    // 2. Test Missing Fields
    console.log('\n--- Test 1: Missing Fields ---');
    const t1 = await apiRequest('/auth/change-password', 'POST', {
      oldPassword: initialPassword,
      newPassword: 'SomeNewPassword1'
      // missing confirmPassword
    }, token);
    if (t1.status === 400) {
      console.log('✓ Correctly rejected missing field:', t1.data.message);
    } else {
      throw new Error(`Expected 400 for missing confirmPassword, got ${t1.status}`);
    }

    // 3. Test Password Mismatch
    console.log('\n--- Test 2: Password Mismatch ---');
    const t2 = await apiRequest('/auth/change-password', 'POST', {
      oldPassword: initialPassword,
      newPassword: 'SomeNewPassword1',
      confirmPassword: 'DifferentPassword2'
    }, token);
    if (t2.status === 400) {
      console.log('✓ Correctly rejected password mismatch:', t2.data.message);
    } else {
      throw new Error(`Expected 400 for password mismatch, got ${t2.status}`);
    }

    // 4. Test Password Too Short (< 6 chars)
    console.log('\n--- Test 3: Password Too Short (< 6 chars) ---');
    const t3 = await apiRequest('/auth/change-password', 'POST', {
      oldPassword: initialPassword,
      newPassword: '123',
      confirmPassword: '123'
    }, token);
    if (t3.status === 400) {
      console.log('✓ Correctly rejected short password:', t3.data.message);
    } else {
      throw new Error(`Expected 400 for short password, got ${t3.status}`);
    }

    // 5. Test Incorrect Old Password
    console.log('\n--- Test 4: Incorrect Old Password ---');
    const t4 = await apiRequest('/auth/change-password', 'POST', {
      oldPassword: 'WrongPassword999!',
      newPassword: 'ValidNewPassword123',
      confirmPassword: 'ValidNewPassword123'
    }, token);
    if (t4.status === 400) {
      console.log('✓ Correctly rejected incorrect old password:', t4.data.message);
    } else {
      throw new Error(`Expected 400 for incorrect old password, got ${t4.status}`);
    }

    // 6. Test New Password Same as Old Password
    console.log('\n--- Test 5: New Password Same as Old Password ---');
    const t5 = await apiRequest('/auth/change-password', 'POST', {
      oldPassword: initialPassword,
      newPassword: initialPassword,
      confirmPassword: initialPassword
    }, token);
    if (t5.status === 400) {
      console.log('✓ Correctly rejected identical new password:', t5.data.message);
    } else {
      throw new Error(`Expected 400 for same password, got ${t5.status}`);
    }

    // 7. Test Successful Password Change
    console.log('\n--- Test 6: Successful Password Change ---');
    const targetNewPassword = initialPassword === 'Srija@345' ? 'NewAdminPass@2026' : 'Srija@345';
    const t6 = await apiRequest('/auth/change-password', 'POST', {
      oldPassword: initialPassword,
      newPassword: targetNewPassword,
      confirmPassword: targetNewPassword
    }, token);
    if (t6.ok) {
      console.log('✓ Change password succeeded:', t6.data);
    } else {
      throw new Error(`Change password failed: ${JSON.stringify(t6.data)}`);
    }

    // 8. Test Old Password Fails Login
    console.log('\n--- Test 7: Old Password Fails Login ---');
    const t7 = await apiRequest('/auth/login', 'POST', {
      email: admin.email,
      password: initialPassword
    });
    if (t7.status === 401) {
      console.log('✓ Correctly failed login with old password:', t7.data.message);
    } else {
      throw new Error(`Expected login failure with old password, got ${t7.status}`);
    }

    // 9. Test New Password Succeeds Login
    console.log('\n--- Test 8: New Password Succeeds Login ---');
    const t8 = await apiRequest('/auth/login', 'POST', {
      email: admin.email,
      password: targetNewPassword
    });
    if (t8.ok && t8.data.token) {
      console.log('✓ Successfully logged in with new password. Token received!');
    } else {
      throw new Error(`Failed to login with new password: ${JSON.stringify(t8.data)}`);
    }

    // 10. Test Seed Startup Does NOT Overwrite Password
    console.log('\n--- Test 9: Seed Function Preserves Custom Password ---');
    await authController.seedDefaultUsersIfEmpty();
    const t9 = await apiRequest('/auth/login', 'POST', {
      email: admin.email,
      password: targetNewPassword
    });
    if (t9.ok && t9.data.token) {
      console.log('✓ Custom password verified preserved after seed execution!');
    } else {
      throw new Error('Seed function wiped custom password!');
    }

    // 11. Restore original password Srija@345 so admin login remains known
    console.log('\n--- Restoring Default Password for Clean State ---');
    const t10 = await apiRequest('/auth/change-password', 'POST', {
      oldPassword: targetNewPassword,
      newPassword: 'Srija@345',
      confirmPassword: 'Srija@345'
    }, t9.data.token);
    if (t10.ok) {
      console.log('✓ Restored admin password back to Srija@345 for standard access.');
    } else {
      throw new Error(`Failed to restore password: ${JSON.stringify(t10.data)}`);
    }

    console.log('\n=========================================');
    console.log('🎉 ALL 9 TEST SCENARIOS PASSED WITH 100% SUCCESS! 🎉');
    console.log('=========================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failure:', err.message);
    process.exit(1);
  }
}

runTests();
