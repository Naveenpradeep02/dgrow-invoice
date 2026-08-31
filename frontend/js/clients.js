// Client Master Management Script

let cachedMarketersList = [];

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('clientsTableBody')) {
    initClientsMasterPage();
  }
  if (document.getElementById('clientForm')) {
    initClientEditPage();
  }
});

async function initClientsMasterPage() {
  const user = typeof getUser === 'function' ? getUser() : null;
  const isAdmin = user && user.role === 'ADMIN';

  // Load marketers for Admin filtering and modal
  if (isAdmin) {
    await loadMarketersForAdmin();
    const filterWrapper = document.getElementById('marketerFilterWrapper');
    if (filterWrapper) filterWrapper.style.display = 'block';
  }

  loadClients();
}

async function loadMarketersForAdmin() {
  try {
    const res = await apiFetch('/auth/users');
    if (res.success && Array.isArray(res.users)) {
      cachedMarketersList = res.users.filter(u => u.role === 'MARKETING' || u.role_id === 4 || String(u.role).toUpperCase() === 'MARKETING');
      
      // Populate Table Filter Dropdown
      const filterSelect = document.getElementById('clientMarketerFilter');
      if (filterSelect) {
        filterSelect.innerHTML = '<option value="">-- All Field Marketers --</option>' +
          cachedMarketersList.map(m => `<option value="${m.id}">Marketer: ${escapeHtml(m.name)}</option>`).join('');
      }

      // Populate Modal Dropdown
      const modalSelect = document.getElementById('modalMarketerSelect');
      if (modalSelect) {
        modalSelect.innerHTML = '<option value="">-- Unassigned (Direct Client) --</option>' +
          cachedMarketersList.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('');
      }
    }
  } catch (e) {
    console.warn('Could not load marketers list for admin:', e);
  }
}

function getClientStatusBadge(status = 'ACTIVE') {
  const s = String(status || 'ACTIVE').toUpperCase();
  switch (s) {
    case 'ACTIVE':
      return '<span class="badge badge-paid">Active</span>';
    case 'ONBOARDING':
      return '<span class="badge badge-issued">Onboarding</span>';
    case 'LEAD':
      return '<span class="badge badge-partial">Lead</span>';
    case 'INACTIVE':
      return '<span class="badge badge-cancelled">Inactive</span>';
    case 'COMPLETED':
      return '<span class="badge" style="background:#f3e8ff; color:#6b21a8; font-weight:600;">Completed</span>';
    default:
      return `<span class="badge badge-draft">${s}</span>`;
  }
}

