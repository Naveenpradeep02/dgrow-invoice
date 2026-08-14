// Admin & Auditor Dashboard KPI Controller

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('kpiTotalRevenue')) {
    loadDashboardKPIs();
  }
  if (document.getElementById('auditorInvoicesBody')) {
    loadAuditorDashboardInvoices();
  }
});

async function loadAuditorDashboardInvoices() {
  const tbody = document.getElementById('auditorInvoicesBody');
  if (!tbody) return;
  try {
    const res = await apiFetch('/invoices');
    if (!res.success || !res.invoices) return;

    const items = res.invoices.slice(0, 5);
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No GST invoices found.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(inv => `
      <tr>
        <td><strong><a href="invoice-view.html?id=${inv.id}">${inv.invoice_number}</a></strong></td>
        <td>${formatDate(inv.invoice_date)}</td>
        <td>${inv.company_name}</td>
        <td><strong>${formatINR(inv.grand_total)}</strong></td>
        <td>${formatINR(inv.paid_amount)}</td>
        <td><span class="badge badge-${inv.status.toLowerCase()}">${inv.status.replace('_', ' ')}</span></td>
        <td>
          <a href="invoice-view.html?id=${inv.id}" class="btn btn-secondary btn-sm">View</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load auditor invoices:', err);
  }
}

async function loadDashboardKPIs() {
  try {
    const res = await apiFetch('/reports/kpis');
    if (!res.success) return;

    const { kpis, recent_activity } = res;

    // Update KPI Card Numbers
    const elRevenue = document.getElementById('kpiTotalRevenue');
    const elPaid = document.getElementById('kpiPaidAmount');
    const elPending = document.getElementById('kpiPendingAmount');
    const elGST = document.getElementById('kpiGSTCollected');
    const elInvoicesCount = document.getElementById('kpiTotalInvoices');
    const elGSTInvoicesCount = document.getElementById('kpiGSTInvoicesCount');
    const elNonGSTInvoicesCount = document.getElementById('kpiNonGSTInvoicesCount');
    const elCancelledCount = document.getElementById('kpiCancelledCount');

    if (elRevenue) elRevenue.textContent = formatINR(kpis.total_revenue);
    if (elPaid) elPaid.textContent = formatINR(kpis.paid_amount);
    if (elPending) elPending.textContent = formatINR(kpis.pending_amount);
    if (elGST) elGST.textContent = formatINR(kpis.gst_collected);
    if (elInvoicesCount) elInvoicesCount.textContent = kpis.total_invoices;
    if (elGSTInvoicesCount) elGSTInvoicesCount.textContent = kpis.gst_invoices;
    if (elNonGSTInvoicesCount) elNonGSTInvoicesCount.textContent = kpis.nongst_invoices;
    if (elCancelledCount) elCancelledCount.textContent = kpis.cancelled_count;

    // Render Recent Activity List
    const activityContainer = document.getElementById('recentActivityList');
    if (activityContainer && recent_activity) {
      if (recent_activity.length === 0) {
        activityContainer.innerHTML = '<p class="text-muted" style="padding: 1rem;">No recent activity recorded.</p>';
      } else {
        activityContainer.innerHTML = recent_activity.map(act => `
          <div class="activity-item">
            <div class="activity-icon">
              ${act.action === 'CREATE' ? '＋' : act.action === 'PAYMENT' ? '₹' : act.action === 'CANCEL' ? '✕' : '✎'}
            </div>
            <div class="activity-content">
              <p><strong>${act.user_email || 'User'}</strong> ${getAuditActionText(act.action)} <strong>${act.entity_type} #${act.entity_id}</strong></p>
              <span>${formatDate(act.created_at)}</span>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard KPIs:', err);
  }
}

function getAuditActionText(action) {
  switch (action) {
    case 'CREATE': return 'created new';
    case 'UPDATE': return 'updated';
    case 'ISSUE': return 'issued';
    case 'CANCEL': return 'cancelled';
    case 'PAYMENT': return 'recorded payment for';
    case 'LOGIN': return 'logged in to';
    default: return 'modified';
  }
}
