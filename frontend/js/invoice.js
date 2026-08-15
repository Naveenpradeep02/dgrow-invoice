// Invoice Builder, Tax Calculation, and View Controller

let currentItems = [];
let availableClients = [];
let availableServices = [];

function parseItemDetails(item) {
  const rawDesc = (item.description || item.name || '').trim();
  const lines = rawDesc.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  let serviceName = '';
  let subDetails = [];

  if (lines.length > 1) {
    serviceName = lines[0];
    subDetails = lines.slice(1);
  } else if (rawDesc.includes(':')) {
    const parts = rawDesc.split(':');
    serviceName = parts[0].trim();
    subDetails = parts.slice(1).join(':').split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
  } else {
    serviceName = rawDesc || 'Service';
    subDetails = [];
  }

  const cleanSubDetails = subDetails.map(d => d.replace(/^[•\-\*\+]\s*/, '').trim()).filter(d => d.length > 0);

  return {
    serviceName,
    subDetails: cleanSubDetails,
    hsnSac: (item.hsn_sac && item.hsn_sac !== '0' && item.hsn_sac !== 'null') ? item.hsn_sac : '-',
    amount: parseFloat(item.taxable_amount || item.total_amount || ((item.quantity || 1) * (item.rate || 0)) || 0)
  };
}
function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hasValidGSTIN(clientGstin, agencyGstin = '') {
  if (!clientGstin) return false;
  const cleanClient = String(clientGstin).trim();
  const cleanAgency = String(agencyGstin || '').trim();

  if (!cleanClient || cleanClient === '-' || cleanClient.toLowerCase() === 'unregistered' || cleanClient.toLowerCase() === 'null' || cleanClient.toLowerCase() === 'undefined') {
    return false;
  }
  if (cleanClient === '33AAACM1234F1Z5' || (cleanAgency && cleanClient.toLowerCase() === cleanAgency.toLowerCase())) {
    return false;
  }
  return true;
}

function formatAddress3Lines(client = {}) {
  const rawAddr = (client.address || '').trim().replace(/,\s*$/, '');
  const cityPin = [client.city, client.pincode].filter(Boolean).join(' - ');
  const stateStr = (client.state || 'Tamil Nadu').replace(/\s*\(\d+\)/g, '').trim();
  const line3 = [cityPin, stateStr ? `${stateStr}, India.` : 'India.'].filter(Boolean).join(', ');

  if (!rawAddr) {
    return [line3].filter(Boolean);
  }

  if (rawAddr.includes('\n')) {
    return [...rawAddr.split('\n').map(l => l.trim()).filter(Boolean), line3];
  }

  const parts = rawAddr.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length <= 2 || rawAddr.length < 40) {
    const l1 = rawAddr.endsWith(',') ? rawAddr : rawAddr + ',';
    return [l1, line3];
  }

  const mid = Math.ceil(parts.length / 2);
  const line1 = parts.slice(0, mid).join(', ') + ',';
  const line2 = parts.slice(mid).join(', ') + ',';
  return [line1, line2, line3];
}

function renderSubDetailRowHTML(text = '') {
  return `
    <div class="subdetail-row" style="display:flex; align-items:center; gap:0.35rem; margin-top:0.25rem;">
      <span style="color:#2563eb; font-weight:bold; font-size:0.85rem; line-height:1;">•</span>
      <input type="text" class="form-input subdetail-input" value="${escapeAttr(text)}" placeholder="Sub-detail (e.g. Local SEO)" style="font-size:0.8rem; padding:0.25rem 0.5rem; flex:1;">
      <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; font-size:0.9rem; cursor:pointer; padding:0 0.25rem; font-weight:bold;" title="Remove sub-detail">✕</button>
    </div>
  `;
}

function addSubDetailLine(btn, text = '') {
  const cell = btn.closest('td');
  const container = cell.querySelector('.item-subdetails-container');
  if (!container) return;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderSubDetailRowHTML(text);
  const newRow = tempDiv.firstElementChild;
  container.appendChild(newRow);
  const input = newRow.querySelector('.subdetail-input');
  if (input && !text) input.focus();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('invoicesTableBody')) {
    loadInvoicesList();
  }
  if (document.getElementById('createInvoiceForm')) {
    initCreateInvoicePage();
  }
  if (document.getElementById('invoiceSheetContainer')) {
    initInvoiceViewPage();
  }
});