async function loadClients() {
  const tbody = document.getElementById('clientsTableBody');
  if (!tbody) return;

  const search = document.getElementById('clientSearch')?.value || '';
  const status = document.getElementById('clientStatusFilter')?.value || '';
  const marketerId = document.getElementById('clientMarketerFilter')?.value || '';
  const currentUser = typeof getUser === 'function' ? getUser() : null;
  const isAdmin = currentUser && currentUser.role === 'ADMIN';

  try {
    tbody.innerHTML = renderTableLoader(8, 'Loading clients...');
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (marketerId) params.append('marketer_id', marketerId);

    const res = await apiFetch(`/clients?${params.toString()}`);

    if (!res.clients || res.clients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:2rem; color:var(--text-muted);">No clients found.</td></tr>';
      return;
    }

    tbody.innerHTML = res.clients.map(c => {
      const statusBadge = getClientStatusBadge(c.status);
      let termsLabel = '<span class="badge" style="background:#f1f5f9; color:#475569;">Single Pay</span>';
      
      if (c.payment_terms_type === 'SPLIT' || c.payment_terms_type === '3_PAYMENTS') {
        let count = '';
        if (c.payment_schedule_json) {
          try {
            const sched = typeof c.payment_schedule_json === 'string' ? JSON.parse(c.payment_schedule_json) : c.payment_schedule_json;
            if (Array.isArray(sched.milestones)) count = ` (${sched.milestones.length})`;
          } catch (e) {}
        }
        termsLabel = `<span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:600;">Split Pay${count}</span>`;
      }

      // Marketer Column Display
      let marketerDisplay = '';
      if (c.assigned_marketer_name) {
        marketerDisplay = `<span class="badge" style="background:#ecfdf5; color:#065f46; font-weight:700; border:1px solid #a7f3d0; display:inline-flex; align-items:center; gap:0.25rem;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${escapeHtml(c.assigned_marketer_name)}
        </span>`;
      } else if (c.marketing_person) {
        marketerDisplay = `<span class="badge" style="background:#eff6ff; color:#1e40af; font-weight:600; border:1px solid #bfdbfe; display:inline-flex; align-items:center; gap:0.25rem;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${escapeHtml(c.marketing_person)}
        </span>`;
      } else {
        marketerDisplay = `<span class="badge" style="background:#f8fafc; color:#94a3b8; font-size:0.75rem;">Direct / Unassigned</span>`;
      }

      const assignBtnHtml = isAdmin ? `
        <button type="button" onclick="openAssignMarketerModal(${c.id}, '${escapeAttr(c.company_name)}', ${c.assigned_to || 'null'})" class="btn btn-secondary btn-sm" title="Assign / Reassign Marketer" style="padding:0.18rem 0.45rem; font-size:0.7rem; color:#0369a1; border-color:#bae6fd; background:#f0f9ff; margin-top:3px; display:inline-flex; align-items:center; gap:2px;">
          Assign
        </button>
      ` : '';

      return `
        <tr>
          <td>
            <a href="client-view.html?id=${c.id}" style="color:var(--text-main); font-weight:700; text-decoration:none; font-size:0.92rem;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-main)'">
              ${escapeHtml(c.company_name)}
            </a>
            ${c.contact_person ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(c.contact_person)}</div>` : ''}
          </td>
          <td>${escapeHtml(c.mobile)}<br><span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(c.email)}</span></td>
          <td>
            <div>${marketerDisplay}</div>
            ${assignBtnHtml}
          </td>
          <td>${c.onboarding_date ? formatDate(c.onboarding_date) : '-'}</td>
          <td>${statusBadge}</td>
          <td>${termsLabel}</td>
          <td>${c.gstin ? `<code>${escapeHtml(c.gstin)}</code>` : '<span class="text-muted">Unregistered</span>'}</td>
          <td>
            <div style="display:flex; gap:0.35rem; align-items:center;">
              <a href="client-view.html?id=${c.id}" class="btn btn-secondary btn-sm" title="View 360° History & Financials" style="padding:0.3rem 0.55rem; display:inline-flex; align-items:center; gap:0.25rem; font-weight:700; text-decoration:none; color:var(--primary); border-color:#fecdd3; background:#fff1f2;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </a>
              <a href="client-edit.html?id=${c.id}" class="btn btn-secondary btn-sm" title="Edit Client Details" style="padding:0.3rem 0.5rem; display:inline-flex; align-items:center; gap:0.25rem;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </a>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-danger" style="padding:2rem;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// Modal management for 1-click Assignment
function openAssignMarketerModal(clientId, companyName, currentMarketerId) {
  const modal = document.getElementById('assignMarketerModal');
  if (!modal) return;

  document.getElementById('modalClientId').value = clientId;
  document.getElementById('modalClientCompanyName').textContent = companyName;

  const select = document.getElementById('modalMarketerSelect');
  if (select) {
    select.value = currentMarketerId || '';
  }

  modal.style.display = 'flex';
}

function closeAssignMarketerModal() {
  const modal = document.getElementById('assignMarketerModal');
  if (modal) modal.style.display = 'none';
}

async function submitClientAssignment() {
  const clientId = document.getElementById('modalClientId').value;
  const marketerId = document.getElementById('modalMarketerSelect').value;
  const saveBtn = document.getElementById('btnSaveClientAssignment');

  if (!clientId) return;

  try {
    if (saveBtn) saveBtn.disabled = true;
    const res = await apiFetch(`/clients/${clientId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ marketer_id: marketerId ? parseInt(marketerId, 10) : null })
    });

    if (!res.success) throw new Error(res.message || 'Failed to update assignment.');

    showToast(res.message, 'success');
    closeAssignMarketerModal();
    loadClients();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function selectPaymentTermType(type = 'SINGLE') {
  const hiddenInput = document.getElementById('payment_terms_type');
  if (hiddenInput) hiddenInput.value = type;

  const pillSingle = document.getElementById('termPillSingle');
  const pillSplit = document.getElementById('termPillSplit');
  const singleOpts = document.getElementById('singlePayOptions');
  const splitOpts = document.getElementById('splitPayOptions');

  if (type === 'SPLIT' || type === '3_PAYMENTS') {
    if (pillSingle) pillSingle.classList.remove('active');
    if (pillSplit) pillSplit.classList.add('active');
    if (singleOpts) singleOpts.style.display = 'none';
    if (splitOpts) splitOpts.style.display = 'block';

    const container = document.getElementById('splitMilestonesContainer');
    if (container && container.children.length === 0) {
      addSplitMilestoneRow({ milestone: 'Advance / Onboarding', percent: 50, due_days: 0 });
      addSplitMilestoneRow({ milestone: 'Final Delivery & Handover', percent: 50, due_days: 30 });
    }
    calculateMilestoneSum();
  } else {
    if (pillSingle) pillSingle.classList.add('active');
    if (pillSplit) pillSplit.classList.remove('active');
    if (singleOpts) singleOpts.style.display = 'block';
    if (splitOpts) splitOpts.style.display = 'none';
  }
}

function addSplitMilestoneRow(data = null) {
  const container = document.getElementById('splitMilestonesContainer');
  if (!container) return;

  const currentCount = container.children.length;
  const stageNum = currentCount + 1;

  const defaultDesc = data?.milestone || (stageNum === 1 ? 'Advance / Onboarding' : stageNum === 2 ? 'Mid-Project Milestone' : stageNum === 3 ? 'Final Delivery & Handover' : `Stage ${stageNum} Milestone`);
  const defaultPercent = data?.percent !== undefined ? data.percent : (stageNum === 1 ? 50 : 25);
  const defaultDue = data?.due_days !== undefined ? data.due_days : (stageNum === 1 ? 0 : stageNum === 2 ? 15 : 30);

  const card = document.createElement('div');
  card.className = 'milestone-card';
  card.innerHTML = `
    <div class="milestone-card-header">
      <span class="milestone-badge stage-badge">Stage #${stageNum}</span>
      <button type="button" onclick="removeSplitMilestoneRow(this)" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:0 0.25rem; display:inline-flex; align-items:center;" title="Remove this split stage">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="form-group" style="margin:0;">
      <label class="form-label" style="font-size:0.8rem;">Stage Description</label>
      <input type="text" class="form-input milestone-name" value="${escapeAttr(defaultDesc)}" placeholder="e.g. Advance / Milestone">
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
      <div class="form-group" style="margin:0;">
        <label class="form-label" style="font-size:0.8rem;">Share %</label>
        <input type="number" class="form-input milestone-percent" value="${defaultPercent}" min="1" max="100" oninput="calculateMilestoneSum()">
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label" style="font-size:0.8rem;">Due When</label>
        <select class="form-select milestone-due" style="font-size:0.8rem; padding:0.45rem;">
          <option value="0" ${defaultDue == 0 ? 'selected' : ''}>Onboarding / Immed.</option>
          <option value="7" ${defaultDue == 7 ? 'selected' : ''}>7 Days</option>
          <option value="15" ${defaultDue == 15 ? 'selected' : ''}>15 Days</option>
          <option value="20" ${defaultDue == 20 ? 'selected' : ''}>20 Days</option>
          <option value="30" ${defaultDue == 30 ? 'selected' : ''}>30 Days</option>
          <option value="45" ${defaultDue == 45 ? 'selected' : ''}>45 Days</option>
          <option value="60" ${defaultDue == 60 ? 'selected' : ''}>60 Days</option>
        </select>
      </div>
    </div>
  `;
  container.appendChild(card);
  recalculateMilestoneBadges();
  calculateMilestoneSum();
}

function removeSplitMilestoneRow(btn) {
  const container = document.getElementById('splitMilestonesContainer');
  if (!container) return;

  if (container.children.length <= 2) {
    showToast('At least 2 split stages are required for split payment terms.', 'error');
    return;
  }

  const card = btn.closest('.milestone-card');
  if (card) {
    card.remove();
    recalculateMilestoneBadges();
    calculateMilestoneSum();
  }
}

function recalculateMilestoneBadges() {
  const container = document.getElementById('splitMilestonesContainer');
  if (!container) return;

  const badges = container.querySelectorAll('.stage-badge');
  badges.forEach((b, idx) => {
    b.textContent = `Stage #${idx + 1}`;
  });
}

function calculateMilestoneSum() {
  const inputs = document.querySelectorAll('#splitMilestonesContainer .milestone-percent');
  let total = 0;
  inputs.forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });

  const badge = document.getElementById('milestoneSumBadge');
  if (badge) {
    if (total === 100) {
      badge.style.color = '#16a34a';
      badge.style.background = '#dcfce7';
      badge.textContent = `Total: 100% Allocated`;
    } else {
      badge.style.color = '#dc2626';
      badge.style.background = '#fee2e2';
      badge.textContent = `Total: ${total}% (Must equal 100%)`;
    }
  }
  return total;
}

