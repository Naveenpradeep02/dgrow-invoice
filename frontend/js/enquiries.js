// Enquiries & Lead Management Controller

let currentEnquiries = [];
let activePeriod = 'monthly';
let currentEnquiryData = null;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('enquiriesTableBody')) {
    initEnquiriesPage();
  }
});

function initEnquiriesPage() {
  // Set default custom date pickers
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const fromEl = document.getElementById('filterCustomFrom');
  const toEl = document.getElementById('filterCustomTo');
  if (fromEl) fromEl.value = thirtyDaysAgo.toISOString().split('T')[0];
  if (toEl) toEl.value = today.toISOString().split('T')[0];

  loadEnquiryMetrics();
  loadEnquiries();
}

function setPeriodFilter(period) {
  activePeriod = period;

  // Update button active styles
  document.querySelectorAll('.period-btn').forEach(btn => {
    if (btn.dataset.period === period) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const customRangeBox = document.getElementById('customRangeInputs');
  if (customRangeBox) {
    if (period === 'custom') {
      customRangeBox.style.display = 'flex';
    } else {
      customRangeBox.style.display = 'none';
    }
  }

  loadEnquiryMetrics();
  loadEnquiries();
}

function applyCustomDateFilter() {
  if (activePeriod === 'custom') {
    loadEnquiryMetrics();
    loadEnquiries();
  }
}

// --- METRICS / ANALYTICS LOADER ---
async function loadEnquiryMetrics() {
  try {
    const params = new URLSearchParams();
    params.append('time_filter', activePeriod);

    if (activePeriod === 'custom') {
      const fromVal = document.getElementById('filterCustomFrom')?.value || '';
      const toVal = document.getElementById('filterCustomTo')?.value || '';
      if (fromVal) params.append('from_date', fromVal);
      if (toVal) params.append('to_date', toVal);
    }

    const res = await apiFetch('/enquiries/metrics?' + params.toString());
    if (!res || !res.success) return;

    const s = res.summary || {};

    if (document.getElementById('metricTotalLeads')) {
      document.getElementById('metricTotalLeads').textContent = s.total_entry_leads || 0;
    }
    if (document.getElementById('metricOnboarded')) {
      document.getElementById('metricOnboarded').textContent = s.onboarded_leads || 0;
    }
    if (document.getElementById('metricConversionRate')) {
      document.getElementById('metricConversionRate').textContent = `${s.conversion_rate || 0}%`;
    }
    if (document.getElementById('metricNegotiation')) {
      document.getElementById('metricNegotiation').textContent = s.in_negotiation || 0;
    }
    if (document.getElementById('metricPipelineValue')) {
      document.getElementById('metricPipelineValue').textContent = formatINR(s.total_pipeline_value || 0);
    }

    // Render Source Breakdown Progress Bars
    renderSourceMetrics(res.source_breakdown || []);
  } catch (err) {
    console.error('Error loading enquiry metrics:', err);
  }
}

function renderSourceMetrics(sources = []) {
  const container = document.getElementById('sourceMetricsContainer');
  if (!container) return;

  if (sources.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.8rem;">No source activity recorded for this period.</p>';
    return;
  }

  const sourceIconMap = {
    WEBSITE: '🌐',
    CALL: '📞',
    GMB: '📍',
    ADS: '📢',
    MARKETING_PERSON: '👤',
    OTHER: '⚡'
  };

  container.innerHTML = sources.map(s => {
    const icon = sourceIconMap[s.source_key] || '🔹';
    return `
      <div class="source-metric-item">
        <div class="source-header">
          <div class="source-title">
            <span class="source-icon">${icon}</span>
            <strong>${escapeAttr(s.label)}</strong>
          </div>
          <div class="source-stats">
            <span class="source-count">${s.total} Leads</span>
            <span class="source-converted text-success">(${s.onboarded} Won &bull; ${s.conversion_rate}%)</span>
          </div>
        </div>
        <div class="source-progress-track">
          <div class="source-progress-bar" style="width: ${Math.min(100, Math.max(8, s.share_of_total))}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// --- ENQUIRIES TABLE LOADER ---
async function loadEnquiries() {
  const tbody = document.getElementById('enquiriesTableBody');
  if (!tbody) return;

  const search = document.getElementById('filterEnquirySearch')?.value || '';
  const status = document.getElementById('filterEnquiryStatus')?.value || '';
  const source = document.getElementById('filterEnquirySource')?.value || '';

  try {
    tbody.innerHTML = renderTableLoader(8, 'Loading enquiries & leads...');

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (source) params.append('source', source);
    params.append('time_filter', activePeriod);

    if (activePeriod === 'custom') {
      const fromVal = document.getElementById('filterCustomFrom')?.value || '';
      const toVal = document.getElementById('filterCustomTo')?.value || '';
      if (fromVal) params.append('from_date', fromVal);
      if (toVal) params.append('to_date', toVal);
    }

    const res = await apiFetch('/enquiries?' + params.toString());

    if (!res || !res.enquiries || res.enquiries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding: 2.5rem 1rem;">
            <div style="color:var(--text-muted); font-size:0.9rem;">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.5rem; opacity:0.6;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <div>No enquiries found matching your filter criteria.</div>
              <button type="button" onclick="openNewEnquiryModal()" class="btn btn-primary btn-sm" style="margin-top:0.75rem;">+ Add New Enquiry</button>
            </div>
          </td>
        </tr>
      `;
      currentEnquiries = [];
      return;
    }

    currentEnquiries = res.enquiries;

    tbody.innerHTML = currentEnquiries.map(enq => {
      const statusBadge = getEnquiryStatusBadge(enq.status);
      const sourceBadge = getEnquirySourceBadge(enq.source, enq.marketing_person);
      const budgetFormatted = parseFloat(enq.estimated_budget || 0) > 0 ? formatINR(enq.estimated_budget) : '<span class="text-muted">-</span>';

      return `
        <tr>
          <td>
            <div style="font-weight:700; font-size:0.88rem; color:var(--text-main);">${formatDate(enq.created_at)}</div>
            <span style="font-size:0.72rem; color:var(--text-muted);">ID #${enq.id}</span>
          </td>
          <td>
            <strong><a href="enquiry-view.html?id=${enq.id}" style="color:var(--primary); font-size:0.92rem;">${escapeAttr(enq.name)}</a></strong>
            <div style="font-size:0.78rem; color:var(--text-muted); display:flex; align-items:center; gap:0.35rem; margin-top:2px;">
              <span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:2px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${escapeAttr(enq.mobile)}</span>
              ${enq.email ? `<span>&bull; <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:2px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>${escapeAttr(enq.email)}</span>` : ''}
            </div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-main); font-size:0.88rem;">${escapeAttr(enq.business_name)}</div>
            ${enq.services_interested ? `<div style="font-size:0.75rem; color:#475569; margin-top:2px;" title="${escapeAttr(enq.services_interested)}">${truncateStr(enq.services_interested, 30)}</div>` : ''}
          </td>
          <td>${sourceBadge}</td>
          <td><strong style="color:var(--text-main); font-size:0.88rem;">${budgetFormatted}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex; gap:0.3rem; align-items:center;">
              <a href="enquiry-view.html?id=${enq.id}" class="btn btn-secondary btn-sm" title="View History & Negotiation Details" style="padding:0.3rem 0.55rem; display:inline-flex; align-items:center; gap:0.25rem; font-weight:700; text-decoration:none;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </a>
              <button type="button" class="btn btn-secondary btn-sm" onclick="openEditEnquiryModal(${enq.id})" title="Edit Enquiry" style="padding:0.3rem 0.45rem;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="handleCreateQuotationFromEnquiry(${enq.id})" title="Create Quotation" style="padding:0.3rem 0.45rem; color:#0284c7; border-color:#bae6fd;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4z"/></svg>
              </button>
              ${enq.status !== 'ONBOARDED' ? `
                <button type="button" class="btn btn-primary btn-sm" onclick="handleConvertToClient(${enq.id}, '${escapeAttr(enq.business_name)}')" title="Convert to Onboarded Client Master" style="background:linear-gradient(135deg, #16a34a, #15803d); border:none; padding:0.3rem 0.6rem; font-size:0.75rem; display:inline-flex; align-items:center; gap:0.25rem;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Onboard
                </button>
              ` : `
                <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.7rem; padding:0.25rem 0.5rem; font-weight:700;">Won</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-danger" style="padding:2rem;">Error loading enquiries: ${err.message}</td></tr>`;
  }
}

// --- BADGE RENDERERS ---
function getEnquiryStatusBadge(status) {
  switch (status) {
    case 'NEW':
      return '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700; border:1px solid #bae6fd;">NEW</span>';
    case 'IN_DISCUSSION':
      return '<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700; border:1px solid #fde68a;">DISCUSSION</span>';
    case 'QUOTATION_SENT':
      return '<span class="badge" style="background:#ede9fe; color:#6d28d9; font-weight:700; border:1px solid #ddd6fe;">QUO SENT</span>';
    case 'NEGOTIATION':
      return '<span class="badge" style="background:#fff7ed; color:#c2410c; font-weight:700; border:1px solid #ffedd5;">NEGOTIATION</span>';
    case 'ONBOARDED':
      return '<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800; border:1px solid #86efac;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:text-bottom; margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>ONBOARDED</span>';
    case 'LOST':
      return '<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700; border:1px solid #fecaca;">LOST</span>';
    default:
      return `<span class="badge badge-issued">${status}</span>`;
  }
}

function getEnquirySourceBadge(source, marketingPerson = '') {
  switch (source) {
    case 'WEBSITE':
      return `<span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Website</span>`;
    case 'CALL':
      return `<span class="badge" style="background:#f0fdf4; color:#15803d; font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Phone Call</span>`;
    case 'GMB':
      return `<span class="badge" style="background:#fefce8; color:#a16207; font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>GMB Listing</span>`;
    case 'ADS':
      return `<span class="badge" style="background:#fdf2f8; color:#be185d; font-weight:700;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Paid Ads</span>`;
    case 'MARKETING_PERSON':
      return `<span class="badge" style="background:#faf5ff; color:#7e22ce; font-weight:700;" title="${escapeAttr(marketingPerson)}"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Rep: ${escapeAttr(marketingPerson || 'Field Rep')}</span>`;
    default:
      return `<span class="badge" style="background:#f1f5f9; color:#475569;">${source || 'Direct'}</span>`;
  }
}

// --- ADD NEW ENQUIRY MODAL ---
function openNewEnquiryModal() {
  const form = document.getElementById('newEnquiryForm');
  if (form) form.reset();

  document.getElementById('newEnqSource').value = 'WEBSITE';
  toggleMarketingPersonField('newEnqSource', 'newEnqRepContainer');
  document.getElementById('newEnquiryModal').classList.add('active');
}

function closeNewEnquiryModal() {
  document.getElementById('newEnquiryModal').classList.remove('active');
}

function toggleMarketingPersonField(sourceSelectId, repContainerId) {
  const select = document.getElementById(sourceSelectId);
  const container = document.getElementById(repContainerId);
  if (!select || !container) return;

  if (select.value === 'MARKETING_PERSON') {
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

async function submitNewEnquiry(e) {
  e.preventDefault();

  const name = document.getElementById('newEnqName').value.trim();
  const mobile = document.getElementById('newEnqMobile').value.trim();
  const email = document.getElementById('newEnqEmail').value.trim();
  const business_name = document.getElementById('newEnqBusiness').value.trim();
  const source = document.getElementById('newEnqSource').value;
  const marketing_person = document.getElementById('newEnqMarketingPerson')?.value.trim() || '';
  const services_interested = document.getElementById('newEnqServices').value.trim();
  const estimated_budget = parseFloat(document.getElementById('newEnqBudget').value) || 0;
  const status = document.getElementById('newEnqStatus').value;
  const notes = document.getElementById('newEnqNotes').value.trim();

  if (!name || !mobile || !business_name) {
    showToast('Please fill all required fields: Name, Mobile, and Business Name.', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitNewEnquiry');
  btn.disabled = true;
  btn.textContent = 'Saving Enquiry...';

  try {
    const res = await apiFetch('/enquiries', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        mobile,
        business_name,
        source,
        marketing_person,
        services_interested,
        estimated_budget,
        status,
        notes
      })
    });

    closeNewEnquiryModal();
    showToast('✓ Lead / Enquiry created successfully!', 'success');
    loadEnquiryMetrics();
    loadEnquiries();
  } catch (err) {
    showToast('Failed to create enquiry: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save & Track Enquiry';
  }
}

// --- VIEW ENQUIRY (NAVIGATE TO NESTED PAGE) ---
function openViewEnquiryModal(id) {
  window.location.href = `enquiry-view.html?id=${id}`;
}

function renderTimelineItem(item) {
  let badgeColor = '#64748b';
  let badgeBg = '#f1f5f9';
  let icon = '📝';

  switch (item.event_type) {
    case 'NEGOTIATION':
      badgeColor = '#c2410c'; badgeBg = '#ffedd5'; icon = '🤝'; break;
    case 'CALL':
      badgeColor = '#0369a1'; badgeBg = '#e0f2fe'; icon = '📞'; break;
    case 'QUOTATION':
      badgeColor = '#6d28d9'; badgeBg = '#ede9fe'; icon = '📄'; break;
    case 'STATUS_CHANGE':
      badgeColor = '#92400e'; badgeBg = '#fef3c7'; icon = '🔄'; break;
    case 'ONBOARDED':
      badgeColor = '#15803d'; badgeBg = '#dcfce7'; icon = '🎉'; break;
    default:
      badgeColor = '#475569'; badgeBg = '#f1f5f9'; icon = '📝'; break;
  }

  return `
    <div class="timeline-item">
      <div class="timeline-dot" style="background:${badgeBg}; color:${badgeColor}; border-color:${badgeColor};">
        ${icon}
      </div>
      <div class="timeline-body">
        <div class="timeline-header">
          <div>
            <strong style="color:var(--text-main); font-size:0.88rem;">${escapeAttr(item.title)}</strong>
            <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-size:0.65rem; padding:0.1rem 0.35rem; margin-left:0.35rem; font-weight:700;">${item.event_type}</span>
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${formatDate(item.created_at)}</span>
        </div>
        ${item.details ? `<p style="margin:0.25rem 0 0 0; font-size:0.82rem; color:#334155; line-height:1.4;">${escapeAttr(item.details)}</p>` : ''}
        <div style="font-size:0.7rem; color:#94a3b8; margin-top:0.25rem;">Logged by ${escapeAttr(item.created_by_name || 'Admin')}</div>
      </div>
    </div>
  `;
}

function closeViewEnquiryModal() {
  document.getElementById('viewEnquiryModal').classList.remove('active');
}

async function submitTimelineNote(e, enquiryId) {
  e.preventDefault();

  const event_type = document.getElementById('timelineEventType').value;
  const title = document.getElementById('timelineEventTitle').value.trim();
  const details = document.getElementById('timelineEventDetails').value.trim();

  if (!title) {
    showToast('Please enter a note title/summary.', 'error');
    return;
  }

  const btn = document.getElementById('btnAddTimelineEventBtn');
  btn.disabled = true;

  try {
    await apiFetch(`/enquiries/${enquiryId}/timeline`, {
      method: 'POST',
      body: JSON.stringify({ event_type, title, details })
    });

    showToast('✓ Interaction note added to history.', 'success');
    openViewEnquiryModal(enquiryId);
    loadEnquiries();
    loadEnquiryMetrics();
  } catch (err) {
    showToast('Failed to add note: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// --- EDIT ENQUIRY MODAL ---
async function openEditEnquiryModal(id) {
  try {
    const res = await apiFetch(`/enquiries/${id}`);
    if (!res || !res.success || !res.enquiry) {
      showToast('Enquiry not found', 'error');
      return;
    }

    const enq = res.enquiry;
    document.getElementById('editEnqId').value = enq.id;
    document.getElementById('editEnqName').value = enq.name;
    document.getElementById('editEnqMobile').value = enq.mobile;
    document.getElementById('editEnqEmail').value = enq.email || '';
    document.getElementById('editEnqBusiness').value = enq.business_name;
    document.getElementById('editEnqSource').value = enq.source || 'WEBSITE';
    document.getElementById('editEnqMarketingPerson').value = enq.marketing_person || '';
    document.getElementById('editEnqServices').value = enq.services_interested || '';
    document.getElementById('editEnqBudget').value = enq.estimated_budget || 0;
    document.getElementById('editEnqStatus').value = enq.status || 'NEW';
    document.getElementById('editEnqNotes').value = enq.notes || '';

    toggleMarketingPersonField('editEnqSource', 'editEnqRepContainer');
    document.getElementById('editEnquiryModal').classList.add('active');
  } catch (err) {
    showToast('Error loading enquiry: ' + err.message, 'error');
  }
}

function closeEditEnquiryModal() {
  document.getElementById('editEnquiryModal').classList.remove('active');
}

async function submitEditEnquiry(e) {
  e.preventDefault();

  const id = document.getElementById('editEnqId').value;
  const name = document.getElementById('editEnqName').value.trim();
  const mobile = document.getElementById('editEnqMobile').value.trim();
  const email = document.getElementById('editEnqEmail').value.trim();
  const business_name = document.getElementById('editEnqBusiness').value.trim();
  const source = document.getElementById('editEnqSource').value;
  const marketing_person = document.getElementById('editEnqMarketingPerson')?.value.trim() || '';
  const services_interested = document.getElementById('editEnqServices').value.trim();
  const estimated_budget = parseFloat(document.getElementById('editEnqBudget').value) || 0;
  const status = document.getElementById('editEnqStatus').value;
  const notes = document.getElementById('editEnqNotes').value.trim();

  const btn = document.getElementById('btnSubmitEditEnquiry');
  btn.disabled = true;
  btn.textContent = 'Updating...';

  try {
    await apiFetch(`/enquiries/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        email,
        mobile,
        business_name,
        source,
        marketing_person,
        services_interested,
        estimated_budget,
        status,
        notes
      })
    });

    closeEditEnquiryModal();
    showToast('✓ Enquiry updated successfully!', 'success');
    loadEnquiryMetrics();
    loadEnquiries();
  } catch (err) {
    showToast('Failed to update enquiry: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

// --- 1-CLICK CONVERT TO ONBOARDED CLIENT ---
async function handleConvertToClient(enquiryId, businessName) {
  if (!confirm(`Are you sure you want to onboard "${businessName}" into Client Master? This will create a permanent client record and mark the lead as ONBOARDED.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/enquiries/${enquiryId}/convert`, {
      method: 'POST'
    });

    showToast(`✓ "${businessName}" successfully converted to Client Master!`, 'success');
    loadEnquiryMetrics();
    loadEnquiries();

    if (document.getElementById('viewEnquiryModal').classList.contains('active')) {
      openViewEnquiryModal(enquiryId);
    }
  } catch (err) {
    showToast('Failed to onboard client: ' + err.message, 'error');
  }
}

// --- CREATE QUOTATION SHORTCUT ---
function handleCreateQuotationFromEnquiry(enquiryId) {
  const enq = currentEnquiries.find(e => e.id === enquiryId) || currentEnquiryData;
  if (!enq) {
    window.location.href = 'quotations.html';
    return;
  }

  // Store prefill information in sessionStorage for quotations page
  sessionStorage.setItem('dgrow_quote_prefill', JSON.stringify({
    enquiry_id: enq.id,
    client_name: enq.name,
    business_name: enq.business_name,
    email: enq.email,
    mobile: enq.mobile,
    services: enq.services_interested,
    budget: enq.estimated_budget
  }));

  window.location.href = `quotations.html?enquiry_id=${enq.id}&open_create=1`;
}

// --- UTILITIES ---
function truncateStr(str, max = 30) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '...' : str;
}
