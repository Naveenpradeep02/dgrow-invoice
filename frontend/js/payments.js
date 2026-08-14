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
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading payments...</td></tr>';
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

function onPaymentInvoiceSelect(selectEl) {
  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  if (selectedOpt.value) {
    const bal = selectedOpt.dataset.balance;
    document.getElementById('paymentAmount').value = bal;
    document.getElementById('paymentBalanceNotice').textContent = `Outstanding Balance: ${formatINR(bal)}`;
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
