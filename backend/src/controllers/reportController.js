const db = require('../config/database');

async function computePeriodKPIs(whereClause, params, fromDate = null, toDate = null) {
  let dateFilter = '';
  const dateParams = [...params];
  
  if (fromDate && toDate) {
    dateFilter = ' AND i.invoice_date >= ? AND i.invoice_date <= ?';
    dateParams.push(fromDate, toDate);
  }

  const totals = await db.query(
    `SELECT 
      COUNT(*) as total_invoices,
      COALESCE(SUM(CASE WHEN i.status != 'CANCELLED' THEN i.grand_total ELSE 0 END), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN i.status = 'CANCELLED' THEN 1 ELSE 0 END), 0) as cancelled_count,
      COALESCE(SUM(CASE WHEN i.status != 'CANCELLED' THEN (i.cgst_amount + i.sgst_amount + i.igst_amount) ELSE 0 END), 0) as total_gst,
      COALESCE(SUM(CASE WHEN i.invoice_type IN ('GST', 'GST_CLIENT') AND i.status != 'CANCELLED' THEN 1 ELSE 0 END), 0) as gst_invoices,
      COALESCE(SUM(CASE WHEN i.invoice_type = 'NON_GST' AND i.status != 'CANCELLED' THEN 1 ELSE 0 END), 0) as nongst_invoices
     FROM invoices i ${whereClause} ${dateFilter}`,
    dateParams
  );

  let paidDateFilter = '';
  const paidParams = [...params];
  if (fromDate && toDate) {
    paidDateFilter = ' AND p.payment_date >= ? AND p.payment_date <= ?';
    paidParams.push(fromDate, toDate);
  }

  const paidResult = await db.query(
    `SELECT COALESCE(SUM(p.amount), 0) as paid_amount 
     FROM payments p 
     JOIN invoices i ON p.invoice_id = i.id 
     ${whereClause} AND i.status != 'CANCELLED' ${paidDateFilter}`,
    paidParams
  );

  const stats = totals[0] || {};
  const paidAmount = parseFloat(paidResult[0] ? paidResult[0].paid_amount : 0);
  const totalRevenue = parseFloat(stats.total_revenue || 0);
  const pendingAmount = Math.max(0, totalRevenue - paidAmount);

  return {
    total_invoices: stats.total_invoices || 0,
    total_revenue: totalRevenue,
    paid_amount: paidAmount,
    pending_amount: pendingAmount,
    gst_collected: parseFloat(stats.total_gst || 0),
    cancelled_count: stats.cancelled_count || 0,
    gst_invoices: stats.gst_invoices || 0,
    nongst_invoices: stats.nongst_invoices || 0
  };
}

