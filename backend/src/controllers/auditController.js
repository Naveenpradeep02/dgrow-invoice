const db = require('../config/database');
const { generateDiff } = require('../services/auditService');

async function getAuditLogs(req, res) {
  try {
    const { entity_type = '', entity_id = '', action = '', limit = 100 } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (entity_type) {
      sql += ' AND entity_type = ?';
      params.push(entity_type);
    }

    if (entity_id) {
      sql += ' AND entity_id = ?';
      params.push(entity_id);
    }

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 100));
    sql += ` ORDER BY created_at DESC LIMIT ${maxLimit}`;

    const logs = await db.query(sql, params);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getInvoiceAuditHistory(req, res) {
  try {
    const { invoiceId } = req.params;
    const logs = await db.query(
      `SELECT * FROM audit_logs 
       WHERE entity_type = 'INVOICE' AND entity_id = ? 
       ORDER BY created_at ASC`,
      [invoiceId]
    );

    const historyWithDiffs = logs.map((log, index) => {
      let oldData = null;
      let newData = null;
      try { oldData = log.old_data ? JSON.parse(log.old_data) : null; } catch(e) {}
      try { newData = log.new_data ? JSON.parse(log.new_data) : null; } catch(e) {}

      const diffs = (oldData && newData) ? generateDiff(oldData, newData) : [];

      return {
        ...log,
        old_data_parsed: oldData,
        new_data_parsed: newData,
        diffs
      };
    });

    res.json({ success: true, history: historyWithDiffs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAuditLogs,
  getInvoiceAuditHistory
};