function getPaymentScheduleObject() {
  const type = document.getElementById('payment_terms_type')?.value || 'SINGLE';
  if (type === 'SPLIT' || type === '3_PAYMENTS') {
    const cards = document.querySelectorAll('#splitMilestonesContainer .milestone-card');
    const milestones = [];
    cards.forEach((card, idx) => {
      const name = card.querySelector('.milestone-name')?.value.trim() || `Stage #${idx + 1}`;
      const percent = parseFloat(card.querySelector('.milestone-percent')?.value) || 0;
      const dueDays = parseInt(card.querySelector('.milestone-due')?.value, 10) || 0;
      milestones.push({
        stage: idx + 1,
        milestone: name,
        percent: percent,
        due_days: dueDays
      });
    });

    return {
      type: 'SPLIT',
      milestones: milestones
    };
  } else {
    return {
      type: 'SINGLE',
      due_days: parseInt(document.getElementById('single_due_days')?.value, 10) || 7
    };
  }
}

async function populateEditPageMarketers(user) {
  const select = document.getElementById('assigned_to');
  if (!select) return;

  const isMarketing = user && user.role === 'MARKETING';

  try {
    const res = await apiFetch('/auth/users');
    if (res.success && Array.isArray(res.users)) {
      const marketers = res.users.filter(u => u.role === 'MARKETING' || u.role_id === 4 || String(u.role).toUpperCase() === 'MARKETING');
      
      select.innerHTML = '<option value="">-- Unassigned (Direct Client) --</option>' +
        marketers.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('');
    }
  } catch (e) {}

  if (isMarketing) {
    select.value = String(user.id);
    select.disabled = true;
    const noteInput = document.getElementById('marketing_person');
    if (noteInput && !noteInput.value) noteInput.value = user.name;
  }
}

