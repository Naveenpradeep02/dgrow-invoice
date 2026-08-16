const db = require('../config/database');

async function getRealNotifications(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notifications = [];

    // 1. INVOICE READY NOTIFICATIONS (Based on Client Onboarding Date: 2 Weeks & 3 Days Notices)
    const clients = await db.query(
      "SELECT id, company_name, contact_person, mobile, email, onboarding_date, created_at FROM clients WHERE status = 'ACTIVE'"
    );

    clients.forEach((client) => {
      const onboardDateStr = client.onboarding_date || client.created_at;
      if (!onboardDateStr) return;

      const onboardDate = new Date(onboardDateStr);
      if (isNaN(onboardDate.getTime())) return;

      const cycleDay = onboardDate.getDate(); // Day of month (1 - 31)

      // Determine the next upcoming monthly cycle date
      let upcomingCycle = new Date(today.getFullYear(), today.getMonth(), cycleDay);
      
      // If cycle day in this month has already passed by more than 2 days, look at next month
      const daysDiffFromThisMonth = Math.ceil((upcomingCycle.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiffFromThisMonth < -2) {
        upcomingCycle = new Date(today.getFullYear(), today.getMonth() + 1, cycleDay);
      }

      const diffDays = Math.ceil((upcomingCycle.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Trigger condition: Within 14 days (2 weeks) or 3 days (Urgent)
      if (diffDays <= 14 && diffDays >= -2) {
        let isUrgent = diffDays <= 3;
        let title = '';
        let desc = '';
        let badge = '';

        const cycleDateFormatted = `${String(upcomingCycle.getDate()).padStart(2, '0')}/${String(upcomingCycle.getMonth() + 1).padStart(2, '0')}/${upcomingCycle.getFullYear()}`;

        if (diffDays <= 0) {
          title = `Invoice Due Today: ${client.company_name}`;
          desc = `Monthly recurring cycle date (${cycleDateFormatted}) is due. Create and send invoice now.`;
          badge = 'DUE TODAY';
        } else if (diffDays <= 3) {
          title = `Invoice Ready (3 Days Left): ${client.company_name}`;
          desc = `Renewal billing cycle in ${diffDays} day${diffDays > 1 ? 's' : ''} (${cycleDateFormatted}). Prepare invoice now.`;
          badge = '3 DAYS DUE';
        } else {
          title = `Invoice Preparation (2 Weeks Notice): ${client.company_name}`;
          desc = `Upcoming monthly billing cycle on ${cycleDateFormatted} (in ${diffDays} days). Onboarded on ${String(onboardDate.getDate()).padStart(2, '0')}/${String(onboardDate.getMonth() + 1).padStart(2, '0')}.`;
          badge = '2 WEEKS NOTICE';
        }

        notifications.push({
          id: `onboard-inv-${client.id}-${upcomingCycle.getMonth() + 1}`,
          type: 'INVOICE_READY',
          category: 'Invoice Ready',
          title,
          desc,
          badge,
          isUrgent,
          client_id: client.id,
          company_name: client.company_name,
          cycle_date: upcomingCycle.toISOString(),
          diff_days: diffDays,
          actionUrl: `create-invoice.html?client_id=${client.id}`,
          actionLabel: 'Create Invoice',
          icon: 'invoice',
          created_at: new Date().toISOString()
        });
      }
    });

    // 2. PAYMENT PENDING NOTIFICATIONS (For Unpaid / Partially Paid Invoices)
    const sqlPending = `
      SELECT 
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.grand_total,
        i.status,
        c.id as client_id,
        c.company_name,
        COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) AS paid_amount
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.status NOT IN ('PAID', 'CANCELLED', 'DRAFT')
      ORDER BY i.due_date ASC
    `;

    const pendingInvoices = await db.query(sqlPending);

    pendingInvoices.forEach((inv) => {
      const grandTotal = parseFloat(inv.grand_total || 0);
      const paidAmount = parseFloat(inv.paid_amount || 0);
      const balance = Math.max(0, grandTotal - paidAmount);

      if (balance > 0) {
        const dueDate = new Date(inv.due_date);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0;

        const dueDateFormatted = !isNaN(dueDate.getTime()) 
          ? `${String(dueDate.getDate()).padStart(2, '0')}/${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`
          : inv.due_date;

        let title = isOverdue
          ? `Payment Overdue: ${inv.invoice_number}`
          : `Payment Pending: ${inv.invoice_number}`;

        let desc = isOverdue
          ? `Balance ₹${balance.toLocaleString('en-IN')} pending from ${inv.company_name}. Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} (Due: ${dueDateFormatted}).`
          : `Balance ₹${balance.toLocaleString('en-IN')} pending from ${inv.company_name}. Due on ${dueDateFormatted}.`;

        notifications.push({
          id: `pay-pending-${inv.id}`,
          type: 'PAYMENT_PENDING',
          category: 'Payment Pending',
          title,
          desc,
          badge: isOverdue ? 'OVERDUE' : 'PENDING',
          isUrgent: isOverdue || diffDays <= 3,
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          company_name: inv.company_name,
          balance_amount: balance,
          due_date: inv.due_date,
          diff_days: diffDays,
          actionUrl: `invoice-view.html?id=${inv.id}`,
          actionLabel: 'View Invoice',
          icon: 'payment',
          created_at: inv.invoice_date || new Date().toISOString()
        });
      }
    });

    // Sort: Urgent first, then by diff_days
    notifications.sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return (a.diff_days || 0) - (b.diff_days || 0);
    });

    res.json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (err) {
    console.error('Error fetching real notifications:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getRealNotifications
};
