function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication context missing.',
        errorCode: 'UNAUTHORIZED'
      });
    }

    const userRole = String(req.user.role || '').toUpperCase().trim();
    const normalizedAllowed = allowedRoles.map(r => String(r).toUpperCase().trim());

    // Normalize MARKETING and SALES_EXECUTIVE as equivalent
    const effectiveRoles = [userRole];
    if (userRole === 'SALES_EXECUTIVE' || userRole === 'MARKETING') {
      effectiveRoles.push('MARKETING', 'SALES_EXECUTIVE');
    }

    const isAuthorized = effectiveRoles.some(r => normalizedAllowed.includes(r));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to perform this operation.`,
        errorCode: 'ROLE_FORBIDDEN'
      });
    }

    next();
  };
}

module.exports = {
  authorizeRoles
};
