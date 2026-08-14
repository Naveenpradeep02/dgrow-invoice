const db = require('../config/database');

async function logAudit({ user, action, entity_type, entity_id, old_data = null, new_data = null, req = null }) {
  try {
    const userId = user ? user.id : null;
    const userEmail = user ? user.email : 'system';
    const userRole = user ? user.role : 'SYSTEM';
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '') : '';

    const oldJson = old_data ? JSON.stringify(old_data) : null;
    const newJson = new_data ? JSON.stringify(new_data) : null;

    const sql = `
      INSERT INTO audit_logs (user_id, user_email, user_role, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      userId,
      userEmail,
      userRole,
      action,
      entity_type,
      String(entity_id),
      oldJson,
      newJson,
      ipAddress,
      userAgent
    ]);
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
}

// Diff helper for Auditor view
function generateDiff(oldObj, newObj) {
  if (!oldObj || !newObj) return [];
  const diffs = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  allKeys.forEach(key => {
    if (['created_at', 'updated_at', 'client_snapshot_json'].includes(key)) return;
    const val1 = JSON.stringify(oldObj[key]);
    const val2 = JSON.stringify(newObj[key]);
    if (val1 !== val2) {
      diffs.push({
        field: key,
        old_value: oldObj[key],
        new_value: newObj[key]
      });
    }
  });

  return diffs;
}

module.exports = {
  logAudit,
  generateDiff
};