async function initClientEditPage() {
  const user = typeof getUser === 'function' ? getUser() : null;
  await populateEditPageMarketers(user);

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
    // Set default onboarding date to today
    const dateInput = document.getElementById('onboarding_date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    selectPaymentTermType('SINGLE');

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

    // Marketer Assignment
    if (document.getElementById('assigned_to') && c.assigned_to) {
      document.getElementById('assigned_to').value = String(c.assigned_to);
    }
    if (document.getElementById('marketing_person') && c.marketing_person) {
      document.getElementById('marketing_person').value = c.marketing_person;
    }

    // Onboarding date
    if (document.getElementById('onboarding_date')) {
      if (c.onboarding_date) {
        const d = new Date(c.onboarding_date);
        document.getElementById('onboarding_date').value = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : c.onboarding_date;
      } else {
        document.getElementById('onboarding_date').value = new Date().toISOString().split('T')[0];
      }
    }

    // Status
    if (document.getElementById('status')) {
      document.getElementById('status').value = c.status || 'ACTIVE';
    }

    // Payment Terms & Schedule
    const termType = (c.payment_terms_type === 'SPLIT' || c.payment_terms_type === '3_PAYMENTS') ? 'SPLIT' : 'SINGLE';
    selectPaymentTermType(termType);

    if (c.payment_schedule_json) {
      try {
        const sched = typeof c.payment_schedule_json === 'string' ? JSON.parse(c.payment_schedule_json) : c.payment_schedule_json;
        if ((sched.type === 'SPLIT' || sched.type === '3_PAYMENTS') && Array.isArray(sched.milestones)) {
          const container = document.getElementById('splitMilestonesContainer');
          if (container) {
            container.innerHTML = '';
            sched.milestones.forEach(m => addSplitMilestoneRow(m));
          }
        } else if (sched.type === 'SINGLE') {
          if (document.getElementById('single_due_days')) {
            document.getElementById('single_due_days').value = sched.due_days !== undefined ? sched.due_days : 7;
          }
        }
      } catch (err) {
        console.error('Error parsing payment schedule:', err);
      }
    }

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
      <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:0 0.25rem; display:inline-flex; align-items:center;" title="Remove sub-detail">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
}

function addPresetSubDetailLine(btn, text = '') {
  const container = btn.closest('td').querySelector('.preset-subdetails-container');
  if (!container) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderPresetSubDetailRowHTML(text);
  container.appendChild(temp.firstElementChild);
}

function addClientPresetRow(data = null) {
  const container = document.getElementById('clientPresetRows');
  if (!container) return;

  const parsed = parsePresetDetails(data?.description || '');
  const serviceName = parsed.serviceName || (data?.name || '');
  const subDetails = parsed.subDetails || [];

  let subDetailsHTML = '';
  subDetails.forEach(sub => {
    subDetailsHTML += renderPresetSubDetailRowHTML(sub);
  });

  const tr = document.createElement('tr');
  tr.className = 'preset-service-row';
  tr.innerHTML = `
    <td>
      <input type="text" class="form-input preset-name" placeholder="Service Name (e.g. Digital Marketing)" value="${escapeAttr(serviceName)}" style="font-weight:600; margin-bottom:0.25rem;">
      
      <!-- Container for individual sub-details -->
      <div class="preset-subdetails-container" style="display:flex; flex-direction:column; gap:0.2rem;">
        ${subDetailsHTML}
      </div>

      <!-- Add Sub-detail button -->
      <button type="button" class="btn btn-secondary btn-sm" onclick="addPresetSubDetailLine(this)" style="margin-top:0.4rem; padding:0.2rem 0.5rem; font-size:0.75rem; display:inline-flex; align-items:center; gap:0.3rem;">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Sub-detail Line
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
      <button type="button" class="btn btn-danger btn-sm" onclick="removeClientPresetRow(this)" style="padding:0.3rem 0.5rem; display:inline-flex; align-items:center; justify-content:center;" title="Remove service preset">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
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
    const serviceName = tr.querySelector('.preset-name')?.value.trim() || '';
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

  const paymentTermType = document.getElementById('payment_terms_type')?.value || 'SINGLE';
  if (paymentTermType === 'SPLIT' || paymentTermType === '3_PAYMENTS') {
    const sum = calculateMilestoneSum();
    if (sum !== 100) {
      showToast(`The split payment stages must total exactly 100% (currently ${sum}%).`, 'error');
      if (btn) btn.disabled = false;
      return;
    }
  }

  const paymentSchedule = getPaymentScheduleObject();

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
    onboarding_date: document.getElementById('onboarding_date')?.value || null,
    status: document.getElementById('status')?.value || 'ACTIVE',
    payment_terms_type: paymentTermType,
    payment_schedule_json: paymentSchedule,
    preset_services_json: presetServices,
    assigned_to: document.getElementById('assigned_to')?.value ? parseInt(document.getElementById('assigned_to').value, 10) : null,
    marketing_person: document.getElementById('marketing_person')?.value.trim() || null
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