function onAuditorDateFilterChange() {
  const monthEl = document.getElementById('filterMonth');
  const yearEl = document.getElementById('filterYear');
  
  if (!monthEl && !yearEl) {
    loadInvoicesList();
    return;
  }

  const month = monthEl ? monthEl.value : '';
  const year = yearEl ? yearEl.value : '';

  let fromDate = '';
  let toDate = '';

  if (month && year) {
    const lastDay = new Date(year, parseInt(month), 0).getDate();
    fromDate = `${year}-${month}-01`;
    toDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  } else if (year) {
    fromDate = `${year}-01-01`;
    toDate = `${year}-12-31`;
  } else if (month) {
    const currYear = new Date().getFullYear();
    const lastDay = new Date(currYear, parseInt(month), 0).getDate();
    fromDate = `${currYear}-${month}-01`;
    toDate = `${currYear}-${month}-${String(lastDay).padStart(2, '0')}`;
  }

  loadInvoicesList(fromDate, toDate);
}

// --- INVOICES LIST PAGE ---
async function loadInvoicesList(fromDateOverride = '', toDateOverride = '') {
  const tbody = document.getElementById('invoicesTableBody');
  if (!tbody) return;

  const search = document.getElementById('filterSearch')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const type = document.getElementById('filterType')?.value || '';
  const from_date = fromDateOverride || document.getElementById('filterFromDate')?.value || '';
  const to_date = toDateOverride || document.getElementById('filterToDate')?.value || '';

  try {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:2rem;">Loading invoices...</td></tr>';
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (type) params.append('invoice_type', type);
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);

    const res = await apiFetch(`/invoices?${params.toString()}`);

    if (!res.invoices || res.invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:2rem;">No invoices found.</td></tr>';
      return;
    }

    const user = getUser();
    const isAdmin = user && user.role === 'ADMIN';

    tbody.innerHTML = res.invoices.map(inv => `
      <tr>
        <td><strong><a href="invoice-view.html?id=${inv.id}">${inv.invoice_number}</a></strong></td>
        <td>${formatDate(inv.invoice_date)}</td>
        <td>${inv.company_name}</td>
        <td><span class="badge badge-${inv.invoice_type.toLowerCase()}">${inv.invoice_type}</span></td>
        <td><strong>${formatINR(inv.grand_total)}</strong></td>
        <td>${formatINR(inv.paid_amount)}</td>
        <td><span class="badge badge-${inv.status.toLowerCase()}">${inv.status.replace('_', ' ')}</span></td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <a href="invoice-view.html?id=${inv.id}" class="btn btn-secondary btn-sm">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View
            </a>
            <a href="${API_BASE}/invoices/${inv.id}/pdf?token=${getToken()}" target="_blank" class="btn btn-secondary btn-sm">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF
            </a>
            ${(isAdmin && inv.status !== 'PAID' && inv.status !== 'CANCELLED') ? `
              <button onclick="handleQuickPaymentDone(${inv.id}, '${inv.invoice_number}', ${inv.grand_total - inv.paid_amount})" class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #16a34a, #15803d); border:none; display:inline-flex; align-items:center; gap:0.25rem;" title="Mark Payment Done">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Payment Done
              </button>
            ` : ''}
            ${(isAdmin && inv.status !== 'CANCELLED') ? `
              <button onclick="handleCancelInvoice(${inv.id}, '${inv.invoice_number}')" class="btn btn-danger btn-sm">Cancel</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-danger" style="padding:2rem;">Error loading invoices: ${err.message}</td></tr>`;
  }
}

