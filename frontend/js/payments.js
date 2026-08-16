// Payment Management Script

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('paymentsTableBody')) {
    loadPayments();
  }
});

async function loadPayments() {
  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = renderTableLoader(7, 'Loading payments...');
    const res = await apiFetch('/payments');

    if (!res.payments || res.payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No payment records found.</td></tr>';
      return;
    }

    tbody.innerHTML = res.payments.map(p => `
      <tr>
        <td>${formatDate(p.payment_date)}</td>
        <td><strong><a href="invoice-view.html?id=${p.invoice_id}">${p.invoice_number}</a></strong></td>
        <td>${p.company_name}</td>
        <td><strong class="text-success">${formatINR(p.amount)}</strong></td>
        <td><span class="badge badge-issued">${p.payment_mode}</span></td>
        <td><code>${p.reference_number || '-'}</code></td>
        <td>${p.recorded_by || 'Admin'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

async function openRecordPaymentModal() {
  try {
    const res = await apiFetch('/invoices');
    const invoices = (res.invoices || []).filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED');

    const select = document.getElementById('paymentInvoiceId');
    if (invoices.length === 0) {
      showToast('No outstanding invoices found to record payment for.', 'info');
      return;
    }

    select.innerHTML = '<option value="">-- Select Outstanding Invoice --</option>' +
      invoices.map(i => `<option value="${i.id}" data-total="${i.grand_total}" data-paid="${i.paid_amount}" data-balance="${i.balance_amount}">${i.invoice_number} - ${i.company_name} (Bal: ${formatINR(i.balance_amount)})</option>`).join('');

    document.getElementById('paymentForm').reset();
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('paymentModal').classList.add('active');
  } catch (err) {
    showToast('Error loading invoices: ' + err.message, 'error');
  }
}

function addDaysToDate(dateStr, days = 0) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  d.setDate(d.getDate() + parseInt(days || 0, 10));
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

async function onPaymentInvoiceSelect(selectEl) {
  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  const splitSection = document.getElementById('paymentSplitSection');
  if (splitSection) splitSection.style.display = 'none';

  if (!selectedOpt.value) return;

  const bal = parseFloat(selectedOpt.dataset.balance || 0);
  document.getElementById('paymentAmount').value = bal;
  document.getElementById('paymentBalanceNotice').textContent = `Outstanding Balance: ${formatINR(bal)}`;

  try {
    const res = await apiFetch(`/invoices/${selectedOpt.value}`);
    if (res && res.success && res.invoice) {
      renderPaymentsModalSplitPills(res.invoice);
    }
  } catch (err) {
    console.error('Error fetching invoice details for payment modal:', err);
  }
}

function renderPaymentsModalSplitPills(invoice) {
  const splitSection = document.getElementById('paymentSplitSection');
  if (!splitSection) return;

  const client = invoice.client_snapshot || {};
  let schedule = null;

  if (client.payment_schedule_json) {
    try {
      schedule = typeof client.payment_schedule_json === 'string' ? JSON.parse(client.payment_schedule_json) : client.payment_schedule_json;
    } catch (e) {}
  }

  const isSplit = client.payment_terms_type === 'SPLIT' || client.payment_terms_type === '3_PAYMENTS' || (schedule && Array.isArray(schedule.milestones) && schedule.milestones.length > 0);

  if (!isSplit || !schedule || !Array.isArray(schedule.milestones) || schedule.milestones.length === 0) {
    splitSection.style.display = 'none';
    return;
  }

  const grandTotal = parseFloat(invoice.grand_total || 0);
  const paidAmount = parseFloat(invoice.paid_amount || 0);
  const balanceAmount = parseFloat(invoice.balance_amount || 0);
  const invoiceDateStr = invoice.invoice_date;

  let cumulativeThreshold = 0;
  let defaultSelectSet = false;

  const milestonePillsHTML = schedule.milestones.map((m, idx) => {
    const percent = parseFloat(m.percent || 0);
    const stageAmount = Math.round((percent / 100) * grandTotal);
    cumulativeThreshold += stageAmount;
    
    const isPaid = paidAmount >= cumulativeThreshold;
    const stageNum = idx + 1;
    const dueFormatted = addDaysToDate(invoiceDateStr, m.due_days || 0);
    
    let stagePending = stageAmount;
    if (paidAmount >= cumulativeThreshold) {
      stagePending = 0;
    } else if (paidAmount > (cumulativeThreshold - stageAmount)) {
      stagePending = cumulativeThreshold - paidAmount;
    }

    const isActive = !isPaid && !defaultSelectSet;
    if (isActive) {
      defaultSelectSet = true;
      document.getElementById('paymentAmount').value = stagePending;
      document.getElementById('paymentNotes').value = `Payment for ${invoice.invoice_number} - Due Stage #${stageNum} (${m.milestone || 'Milestone'})`;
    }

    if (isPaid) {
      return `
        <div class="qpm-due-pill paid" title="Fully Paid: ${escapeAttr(m.milestone || `Stage ${stageNum}`)}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.78rem; color:#16a34a;">Due ${stageNum} (${percent}%)</strong>
            <span style="font-size:0.62rem; color:#16a34a; font-weight:700; background:#dcfce7; padding:0.1rem 0.35rem; border-radius:4px;">PAID</span>
          </div>
          <div style="font-size:0.95rem; font-weight:700; text-decoration:line-through; color:var(--text-muted);">${formatINR(stageAmount)}</div>
          <div style="display:flex; align-items:center; gap:0.25rem; font-size:0.7rem; color:var(--text-muted);">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>${dueFormatted}</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="qpm-due-pill ${isActive ? 'active' : ''}" 
           title="${escapeAttr(m.milestone || `Stage ${stageNum}`)}"
           onclick="selectPaymentsModalDuePill(this, ${stagePending}, ${stageNum}, '${invoice.invoice_number}', '${m.milestone || `Stage ${stageNum}`}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.78rem; color:var(--text-main);">Due ${stageNum} (${percent}%)</strong>
          <span class="badge badge-issued" style="font-size:0.62rem; padding:0.1rem 0.35rem;">DUE</span>
        </div>
        <div style="font-size:0.95rem; font-weight:700; color:var(--primary);">${formatINR(stagePending)}</div>
        <div style="display:flex; align-items:center; gap:0.25rem; font-size:0.7rem; color:#b91c1c; font-weight:600;">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>${dueFormatted}</span>
        </div>
      </div>
    `;
  }).join('');

  const fullPillHTML = `
    <div class="qpm-due-pill ${!defaultSelectSet ? 'active' : ''}" title="Full Remaining Amount" onclick="selectPaymentsModalDuePill(this, ${balanceAmount}, 0, '${invoice.invoice_number}', 'Full Remaining')">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="font-size:0.78rem; color:var(--text-main);">Full Balance</strong>
        <span style="font-size:0.62rem; color:#475569; font-weight:700; background:#f1f5f9; padding:0.1rem 0.35rem; border-radius:4px;">100%</span>
      </div>
      <div style="font-size:0.95rem; font-weight:700; color:#16a34a;">${formatINR(balanceAmount)}</div>
      <div style="display:flex; align-items:center; gap:0.25rem; font-size:0.7rem; color:var(--text-muted);">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Clear all dues</span>
      </div>
    </div>
  `;

  splitSection.innerHTML = `
    <div class="qpm-split-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
        <span style="font-size:0.78rem; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:0.35rem;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Client Split Schedule:
        </span>
        <span style="font-size:0.7rem; color:var(--text-muted);">Click due to fill amount</span>
      </div>
      <div class="qpm-split-grid">
        ${milestonePillsHTML}
        ${fullPillHTML}
      </div>
    </div>
  `;

  splitSection.style.display = 'block';
}