async function getDashboardKPIs(req, res) {
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (req.user.role === 'CLIENT') {
      whereClause += ' AND i.client_id = ?';
      params.push(req.user.client_id || -1);
    }
    if (req.user.role === 'AUDITOR') {
      whereClause += " AND i.invoice_type = 'GST'";
    }

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed

    // Current Month range
    const curMonthNum = String(curMonth + 1).padStart(2, '0');
    const curMonthStart = `${curYear}-${curMonthNum}-01`;
    const curMonthEndDay = new Date(curYear, curMonth + 1, 0).getDate();
    const curMonthEnd = `${curYear}-${curMonthNum}-${String(curMonthEndDay).padStart(2, '0')}`;
    const curMonthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // Last Month range
    const lastMonthDate = new Date(curYear, curMonth - 1, 1);
    const lmYear = lastMonthDate.getFullYear();
    const lmMonthNum = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const lmStart = `${lmYear}-${lmMonthNum}-01`;
    const lmEndDay = new Date(lmYear, lastMonthDate.getMonth() + 1, 0).getDate();
    const lmEnd = `${lmYear}-${lmMonthNum}-${String(lmEndDay).padStart(2, '0')}`;
    const lmName = lastMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // Execute queries in parallel for instant toggle response
    const [overallKPIs, currentMonthKPIs, lastMonthKPIs] = await Promise.all([
      computePeriodKPIs(whereClause, params, null, null),
      computePeriodKPIs(whereClause, params, curMonthStart, curMonthEnd),
      computePeriodKPIs(whereClause, params, lmStart, lmEnd)
    ]);

    // Optional Custom range
    let customKPIs = null;
    if (req.query.from_date && req.query.to_date) {
      customKPIs = await computePeriodKPIs(whereClause, params, req.query.from_date, req.query.to_date);
    }

    // Recent Activity
    const recentLogs = await db.query(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 6'
    );

    res.json({
      success: true,
      current_month: {
        ...currentMonthKPIs,
        period_name: curMonthName,
        from_date: curMonthStart,
        to_date: curMonthEnd
      },
      last_month: {
        ...lastMonthKPIs,
        period_name: lmName,
        from_date: lmStart,
        to_date: lmEnd
      },
      overall: {
        ...overallKPIs,
        period_name: 'All-Time Lifetime Overview',
        from_date: '',
        to_date: ''
      },
      custom: customKPIs,
      // Backward compatibility for existing consumers
      kpis: currentMonthKPIs,
      recent_activity: recentLogs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

function resolveDateFilters(query) {
  let { from_date = '', to_date = '', month = '', year = '' } = query;

  if (month && year) {
    const m = String(month).padStart(2, '0');
    from_date = `${year}-${m}-01`;
    const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
    to_date = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
  } else if (year && !month) {
    from_date = `${year}-01-01`;
    to_date = `${year}-12-31`;
  }

  return { from_date, to_date };
}

async function getSalesReport(req, res) {
  try {
    const { client_id = '', status = '' } = req.query;
    const { from_date, to_date } = resolveDateFilters(req.query);

    let sql = `
      SELECT i.*, c.company_name, c.email as client_email,
             (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id) as paid_amount
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'AUDITOR') {
      sql += " AND i.invoice_type = 'GST'";
    }

    if (from_date) { sql += ' AND i.invoice_date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND i.invoice_date <= ?'; params.push(to_date); }
    if (client_id) { sql += ' AND i.client_id = ?'; params.push(client_id); }
    if (status) { sql += ' AND i.status = ?'; params.push(status); }

    sql += ' ORDER BY i.invoice_date DESC';

    const invoices = await db.query(sql, params);

    const report = invoices.map(inv => {
      const paid = parseFloat(inv.paid_amount || 0);
      const total = parseFloat(inv.grand_total || 0);
      return {
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        company_name: inv.company_name,
        invoice_type: inv.invoice_type,
        subtotal: inv.subtotal,
        taxable_amount: inv.taxable_amount,
        gst_amount: inv.cgst_amount + inv.sgst_amount + inv.igst_amount,
        grand_total: total,
        paid_amount: paid,
        balance: Math.max(0, total - paid),
        status: inv.status
      };
    });

    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getGstReport(req, res) {
  try {
    const { from_date, to_date } = resolveDateFilters(req.query);
    let sql = `
      SELECT i.invoice_number, i.invoice_date, i.place_of_supply, i.taxable_amount,
             i.cgst_rate, i.cgst_amount, i.sgst_rate, i.sgst_amount, i.igst_rate, i.igst_amount,
             i.grand_total, i.status, c.company_name, c.gstin
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.invoice_type = 'GST' AND i.status != 'CANCELLED'
    `;
    const params = [];

    if (from_date) { sql += ' AND i.invoice_date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND i.invoice_date <= ?'; params.push(to_date); }

    sql += ' ORDER BY i.invoice_date DESC';

    const records = await db.query(sql, params);

    const summary = records.reduce((acc, r) => {
      acc.taxable_value += parseFloat(r.taxable_amount || 0);
      acc.cgst += parseFloat(r.cgst_amount || 0);
      acc.sgst += parseFloat(r.sgst_amount || 0);
      acc.igst += parseFloat(r.igst_amount || 0);
      acc.total_gst += (parseFloat(r.cgst_amount || 0) + parseFloat(r.sgst_amount || 0) + parseFloat(r.igst_amount || 0));
      acc.total_amount += parseFloat(r.grand_total || 0);
      return acc;
    }, { taxable_value: 0, cgst: 0, sgst: 0, igst: 0, total_gst: 0, total_amount: 0 });

    res.json({ success: true, records, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getOutstandingReport(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    let sql = `
      SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.grand_total, i.status,
             c.company_name, c.mobile, c.email,
             (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id) as paid_amount
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.status != 'CANCELLED'
    `;
    const params = [];
    if (req.user.role === 'AUDITOR') {
      sql += " AND i.invoice_type = 'GST'";
    } else if (req.user.role === 'CLIENT') {
      sql += " AND i.client_id = ?";
      params.push(req.user.client_id || -1);
    }
    sql += ' ORDER BY i.due_date ASC';

    const invoices = await db.query(sql, params);

    const outstanding = invoices.map(inv => {
      const paid = parseFloat(inv.paid_amount || 0);
      const total = parseFloat(inv.grand_total || 0);
      const balance = Math.max(0, total - paid);

      const dueDate = new Date(inv.due_date);
      const diffTime = new Date() - dueDate;
      const daysOverdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        company_name: inv.company_name,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        grand_total: total,
        paid_amount: paid,
        balance: balance,
        days_overdue: daysOverdue,
        status: balance === 0 ? 'PAID' : (daysOverdue > 0 ? 'OVERDUE' : inv.status)
      };
    }).filter(row => row.balance > 0);

    res.json({ success: true, outstanding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getMonthlyRevenueTrend(req, res) {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (req.user.role === 'CLIENT') {
      whereClause += ' AND i.client_id = ?';
      params.push(req.user.client_id || -1);
    }
    if (req.user.role === 'AUDITOR') {
      whereClause += " AND i.invoice_type = 'GST'";
    }

    // Invoices by month
    const invoiceRows = await db.query(
      `SELECT 
        MONTH(i.invoice_date) as month_num,
        COUNT(*) as invoices_count,
        COALESCE(SUM(i.grand_total), 0) as billed_revenue,
        COALESCE(SUM(i.cgst_amount + i.sgst_amount + i.igst_amount), 0) as gst_amount
       FROM invoices i
       ${whereClause} 
       AND i.status != 'CANCELLED'
       AND YEAR(i.invoice_date) = ?
       GROUP BY MONTH(i.invoice_date)`,
      [...params, year]
    );

    // Payments by month
    const paymentRows = await db.query(
      `SELECT 
        MONTH(p.payment_date) as month_num,
        COALESCE(SUM(p.amount), 0) as paid_revenue
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       ${whereClause}
       AND i.status != 'CANCELLED'
       AND YEAR(p.payment_date) = ?
       GROUP BY MONTH(p.payment_date)`,
      [...params, year]
    );

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const monthlyData = [];
    let annualBilled = 0;
    let annualPaid = 0;
    let annualGST = 0;
    let annualInvoices = 0;

    for (let m = 1; m <= 12; m++) {
      const invRow = invoiceRows.find(r => r.month_num === m) || {};
      const payRow = paymentRows.find(r => r.month_num === m) || {};

      const billed = parseFloat(invRow.billed_revenue || 0);
      const paid = parseFloat(payRow.paid_revenue || 0);
      const pending = Math.max(0, billed - paid);
      const gst = parseFloat(invRow.gst_amount || 0);
      const count = parseInt(invRow.invoices_count || 0, 10);

      annualBilled += billed;
      annualPaid += paid;
      annualGST += gst;
      annualInvoices += count;

      monthlyData.push({
        month_num: m,
        month: monthNames[m - 1],
        full_month: new Date(year, m - 1, 1).toLocaleString('en-US', { month: 'long' }),
        billed_revenue: billed,
        paid_revenue: paid,
        pending_revenue: pending,
        gst_amount: gst,
        invoices_count: count
      });
    }

    res.json({
      success: true,
      year,
      annual_summary: {
        total_billed: annualBilled,
        total_paid: annualPaid,
        total_pending: Math.max(0, annualBilled - annualPaid),
        total_gst: annualGST,
        total_invoices: annualInvoices
      },
      months: monthlyData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getClientPortfolioStats(req, res) {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_clients,
        COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as active_clients,
        COALESCE(SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END), 0) as inactive_clients,
        COALESCE(SUM(CASE WHEN payment_terms_type = 'SPLIT' THEN 1 ELSE 0 END), 0) as split_pay_clients,
        COALESCE(SUM(CASE WHEN payment_terms_type != 'SPLIT' OR payment_terms_type IS NULL THEN 1 ELSE 0 END), 0) as single_pay_clients,
        COALESCE(SUM(CASE WHEN gstin IS NOT NULL AND TRIM(gstin) != '' THEN 1 ELSE 0 END), 0) as gst_registered_clients
      FROM clients
    `);

    const result = stats[0] || {};
    res.json({
      success: true,
      stats: {
        total_clients: parseInt(result.total_clients || 0, 10),
        active_clients: parseInt(result.active_clients || 0, 10),
        inactive_clients: parseInt(result.inactive_clients || 0, 10),
        single_pay_clients: parseInt(result.single_pay_clients || 0, 10),
        split_pay_clients: parseInt(result.split_pay_clients || 0, 10),
        gst_registered_clients: parseInt(result.gst_registered_clients || 0, 10)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getDashboardKPIs,
  getMonthlyRevenueTrend,
  getClientPortfolioStats,
  getSalesReport,
  getGstReport,
  getOutstandingReport
};