// --- QUICK PAYMENT CONFIRMATION MODAL ---
function ensureQuickPaymentModalExists() {
  if (document.getElementById('quickPaymentModal')) return;

  const modalHtml = `
    <div class="modal-overlay" id="quickPaymentModal">
      <div class="modal-box" style="max-width: 520px;">
        <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div style="width:36px; height:36px; border-radius:50%; background:rgba(22,163,74,0.12); color:#16a34a; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <h3 style="margin:0; font-size:1.15rem; color:var(--text-color);">Confirm Payment Receipt</h3>
              <p style="margin:0; font-size:0.8rem; color:var(--text-muted);" id="qpmSubTitle">Invoice details</p>
            </div>
          </div>
          <button class="modal-close" type="button" onclick="closeQuickPaymentModal()">&times;</button>
        </div>
        
        <form id="quickPaymentForm" onsubmit="submitQuickPayment(event)">
          <input type="hidden" id="qpmInvoiceId">

          <div style="background:var(--bg-body); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.85rem 1rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Invoice Number</span>
              <h4 style="margin:0.2rem 0 0 0; color:var(--primary-color); font-size:1.1rem;" id="qpmInvoiceNumberText">INV0001</h4>
            </div>
            <div style="text-align:right;">
              <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Remaining Balance</span>
              <h4 style="margin:0.2rem 0 0 0; color:#16a34a; font-size:1.2rem;" id="qpmBalanceText">₹0</h4>
            </div>
          </div>

          <!-- Received Where / How selector -->
          <div class="form-group" style="margin-bottom:1.25rem;">
            <label class="form-label" style="font-weight:600; margin-bottom:0.4rem; display:block;">
              Where / How was Payment Received? <span style="color:#ef4444;">*</span>
            </label>
            
            <input type="hidden" id="qpmPaymentMode" value="UPI">

            <div class="payment-mode-selector">
              <div class="payment-mode-pill active" data-mode="UPI" onclick="selectPaymentModePill('UPI')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                <span>📱 UPI / QR</span>
              </div>

              <div class="payment-mode-pill" data-mode="Bank Transfer" onclick="selectPaymentModePill('Bank Transfer')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 10 12 15 21 10"/></svg>
                <span>🏦 Bank</span>
              </div>

              <div class="payment-mode-pill" data-mode="Cash" onclick="selectPaymentModePill('Cash')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
                <span>💵 Cash</span>
              </div>

              <div class="payment-mode-pill" data-mode="Cheque" onclick="selectPaymentModePill('Cheque')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                <span>📄 Cheque</span>
              </div>

              <div class="payment-mode-pill" data-mode="Card" onclick="selectPaymentModePill('Card')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <span>💳 Card</span>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Amount Received (₹) <span style="color:#ef4444;">*</span></label>
              <input type="number" step="0.01" id="qpmAmount" class="form-input" required style="font-weight:600; font-size:1.05rem;">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;">Payment Date <span style="color:#ef4444;">*</span></label>
              <input type="date" id="qpmDate" class="form-input" required>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Transaction / UTR Reference No. <span style="color:var(--text-muted); font-weight:normal;">(Optional)</span></label>
            <input type="text" id="qpmReference" class="form-input" placeholder="e.g. UPI/6239104817 or UTR123456">
          </div>

          <div class="form-group" style="margin-bottom:1.5rem;">
            <label class="form-label">Notes / Remarks <span style="color:var(--text-muted); font-weight:normal;">(Optional)</span></label>
            <input type="text" id="qpmNotes" class="form-input" placeholder="e.g. Full payment received in Agency Account">
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid var(--border-color); padding-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="closeQuickPaymentModal()">Cancel</button>
            <button type="submit" id="qpmSubmitBtn" class="btn btn-primary" style="background: linear-gradient(135deg, #16a34a, #15803d); border:none; padding:0.6rem 1.25rem; font-weight:600;">
              ✓ Confirm Payment Received
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function selectPaymentModePill(mode) {
  const modeInput = document.getElementById('qpmPaymentMode');
  if (modeInput) modeInput.value = mode;

  const pills = document.querySelectorAll('#quickPaymentModal .payment-mode-pill');
  pills.forEach(p => {
    if (p.getAttribute('data-mode') === mode) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

function closeQuickPaymentModal() {
  const modal = document.getElementById('quickPaymentModal');
  if (modal) modal.classList.remove('active');
}

function handleQuickPaymentDone(id, invNum, balanceAmount) {
  ensureQuickPaymentModalExists();

  const amount = balanceAmount > 0 ? balanceAmount : 0;

  document.getElementById('qpmInvoiceId').value = id;
  document.getElementById('qpmInvoiceNumberText').textContent = invNum;
  document.getElementById('qpmSubTitle').textContent = `Record payment details for Invoice ${invNum}`;
  document.getElementById('qpmBalanceText').textContent = `₹${formatINR(amount)}`;
  document.getElementById('qpmAmount').value = amount;
  document.getElementById('qpmDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('qpmReference').value = '';
  document.getElementById('qpmNotes').value = `Payment received for ${invNum}`;

  selectPaymentModePill('UPI');

  document.getElementById('quickPaymentModal').classList.add('active');
}

async function submitQuickPayment(e) {
  e.preventDefault();

  const id = document.getElementById('qpmInvoiceId').value;
  const invNum = document.getElementById('qpmInvoiceNumberText').textContent;
  const amount = parseFloat(document.getElementById('qpmAmount').value);
  const payment_date = document.getElementById('qpmDate').value;
  const payment_mode = document.getElementById('qpmPaymentMode').value;
  const reference_number = document.getElementById('qpmReference').value;
  const notes = document.getElementById('qpmNotes').value;

  if (!id || isNaN(amount) || amount <= 0 || !payment_date) {
    showToast('Please enter a valid amount and date.', 'error');
    return;
  }

  const btn = document.getElementById('qpmSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Recording Payment...';

  try {
    const res = await apiFetch('/payments', {
      method: 'POST',
      body: JSON.stringify({
        invoice_id: parseInt(id, 10),
        payment_date,
        amount,
        payment_mode,
        reference_number: reference_number || `PAY-${Date.now().toString().slice(-6)}`,
        notes
      })
    });

    closeQuickPaymentModal();
    showToast(`✓ Payment of ₹${formatINR(amount)} received via ${payment_mode} for ${invNum}!`, 'success');

    if (typeof loadInvoicesList === 'function') {
      loadInvoicesList();
    } else if (typeof initInvoiceViewPage === 'function') {
      initInvoiceViewPage();
    } else {
      setTimeout(() => { window.location.reload(); }, 800);
    }
  } catch (err) {
    showToast('Failed to record payment: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Confirm Payment Received';
  }
}


async function handleCancelInvoice(id, invNum) {
  if (!confirm(`Are you sure you want to cancel invoice ${invNum}? Cancelled invoices cannot be undone.`)) return;

  try {
    const res = await apiFetch(`/invoices/${id}/cancel`, { method: 'POST' });
    showToast(res.message, 'success');
    loadInvoicesList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- CREATE / EDIT INVOICE PAGE ---
async function initCreateInvoicePage() {
  try {
    // Fetch sequence, clients, and services
    const [seqRes, clientsRes, servicesRes] = await Promise.all([
      apiFetch('/invoices/next-number'),
      apiFetch('/clients'),
      apiFetch('/services')
    ]);

    if (seqRes.success) {
      document.getElementById('invoice_number').value = seqRes.invoice_number;
    }

    availableClients = clientsRes.clients || [];
    availableServices = servicesRes.services || [];

    // Populate Client Select
    const clientSelect = document.getElementById('client_id');
    clientSelect.innerHTML = '<option value="">-- Select Client --</option>' +
      availableClients.map(c => `<option value="${c.id}">${c.company_name} (${c.email})</option>`).join('');

    // Setup initial row if empty
    if (currentItems.length === 0) {
      addInvoiceItemRow();
    }

    // Toggle GST visibility on change
    document.getElementById('invoice_type').addEventListener('change', onInvoiceTypeChange);
    document.getElementById('place_of_supply').addEventListener('change', updateInvoiceCalculations);
    document.getElementById('client_id').addEventListener('change', handleClientSelect);

    // Initial invoice number fetch
    fetchNextInvoiceNumber(document.getElementById('invoice_type')?.value || 'GST');

    // Form submit
    document.getElementById('createInvoiceForm').addEventListener('submit', handleSaveInvoice);
  } catch (err) {
    showToast('Failed to initialize invoice generator: ' + err.message, 'error');
  }
}

async function onInvoiceTypeChange() {
  const type = document.getElementById('invoice_type')?.value || 'GST';
  await fetchNextInvoiceNumber(type);
  updateInvoiceCalculations();
}

async function fetchNextInvoiceNumber(type = 'GST') {
  try {
    const res = await apiFetch(`/invoices/next-number?type=${type}`);
    if (res.success && document.getElementById('invoice_number')) {
      document.getElementById('invoice_number').value = res.invoice_number;
    }
  } catch (err) {
    console.error('Failed to fetch next invoice number:', err);
  }
}

function handleClientSelect(e) {
  const clientId = e.target.value;
  const client = availableClients.find(c => String(c.id) === String(clientId));
  const previewBox = document.getElementById('clientPreviewBox');

  if (client && previewBox) {
    previewBox.style.display = 'block';
    previewBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <p><strong>${client.company_name}</strong> (${client.contact_person || ''})</p>
          <p style="font-size:0.8rem; color:var(--text-muted);">${client.address}, ${client.city || ''}, ${client.state || ''} - ${client.pincode || ''}</p>
          <p style="font-size:0.8rem; color:var(--text-muted);">Mobile: ${client.mobile} | Email: ${client.email} ${hasValidGSTIN(client.gstin) ? `| GSTIN: <strong>${client.gstin}</strong>` : ''}</p>
        </div>
        ${(client.preset_services_json) ? `<span class="badge badge-paid" style="font-size:0.75rem;">⚡ Presets Available</span>` : ''}
      </div>
    `;

    // Auto-load Client Service Presets if present
    let presets = [];
    if (client.preset_services_json) {
      try {
        presets = typeof client.preset_services_json === 'string' ? JSON.parse(client.preset_services_json) : client.preset_services_json;
      } catch (err) {
        console.error('Failed to parse client presets:', err);
      }
    }

    if (Array.isArray(presets) && presets.length > 0) {
      const container = document.getElementById('itemsTableBody');
      if (container) {
        container.innerHTML = '';
        presets.forEach(item => {
          addInvoiceItemRow(item);
        });
        showToast(`Auto-loaded preset services for ${client.company_name}!`, 'success');
      }
    }
  } else if (previewBox) {
    previewBox.style.display = 'none';
  }
}

