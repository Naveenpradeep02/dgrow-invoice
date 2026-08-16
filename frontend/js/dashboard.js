// Admin & Auditor Dashboard KPI Controller

let revenueChartInstance = null;
let spiderChartInstance = null;

function initDashboard() {
  if (document.getElementById('kpiTotalRevenue')) {
    loadDashboardKPIs();
  }
  if (document.getElementById('revenueTrendChart')) {
    loadMonthlyRevenueChart();
  }
  if (document.getElementById('clientSpiderChart')) {
    loadClientSpiderChart();
  }
  if (document.getElementById('auditorInvoicesBody')) {
    loadAuditorDashboardInvoices();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

async function loadAuditorDashboardInvoices() {
  const tbody = document.getElementById('auditorInvoicesBody');
  if (!tbody) return;
  try {
    tbody.innerHTML = renderTableLoader(7, 'Loading recent invoices...');
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
          <a href="invoice-view.html?id=${inv.id}" class="btn btn-secondary btn-sm" title="View Invoice" style="padding:0.35rem 0.55rem; display:inline-flex; align-items:center; justify-content:center;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load auditor invoices:', err);
  }
}

let cachedDashboardKPIs = {
  current_month: null,
  last_month: null,
  overall: null,
  custom: null
};

let currentActivePeriod = 'CURRENT_MONTH';

async function loadDashboardKPIs() {
  const activityContainer = document.getElementById('recentActivityList');
  if (activityContainer) {
    activityContainer.innerHTML = renderDataLoader('Loading recent activity...', 'sm');
  }

  try {
    const res = await apiFetch('/reports/kpis');
    if (!res.success) return;

    cachedDashboardKPIs.current_month = res.current_month || res.kpis;
    cachedDashboardKPIs.last_month = res.last_month;
    cachedDashboardKPIs.overall = res.overall;

    // Render Current Month by default
    switchDashboardPeriod(currentActivePeriod);

    // Set default custom date inputs
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    if (document.getElementById('dashCustomFrom')) {
      document.getElementById('dashCustomFrom').value = `${curYear}-${curMonth}-01`;
    }
    if (document.getElementById('dashCustomTo')) {
      document.getElementById('dashCustomTo').value = now.toISOString().split('T')[0];
    }

    // Render Recent Activity List
    if (activityContainer && res.recent_activity) {
      if (res.recent_activity.length === 0) {
        activityContainer.innerHTML = '<p class="text-muted" style="padding: 1rem;">No recent activity recorded.</p>';
      } else {
        activityContainer.innerHTML = res.recent_activity.map(act => `
          <div class="activity-item">
            <div class="activity-icon">
              ${act.action === 'CREATE' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' :
                act.action === 'PAYMENT' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' :
                act.action === 'CANCEL' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' :
                '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'}
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

function switchDashboardPeriod(periodKey) {
  currentActivePeriod = periodKey;

  // Update Toggle Buttons active class
  const buttons = document.querySelectorAll('.period-toggle-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-period') === periodKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const customBar = document.getElementById('customDateRangeBar');
  if (customBar && periodKey !== 'CUSTOM') {
    customBar.style.display = 'none';
  }

  const kpis = periodKey === 'CURRENT_MONTH' ? cachedDashboardKPIs.current_month :
               periodKey === 'LAST_MONTH' ? cachedDashboardKPIs.last_month :
               periodKey === 'OVERALL' ? cachedDashboardKPIs.overall :
               cachedDashboardKPIs.custom;

  if (!kpis) return;

  // Update Period Header Badge & Subtitle
  const badgeEl = document.getElementById('activePeriodBadge');
  const subEl = document.getElementById('activePeriodSubtitle');
  const subtextEl = document.getElementById('kpiBilledSubtext');

  if (badgeEl) {
    badgeEl.textContent = periodKey === 'CURRENT_MONTH' ? 'Current Month' :
                          periodKey === 'LAST_MONTH' ? 'Last Month' :
                          periodKey === 'OVERALL' ? 'Lifetime All-Time' : 'Custom Period';
  }

  if (subEl) {
    subEl.textContent = kpis.period_name || 'Selected financial period overview';
  }

  if (subtextEl) {
    subtextEl.textContent = periodKey === 'OVERALL' ? 'Cumulative Billed' : 'Billed in Selected Period';
  }

  // Update 4 Main KPI Cards
  const elRevenue = document.getElementById('kpiTotalRevenue');
  const elPaid = document.getElementById('kpiPaidAmount');
  const elPending = document.getElementById('kpiPendingAmount');
  const elGST = document.getElementById('kpiGSTCollected');

  if (elRevenue) elRevenue.textContent = formatINR(kpis.total_revenue || 0);
  if (elPaid) elPaid.textContent = formatINR(kpis.paid_amount || 0);
  if (elPending) elPending.textContent = formatINR(kpis.pending_amount || 0);
  if (elGST) elGST.textContent = formatINR(kpis.gst_collected || 0);

  // Update 4 Secondary Counts
  const elInvoicesCount = document.getElementById('kpiTotalInvoices');
  const elGSTInvoicesCount = document.getElementById('kpiGSTInvoicesCount');
  const elNonGSTInvoicesCount = document.getElementById('kpiNonGSTInvoicesCount');
  const elCancelledCount = document.getElementById('kpiCancelledCount');

  if (elInvoicesCount) elInvoicesCount.textContent = kpis.total_invoices || 0;
  if (elGSTInvoicesCount) elGSTInvoicesCount.textContent = kpis.gst_invoices || 0;
  if (elNonGSTInvoicesCount) elNonGSTInvoicesCount.textContent = kpis.nongst_invoices || 0;
  if (elCancelledCount) elCancelledCount.textContent = kpis.cancelled_count || 0;
}

function toggleCustomPeriodInputs() {
  const customBar = document.getElementById('customDateRangeBar');
  if (!customBar) return;

  if (customBar.style.display === 'none' || !customBar.style.display) {
    customBar.style.display = 'block';
    const buttons = document.querySelectorAll('.period-toggle-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-period') === 'CUSTOM') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  } else {
    customBar.style.display = 'none';
  }
}

async function applyDashboardCustomRange() {
  const from = document.getElementById('dashCustomFrom')?.value;
  const to = document.getElementById('dashCustomTo')?.value;

  if (!from || !to) {
    showToast('Please select both From and To dates', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/reports/kpis?from_date=${from}&to_date=${to}`);
    if (res && res.success && res.custom) {
      cachedDashboardKPIs.custom = {
        ...res.custom,
        period_name: `Custom Range: ${formatDate(from)} to ${formatDate(to)}`
      };
      switchDashboardPeriod('CUSTOM');
      showToast('Custom date range applied!', 'success');
    }
  } catch (err) {
    showToast('Failed to load custom KPIs: ' + err.message, 'error');
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

let currentRevenueChartType = 'bar';

function switchRevenueChartType(type) {
  currentRevenueChartType = type;
  const buttons = document.querySelectorAll('.chart-type-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-type') === type) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  loadMonthlyRevenueChart();
}

async function loadMonthlyRevenueChart() {
  const canvas = document.getElementById('revenueTrendChart');
  if (!canvas) return;

  const yearSelect = document.getElementById('chartYearSelect');
  const selectedYear = yearSelect ? yearSelect.value : new Date().getFullYear();

  try {
    const res = await apiFetch(`/reports/monthly-trend?year=${selectedYear}`);
    if (!res || !res.success || !res.months) return;

    // Update annual summary metrics
    const summary = res.annual_summary || {};
    if (document.getElementById('annualBilledText')) {
      document.getElementById('annualBilledText').textContent = formatINR(summary.total_billed || 0);
    }
    if (document.getElementById('annualPaidText')) {
      document.getElementById('annualPaidText').textContent = formatINR(summary.total_paid || 0);
    }
    if (document.getElementById('annualPendingText')) {
      document.getElementById('annualPendingText').textContent = formatINR(summary.total_pending || 0);
    }
    if (document.getElementById('chartAnnualSummaryText')) {
      document.getElementById('chartAnnualSummaryText').textContent = `${selectedYear} 12-Month Performance: ${summary.total_invoices || 0} Invoices Issued`;
    }

    const labels = res.months.map(m => m.month);
    const billedData = res.months.map(m => m.billed_revenue);
    const paidData = res.months.map(m => m.paid_revenue);
    const pendingData = res.months.map(m => m.pending_revenue);

    // Destroy existing instance if any
    if (revenueChartInstance) {
      revenueChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js library is not loaded');
      return;
    }

    const isLine = currentRevenueChartType === 'line' || currentRevenueChartType === 'area';
    const isArea = currentRevenueChartType === 'area';

    const datasets = [
      {
        label: 'Billed Revenue',
        data: billedData,
        backgroundColor: isArea ? 'rgba(220, 38, 38, 0.15)' : (isLine ? '#dc2626' : 'rgba(220, 38, 38, 0.85)'),
        borderColor: '#dc2626',
        borderWidth: isLine ? 2.5 : 1.5,
        borderRadius: isLine ? 0 : 6,
        barPercentage: 0.7,
        categoryPercentage: 0.65,
        fill: isArea,
        tension: 0.35,
        pointRadius: isLine ? 4.5 : 0,
        pointHoverRadius: isLine ? 7 : 0,
        pointBackgroundColor: '#dc2626',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      },
      {
        label: 'Collected / Paid',
        data: paidData,
        backgroundColor: isArea ? 'rgba(22, 163, 74, 0.18)' : (isLine ? '#16a34a' : 'rgba(22, 163, 74, 0.85)'),
        borderColor: '#16a34a',
        borderWidth: isLine ? 2.5 : 1.5,
        borderRadius: isLine ? 0 : 6,
        barPercentage: 0.7,
        categoryPercentage: 0.65,
        fill: isArea,
        tension: 0.35,
        pointRadius: isLine ? 4.5 : 0,
        pointHoverRadius: isLine ? 7 : 0,
        pointBackgroundColor: '#16a34a',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      },
      {
        label: 'Pending Receivables',
        data: pendingData,
        backgroundColor: isArea ? 'rgba(245, 158, 11, 0.15)' : (isLine ? '#f59e0b' : 'rgba(245, 158, 11, 0.85)'),
        borderColor: '#f59e0b',
        borderWidth: isLine ? 2.5 : 1.5,
        borderRadius: isLine ? 0 : 6,
        barPercentage: 0.7,
        categoryPercentage: 0.65,
        fill: isArea,
        tension: 0.35,
        pointRadius: isLine ? 4.5 : 0,
        pointHoverRadius: isLine ? 7 : 0,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      }
    ];

    revenueChartInstance = new Chart(ctx, {
      type: isLine ? 'line' : 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 15,
              font: {
                family: 'Inter, system-ui, sans-serif',
                size: 12,
                weight: '600'
              }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${formatINR(context.raw || 0)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: 'Inter, system-ui, sans-serif',
                size: 11,
                weight: '600'
              },
              color: '#64748b'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#f1f5f9',
              drawBorder: false
            },
            ticks: {
              font: {
                family: 'Inter, system-ui, sans-serif',
                size: 11
              },
              color: '#64748b',
              callback: function(value) {
                if (value >= 100000) {
                  return '₹' + (value / 100000).toFixed(1) + 'L';
                } else if (value >= 1000) {
                  return '₹' + (value / 1000).toFixed(0) + 'k';
                }
                return '₹' + value;
              }
            }
          }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load monthly revenue trend:', err);
  }
}

async function loadClientSpiderChart() {
  const canvas = document.getElementById('clientSpiderChart');
  if (!canvas) return;

  try {
    const res = await apiFetch('/reports/client-portfolio');
    if (!res || !res.success || !res.stats) return;

    const stats = res.stats;

    // Update Pill Metric Counters
    if (document.getElementById('spiderTotalClientsBadge')) {
      document.getElementById('spiderTotalClientsBadge').textContent = `${stats.total_clients || 0} Total Clients`;
    }
    if (document.getElementById('spiderActiveCount')) {
      document.getElementById('spiderActiveCount').textContent = stats.active_clients || 0;
    }
    if (document.getElementById('spiderInactiveCount')) {
      document.getElementById('spiderInactiveCount').textContent = stats.inactive_clients || 0;
    }
    if (document.getElementById('spiderOverallCount')) {
      document.getElementById('spiderOverallCount').textContent = stats.total_clients || 0;
    }
    if (document.getElementById('spiderSinglePayCount')) {
      document.getElementById('spiderSinglePayCount').textContent = stats.single_pay_clients || 0;
    }
    if (document.getElementById('spiderSplitPayCount')) {
      document.getElementById('spiderSplitPayCount').textContent = stats.split_pay_clients || 0;
    }
    if (document.getElementById('spiderGstCount')) {
      document.getElementById('spiderGstCount').textContent = stats.gst_registered_clients || 0;
    }

    if (spiderChartInstance) {
      spiderChartInstance.destroy();
    }

    if (typeof Chart === 'undefined') {
      console.error('Chart.js library is not loaded');
      return;
    }

    const ctx = canvas.getContext('2d');

    const labels = [
      'Active Clients',
      'Inactive Clients',
      'Overall Total',
      'Single Pay',
      'Split Pay',
      'GST Registered'
    ];

    const dataValues = [
      stats.active_clients || 0,
      stats.inactive_clients || 0,
      stats.total_clients || 0,
      stats.single_pay_clients || 0,
      stats.split_pay_clients || 0,
      stats.gst_registered_clients || 0
    ];

    spiderChartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Client Count',
            data: dataValues,
            backgroundColor: 'rgba(220, 38, 38, 0.22)',
            borderColor: '#dc2626',
            borderWidth: 2.2,
            pointBackgroundColor: '#dc2626',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4.5,
            pointHoverRadius: 6.5,
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#dc2626'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.raw} clients`;
              }
            }
          }
        },
        scales: {
          r: {
            angleLines: {
              color: '#e2e8f0',
              lineWidth: 1
            },
            grid: {
              color: '#f1f5f9',
              circular: true
            },
            pointLabels: {
              font: {
                family: 'Inter, system-ui, sans-serif',
                size: 11,
                weight: '600'
              },
              color: '#475569'
            },
            ticks: {
              beginAtZero: true,
              stepSize: 5,
              backdropColor: 'transparent',
              font: {
                size: 9
              },
              color: '#94a3b8'
            }
          }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load client portfolio stats:', err);
  }
}

window.switchDashboardPeriod = switchDashboardPeriod;
window.toggleCustomPeriodInputs = toggleCustomPeriodInputs;
window.applyDashboardCustomRange = applyDashboardCustomRange;
window.loadMonthlyRevenueChart = loadMonthlyRevenueChart;
window.switchRevenueChartType = switchRevenueChartType;
window.loadClientSpiderChart = loadClientSpiderChart;
