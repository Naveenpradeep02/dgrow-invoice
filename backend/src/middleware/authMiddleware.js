const jwt = require('jsonwebtoken');
const db = require('../config/database');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required. Please login.',
      errorCode: 'UNAUTHORIZED'
    });
  }

  const secret = process.env.JWT_SECRET || 'dgrow_super_secret_jwt_key_2026_marketing_agency';

  jwt.verify(token, secret, async (err, decodedUser) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.',
        errorCode: 'TOKEN_EXPIRED'
      });
    }

    try {
      // Check live active status from DB
      const users = await db.query(
        `SELECT u.id, u.name, u.email, u.client_id, u.role_id, COALESCE(u.status, 'ACTIVE') as status, 
                COALESCE(r.name, CASE WHEN u.role_id = 4 THEN 'MARKETING' WHEN u.role_id = 1 THEN 'ADMIN' WHEN u.role_id = 3 THEN 'AUDITOR' ELSE 'CLIENT' END) as role 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ? LIMIT 1`,
        [decodedUser.id]
      );

      const dbUser = users[0];
      if (!dbUser) {
        return res.status(401).json({
          success: false,
          message: 'Account not found. You have been logged out.',
          errorCode: 'ACCOUNT_NOT_FOUND'
        });
      }

      if (dbUser.status !== 'ACTIVE') {
        return res.status(401).json({
          success: false,
          message: 'Your account has been deactivated by administrator. You have been logged out.',
          errorCode: 'ACCOUNT_DEACTIVATED'
        });
      }

      const effectiveRole = String(dbUser.role || '').toUpperCase().trim();
      const finalRole = (effectiveRole === 'SALES_EXECUTIVE' || effectiveRole === 'MARKETING' || dbUser.role_id === 4)
        ? 'MARKETING'
        : effectiveRole;

      req.user = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: finalRole,
        client_id: dbUser.client_id,
        status: dbUser.status
      };

      next();
    } catch (dbErr) {
      console.error('[Auth Middleware DB check error]', dbErr.message);
      req.user = decodedUser;
      next();
    }
  });
}

module.exports = {
  authenticateToken
};