function addInvoiceItemRow(serviceData = null) {
  const container = document.getElementById('itemsTableBody');
  if (!container) return;

  const rowIndex = container.children.length;
  const tr = document.createElement('tr');
  tr.dataset.rowIndex = rowIndex;

  const serviceOptions = availableServices.map(s =>
    `<option value="${s.id}" data-sac="${s.hsn_sac}" data-rate="${s.default_rate}" data-gst="${s.default_gst_rate}">${s.name}</option>`
  ).join('');

  let initialServiceName = '';
  let initialSubDetails = [];

  if (serviceData) {
    const parsed = parseItemDetails(serviceData);
    initialServiceName = parsed.serviceName;
    initialSubDetails = parsed.subDetails;
  }

  const subDetailsHTML = initialSubDetails.map(d => renderSubDetailRowHTML(d)).join('');

  tr.innerHTML = `
    <td>
      <select class="form-select service-select" onchange="onServiceSelect(this)" style="margin-bottom:0.35rem; font-size:0.85rem;">
        <option value="">-- Custom / Select Service Preset --</option>
        ${serviceOptions}
      </select>
      <input type="text" class="form-input item-service-name" placeholder="Service Name (e.g. Digital Marketing)" value="${escapeAttr(initialServiceName)}" style="font-weight:600; margin-bottom:0.35rem; font-size:0.9rem;">
      
      <!-- Sub-details Container -->
      <div class="item-subdetails-container" style="display:flex; flex-direction:column; gap:0.2rem;">
        ${subDetailsHTML}
      </div>

      <!-- Add Sub-detail Button -->
      <button type="button" class="btn btn-secondary btn-sm" onclick="addSubDetailLine(this)" style="margin-top:0.4rem; padding:0.2rem 0.5rem; font-size:0.75rem; display:inline-flex; align-items:center; gap:0.25rem;">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ＋ Add Sub-detail Line
      </button>
    </td>
    <td><input type="text" class="form-input item-sac" value="${serviceData ? (serviceData.hsn_sac || '-') : '-'}" style="width:85px; text-align:center;"></td>
    <td><input type="number" class="form-input item-qty" value="${serviceData ? serviceData.quantity : 1}" min="1" step="1" oninput="updateInvoiceCalculations()" style="width:65px;"></td>
    <td><input type="number" class="form-input item-rate" value="${serviceData ? serviceData.rate : 0}" step="0.01" oninput="updateInvoiceCalculations()" style="width:105px;"></td>
    <td class="gst-col"><input type="number" class="form-input item-gst" value="${serviceData ? serviceData.gst_rate : 18}" step="0.1" oninput="updateInvoiceCalculations()" style="width:65px;"></td>
    <td><strong class="item-amount">₹0</strong></td>
    <td><button type="button" class="btn btn-danger btn-sm" onclick="removeInvoiceItemRow(this)">✕</button></td>
  `;

  container.appendChild(tr);
  updateInvoiceCalculations();
}

