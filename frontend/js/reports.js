// Financial & GST Reporting Script

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('reportTabContent')) {
    loadSalesReport();
  }
});

function switchReportTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.report-section').forEach(sec => sec.style.display = 'none');

  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.getElementById(`section-${tabName}`).style.display = 'block';

  if (tabName === 'sales') loadSalesReport();
  else if (tabName === 'gst') loadGstReport();
  else if (tabName === 'outstanding') loadOutstandingReport();
}

function getReportFilterQueryParams() {
  const month = document.getElementById('filterMonth')?.value || '';
  const year = document.getElementById('filterYear')?.value || '';
  const fromDate = document.getElementById('filterFromDate')?.value || '';
  const toDate = document.getElementById('filterToDate')?.value || '';

  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (year) params.append('year', year);
  if (fromDate) params.append('from_date', fromDate);
  if (toDate) params.append('to_date', toDate);

  const str = params.toString();
  return str ? `?${str}` : '';
}

function handleMonthYearChange() {
  const month = document.getElementById('filterMonth')?.value;
  const year = document.getElementById('filterYear')?.value;

  if (month && year) {
    const m = String(month).padStart(2, '0');
    const fromDate = `${year}-${m}-01`;
    const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
    const toDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;

    if (document.getElementById('filterFromDate')) document.getElementById('filterFromDate').value = fromDate;
    if (document.getElementById('filterToDate')) document.getElementById('filterToDate').value = toDate;
  }
  applyReportFilters();
}

function handleCustomDateChange() {
  const fromDate = document.getElementById('filterFromDate')?.value;
  const toDate = document.getElementById('filterToDate')?.value;
  if (fromDate || toDate) {
    if (document.getElementById('filterMonth')) document.getElementById('filterMonth').value = '';
    if (document.getElementById('filterYear')) document.getElementById('filterYear').value = '';
  }
  applyReportFilters();
}

function applyReportFilters() {
  const activeTabBtn = document.querySelector('.tab-btn.active');
  const tabName = activeTabBtn ? activeTabBtn.id.replace('tab-', '') : 'sales';
  
  if (tabName === 'sales') loadSalesReport();
  else if (tabName === 'gst') loadGstReport();
  else if (tabName === 'outstanding') loadOutstandingReport();
}

function clearReportFilters() {
  if (document.getElementById('filterMonth')) document.getElementById('filterMonth').value = '';
  if (document.getElementById('filterYear')) document.getElementById('filterYear').value = '';
  if (document.getElementById('filterFromDate')) document.getElementById('filterFromDate').value = '';
  if (document.getElementById('filterToDate')) document.getElementById('filterToDate').value = '';

  applyReportFilters();
}

async function loadSalesReport() {
  const container = document.getElementById('salesReportBody');
  if (!container) return;

  try {
    container.innerHTML = renderTableLoader(9, 'Loading sales report...');
    const query = getReportFilterQueryParams();
    const res = await apiFetch(`/reports/sales${query}`);

    if (!res.report || res.report.length === 0) {
      container.innerHTML = '<tr><td colspan="9" class="text-center">No sales records found for selected period.</td></tr>';
      return;
    }

    container.innerHTML = res.report.map(r => `
      <tr>
        <td><strong>${r.invoice_number}</strong></td>
        <td>${formatDate(r.invoice_date)}</td>
        <td>${r.company_name}</td>
        <td>${r.invoice_type}</td>
        <td>${formatINR(r.subtotal)}</td>
        <td>${formatINR(r.gst_amount)}</td>
        <td><strong>${formatINR(r.grand_total)}</strong></td>
        <td>${formatINR(r.paid_amount)}</td>
        <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="9" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

async function loadGstReport() {
  const container = document.getElementById('gstReportBody');
  const summaryBox = document.getElementById('gstSummaryBox');
  if (!container) return;

  try {
    container.innerHTML = renderTableLoader(9, 'Loading GST report...');
    const query = getReportFilterQueryParams();
    const res = await apiFetch(`/reports/gst${query}`);

    if (!res.records || res.records.length === 0) {
      container.innerHTML = '<tr><td colspan="9" class="text-center">No GST records found.</td></tr>';
      if (summaryBox) summaryBox.innerHTML = '';
      return;
    }

    const { records, summary } = res;

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div style="display:flex; gap:1.5rem; margin-bottom:1rem; padding:1rem; background-color:var(--bg-dark); border-radius:var(--radius-md);">
          <div><span style="font-size:0.8rem; color:var(--text-muted);">Taxable Value</span><p style="font-weight:700;">${formatINR(summary.taxable_value)}</p></div>
          <div><span style="font-size:0.8rem; color:var(--text-muted);">CGST</span><p style="font-weight:700;">${formatINR(summary.cgst)}</p></div>
          <div><span style="font-size:0.8rem; color:var(--text-muted);">SGST</span><p style="font-weight:700;">${formatINR(summary.sgst)}</p></div>
          <div><span style="font-size:0.8rem; color:var(--text-muted);">IGST</span><p style="font-weight:700;">${formatINR(summary.igst)}</p></div>
          <div><span style="font-size:0.8rem; color:var(--text-muted);">Total Tax</span><p style="font-weight:700; color:var(--primary);">${formatINR(summary.total_gst)}</p></div>
        </div>
      `;
    }

    container.innerHTML = records.map(r => `
      <tr>
        <td><strong>${r.invoice_number}</strong></td>
        <td>${formatDate(r.invoice_date)}</td>
        <td>${r.company_name}</td>
        <td><code>${r.gstin || '-'}</code></td>
        <td>${formatINR(r.taxable_amount)}</td>
        <td>${formatINR(r.cgst_amount)}</td>
        <td>${formatINR(r.sgst_amount)}</td>
        <td>${formatINR(r.igst_amount)}</td>
        <td><strong>${formatINR(r.grand_total)}</strong></td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="9" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

async function loadOutstandingReport() {
  const container = document.getElementById('outstandingReportBody');
  if (!container) return;

  try {
    container.innerHTML = renderTableLoader(7, 'Loading outstanding report...');
    const res = await apiFetch('/reports/outstanding');

    if (!res.outstanding || res.outstanding.length === 0) {
      container.innerHTML = '<tr><td colspan="7" class="text-center">No outstanding balances.</td></tr>';
      return;
    }

    container.innerHTML = res.outstanding.map(o => `
      <tr>
        <td><strong>${o.company_name}</strong></td>
        <td><a href="invoice-view.html?id=${o.id}">${o.invoice_number}</a></td>
        <td>${formatDate(o.due_date)}</td>
        <td>${formatINR(o.grand_total)}</td>
        <td>${formatINR(o.paid_amount)}</td>
        <td><strong class="text-danger">${formatINR(o.balance)}</strong></td>
        <td>${o.days_overdue > 0 ? `<span class="badge badge-overdue">${o.days_overdue} days overdue</span>` : '<span class="badge badge-issued">Pending</span>'}</td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;

  let csv = [];
  const rows = table.querySelectorAll('tr');

  for (let i = 0; i < rows.length; i++) {
    const row = [], cols = rows[i].querySelectorAll('td, th');
    for (let j = 0; j < cols.length; j++) {
      let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ');
      data = data.replace(/"/g, '""');
      row.push('"' + data + '"');
    }
    csv.push(row.join(','));
  }

  const csvFile = new Blob([csv.join('\n')], { type: 'text/csv' });
  const downloadLink = document.createElement('a');
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
}
