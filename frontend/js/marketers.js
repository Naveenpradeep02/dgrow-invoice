// Marketers Management & Performance Monitoring Script

let currentPeriod = 'monthly';
let customFromDate = '';
let customToDate = '';
let marketersData = [];
let summaryMetrics = {};
let selectedMarketerActivity = null;

document.addEventListener('DOMContentLoaded', () => {
  initMarketersPage();
});

function initMarketersPage() {
  loadMarketerMetrics();
}

function setPeriod(period, element) {
  currentPeriod = period;
  customFromDate = '';
  customToDate = '';
  document.getElementById('customFromDate').value = '';
  document.getElementById('customToDate').value = '';

  document.querySelectorAll('.period-pill').forEach(el => el.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }

  loadMarketerMetrics();
}

function applyCustomDateRange() {
  const from = document.getElementById('customFromDate').value;
  const to = document.getElementById('customToDate').value;

  if (!from) {
    showToast('Please select a start date.', 'warning');
    return;
  }

  currentPeriod = 'custom';
  customFromDate = from;
  customToDate = to;

  document.querySelectorAll('.period-pill').forEach(el => el.classList.remove('active'));
  loadMarketerMetrics();
}

async function loadMarketerMetrics() {
  const tbody = document.getElementById('marketersTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading real-time marketer performance...</td></tr>`;
  }

  try {
    let url = `/marketers/metrics?period=${encodeURIComponent(currentPeriod)}`;
    if (customFromDate) url += `&from_date=${encodeURIComponent(customFromDate)}`;
    if (customToDate) url += `&to_date=${encodeURIComponent(customToDate)}`;

    const res = await apiFetch(url);
    if (!res.success) {
      throw new Error(res.message || 'Failed to load marketer metrics.');
    }

    marketersData = res.marketers || [];
    summaryMetrics = res.summary || {};

    updateSummaryCards(summaryMetrics, res.period);
    renderMarketersTable(marketersData);
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#ef4444;">Error loading performance metrics: ${escapeHtml(err.message)}</td></tr>`;
    }
    showToast(err.message, 'error');
  }
}

function updateSummaryCards(s, period) {
  const periodLabel = formatPeriodLabel(period);

  document.getElementById('statActiveMarketers').textContent = s.active_marketers || 0;
  document.getElementById('statTotalMarketersSub').textContent = `${s.total_marketers || 0} registered in team`;

  document.getElementById('statTotalEnquiries').textContent = s.total_enquiries || 0;
  document.getElementById('statEnquiriesPeriod').textContent = `Leads handled (${periodLabel})`;

  document.getElementById('statTotalMeetings').textContent = s.total_meetings || 0;
  document.getElementById('statMeetingsPeriod').textContent = `Client meetings held (${periodLabel})`;

  document.getElementById('statConvertedClients').textContent = s.total_converted_clients || 0;
  document.getElementById('statConvertedRevenue').textContent = `₹${(s.total_converted_revenue || 0).toLocaleString('en-IN')} deal value (${periodLabel})`;
}

function formatPeriodLabel(p) {
  if (p === 'daily') return 'Today';
  if (p === 'weekly') return 'This Week';
  if (p === 'monthly') return 'This Month';
  if (p === 'custom') return 'Custom Range';
  return 'All Time';
}