function onServiceSelect(selectEl) {
  const row = selectEl.closest('tr');
  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  if (selectedOpt.value) {
    const serviceId = parseInt(selectedOpt.value, 10);
    const serviceObj = availableServices.find(s => s.id === serviceId);

    row.querySelector('.item-service-name').value = selectedOpt.text;
    row.querySelector('.item-sac').value = selectedOpt.dataset.sac || '-';
    row.querySelector('.item-rate').value = selectedOpt.dataset.rate || 0;
    row.querySelector('.item-gst').value = selectedOpt.dataset.gst || 18;

    const container = row.querySelector('.item-subdetails-container');
    if (container && serviceObj && serviceObj.description) {
      container.innerHTML = '';
      const lines = serviceObj.description.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      lines.forEach(line => {
        const cleanLine = line.replace(/^[•\-\*\+]\s*/, '').trim();
        if (cleanLine) {
          container.innerHTML += renderSubDetailRowHTML(cleanLine);
        }
      });
    }
  }
  updateInvoiceCalculations();
}

function removeInvoiceItemRow(btn) {
  const tr = btn.closest('tr');
  const container = document.getElementById('itemsTableBody');
  if (container.children.length > 1) {
    tr.remove();
    updateInvoiceCalculations();
  } else {
    showToast('At least one line item is required.', 'error');
  }
}