function selectPaymentsModalDuePill(pillElement, amount, stageNum, invNum, stageTitle) {
  const amountInput = document.getElementById('paymentAmount');
  if (amountInput) amountInput.value = amount;

  const notesInput = document.getElementById('paymentNotes');
  if (notesInput) {
    if (stageNum > 0) {
      notesInput.value = `Payment for ${invNum} - Due Stage #${stageNum} (${stageTitle})`;
    } else {
      notesInput.value = `Full payment for ${invNum}`;
    }
  }

  const pills = document.querySelectorAll('#paymentSplitSection .qpm-due-pill');
  pills.forEach(p => p.classList.remove('active'));
  if (pillElement && !pillElement.classList.contains('paid')) {
    pillElement.classList.add('active');
  }
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
}

async function handleSavePayment(e) {
  e.preventDefault();

  const invoice_id = document.getElementById('paymentInvoiceId').value;
  const payment_date = document.getElementById('paymentDate').value;
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const payment_mode = document.getElementById('paymentMode').value;
  const reference_number = document.getElementById('paymentRef').value;
  const notes = document.getElementById('paymentNotes').value;

  if (!invoice_id || !amount || amount <= 0) {
    showToast('Please enter a valid invoice and payment amount.', 'error');
    return;
  }

  try {
    const res = await apiFetch('/payments', {
      method: 'POST',
      body: JSON.stringify({
        invoice_id,
        payment_date,
        amount,
        payment_mode,
        reference_number,
        notes
      })
    });

    showToast(res.message, 'success');
    closePaymentModal();
    loadPayments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
