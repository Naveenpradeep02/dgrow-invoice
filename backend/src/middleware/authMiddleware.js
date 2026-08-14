const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
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

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired session token.',
        errorCode: 'FORBIDDEN'
      });
    }
    req.user = user;
    next();
  });
}

module.exports = {
  authenticateToken
};