function updateInvoiceCalculations() {
  const type = document.getElementById('invoice_type')?.value || 'GST';
  const isGstType = (type === 'GST' || type === 'GST_CLIENT');
  const pos = document.getElementById('place_of_supply')?.value || 'Tamil Nadu';
  const rows = document.querySelectorAll('#itemsTableBody tr');

  // Toggle GST column headers & cells
  document.querySelectorAll('.gst-col').forEach(el => {
    el.style.display = isGstType ? '' : 'none';
  });

  const isInterstate = pos && !pos.toLowerCase().includes('tamil nadu');

  let subtotal = 0;
  let totalTax = 0;

  rows.forEach(tr => {
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const rate = parseFloat(tr.querySelector('.item-rate').value) || 0;
    const gstRate = isGstType ? (parseFloat(tr.querySelector('.item-gst').value) || 0) : 0;

    const lineGross = qty * rate;
    const lineTax = (lineGross * gstRate) / 100;

    subtotal += lineGross;
    totalTax += lineTax;

    tr.querySelector('.item-amount').textContent = formatINR(lineGross);
  });

  let cgst = 0, sgst = 0, igst = 0;

  if (isGstType) {
    if (isInterstate) {
      igst = totalTax;
    } else {
      cgst = totalTax / 2;
      sgst = totalTax / 2;
    }
  }

  const grandTotal = subtotal + totalTax;

  // Update Summary UI
  if (document.getElementById('summarySubtotal')) document.getElementById('summarySubtotal').textContent = formatINR(subtotal);

  const cgstRow = document.getElementById('summaryCgstRow');
  const sgstRow = document.getElementById('summarySgstRow');
  const igstRow = document.getElementById('summaryIgstRow');

  if (cgstRow && sgstRow && igstRow) {
    if (isGstType && !isInterstate) {
      cgstRow.style.display = 'flex';
      sgstRow.style.display = 'flex';
      igstRow.style.display = 'none';
      document.getElementById('summaryCgst').textContent = formatINR(cgst);
      document.getElementById('summarySgst').textContent = formatINR(sgst);
    } else if (isGstType && isInterstate) {
      cgstRow.style.display = 'none';
      sgstRow.style.display = 'none';
      igstRow.style.display = 'flex';
      document.getElementById('summaryIgst').textContent = formatINR(igst);
    } else {
      cgstRow.style.display = 'none';
      sgstRow.style.display = 'none';
      igstRow.style.display = 'none';
    }
  }

  if (document.getElementById('summaryGrandTotal')) document.getElementById('summaryGrandTotal').textContent = formatINR(grandTotal);
}

