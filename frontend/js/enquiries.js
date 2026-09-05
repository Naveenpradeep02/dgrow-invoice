// Enquiries & Lead Management Controller

let currentEnquiries = [];
let activePeriod = 'monthly';
let currentEnquiryData = null;
let cachedMarketersList = [];

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('enquiriesTableBody')) {
    initEnquiriesPage();
  }
});

async function initEnquiriesPage() {
  // Set default custom date pickers
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const fromEl = document.getElementById('filterCustomFrom');
  const toEl = document.getElementById('filterCustomTo');
  if (fromEl) fromEl.value = thirtyDaysAgo.toISOString().split('T')[0];
  if (toEl) toEl.value = today.toISOString().split('T')[0];

  await loadMarketersList();
  loadEnquiryMetrics();
  loadEnquiries();
}

async function loadMarketersList() {
  try {
    const res = await apiFetch('/auth/users');
    if (res && res.success && Array.isArray(res.users)) {
      cachedMarketersList = res.users.filter(u => 
        u.role === 'MARKETING' || 
        u.role_id === 4 || 
        String(u.role).toUpperCase() === 'MARKETING' ||
        (typeof isMarketingRole === 'function' && isMarketingRole(u.role))
      );

      // 1. Populate Table Filter Dropdown
      const filterSelect = document.getElementById('filterEnquiryMarketer');
      if (filterSelect) {
        const currVal = filterSelect.value || 'ALL';
        filterSelect.innerHTML = '<option value="ALL">All Marketers</option>' +
          '<option value="unassigned">Direct / Unassigned</option>' +
          cachedMarketersList.map(m => `<option value="${m.id}">Marketer: ${escapeHtml(m.name)}</option>`).join('');
        filterSelect.value = currVal;
      }

      // 2. Populate 1-Click Modal Dropdown
      const modalSelect = document.getElementById('modalEnquiryMarketerSelect');
      if (modalSelect) {
        modalSelect.innerHTML = '<option value="">-- Unassigned (Direct / No Field Rep Assigned) --</option>' +
          cachedMarketersList.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('');
      }

      // 3. Populate Add Modal Dropdown
      const newSelect = document.getElementById('newEnqAssignedTo');
      if (newSelect) {
        newSelect.innerHTML = '<option value="">-- Unassigned (Direct / No Field Rep Assigned) --</option>' +
          cachedMarketersList.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('');
      }

      // 4. Populate Edit Modal Dropdown
      const editSelect = document.getElementById('editEnqAssignedTo');
      if (editSelect) {
        editSelect.innerHTML = '<option value="">-- Unassigned (Direct / No Field Rep Assigned) --</option>' +
          cachedMarketersList.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('');
      }
    }
  } catch (err) {
    console.warn('Could not load marketers list for enquiry assignment:', err);
  }
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
    container.innerHTML = '<p class="text-muted" style="font-size:0.8rem; padding:0.5rem 0;">No source activity recorded for this period.</p>';
    return;
  }

  const channelConfig = {
    WEBSITE: {
      name: 'Websites',
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd'
    },
    CALL: {
      name: 'Phone Call',
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0'
    },
    GMB: {
      name: 'Google My Business',
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a'
    },
    ADS: {
      name: 'Paid Ads',
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
      color: '#db2777',
      bg: '#fdf2f8',
      border: '#fbcfe8'
    },
    MARKETING_PERSON: {
      name: 'Marketing Person',
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      color: '#7c3aed',
      bg: '#faf5ff',
      border: '#e9d5ff'
    },
    REFERRAL: {
      name: 'Referral',
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"/><path d="M10 12l2 2 4-4"/></svg>`,
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a'
    },
    OTHER: {
      name: 'Other Sources',
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      color: '#ea580c',
      bg: '#fff7ed',
      border: '#fed7aa'
    }
  };

  const arcLength = 113.1; // pi * R (R = 36)

  container.innerHTML = sources.map(s => {
    const cfg = channelConfig[s.source_key] || channelConfig.OTHER;
    const convRate = parseFloat(s.conversion_rate) || 0;
    const leadsCount = parseInt(s.total) || 0;
    const wonCount = parseInt(s.onboarded) || 0;
    
    // Calculate SVG semi-circle dashoffset (from 113.1 at 0% to 0 at 100%)
    const offset = arcLength - (arcLength * Math.min(100, Math.max(0, convRate)) / 100);
    const gaugeColor = convRate > 0 ? (convRate >= 50 ? '#15803d' : cfg.color) : '#cbd5e1';

    return `
      <div class="source-gauge-card" style="border-top: 3.5px solid ${cfg.color};">
        <div class="source-card-top">
          <div class="source-icon-badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border};">
            ${cfg.icon}
          </div>
          <span class="source-card-title" title="${escapeAttr(s.label || cfg.name)}">${escapeAttr(s.label || cfg.name)}</span>
        </div>

        <!-- Semi-Circular Arch Gauge Speedometer -->
        <div class="source-gauge-container" title="Conversion Rate: ${convRate}% (${wonCount}/${leadsCount} Won)">
          <svg width="100" height="54" viewBox="0 0 100 54" style="display:block; overflow:visible;">
            <defs>
              <pattern id="gaugeHatch_${s.source_key}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4" stroke="#cbd5e1" stroke-width="1.2" />
              </pattern>
            </defs>

            <!-- Background Track with Hatch / Diagonal Pattern -->
            <path d="M 14 46 A 36 36 0 0 1 86 46" fill="none" stroke="#f1f5f9" stroke-width="9" stroke-linecap="round" />
            <path d="M 14 46 A 36 36 0 0 1 86 46" fill="none" stroke="url(#gaugeHatch_${s.source_key})" stroke-width="8" stroke-linecap="round" opacity="0.65" />

            <!-- Active Colored Gauge Arc -->
            <path d="M 14 46 A 36 36 0 0 1 86 46" fill="none" stroke="${gaugeColor}" stroke-width="9" stroke-linecap="round"
              stroke-dasharray="${arcLength}"
              stroke-dashoffset="${offset}"
              style="transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);" />

            <!-- Percentage Value Inside Arch -->
            <text x="50" y="36" text-anchor="middle" font-size="14" font-weight="900" fill="#0f172a" font-family="system-ui, -apple-system, sans-serif">${Math.round(convRate)}%</text>

            <!-- Subtitle Label -->
            <text x="50" y="47" text-anchor="middle" font-size="6.5" font-weight="700" fill="#64748b" font-family="system-ui, -apple-system, sans-serif">Won Rate</text>
          </svg>
        </div>

        <!-- Footer Stats Bar -->
        <div class="source-card-footer">
          <span class="source-footer-lead">${leadsCount} <small>${leadsCount === 1 ? 'Lead' : 'Leads'}</small></span>
          <span class="source-footer-won" style="color: ${wonCount > 0 ? '#15803d' : '#64748b'};">
            ${wonCount > 0 ? `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:1px;"><polyline points="20 6 9 17 4 12"/></svg>` : ''}${wonCount} Won
          </span>
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
  const marketer = document.getElementById('filterEnquiryMarketer')?.value || 'ALL';

  const user = typeof getUser === 'function' ? getUser() : null;
  const isAdmin = user && user.role === 'ADMIN';

  try {
    tbody.innerHTML = renderTableLoader(8, 'Loading enquiries & leads...');

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (source) params.append('source', source);
    if (marketer && marketer !== 'ALL') params.append('assigned_to', marketer);
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

      const assignedMarketer = enq.assigned_to ? (enq.assigned_marketer_name || 'Assigned Marketer') : null;
      let assignedBadge = '';
      if (assignedMarketer) {
        assignedBadge = `
          <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
            <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700; border:1px solid #bfdbfe; font-size:0.75rem; display:inline-flex; align-items:center; gap:3px;">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${escapeHtml(assignedMarketer)}
            </span>
            ${isAdmin ? `
              <button type="button" onclick="openAssignEnquiryModal(${enq.id})" class="btn btn-secondary btn-sm" title="Reassign Marketing Employee" style="padding:0.12rem 0.4rem; font-size:0.68rem; color:#0369a1; border-color:#bae6fd; background:#f0f9ff; margin-top:2px; display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                Reassign
              </button>
            ` : ''}
          </div>
        `;
      } else {
        assignedBadge = `
          <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
            <span class="badge" style="background:#f8fafc; color:#94a3b8; font-weight:600; border:1px solid #e2e8f0; font-size:0.72rem;">
              Unassigned
            </span>
            ${isAdmin ? `
              <button type="button" onclick="openAssignEnquiryModal(${enq.id})" class="btn btn-secondary btn-sm" title="Assign Marketing Employee" style="padding:0.12rem 0.45rem; font-size:0.68rem; color:#2563eb; border-color:#bfdbfe; background:#eff6ff; font-weight:700; margin-top:2px; display:inline-flex; align-items:center; gap:2px; cursor:pointer;">
                + Assign
              </button>
            ` : ''}
          </div>
        `;
      }

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
          <td>${assignedBadge}</td>
          <td><strong style="color:var(--text-main); font-size:0.88rem;">${budgetFormatted}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex; gap:0.3rem; align-items:center;">
              <a href="enquiry-view.html?id=${enq.id}" class="btn btn-secondary btn-sm" title="View History & Negotiation Details" style="padding:0.3rem 0.55rem; display:inline-flex; align-items:center; gap:0.25rem; font-weight:700; text-decoration:none;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </a>
              ${isAdmin ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="openAssignEnquiryModal(${enq.id})" title="Assign / Reassign Marketer" style="padding:0.3rem 0.45rem; color:#2563eb; border-color:#bfdbfe; background:#eff6ff;">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                </button>
              ` : ''}
              <button type="button" class="btn btn-secondary btn-sm" onclick="openEditEnquiryModal(${enq.id})" title="Edit Enquiry" style="padding:0.3rem 0.45rem;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
              ${isAdmin ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="handleDeleteEnquiry(${enq.id}, '${escapeAttr(enq.name)}')" title="Remove / Delete Enquiry" style="padding:0.3rem 0.45rem; color:#dc2626; border-color:#fecaca; background:#fffbfb;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fffbfb'">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              ` : ''}
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
    case 'REFERRAL':
      return `<span class="badge" style="background:#fefce8; color:#a16207; font-weight:700; border:1px solid #fef08a;" title="${escapeAttr(marketingPerson)}"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"/><path d="M10 12l2 2 4-4"/></svg>Ref: ${escapeAttr(marketingPerson || 'Referral')}</span>`;
    default:
      return `<span class="badge" style="background:#f1f5f9; color:#475569;">${source || 'Direct'}</span>`;
  }
}

// --- ADD NEW ENQUIRY MODAL ---
function openNewEnquiryModal() {
  const form = document.getElementById('newEnquiryForm');
  if (form) form.reset();

  const user = typeof getUser === 'function' ? getUser() : null;
  const isMarketing = user && user.role === 'MARKETING';

  const assignedSelect = document.getElementById('newEnqAssignedTo');
  if (assignedSelect) {
    if (isMarketing) {
      assignedSelect.value = String(user.id || '');
      assignedSelect.disabled = true;
    } else {
      assignedSelect.value = '';
      assignedSelect.disabled = false;
    }
  }

  if (isMarketing) {
    document.getElementById('newEnqSource').value = 'MARKETING_PERSON';
    toggleMarketingPersonField('newEnqSource', 'newEnqRepContainer');
    const mktInput = document.getElementById('newEnqMarketingPerson');
    if (mktInput) {
      mktInput.value = user.name || '';
      mktInput.readOnly = true;
      mktInput.style.background = '#f1f5f9';
    }
  } else {
    document.getElementById('newEnqSource').value = 'WEBSITE';
    toggleMarketingPersonField('newEnqSource', 'newEnqRepContainer');
    const mktInput = document.getElementById('newEnqMarketingPerson');
    if (mktInput) {
      mktInput.readOnly = false;
      mktInput.style.background = '';
    }
  }
  document.getElementById('newEnquiryModal').classList.add('active');
}

function closeNewEnquiryModal() {
  document.getElementById('newEnquiryModal').classList.remove('active');
}

function toggleMarketingPersonField(sourceSelectId, repContainerId) {
  const select = document.getElementById(sourceSelectId);
  const container = document.getElementById(repContainerId);
  if (!select || !container) return;

  const labelEl = container.querySelector('label') || container.querySelector('.form-label');
  const inputEl = container.querySelector('input');

  if (select.value === 'MARKETING_PERSON') {
    container.style.display = 'block';
    container.style.background = '#faf5ff';
    container.style.borderColor = '#e9d5ff';
    if (labelEl) {
      labelEl.textContent = 'Marketing Person / Executive Name *';
      labelEl.style.color = '#6b21a8';
    }
    if (inputEl) inputEl.placeholder = 'e.g. Vimal (Field Executive) or Rahul';
  } else if (select.value === 'REFERRAL') {
    container.style.display = 'block';
    container.style.background = '#fefce8';
    container.style.borderColor = '#fef08a';
    if (labelEl) {
      labelEl.textContent = 'Referral Person / Referred By Name *';
      labelEl.style.color = '#a16207';
    }
    if (inputEl) inputEl.placeholder = 'e.g. Anand Kumar, Dr. Rajesh, Client XYZ';
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
  const assigned_to = document.getElementById('newEnqAssignedTo')?.value ? parseInt(document.getElementById('newEnqAssignedTo').value, 10) : null;
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
        assigned_to,
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
  let iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

  switch (item.event_type) {
    case 'NEGOTIATION':
      badgeColor = '#c2410c'; badgeBg = '#ffedd5'; 
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
      break;
    case 'CALL':
      badgeColor = '#0369a1'; badgeBg = '#e0f2fe'; 
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
      break;
    case 'QUOTATION':
      badgeColor = '#6d28d9'; badgeBg = '#ede9fe'; 
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
      break;
    case 'STATUS_CHANGE':
      badgeColor = '#92400e'; badgeBg = '#fef3c7'; 
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      break;
    case 'ONBOARDED':
      badgeColor = '#15803d'; badgeBg = '#dcfce7'; 
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>';
      break;
    default:
      badgeColor = '#475569'; badgeBg = '#f1f5f9'; 
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      break;
  }

  return `
    <div class="timeline-item">
      <div class="timeline-dot" style="background:${badgeBg}; color:${badgeColor}; border-color:${badgeColor}; display:flex; align-items:center; justify-content:center;">
        ${iconSvg}
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

    const editAssigned = document.getElementById('editEnqAssignedTo');
    if (editAssigned) {
      editAssigned.value = enq.assigned_to ? String(enq.assigned_to) : '';
    }

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
  const assigned_to = document.getElementById('editEnqAssignedTo')?.value ? parseInt(document.getElementById('editEnqAssignedTo').value, 10) : null;
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
        assigned_to,
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

// --- 1-CLICK ASSIGN ENQUIRY MODAL (ADMIN ONLY) ---
function openAssignEnquiryModal(enquiryId, optionalBusinessName, optionalMarketerId) {
  const modal = document.getElementById('assignEnquiryModal');
  if (!modal) return;

  const enq = currentEnquiries.find(e => String(e.id) === String(enquiryId));
  const businessName = optionalBusinessName || (enq ? (enq.business_name || enq.name) : `Enquiry #${enquiryId}`);
  const currentMarketerId = (optionalMarketerId !== undefined && optionalMarketerId !== null)
    ? optionalMarketerId
    : (enq ? enq.assigned_to : null);

  const idInput = document.getElementById('modalEnquiryId');
  if (idInput) idInput.value = enquiryId;

  const nameEl = document.getElementById('modalEnquiryBusinessName');
  if (nameEl) nameEl.textContent = businessName;

  const select = document.getElementById('modalEnquiryMarketerSelect');
  if (select) {
    select.value = currentMarketerId ? String(currentMarketerId) : '';
  }

  modal.classList.add('active');
}

function closeAssignEnquiryModal() {
  const modal = document.getElementById('assignEnquiryModal');
  if (modal) modal.classList.remove('active');
}

async function submitEnquiryAssignment() {
  const enquiryId = document.getElementById('modalEnquiryId').value;
  const marketerId = document.getElementById('modalEnquiryMarketerSelect').value;
  const btn = document.getElementById('btnSaveEnquiryAssignment');

  if (!enquiryId) return;

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const res = await apiFetch(`/enquiries/${enquiryId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({
        assigned_to: marketerId ? parseInt(marketerId, 10) : null,
        marketer_id: marketerId ? parseInt(marketerId, 10) : null
      })
    });

    if (!res.success) throw new Error(res.message || 'Failed to update assignment.');

    showToast(res.message, 'success');
    closeAssignEnquiryModal();
    loadEnquiryMetrics();
    loadEnquiries();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save & Assign'; }
  }
}

window.openAssignEnquiryModal = openAssignEnquiryModal;
window.closeAssignEnquiryModal = closeAssignEnquiryModal;
window.submitEnquiryAssignment = submitEnquiryAssignment;

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

// --- DELETE / REMOVE ENQUIRY ---
async function handleDeleteEnquiry(id, name) {
  const displayName = name || `Enquiry #${id}`;
  if (!confirm(`Are you sure you want to remove / delete enquiry for "${displayName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/enquiries/${id}`, {
      method: 'DELETE'
    });

    if (res && res.success) {
      showToast(`✓ Enquiry for "${displayName}" removed successfully!`, 'success');
    } else {
      showToast(res?.message || 'Enquiry removed.', 'success');
    }
    loadEnquiryMetrics();
    loadEnquiries();
  } catch (err) {
    showToast('Failed to delete enquiry: ' + err.message, 'error');
  }
}
window.handleDeleteEnquiry = handleDeleteEnquiry;