function renderMarketersTable(list) {
  const tbody = document.getElementById('marketersTableBody');
  if (!tbody) return;

  const search = (document.getElementById('marketerSearchInput')?.value || '').toLowerCase().trim();
  const filtered = list.filter(m => 
    !search || 
    m.name.toLowerCase().includes(search) || 
    m.email.toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:0.35rem;">No Marketer Accounts Found</div>
          <div style="font-size:0.85rem;">Click <strong>"+ Create Marketer Account"</strong> above to register marketing team members.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((m, idx) => {
    const initials = m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'MK';
    const statusBadge = m.status === 'ACTIVE'
      ? `<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700; font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:10px;">ACTIVE</span>`
      : `<span class="badge" style="background:#fee2e2; color:#dc2626; font-weight:700; font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:10px;">INACTIVE</span>`;

    // Progress bar for conversion
    const convRate = m.conversion_rate_percent || 0;
    const progressColor = convRate >= 50 ? '#16a34a' : (convRate >= 25 ? '#0284c7' : '#d97706');

    return `
      <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;">
        <td style="text-align:center; font-weight:700; color:#94a3b8; font-size:0.8rem; vertical-align:middle; padding:0.65rem 0.35rem;">${idx + 1}</td>
        <td style="vertical-align:middle; padding:0.65rem 0.65rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div style="width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, #e11d48, #be123c); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.8rem; flex-shrink:0;">
              ${initials}
            </div>
            <div style="overflow:hidden;">
              <div style="font-weight:700; color:var(--text-main); font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.name)}</div>
              <div style="font-size:0.75rem; color:#64748b; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.email)}</div>
            </div>
          </div>
        </td>
        <td style="text-align:center; vertical-align:middle; padding:0.65rem 0.4rem;">
          <div style="font-size:1rem; font-weight:800; color:#0f172a;">${m.enquiries_count}</div>
          <div style="font-size:0.68rem; color:#64748b;">${m.enquiries_in_discussion} active</div>
        </td>
        <td style="text-align:center; vertical-align:middle; padding:0.65rem 0.4rem;">
          <div style="font-size:1rem; font-weight:800; color:#0284c7;">${m.meetings_total}</div>
          <div style="font-size:0.68rem; color:#16a34a;">${m.meetings_completed} done</div>
        </td>
        <td style="text-align:center; vertical-align:middle; padding:0.65rem 0.4rem;">
          <div style="display:inline-flex; align-items:center; gap:0.25rem; font-weight:800; font-size:0.95rem; color:#15803d;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ${m.converted_clients_count} Clients
          </div>
          <div style="width:70px; height:4px; background:#e2e8f0; border-radius:3px; margin:3px auto 0 auto; overflow:hidden;">
            <div style="width:${Math.min(100, convRate)}%; height:100%; background:${progressColor}; border-radius:3px;"></div>
          </div>
        </td>
        <td style="text-align:center; vertical-align:middle; padding:0.65rem 0.4rem;">
          <span class="badge" style="background:#f1f5f9; color:${progressColor}; font-weight:800; font-size:0.78rem; padding:0.2rem 0.45rem; border-radius:5px;">
            ${convRate}%
          </span>
        </td>
        <td style="text-align:right; vertical-align:middle; padding:0.65rem 0.65rem;">
          <div style="font-weight:800; font-size:0.92rem; color:#0f172a;">₹${(m.converted_revenue || 0).toLocaleString('en-IN')}</div>
          ${m.pipeline_value > 0 ? `<div style="font-size:0.68rem; color:#b45309;">₹${(m.pipeline_value).toLocaleString('en-IN')} pipe</div>` : ''}
        </td>
        <td style="text-align:center; vertical-align:middle; padding:0.65rem 0.4rem;">
          ${statusBadge}
        </td>
        <td style="text-align:right; vertical-align:middle; padding:0.65rem 0.65rem; white-space:nowrap;">
          <div style="display:inline-flex; gap:0.3rem; align-items:center; justify-content:flex-end;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="viewMarketerActivity(${m.id})" title="View Activity" style="font-weight:700; padding:0.25rem 0.5rem; font-size:0.75rem;">
              Activity
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="openEditMarketerModal(${m.id})" title="Edit" style="padding:0.25rem 0.45rem; font-size:0.75rem;">
              Edit
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="toggleMarketerStatus(${m.id}, '${m.status}')" style="padding:0.25rem 0.45rem; font-size:0.75rem; color:${m.status === 'ACTIVE' ? '#b91c1c' : '#15803d'};">
              ${m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="deleteMarketerAccount(${m.id}, '${escapeHtml(m.name)}')" title="Delete" style="padding:0.25rem 0.45rem; font-size:0.75rem;">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------
// Marketer Account Creation & Editing Modals
// -------------------------------------------------------------
function openCreateMarketerModal() {
  document.getElementById('marketerModalTitle').textContent = 'Create Marketer Account';
  document.getElementById('marketerUserId').value = '';
  document.getElementById('marketerName').value = '';
  document.getElementById('marketerEmail').value = '';
  document.getElementById('marketerPassword').value = '';
  document.getElementById('marketerPassword').required = true;
  document.getElementById('marketerPasswordRequired').style.display = 'inline';
  document.getElementById('marketerPasswordHelp').style.display = 'none';
  document.getElementById('marketerStatus').value = 'ACTIVE';
  document.getElementById('marketerModal').classList.add('active');
}

function openEditMarketerModal(userId) {
  const m = marketersData.find(item => item.id === userId);
  if (!m) return;

  document.getElementById('marketerModalTitle').textContent = `Edit Marketer: ${m.name}`;
  document.getElementById('marketerUserId').value = m.id;
  document.getElementById('marketerName').value = m.name || '';
  document.getElementById('marketerEmail').value = m.email || '';
  document.getElementById('marketerPassword').value = '';
  document.getElementById('marketerPassword').required = false;
  document.getElementById('marketerPasswordRequired').style.display = 'none';
  document.getElementById('marketerPasswordHelp').style.display = 'block';
  document.getElementById('marketerStatus').value = m.status || 'ACTIVE';
  document.getElementById('marketerModal').classList.add('active');
}

function closeMarketerModal() {
  document.getElementById('marketerModal').classList.remove('active');
}

async function handleSaveMarketer(e) {
  e.preventDefault();
  const userId = document.getElementById('marketerUserId').value;
  const name = document.getElementById('marketerName').value.trim();
  const email = document.getElementById('marketerEmail').value.trim();
  const password = document.getElementById('marketerPassword').value.trim();
  const status = document.getElementById('marketerStatus').value;

  const btn = document.getElementById('btnSaveMarketer');
  const origText = btn.innerHTML;
  btn.innerHTML = 'Saving...';
  btn.disabled = true;

  try {
    if (userId) {
      const body = { name, email, role_id: 4, status };
      if (password) body.password = password;
      const res = await apiFetch(`/auth/users/${userId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast(res.message || 'Marketer account updated successfully.', 'success');
    } else {
      if (!password) throw new Error('Password is required when creating a new account.');
      const res = await apiFetch('/auth/users', { 
        method: 'POST', 
        body: JSON.stringify({ name, email, password, role_id: 4, status }) 
      });
      showToast(res.message || 'Marketer account created successfully.', 'success');
    }
    closeMarketerModal();
    loadMarketerMetrics();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

async function toggleMarketerStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  if (!confirm(`Are you sure you want to change this marketer account status to ${newStatus}?`)) return;

  try {
    const res = await apiFetch(`/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(res.message || 'Status updated', 'success');
    loadMarketerMetrics();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteMarketerAccount(userId, name) {
  if (!confirm(`Are you sure you want to permanently delete marketer account for "${name}"? This action cannot be undone.`)) return;

  try {
    const res = await apiFetch(`/auth/users/${userId}`, { method: 'DELETE' });
    showToast(res.message || 'Marketer account deleted successfully.', 'success');
    loadMarketerMetrics();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// -------------------------------------------------------------
// Marketer Drilldown Activity Modal
// -------------------------------------------------------------
async function viewMarketerActivity(userId) {
  const modal = document.getElementById('marketerActivityModal');
  const title = document.getElementById('activityModalTitle');
  const subtitle = document.getElementById('activityModalSubtitle');
  const container = document.getElementById('activityModalContent');

  if (!modal) return;
  modal.classList.add('active');
  container.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted);">Loading marketer activity details...</div>`;

  try {
    let url = `/marketers/${userId}/activity?period=${encodeURIComponent(currentPeriod)}`;
    if (customFromDate) url += `&from_date=${encodeURIComponent(customFromDate)}`;
    if (customToDate) url += `&to_date=${encodeURIComponent(customToDate)}`;

    const res = await apiFetch(url);
    if (!res.success) throw new Error(res.message || 'Failed to fetch marketer activity');

    const { marketer, summary, converted_clients, enquiries, meetings } = res;
    selectedMarketerActivity = res;

    title.textContent = `Marketer Activity: ${marketer.name}`;
    subtitle.textContent = `${marketer.email} • Period: ${formatPeriodLabel(currentPeriod)}`;

    renderActivityModalContent(res);
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:#ef4444;">Error loading activity: ${escapeHtml(err.message)}</div>`;
  }
}

function closeMarketerActivityModal() {
  document.getElementById('marketerActivityModal').classList.remove('active');
}

function renderActivityModalContent(data, activeTab = 'converted') {
  const container = document.getElementById('activityModalContent');
  if (!container) return;

  const { summary, converted_clients, enquiries, meetings } = data;

  container.innerHTML = `
    <!-- Top Summary Pills in Modal -->
    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.75rem; margin-bottom:1.25rem;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; text-align:center;">
        <div style="font-size:0.72rem; font-weight:700; color:#64748b; text-transform:uppercase;">Enquiries</div>
        <div style="font-size:1.3rem; font-weight:900; color:#0f172a;">${summary.total_enquiries}</div>
      </div>
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:0.75rem; text-align:center;">
        <div style="font-size:0.72rem; font-weight:700; color:#15803d; text-transform:uppercase;">Converted Clients</div>
        <div style="font-size:1.3rem; font-weight:900; color:#15803d;">${summary.converted_clients}</div>
      </div>
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:0.75rem; text-align:center;">
        <div style="font-size:0.72rem; font-weight:700; color:#1d4ed8; text-transform:uppercase;">Meetings</div>
        <div style="font-size:1.3rem; font-weight:900; color:#1d4ed8;">${summary.meetings_count}</div>
      </div>
      <div style="background:#fefce8; border:1px solid #fef08a; border-radius:8px; padding:0.75rem; text-align:center;">
        <div style="font-size:0.72rem; font-weight:700; color:#a16207; text-transform:uppercase;">Deal Value</div>
        <div style="font-size:1.15rem; font-weight:900; color:#a16207;">₹${(summary.total_revenue || 0).toLocaleString('en-IN')}</div>
      </div>
    </div>

    <!-- Modal Tabs -->
    <div style="display:flex; border-bottom:1px solid var(--border-color); gap:0.5rem; margin-bottom:1rem;">
      <button type="button" class="tab-btn ${activeTab === 'converted' ? 'active' : ''}" onclick="renderActivityModalContent(selectedMarketerActivity, 'converted')" style="padding:0.5rem 1rem; border:none; background:none; font-weight:700; font-size:0.85rem; cursor:pointer; color:${activeTab === 'converted' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom:${activeTab === 'converted' ? '2px solid var(--primary)' : '2px solid transparent'};">
        🏆 Converted Clients (${converted_clients.length})
      </button>
      <button type="button" class="tab-btn ${activeTab === 'enquiries' ? 'active' : ''}" onclick="renderActivityModalContent(selectedMarketerActivity, 'enquiries')" style="padding:0.5rem 1rem; border:none; background:none; font-weight:700; font-size:0.85rem; cursor:pointer; color:${activeTab === 'enquiries' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom:${activeTab === 'enquiries' ? '2px solid var(--primary)' : '2px solid transparent'};">
        💬 All Enquiries Pipeline (${enquiries.length})
      </button>
      <button type="button" class="tab-btn ${activeTab === 'meetings' ? 'active' : ''}" onclick="renderActivityModalContent(selectedMarketerActivity, 'meetings')" style="padding:0.5rem 1rem; border:none; background:none; font-weight:700; font-size:0.85rem; cursor:pointer; color:${activeTab === 'meetings' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom:${activeTab === 'meetings' ? '2px solid var(--primary)' : '2px solid transparent'};">
        📅 Client Meetings (${meetings.length})
      </button>
    </div>

    <!-- Tab Content -->
    <div>
      ${activeTab === 'converted' ? renderConvertedClientsTab(converted_clients) : ''}
      ${activeTab === 'enquiries' ? renderEnquiriesTab(enquiries) : ''}
      ${activeTab === 'meetings' ? renderMeetingsTab(meetings) : ''}
    </div>
  `;
}

function renderConvertedClientsTab(list) {
  if (list.length === 0) {
    return `<div style="text-align:center; padding:2rem; color:var(--text-muted);">No clients converted in this selected period yet.</div>`;
  }

  return `
    <div style="display:flex; flex-direction:column; gap:0.6rem;">
      ${list.map(c => `
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:0.85rem 1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:#15803d;">${escapeHtml(c.business_name || c.name)}</div>
            <div style="font-size:0.8rem; color:#475569; margin-top:2px;">Contact: ${escapeHtml(c.name)} • 📞 ${escapeHtml(c.mobile)}</div>
            <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">Services: ${escapeHtml(c.services_interested || 'Digital Marketing')}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.1rem; font-weight:900; color:#15803d;">₹${parseFloat(c.estimated_budget || 0).toLocaleString('en-IN')}</div>
            <span class="badge" style="background:#dcfce7; color:#16a34a; font-size:0.72rem; font-weight:800; padding:0.15rem 0.5rem;">ONBOARDED</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderEnquiriesTab(list) {
  if (list.length === 0) {
    return `<div style="text-align:center; padding:2rem; color:var(--text-muted);">No enquiries assigned to this marketer in the selected period.</div>`;
  }

  return `
    <table class="data-table" style="width:100%; font-size:0.83rem;">
      <thead>
        <tr style="background:#f8fafc;">
          <th>Lead / Business</th>
          <th>Mobile</th>
          <th>Budget</th>
          <th>Stage Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(e => `
          <tr>
            <td>
              <div style="font-weight:700; color:#0f172a;">${escapeHtml(e.business_name || e.name)}</div>
              <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(e.name)}</div>
            </td>
            <td>${escapeHtml(e.mobile)}</td>
            <td style="font-weight:700;">₹${parseFloat(e.estimated_budget || 0).toLocaleString('en-IN')}</td>
            <td>
              <span class="badge" style="font-weight:700; font-size:0.72rem; padding:0.15rem 0.45rem; ${getStatusBadgeStyle(e.status)}">
                ${escapeHtml(e.status)}
              </span>
            </td>
            <td style="color:#64748b; font-size:0.78rem;">${formatSimpleDate(e.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderMeetingsTab(list) {
  if (list.length === 0) {
    return `<div style="text-align:center; padding:2rem; color:var(--text-muted);">No client meetings logged for this marketer.</div>`;
  }

  return `
    <table class="data-table" style="width:100%; font-size:0.83rem;">
      <thead>
        <tr style="background:#f8fafc;">
          <th>Meeting Title</th>
          <th>Client Name</th>
          <th>Date & Time</th>
          <th>Mode</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(m => `
          <tr>
            <td style="font-weight:700; color:#0f172a;">${escapeHtml(m.title)}</td>
            <td>${escapeHtml(m.client_name || '-')}</td>
            <td>${formatSimpleDate(m.meeting_date)} ${m.meeting_time ? `(${m.meeting_time})` : ''}</td>
            <td><span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.72rem;">${escapeHtml(m.meeting_mode || 'ONLINE')}</span></td>
            <td>
              <span class="badge" style="font-weight:700; font-size:0.72rem; ${m.status === 'DONE' ? 'background:#dcfce7; color:#15803d;' : 'background:#e0f2fe; color:#0369a1;'}">
                ${escapeHtml(m.status)}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function getStatusBadgeStyle(status) {
  if (status === 'ONBOARDED') return 'background:#dcfce7; color:#15803d;';
  if (status === 'NEW') return 'background:#eff6ff; color:#1d4ed8;';
  if (status === 'IN_DISCUSSION' || status === 'QUOTATION_SENT') return 'background:#fef3c7; color:#b45309;';
  if (status === 'LOST') return 'background:#fee2e2; color:#b91c1c;';
  return 'background:#f1f5f9; color:#475569;';
}

function formatSimpleDate(dStr) {
  if (!dStr) return '-';
  const d = new Date(dStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