async function handleSaveInvoice(e) {
  e.preventDefault();
  const form = e.target;

  const client_id = document.getElementById('client_id').value;
  const invoice_type = document.getElementById('invoice_type').value;
  const invoice_date = document.getElementById('invoice_date').value;
  const due_date = document.getElementById('due_date').value;
  const place_of_supply = document.getElementById('place_of_supply').value;
  const payment_terms_text = document.getElementById('payment_terms_text').value;
  const notes = document.getElementById('notes').value;

  const rows = document.querySelectorAll('#itemsTableBody tr');
  const items = [];

  rows.forEach((tr, idx) => {
    const service_id = tr.querySelector('.service-select')?.value || null;
    const serviceName = tr.querySelector('.item-service-name')?.value.trim() || '';

    const subDetailInputs = tr.querySelectorAll('.subdetail-input');
    const subDetails = Array.from(subDetailInputs)
      .map(inp => inp.value.trim())
      .filter(val => val.length > 0);

    let description = serviceName;
    if (subDetails.length > 0) {
      const bulleted = subDetails.map(d => d.startsWith('•') || d.startsWith('-') || d.startsWith('*') ? d : `• ${d}`).join('\n');
      description = serviceName ? `${serviceName}\n${bulleted}` : bulleted;
    }

    const sac = tr.querySelector('.item-sac')?.value.trim() || '-';
    const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 1;
    const rate = parseFloat(tr.querySelector('.item-rate')?.value) || 0;
    const gst = parseFloat(tr.querySelector('.item-gst')?.value) || 0;

    if (description && rate >= 0) {
      items.push({
        service_id: service_id ? parseInt(service_id, 10) : null,
        description,
        hsn_sac: sac,
        quantity: qty,
        rate: rate,
        gst_rate: gst,
        item_order: idx + 1
      });
    }
  });

  if (items.length === 0) {
    showToast('Please add at least one valid line item with description and rate.', 'error');
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving Invoice...';

  try {
    const res = await apiFetch('/invoices', {
      method: 'POST',
      body: JSON.stringify({
        client_id,
        invoice_type,
        invoice_date,
        due_date,
        place_of_supply,
        payment_terms_text,
        notes,
        items,
        status: 'ISSUED'
      })
    });

    showToast(res.message, 'success');
    setTimeout(() => {
      window.location.href = `invoice-view.html?id=${res.invoiceId}`;
    }, 800);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Save & Issue Invoice';
  }
}

// --- VIEW INVOICE PAGE ---
async function initInvoiceViewPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || '1';

  const pdfBtn = document.getElementById('btnDownloadPDF');
  if (pdfBtn) {
    pdfBtn.href = `${API_BASE}/invoices/${id}/pdf?token=${getToken()}`;
  }

  try {
    const res = await apiFetch(`/invoices/${id}`);
    if (!res.success) return;

    renderA4InvoiceSheet(res);

    const user = getUser();
    const isAdmin = user && user.role === 'ADMIN';

    if (isAdmin && res.invoice.status !== 'PAID' && res.invoice.status !== 'CANCELLED') {
      const pageActions = document.querySelector('.page-actions');
      if (pageActions && !document.getElementById('btnViewPaymentDone')) {
        const payBtn = document.createElement('button');
        payBtn.id = 'btnViewPaymentDone';
        payBtn.className = 'btn btn-primary';
        payBtn.style.background = 'linear-gradient(135deg, #16a34a, #15803d)';
        payBtn.style.border = 'none';
        payBtn.style.display = 'inline-flex';
        payBtn.style.alignItems = 'center';
        payBtn.style.gap = '0.35rem';
        payBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Payment Done
        `;
        payBtn.onclick = () => handleQuickPaymentDone(res.invoice.id, res.invoice.invoice_number, res.invoice.balance_amount);
        pageActions.insertBefore(payBtn, pageActions.firstChild);
      }
    }
  } catch (err) {
    showToast('Failed to load invoice details: ' + err.message, 'error');
  }
}

function renderA4InvoiceSheet({ invoice, items, company, terms }) {
  const container = document.getElementById('invoiceSheetContainer');
  if (!container) return;

  const client = invoice.client_snapshot || {};
  const isGST = (invoice.invoice_type === 'GST' || invoice.invoice_type === 'GST_CLIENT');

  container.innerHTML = `
    <div class="invoice-sheet" id="printableInvoice">
      <!-- Agency Header -->
      <div class="inv-agency-header">
        <div class="inv-brand-left">
          <img src="../assets/Logo.png" onerror="this.onerror=null; this.src='assets/Logo.png'; if(!this.complete) this.src='/assets/Logo.png';" alt="D-GROW Marketing Agency Logo" style="max-height: 60px; max-width: 220px; object-fit: contain;">
          <div class="inv-agency-details" style="margin-left: 10px;">
            <h2>${company.company_name || 'D-GROW MARKETING AGENCY'}</h2>
            <p><strong>GSTIN Number:</strong> ${company.gstin || '33OUUPS5195G1ZJ'}</p>
            <p><strong>Address:</strong> ${company.address || 'SF No: 14/3, Plot No. 141, Radha Ave Main Rd, Ganga Nagar, Valasaravakkam'}, ${company.city || 'Chennai'} - ${company.pincode || '600087'}</p>
            <p><strong>Contact No:</strong> ${company.phone || ''}</p>
            <p><strong>Email:</strong> ${company.email || ''}</p>
          </div>
        </div>
        <div class="inv-title-right">
          <h1>Invoice</h1>
        </div>
      </div>

      <!-- Invoice Info -->
      <div class="inv-info-section">
        <div>
          <div class="inv-info-row"><span class="inv-info-label"># Invoice</span><span class="inv-info-val">: ${invoice.invoice_number}</span></div>
          <div class="inv-info-row"><span class="inv-info-label">Date</span><span class="inv-info-val">: ${formatDate(invoice.invoice_date)}</span></div>
          <div class="inv-info-row"><span class="inv-info-label">Terms</span><span class="inv-info-val">: ${invoice.payment_terms_text || '100% payment in advance'}</span></div>
          <div class="inv-info-row"><span class="inv-info-label">Due Date</span><span class="inv-info-val">: ${formatDate(invoice.due_date)}</span></div>
        </div>
        <div>
          <div class="inv-info-row"><span class="inv-info-label">Place of Supply</span><span class="inv-info-val">: ${(invoice.place_of_supply || 'Tamil Nadu').replace(/\s*\(\d+\)/g, '')}</span></div>
        </div>
      </div>

      <!-- Billed To -->
      <div class="inv-bill-to">
        <div class="inv-bill-header">Billed To</div>
        <div class="inv-bill-body">
          <div class="inv-bill-left">
            <div class="inv-client-name">${client.company_name || 'Client Name'}</div>
            <div class="inv-client-address-title"><strong>Address:</strong></div>
            <div class="inv-client-address-text">${formatAddress3Lines(client).join('<br>')}</div>
          </div>
          <div class="inv-bill-right">
            <div><strong>Mobile Number:</strong> ${client.mobile || ''}</div>
            ${hasValidGSTIN(client.gstin, company.gstin) ? `<div style="margin-top:4px;"><strong>GSTIN:</strong> ${client.gstin}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Service Table -->
      <table class="inv-items-table">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">No</th>
            <th style="width:160px;">Service</th>
            <th style="width:85px; text-align:center;">HSN/SAC</th>
            <th>Details</th>
            <th style="width:120px; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
            const parsed = parseItemDetails(item);
            return `
              <tr>
                <td style="text-align:center; font-weight:700;">${idx + 1}</td>
                <td style="font-weight:700; color:#111827; vertical-align:top;">${parsed.serviceName}</td>
                <td style="text-align:center; vertical-align:top; color:#4b5563;">${parsed.hsnSac}</td>
                <td style="vertical-align:top;">
                  ${parsed.subDetails.length > 0 ? `
                    <ul class="inv-details-list">
                      ${parsed.subDetails.map(d => `<li>${d}</li>`).join('')}
                    </ul>
                  ` : `<span style="color:#9ca3af;">-</span>`}
                </td>
                <td style="text-align:right; font-weight:700; color:#111827; vertical-align:top;">${formatINR(parsed.amount)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Totals & Words -->
      <div class="inv-totals-grid">
        <div class="inv-words-box">
          <div class="inv-words-title">Total In Words</div>
          <div class="inv-words-text">${invoice.amount_in_words || 'Rupees Only.'}</div>
          ${invoice.notes ? `<div style="margin-top:10px;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
        </div>
        <div>
          <table class="inv-totals-table">
            <tr><td class="total-label">Sub Total</td><td class="total-amount">${formatINR(invoice.subtotal)}</td></tr>
            ${isGST && invoice.cgst_amount > 0 ? `<tr><td class="total-label">CGST ${invoice.cgst_rate}%</td><td class="total-amount">${formatINR(invoice.cgst_amount)}</td></tr>` : ''}
            ${isGST && invoice.sgst_amount > 0 ? `<tr><td class="total-label">SGST ${invoice.sgst_rate}%</td><td class="total-amount">${formatINR(invoice.sgst_amount)}</td></tr>` : ''}
            ${isGST && invoice.igst_amount > 0 ? `<tr><td class="total-label">IGST ${invoice.igst_rate}%</td><td class="total-amount">${formatINR(invoice.igst_amount)}</td></tr>` : ''}
            ${invoice.round_off !== 0 ? `<tr><td class="total-label">Round Off</td><td class="total-amount">${formatINR(invoice.round_off)}</td></tr>` : ''}
            <tr class="inv-grand-total-row"><td>Total</td><td style="text-align:right;">${formatINR(invoice.grand_total)}</td></tr>
          </table>
        </div>
      </div>

      <!-- Footer Grid -->
      <div class="inv-footer-grid">
        <div class="inv-terms-col">
          <div class="inv-terms-title">Terms & Conditions</div>
          <div class="inv-term-item"><strong>Scope of Work</strong><p>${(terms.scope_of_work || '1. Services include the specific digital marketing services mentioned in the invoice').replace(/\n/g, '<br>')}</p></div>
          <div class="inv-term-item"><strong>Payment Terms</strong><p>${(terms.payment_terms || '1. Full payment should be made every month in advance.').replace(/\n/g, '<br>')}</p></div>
          <div class="inv-term-item"><strong>Ownership and Usage</strong><p>${(terms.ownership_usage || '1. The client receives ownership rights to the final deliverables upon full payment.<br>2. The service provider retains the right to use completed work for portfolio and marketing purposes.').replace(/\n/g, '<br>')}</p></div>
          <div class="inv-term-item"><strong>Confidentiality</strong><p>${(terms.confidentiality || '1. Both parties agree to keep confidential any proprietary information shared during the project.').replace(/\n/g, '<br>')}</p></div>
          <div class="inv-term-item"><strong>Cancellation Policy</strong><p>${(terms.cancellation_policy || '1. The client will be billed for any work completed up to the cancellation date.').replace(/\n/g, '<br>')}</p></div>
        </div>
        <div>
          <div class="inv-payment-box">
            <div class="inv-payment-title">Payment Details:</div>
            <div class="inv-payment-row"><span class="inv-payment-label">Ac Number</span><span>: ${company.account_number || ''}</span></div>
            <div class="inv-payment-row"><span class="inv-payment-label">IFSC Code</span><span>: ${company.ifsc_code || ''}</span></div>
            <div class="inv-payment-row"><span class="inv-payment-label">Banking Name</span><span>: ${company.banking_name || ''}</span></div>
            <div class="inv-payment-row"><span class="inv-payment-label">Bank Name</span><span>: ${company.bank_name || ''}</span></div>
            <div class="inv-payment-row"><span class="inv-payment-label">Branch</span><span>: ${company.branch_name || ''}</span></div>
            <div class="inv-payment-row" style="margin-top:4px;"><span class="inv-payment-label">GPay</span><span>: <strong>${company.gpay_number || ''}</strong></span></div>
          </div>
          <div class="inv-signature-block" style="text-align:center; margin-top:12px;">
            <div style="margin:4px 0; display:flex; justify-content:center; align-items:center;">
              <img src="../assets/seel.png" onerror="this.onerror=null; this.src='assets/seel.png'; if(!this.complete) this.src='/assets/seel.png';" alt="Official Seal & Signature" style="max-height:100px; max-width:190px; object-fit:contain; display:block; margin:0 auto;">
            </div>
            <div class="inv-signature-label" style="font-size:9px; color:#6b7280; font-weight:600; margin-top:2px;">Authorized Signature</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind actions
  const pdfBtn = document.getElementById('btnDownloadPDF');
  if (pdfBtn) pdfBtn.href = `${API_BASE}/invoices/${invoice.id}/pdf?token=${getToken()}`;
}
