// Client Master Management Script

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('clientsTableBody')) {
    loadClients();
  }
  if (document.getElementById('clientForm')) {
    initClientEditPage();
  }
});

async function loadClients() {
  const tbody = document.getElementById('clientsTableBody');
  if (!tbody) return;

  const search = document.getElementById('clientSearch')?.value || '';

  try {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading clients...</td></tr>';
    const query = new URLSearchParams({ search }).toString();
    const res = await apiFetch(`/clients?${query}`);

    if (!res.clients || res.clients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No clients registered.</td></tr>';
      return;
    }

    tbody.innerHTML = res.clients.map(c => `
      <tr>
        <td><strong>${c.company_name}</strong></td>
        <td>${c.contact_person || '-'}</td>
        <td>${c.mobile}<br><span style="font-size:0.75rem; color:var(--text-muted);">${c.email}</span></td>
        <td>${c.gstin ? `<code>${c.gstin}</code>` : '<span class="text-muted">Unregistered</span>'}</td>
        <td>${c.city || ''}, ${c.state || ''}</td>
        <td>
          <a href="client-edit.html?id=${c.id}" class="btn btn-secondary btn-sm">Edit</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

async function initClientEditPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (id) {
    if (document.getElementById('clientPageTitle')) {
      document.getElementById('clientPageTitle').textContent = 'Edit Client Master';
    }
    await loadClientDataForEdit(id);
  } else {
    if (document.getElementById('clientPageTitle')) {
      document.getElementById('clientPageTitle').textContent = 'Add New Client Master';
    }
    const rows = document.getElementById('clientPresetRows');
    if (rows && rows.children.length === 0) {
      addClientPresetRow();
    }
  }
}

async function loadClientDataForEdit(id) {
  try {
    const res = await apiFetch(`/clients/${id}`);
    if (!res.client) return;

    const c = res.client;
    if (document.getElementById('clientId')) document.getElementById('clientId').value = c.id;
    if (document.getElementById('company_name')) document.getElementById('company_name').value = c.company_name;
    if (document.getElementById('contact_person')) document.getElementById('contact_person').value = c.contact_person || '';
    if (document.getElementById('mobile')) document.getElementById('mobile').value = c.mobile;
    if (document.getElementById('email')) document.getElementById('email').value = c.email;
    if (document.getElementById('address')) document.getElementById('address').value = c.address;
    if (document.getElementById('city')) document.getElementById('city').value = c.city || '';
    if (document.getElementById('state')) document.getElementById('state').value = c.state || 'Tamil Nadu';
    if (document.getElementById('pincode')) document.getElementById('pincode').value = c.pincode || '';
    if (document.getElementById('gstin')) document.getElementById('gstin').value = c.gstin || '';
    if (document.getElementById('pan')) document.getElementById('pan').value = c.pan || '';

    const rows = document.getElementById('clientPresetRows');
    if (rows) {
      rows.innerHTML = '';
      let presets = [];
      if (c.preset_services_json) {
        try {
          presets = typeof c.preset_services_json === 'string' ? JSON.parse(c.preset_services_json) : c.preset_services_json;
        } catch (err) {
          console.error('Error parsing client presets:', err);
        }
      }
      if (Array.isArray(presets) && presets.length > 0) {
        presets.forEach(p => addClientPresetRow(p));
      } else {
        addClientPresetRow();
      }
    }
  } catch (err) {
    showToast('Failed to load client details: ' + err.message, 'error');
  }
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parsePresetDetails(rawDesc) {
  const fullText = (rawDesc || '').trim();
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  let serviceName = '';
  let subDetails = [];

  if (lines.length > 1) {
    serviceName = lines[0];
    subDetails = lines.slice(1);
  } else if (fullText.includes(':')) {
    const parts = fullText.split(':');
    serviceName = parts[0].trim();
    subDetails = parts.slice(1).join(':').split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
  } else {
    serviceName = fullText || '';
    subDetails = [];
  }

  const cleanSubDetails = subDetails.map(d => d.replace(/^[•\-\*\+]\s*/, '').trim()).filter(d => d.length > 0);
  return { serviceName, subDetails: cleanSubDetails };
}

function renderPresetSubDetailRowHTML(text = '') {
  return `
    <div class="preset-subdetail-row" style="display:flex; align-items:center; gap:0.35rem; margin-top:0.25rem;">
      <span style="color:#2563eb; font-weight:bold; font-size:0.85rem; line-height:1;">•</span>
      <input type="text" class="form-input preset-subdetail-input" value="${escapeAttr(text)}" placeholder="Sub-detail (e.g. Local SEO)" style="font-size:0.8rem; padding:0.25rem 0.5rem; flex:1;">
      <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; font-size:0.9rem; cursor:pointer; padding:0 0.25rem; font-weight:bold;" title="Remove sub-detail">✕</button>
    </div>
  `;
}

function addPresetSubDetailLine(btn, text = '') {
  const cell = btn.closest('td');
  const container = cell.querySelector('.preset-subdetails-container');
  if (!container) return;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderPresetSubDetailRowHTML(text);
  const newRow = tempDiv.firstElementChild;
  container.appendChild(newRow);
  const input = newRow.querySelector('.preset-subdetail-input');
  if (input && !text) input.focus();
}

function addClientPresetRow(data = null) {
  const container = document.getElementById('clientPresetRows');
  if (!container) return;

  let serviceNameVal = '';
  let subDetails = [];

  if (data && data.description) {
    const parsed = parsePresetDetails(data.description);
    serviceNameVal = parsed.serviceName;
    subDetails = parsed.subDetails;
  }

  const subDetailsHTML = subDetails.map(d => renderPresetSubDetailRowHTML(d)).join('');

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="vertical-align:top;">
      <input type="text" class="form-input preset-service-name" placeholder="Service Name (e.g. Digital Marketing)" value="${escapeAttr(serviceNameVal)}" style="font-weight:600; margin-bottom:0.35rem;">
      
      <!-- Container for individual sub-details -->
      <div class="preset-subdetails-container" style="display:flex; flex-direction:column; gap:0.2rem;">
        ${subDetailsHTML}
      </div>

      <!-- Add Sub-detail button -->
      <button type="button" class="btn btn-secondary btn-sm" onclick="addPresetSubDetailLine(this)" style="margin-top:0.4rem; padding:0.2rem 0.5rem; font-size:0.75rem; display:inline-flex; align-items:center; gap:0.25rem;">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ＋ Add Sub-detail Line
      </button>
    </td>
    <td style="vertical-align:top;">
      <input type="text" class="form-input preset-sac" placeholder="998311" value="${data ? (data.hsn_sac || '998311') : '998311'}" style="width:90px; text-align:center;">
    </td>
    <td style="vertical-align:top;">
      <input type="number" class="form-input preset-qty" value="${data ? (data.quantity || 1) : 1}" min="1" step="1" style="width:65px;">
    </td>
    <td style="vertical-align:top;">
      <input type="number" class="form-input preset-rate" placeholder="0.00" value="${data ? (data.rate !== undefined ? data.rate : '') : ''}" step="0.01" style="width:100px;">
    </td>
    <td style="vertical-align:top;">
      <input type="number" class="form-input preset-gst" value="${data ? (data.gst_rate !== undefined ? data.gst_rate : 18) : 18}" step="0.1" style="width:70px;">
    </td>
    <td style="vertical-align:top;">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeClientPresetRow(this)" style="padding:0.25rem 0.5rem;" title="Remove service preset">✕</button>
    </td>
  `;
  container.appendChild(tr);
}

function removeClientPresetRow(btn) {
  const tr = btn.closest('tr');
  if (tr) tr.remove();
}

function getClientPresetServicesArray() {
  const rows = document.querySelectorAll('#clientPresetRows tr');
  const items = [];
  rows.forEach(tr => {
    const serviceName = tr.querySelector('.preset-service-name')?.value.trim() || '';
    const subDetailInputs = tr.querySelectorAll('.preset-subdetail-input');
    const subDetails = Array.from(subDetailInputs)
      .map(inp => inp.value.trim())
      .filter(val => val.length > 0);

    let description = serviceName;
    if (subDetails.length > 0) {
      const bulleted = subDetails.map(d => d.startsWith('•') || d.startsWith('-') || d.startsWith('*') ? d : `• ${d}`).join('\n');
      description = serviceName ? `${serviceName}\n${bulleted}` : bulleted;
    }

    const sac = tr.querySelector('.preset-sac')?.value.trim() || '998311';
    const qty = parseFloat(tr.querySelector('.preset-qty')?.value) || 1;
    const rate = parseFloat(tr.querySelector('.preset-rate')?.value) || 0;
    const gst = parseFloat(tr.querySelector('.preset-gst')?.value) || 18;

    if (description) {
      items.push({
        description: description,
        hsn_sac: sac,
        quantity: qty,
        rate: rate,
        gst_rate: gst
      });
    }
  });
  return items;
}

async function handleSaveClient(e) {
  e.preventDefault();
  const btn = document.getElementById('saveClientBtn');
  if (btn) btn.disabled = true;

  const id = document.getElementById('clientId').value;
  const presetServices = getClientPresetServicesArray();

  const data = {
    company_name: document.getElementById('company_name').value,
    contact_person: document.getElementById('contact_person').value,
    mobile: document.getElementById('mobile').value,
    email: document.getElementById('email').value,
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    state: document.getElementById('state').value,
    pincode: document.getElementById('pincode').value,
    gstin: document.getElementById('gstin').value,
    pan: document.getElementById('pan').value,
    preset_services_json: presetServices
  };

  try {
    if (id) {
      await apiFetch(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Client updated successfully', 'success');
    } else {
      await apiFetch('/clients', { method: 'POST', body: JSON.stringify(data) });
      showToast('Client created successfully', 'success');
    }
    setTimeout(() => {
      window.location.href = 'clients.html';
    }, 800);
  } catch (err) {
    showToast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
}
