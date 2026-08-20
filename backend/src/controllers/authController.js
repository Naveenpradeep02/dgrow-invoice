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
      ? "INSERT IGNORE INTO roles (id, name) VALUES (1, 'ADMIN'), (2, 'CLIENT'), (3, 'AUDITOR')"
      : "INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'ADMIN'), (2, 'CLIENT'), (3, 'AUDITOR')";
    await db.query(rolesSql);

    // Fetch clients
    const clients = await db.query('SELECT id FROM clients LIMIT 1');
    const clientId = clients[0] ? clients[0].id : 1;

    // Automatically update/migrate Admin in production DB on server startup
    const existingAdmin = await db.query("SELECT id FROM users WHERE id = 1 OR email = 'admin@dgrow.com' OR email = 'info@dgrowmarketing.com' ORDER BY id ASC LIMIT 1");
    if (existingAdmin && existingAdmin.length > 0) {
      await db.query(
        "UPDATE users SET name = 'D-GROW Admin', email = 'info@dgrowmarketing.com', password_hash = ?, role_id = 1, status = 'ACTIVE' WHERE id = ?",
        [defaultAdminPass, existingAdmin[0].id]
      );
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
      `SELECT u.id, u.name, u.email, u.password_hash, u.client_id, u.status, r.name as role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ? OR u.email = ?`,
      [inputEmail, normalizedEmail]
    );

    const user = users[0];
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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
        role: user.role,
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

module.exports = {
  seedDefaultUsersIfEmpty,
  login,
  getMe
};
