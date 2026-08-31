const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { logAudit } = require('../services/auditService');

async function seedDefaultUsersIfEmpty() {
  try {
    const defaultAdminPass = await bcrypt.hash('Srija@345', 10);
    const clientPass = await bcrypt.hash('client123', 10);
    const auditorPass = await bcrypt.hash('auditor123', 10);

    // Ensure Roles exist (MySQL: INSERT IGNORE, SQLite: INSERT OR IGNORE)
    const rolesSql = db.getDriver() === 'mysql'
      ? "INSERT IGNORE INTO roles (id, name) VALUES (1, 'ADMIN'), (2, 'CLIENT'), (3, 'AUDITOR'), (4, 'MARKETING')"
      : "INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'ADMIN'), (2, 'CLIENT'), (3, 'AUDITOR'), (4, 'MARKETING')";
    await db.query(rolesSql);

    // Fetch clients
    const clients = await db.query('SELECT id FROM clients LIMIT 1');
    const clientId = clients[0] ? clients[0].id : 1;

    // Automatically update/migrate Admin in production DB on server startup
    const existingAdmin = await db.query("SELECT id, password_hash FROM users WHERE id = 1 OR email = 'admin@dgrow.com' OR email = 'info@dgrowmarketing.com' ORDER BY id ASC LIMIT 1");
    if (existingAdmin && existingAdmin.length > 0) {
      if (!existingAdmin[0].password_hash) {
        await db.query(
          "UPDATE users SET name = 'D-GROW Admin', email = 'info@dgrowmarketing.com', password_hash = ?, role_id = 1, status = 'ACTIVE' WHERE id = ?",
          [defaultAdminPass, existingAdmin[0].id]
        );
      } else {
        await db.query(
          "UPDATE users SET name = 'D-GROW Admin', email = 'info@dgrowmarketing.com', role_id = 1, status = 'ACTIVE' WHERE id = ?",
          [existingAdmin[0].id]
        );
      }
    } else {
      await db.query(
        'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
        ['D-GROW Admin', 'info@dgrowmarketing.com', defaultAdminPass, 1]
      );
    }

    // Insert Client User
    const existingClient = await db.query("SELECT id FROM users WHERE email = 'client@marksbiotech.com'");
    if (!existingClient[0]) {
      await db.query(
        'INSERT INTO users (name, email, password_hash, role_id, client_id) VALUES (?, ?, ?, ?, ?)',
        ['Marks Biotech Client', 'client@marksbiotech.com', clientPass, 2, clientId]
      );
    }

    // Insert Auditor
    const existingAuditor = await db.query("SELECT id FROM users WHERE email = 'auditor@dgrow.com'");
    if (!existingAuditor[0]) {
      await db.query(
        'INSERT INTO users (name, email, password_hash, role_id, client_id) VALUES (?, ?, ?, ?)',
        ['Tax Auditor', 'auditor@dgrow.com', auditorPass, 3]
      );
    }

    console.log('[Auth Seed] Accounts confirmed: info@dgrowmarketing.com, client@marksbiotech.com, auditor@dgrow.com');
  } catch (err) {
    console.error('[Auth Seed Warning]', err.message);
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const inputEmail = email.toLowerCase().trim();
    const normalizedEmail = inputEmail.replace(/^info\.dgrowmarketing\.com$/, 'info@dgrowmarketing.com');

    const users = await db.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.client_id, u.role_id, COALESCE(u.status, 'ACTIVE') as status, 
              COALESCE(r.name, CASE WHEN u.role_id = 4 THEN 'MARKETING' WHEN u.role_id = 1 THEN 'ADMIN' WHEN u.role_id = 3 THEN 'AUDITOR' ELSE 'CLIENT' END) as role 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE LOWER(TRIM(u.email)) = ? OR LOWER(TRIM(u.email)) = ?`,
      [inputEmail, normalizedEmail]
    );

    const user = users[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Your account is inactive. Please contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    // Normalize role name
    const effectiveRole = String(user.role || '').toUpperCase().trim();
    const finalRole = (effectiveRole === 'SALES_EXECUTIVE' || effectiveRole === 'MARKETING' || user.role_id === 4)
      ? 'MARKETING'
      : effectiveRole;

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: finalRole,
      client_id: user.client_id
    };

    const secret = process.env.JWT_SECRET || 'dgrow_super_secret_jwt_key_2026_marketing_agency';
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });

    await logAudit({
      user: payload,
      action: 'LOGIN',
      entity_type: 'USER',
      entity_id: user.id,
      req
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: finalRole,
        client_id: user.client_id
      }
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ success: false, message: 'Server authentication error.' });
  }
}

async function getMe(req, res) {
  res.json({
    success: true,
    user: req.user
  });
}

// User Management (Admin Only)
async function getAllStaffUsers(req, res) {
  try {
    const users = await db.query(
      `SELECT u.id, u.name, u.email, COALESCE(u.status, 'ACTIVE') as status, u.created_at, 
              COALESCE(r.name, CASE WHEN u.role_id = 4 THEN 'MARKETING' WHEN u.role_id = 1 THEN 'ADMIN' WHEN u.role_id = 3 THEN 'AUDITOR' ELSE 'CLIENT' END) as role, 
              u.role_id 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       ORDER BY u.id ASC`
    );
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createStaffUser(req, res) {
  try {
    const { name, email, password, role_id = 4, status = 'ACTIVE' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), cleanEmail, passwordHash, parseInt(role_id) || 4, status]
    );

    const newUserId = result.insertId || (await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]))[0]?.id;

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'USER',
      entity_id: String(newUserId),
      new_data: { name, email: cleanEmail, role_id, status },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Staff user created successfully.',
      userId: newUserId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateStaffUser(req, res) {
  try {
    const userId = req.params.id;
    const { name, email, password, role_id, status } = req.body;

    const oldUser = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!oldUser || oldUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let passwordHash = oldUser[0].password_hash;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const updatedName = name !== undefined ? name.trim() : oldUser[0].name;
    const updatedEmail = email !== undefined ? email.toLowerCase().trim() : oldUser[0].email;
    const updatedRoleId = role_id !== undefined ? parseInt(role_id) : oldUser[0].role_id;
    const updatedStatus = status !== undefined ? status : oldUser[0].status;

    await db.query(
      'UPDATE users SET name = ?, email = ?, password_hash = ?, role_id = ?, status = ? WHERE id = ?',
      [updatedName, updatedEmail, passwordHash, updatedRoleId, updatedStatus, userId]
    );

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'USER',
      entity_id: String(userId),
      old_data: oldUser[0],
      new_data: { name: updatedName, email: updatedEmail, role_id: updatedRoleId, status: updatedStatus },
      req
    });

    res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteStaffUser(req, res) {
  try {
    const userId = req.params.id;
    if (String(userId) === '1' || String(userId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'Cannot delete the primary administrative account.' });
    }

    const oldUser = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!oldUser || oldUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    await logAudit({
      user: req.user,
      action: 'DELETE',
      entity_type: 'USER',
      entity_id: String(userId),
      old_data: oldUser[0],
      req
    });

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function changePassword(req, res) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized request.' });
    }

    const {
      oldPassword,
      newPassword,
      confirmPassword,
      old_password,
      new_password,
      confirm_password
    } = req.body;

    const currentPass = (oldPassword !== undefined ? oldPassword : old_password || '').trim();
    const newPass = (newPassword !== undefined ? newPassword : new_password || '').trim();
    const confirmPass = (confirmPassword !== undefined ? confirmPassword : confirm_password || '').trim();

    if (!currentPass || !newPass || !confirmPass) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: Old Password, New Password, and Confirm Password.'
      });
    }

    if (newPass.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters in length.'
      });
    }

    if (newPass !== confirmPass) {
      return res.status(400).json({
        success: false,
        message: 'New password and Confirm password do not match.'
      });
    }

    if (currentPass === newPass) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current old password.'
      });
    }

    const users = await db.query('SELECT id, name, email, password_hash FROM users WHERE id = ?', [userId]);
    const user = users[0];
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPass, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect old password. Please verify your current password.'
      });
    }

    const newPasswordHash = await bcrypt.hash(newPass, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, userId]);

    await logAudit({
      user: req.user,
      action: 'PASSWORD_CHANGE',
      entity_type: 'USER',
      entity_id: String(userId),
      new_data: { note: 'Admin changed password successfully' },
      req
    });

    return res.json({
      success: true,
      message: 'Password changed successfully! Please use your new password for future logins.'
    });
  } catch (err) {
    console.error('[Change Password Error]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to change password.' });
  }
}

module.exports = {
  seedDefaultUsersIfEmpty,
  login,
  getMe,
  changePassword,
  getAllStaffUsers,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser
};

