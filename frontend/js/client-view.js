// Client 360° Profile, History & Financials Hub Controller (Vector Icons & Clean Theme)

let clientData = null;
let currentTab = 'INVOICES';

const SVG = {
  BILLED: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#0284c7" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  PAID: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  PENDING: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ea580c" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  ADS: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#9333ea" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  MEETING: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#0891b2" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  CALL: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#0284c7" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  QUOTE: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#7e22ce" stroke-width="2"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4z"/></svg>`,
  USER: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  CHECK: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:text-bottom; margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('id');

  if (!clientId) {
    document.getElementById('client360Content').innerHTML = `
      <div class="card" style="padding:2rem; text-align:center;">
        <h3 style="color:#dc2626;">Missing Client ID</h3>
        <p style="color:#64748b; margin-bottom:1rem;">Please select a client from Clients Master to view the profile.</p>
        <a href="clients.html" class="btn btn-primary">← Go to Clients Master</a>
      </div>
    `;
    return;
  }

  loadClient360Page(clientId);
});

async function loadClient360Page(id) {
  const container = document.getElementById('client360Content');
  if (!container) return;

  try {
    const res = await apiFetch(`/clients/${id}/360-history`);
    if (!res || !res.success || !res.client) {
      container.innerHTML = `
        <div class="card" style="padding:2rem; text-align:center;">
          <h3 style="color:#dc2626;">Client Not Found</h3>
          <p style="color:#64748b; margin-bottom:1rem;">The requested client record does not exist or has been deleted.</p>
          <a href="clients.html" class="btn btn-primary">← Go to Clients Master</a>
        </div>
      `;
      return;
    }

    clientData = res;
    const client = res.client;

    // Update document & breadcrumb title
    document.title = `${client.company_name} - 360° History - D-GROW`;
    const breadcrumb = document.getElementById('breadcrumbClientName');
    if (breadcrumb) {
      breadcrumb.textContent = `${client.company_name} (#${client.id})`;
    }

    renderClient360View(res);
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="padding:2rem; text-align:center; color:#dc2626;">
        <h3>Error Loading Client History</h3>
        <p>${escapeAttr(err.message)}</p>
        <a href="clients.html" class="btn btn-secondary" style="margin-top:1rem;">← Return to Clients Master</a>
      </div>
    `;
  }
}

function renderClient360View(data) {
  const container = document.getElementById('client360Content');
  const { 
    client = {}, 
    financials = { total_invoiced: 0, total_paid: 0, pending_dues: 0, invoices_count: 0, paid_count: 0, unpaid_count: 0, partial_count: 0 }, 
    ads_summary = { active_ads_count: 0, total_campaigns: 0, total_budget: 0, total_spent: 0, total_leads: 0 }, 
    invoices = [], 
    payments = [], 
    meetings = [], 
    ads = [], 
    call_logs: callLogs = [], 
    enquiries = [], 
    enquiry_timeline: enquiryTimeline = [] 
  } = data || {};

  const initials = getInitials(client.company_name || client.contact_person);

  container.innerHTML = `
    <!-- Top Hero Banner (Clean D-GROW White Theme) -->
    <div class="client-hero-card">
      <div class="hero-top-row">
        <!-- Client Profile -->
        <div class="hero-profile-left">
          <div class="hero-avatar">${initials}</div>
          <div>
            <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
              <h1 style="margin:0; font-size:1.35rem; font-weight:800; color:var(--text-main);">${escapeAttr(client.company_name)}</h1>
              <span class="badge ${client.status === 'ACTIVE' ? 'badge-paid' : 'badge-cancelled'}">${escapeAttr(client.status || 'ACTIVE')}</span>
              ${client.payment_terms_type === 'SPLIT' ? '<span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700;">Split Pay (Milestones)</span>' : '<span class="badge" style="background:#f1f5f9; color:#475569;">Single Pay</span>'}
            </div>
            <div class="hero-meta-strip">
              ${client.contact_person ? `<span class="hero-meta-item">${SVG.USER} <strong>${escapeAttr(client.contact_person)}</strong></span><span>&bull;</span>` : ''}
              <span class="hero-meta-item"><a href="tel:${escapeAttr(client.mobile)}">${SVG.CALL} ${escapeAttr(client.mobile)}</a></span>
              <span>&bull;</span>
              <span class="hero-meta-item"><a href="mailto:${escapeAttr(client.email)}"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> ${escapeAttr(client.email)}</a></span>
              ${client.gstin ? `<span>&bull;</span><span class="hero-meta-item">GSTIN: <code>${escapeAttr(client.gstin)}</code></span>` : ''}
              ${client.onboarding_date ? `<span>&bull;</span><span class="hero-meta-item"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Onboarded ${formatDate(client.onboarding_date)}</span>` : ''}
              <span>&bull;</span>
              <span class="hero-meta-item" style="color:#0f172a; font-weight:700;">
                Field Marketer: 
                <span class="badge" style="background:#ecfdf5; color:#065f46; font-weight:700; border:1px solid #a7f3d0; margin-left:4px;">
                  👤 ${escapeAttr(client.assigned_marketer_name || client.marketing_person || 'Direct / Unassigned')}
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- Edit Profile Link -->
        <a href="client-edit.html?id=${client.id}" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem; font-weight:700;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Profile
        </a>
      </div>

      <!-- 1-Click Action Toolbar -->
      <div class="hero-actions-toolbar">
        <button type="button" class="btn btn-secondary btn-sm" onclick="openScheduleMeetingModal()" style="color:#0891b2; border-color:#a5f3fc; background:#ecfeff; font-weight:700; display:inline-flex; align-items:center; gap:0.35rem;">
          ${SVG.MEETING} + Note Meeting
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="openClientCallModal()" style="color:#0284c7; border-color:#bae6fd; background:#f0f9ff; font-weight:700; display:inline-flex; align-items:center; gap:0.35rem;">
          ${SVG.CALL} + Log Call
        </button>
        <a href="create-invoice.html?client_id=${client.id}" class="btn btn-secondary btn-sm" style="color:#15803d; border-color:#bbf7d0; background:#f0fdf4; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:0.35rem;">
          ${SVG.BILLED} + Create Invoice
        </a>
        <button type="button" class="btn btn-secondary btn-sm" onclick="openAdCampaignModal()" style="color:#7e22ce; border-color:#e9d5ff; background:#faf5ff; font-weight:700; display:inline-flex; align-items:center; gap:0.35rem;">
          ${SVG.ADS} + Ad Campaign
        </button>
        <a href="quotations.html" class="btn btn-secondary btn-sm" style="color:#c2410c; border-color:#fed7aa; background:#fff7ed; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:0.35rem;">
          ${SVG.QUOTE} + Issue Quotation
        </a>
        ${(typeof getUser === 'function' && getUser() && getUser().role === 'ADMIN') ? `
          <button type="button" class="btn btn-secondary btn-sm" onclick="openAssignMarketerModalFromView()" style="color:#0369a1; border-color:#bae6fd; background:#f0f9ff; font-weight:700; display:inline-flex; align-items:center; gap:0.35rem;">
            👤 Reassign Marketer
          </button>
        ` : ''}
      </div>
    </div>

    <!-- 6-Metric Financial & Operational Summary Grid -->
    <div class="kpi-summary-grid">
      <!-- 1. Total Billed -->
      <div class="kpi-card billed">
        <div class="kpi-label">${SVG.BILLED} Total Billed</div>
        <div class="kpi-value">${formatINR(financials.total_invoiced)}</div>
        <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Across ${financials.invoices_count} invoices</div>
      </div>

      <!-- 2. Total Paid -->
      <div class="kpi-card paid">
        <div class="kpi-label" style="color:#15803d;">${SVG.PAID} Total Paid</div>
        <div class="kpi-value" style="color:#15803d;">${formatINR(financials.total_paid)}</div>
        <div style="font-size:0.72rem; color:#16a34a; margin-top:2px;">${financials.paid_count} fully paid</div>
      </div>

      <!-- 3. Pending Dues -->
      <div class="kpi-card pending">
        <div class="kpi-label" style="color:#c2410c;">${SVG.PENDING} Pending Dues</div>
        <div class="kpi-value" style="color:#ea580c;">${formatINR(financials.pending_dues)}</div>
        <div style="font-size:0.72rem; color:#c2410c; margin-top:2px;">${financials.unpaid_count + financials.partial_count} pending invoices</div>
      </div>

      <!-- 4. Active Ads Running -->
      <div class="kpi-card ads">
        <div class="kpi-label" style="color:#7e22ce;">${SVG.ADS} Ads Running</div>
        <div class="kpi-value" style="color:#7e22ce;">${ads_summary.active_ads_count} Active</div>
        <div style="font-size:0.72rem; color:#6b21a8; margin-top:2px;">Fund: ${formatINR(ads_summary.total_budget)}</div>
      </div>

      <!-- 5. Meetings Held -->
      <div class="kpi-card meetings">
        <div class="kpi-label" style="color:#0891b2;">${SVG.MEETING} Meetings</div>
        <div class="kpi-value">${meetings.length} Total</div>
        <div style="font-size:0.72rem; color:#0891b2; margin-top:2px;">${meetings.filter(m => m.status === 'DONE').length} completed</div>
      </div>

      <!-- 6. Calls Logged -->
      <div class="kpi-card calls">
        <div class="kpi-label">${SVG.CALL} Calls Logged</div>
        <div class="kpi-value">${callLogs.length} Calls</div>
        <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Interaction history</div>
      </div>
    </div>

    <!-- 360-Degree Tab Navigation Bar -->
    <div class="hub-tabs-bar">
      <button type="button" class="hub-tab-btn active" id="tabBtn_INVOICES" onclick="switch360Tab('INVOICES')">
        ${SVG.BILLED} Invoices & Payments <span class="tab-badge">${invoices.length}</span>
      </button>
      <button type="button" class="hub-tab-btn" id="tabBtn_ADS" onclick="switch360Tab('ADS')">
        ${SVG.ADS} Live Ads Campaigns <span class="tab-badge">${ads.length}</span>
      </button>
      <button type="button" class="hub-tab-btn" id="tabBtn_MEETINGS" onclick="switch360Tab('MEETINGS')">
        ${SVG.MEETING} Meetings & Minutes <span class="tab-badge">${meetings.length}</span>
      </button>
      <button type="button" class="hub-tab-btn" id="tabBtn_CALLS" onclick="switch360Tab('CALLS')">
        ${SVG.CALL} Manual Call Logs <span class="tab-badge">${callLogs.length}</span>
      </button>
      <button type="button" class="hub-tab-btn" id="tabBtn_ENQUIRIES" onclick="switch360Tab('ENQUIRIES')">
        ${SVG.QUOTE} Quotations & Scope <span class="tab-badge">${enquiries.length + enquiryTimeline.length}</span>
      </button>
      <button type="button" class="hub-tab-btn" id="tabBtn_TIMELINE" onclick="switch360Tab('TIMELINE')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Unified Timeline
      </button>
    </div>

    <!-- TAB 1: INVOICES & PAYMENTS -->
    <div class="tab-content-panel active" id="tabPanel_INVOICES">
      <div class="hub-card">
        <div class="hub-card-header">
          <h3 class="hub-card-title">${SVG.BILLED} Invoices & Payment Dues</h3>
          <a href="create-invoice.html?client_id=${client.id}" class="btn btn-primary btn-sm" style="font-weight:700;">+ Create New Invoice</a>
        </div>
        ${renderInvoicesTable(invoices, payments, client)}
      </div>
    </div>

    <!-- TAB 2: LIVE ADS MANAGEMENT -->
    <div class="tab-content-panel" id="tabPanel_ADS">
      <div class="hub-card">
        <div class="hub-card-header">
          <div>
            <h3 class="hub-card-title" style="color:#7e22ce;">${SVG.ADS} Active Ad Campaigns & Fund Management</h3>
            <span style="font-size:0.75rem; color:#64748b;">Track running campaigns, ad spend budget, spent funds & lead generation</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="openAdCampaignModal()" style="background:linear-gradient(135deg, #7e22ce, #6b21a8); border:none; font-weight:700;">
            + Add Live Campaign
          </button>
        </div>
        <div class="hub-card-body">
          ${renderAdsCampaignsList(ads, ads_summary)}
        </div>
      </div>
    </div>

    <!-- TAB 3: MEETINGS & MINUTES -->
    <div class="tab-content-panel" id="tabPanel_MEETINGS">
      <div class="hub-card">
        <div class="hub-card-header">
          <div>
            <h3 class="hub-card-title" style="color:#0891b2;">${SVG.MEETING} Meetings & Post-Meeting Decision Minutes</h3>
            <span style="font-size:0.75rem; color:#64748b;">Schedule online/offline meetings and record agreed minutes & next action items</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="openScheduleMeetingModal()" style="background:linear-gradient(135deg, #0891b2, #0e7490); border:none; font-weight:700;">
            + Note / Schedule Meeting
          </button>
        </div>
        <div class="hub-card-body">
          ${renderMeetingsList(meetings)}
        </div>
      </div>
    </div>

    <!-- TAB 4: MANUAL CALL LOGS -->
    <div class="tab-content-panel" id="tabPanel_CALLS">
      <div class="hub-card">
        <div class="hub-card-header">
          <div>
            <h3 class="hub-card-title" style="color:#0284c7;">${SVG.CALL} Manual Call Interactions & Notes</h3>
            <span style="font-size:0.75rem; color:#64748b;">Logged discussions, outcomes, durations & next callback dates</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="openClientCallModal()" style="background:linear-gradient(135deg, #0284c7, #0369a1); border:none; font-weight:700;">
            + Log New Call
          </button>
        </div>
        <div class="hub-card-body">
          ${renderCallLogsList(callLogs)}
        </div>
      </div>
    </div>

    <!-- TAB 5: QUOTATIONS & NEGOTIATIONS -->
    <div class="tab-content-panel" id="tabPanel_ENQUIRIES">
      <div class="hub-card">
        <div class="hub-card-header">
          <div>
            <h3 class="hub-card-title" style="color:#c2410c;">${SVG.QUOTE} Quotation Proposals & Price Negotiation History</h3>
            <span style="font-size:0.75rem; color:#64748b;">Initial lead scope, proposals, and negotiation rounds</span>
          </div>
          <a href="quotations.html" class="btn btn-secondary btn-sm" style="font-weight:700;">Open Quotations Module →</a>
        </div>
        <div class="hub-card-body">
          ${renderQuotationsAndNegotiations(enquiries, enquiryTimeline)}
        </div>
      </div>
    </div>

    <!-- TAB 6: UNIFIED TIMELINE -->
    <div class="tab-content-panel" id="tabPanel_TIMELINE">
      <div class="hub-card">
        <div class="hub-card-header">
          <h3 class="hub-card-title">⏳ Unified Chronological Touchpoint Audit</h3>
          <span style="font-size:0.75rem; color:#64748b;">Every interaction across the client lifecycle</span>
        </div>
        <div class="hub-card-body">
          ${renderUnifiedTimeline(data)}
        </div>
      </div>
    </div>
  `;
}

function switch360Tab(tabKey) {
  currentTab = tabKey;
  document.querySelectorAll('.hub-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content-panel').forEach(panel => panel.classList.remove('active'));

  const activeBtn = document.getElementById(`tabBtn_${tabKey}`);
  const activePanel = document.getElementById(`tabPanel_${tabKey}`);

  if (activeBtn) activeBtn.classList.add('active');
  if (activePanel) activePanel.classList.add('active');
}

function renderInvoicesTable(invoices = [], payments = [], client = {}) {
  if (invoices.length === 0) {
    return `
      <div style="padding:3rem 1.5rem; text-align:center; color:#94a3b8;">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.5rem; opacity:0.6;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <div style="font-weight:600; font-size:0.9rem; color:#64748b;">No invoices generated for this client yet.</div>
        <a href="create-invoice.html?client_id=${client.id}" class="btn btn-primary btn-sm" style="margin-top:0.75rem; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:0.25rem;">+ Create First Invoice</a>
      </div>
    `;
  }

  return `
    <div class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th style="padding-left:1.35rem;">Invoice #</th>
            <th>Invoice Date</th>
            <th>Due Date</th>
            <th>Total Amount</th>
            <th>Paid Amount</th>
            <th>Balance Due</th>
            <th>Status</th>
            <th style="text-align:right; padding-right:1.35rem;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(inv => {
            const total = parseFloat(inv.total_amount || 0);
            const paid = inv.status === 'PAID' ? total : (parseFloat(inv.paid_amount || 0));
            const bal = Math.max(0, total - paid);

            let statusBadge = '';
            if (inv.status === 'PAID') {
              statusBadge = '<span class="badge badge-paid">Paid</span>';
            } else if (inv.status === 'PARTIAL') {
              statusBadge = '<span class="badge badge-partial">Partial Pay</span>';
            } else {
              statusBadge = '<span class="badge badge-cancelled">Pending</span>';
            }

            return `
              <tr>
                <td style="padding-left:1.35rem;">
                  <strong style="font-family:monospace; font-size:0.92rem; color:var(--text-main);">${escapeAttr(inv.invoice_number)}</strong>
                </td>
                <td>${formatDate(inv.invoice_date)}</td>
                <td>${formatDate(inv.due_date)}</td>
                <td><strong>${formatINR(total)}</strong></td>
                <td style="color:#15803d; font-weight:700;">${formatINR(paid)}</td>
                <td style="color:${bal > 0 ? '#ea580c' : '#15803d'}; font-weight:700;">${formatINR(bal)}</td>
                <td>${statusBadge}</td>
                <td style="text-align:right; padding-right:1.35rem;">
                  <a href="invoice-view.html?id=${inv.id}" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.25rem; font-weight:600;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    View
                  </a>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- RENDER LIVE ADS CAMPAIGNS LIST ---
function renderAdsCampaignsList(ads = [], summary = {}) {
  if (ads.length === 0) {
    return `
      <div style="padding:2.5rem; text-align:center; color:#94a3b8;">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.5rem; opacity:0.6;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <div>No active ad campaigns logged yet.</div>
        <button type="button" class="btn btn-primary btn-sm" onclick="openAdCampaignModal()" style="margin-top:0.75rem;">+ Add First Ad Campaign</button>
      </div>
    `;
  }

  return `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1rem;">
      ${ads.map(ad => {
        const budget = parseFloat(ad.ad_fund_budget || 0);
        const spent = parseFloat(ad.spent_amount || 0);
        const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

        let platformBadge = '<span class="badge" style="background:#eff6ff; color:#1d4ed8;">Meta Ads</span>';
        if (ad.platform === 'GOOGLE') {
          platformBadge = '<span class="badge" style="background:#fefce8; color:#a16207;">Google Ads</span>';
        } else if (ad.platform === 'INSTAGRAM') {
          platformBadge = '<span class="badge" style="background:#fdf2f8; color:#be185d;">Instagram Ads</span>';
        }

        return `
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:1rem; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.6rem;">
              <div>
                <strong style="color:var(--text-main); font-size:0.95rem; display:block;">${escapeAttr(ad.campaign_name)}</strong>
                <div style="margin-top:3px;">${platformBadge} <span class="badge ${ad.status === 'ACTIVE' ? 'badge-paid' : 'badge-draft'}">${ad.status}</span></div>
              </div>
              <button type="button" class="icon-action-btn" onclick="editAdCampaign(${ad.id})" title="Edit Campaign">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>

            <!-- Ad Fund Spent Progress -->
            <div style="margin:0.75rem 0;">
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:700; margin-bottom:3px;">
                <span>Ad Spend: ${formatINR(spent)}</span>
                <span style="color:#64748b;">Budget: ${formatINR(budget)} (${pct}%)</span>
              </div>
              <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #9333ea, #c084fc); border-radius:3px;"></div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; color:#475569; padding-top:0.5rem; border-top:1px solid #f1f5f9;">
              <span>🎯 <strong>${ad.leads_generated || 0}</strong> Leads Generated</span>
              <span>${ad.start_date ? `Start: ${formatDate(ad.start_date)}` : ''}</span>
            </div>

            ${ad.notes ? `
              <div style="margin-top:0.5rem; background:#faf5ff; padding:0.45rem 0.65rem; border-radius:6px; font-size:0.75rem; color:#6b21a8;">
                ${escapeAttr(ad.notes)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// --- RENDER MEETINGS & MINUTES ---
function renderMeetingsList(meetings = []) {
  if (meetings.length === 0) {
    return `<div style="padding:2.5rem; text-align:center; color:#94a3b8;">No meetings scheduled or recorded for this client yet.</div>`;
  }

  return `
    <div style="display:flex; flex-direction:column; gap:0.85rem;">
      ${meetings.map(m => {
        let statusBadge = '<span class="badge" style="background:#e0f2fe; color:#0369a1;">SCHEDULED</span>';
        if (m.status === 'DONE') {
          statusBadge = '<span class="badge badge-paid">✓ COMPLETED</span>';
        } else if (m.status === 'CANCELLED') {
          statusBadge = '<span class="badge badge-cancelled">CANCELLED</span>';
        }

        const isOnline = m.meeting_mode === 'ONLINE';

        return `
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:4px solid ${m.status === 'DONE' ? '#16a34a' : '#0891b2'}; border-radius:8px; padding:1rem; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.4rem;">
              <div>
                <strong style="font-size:0.95rem; color:var(--text-main);">${escapeAttr(m.title)}</strong>
                <span style="margin-left:0.4rem;">${statusBadge}</span>
                <span class="badge" style="background:#f1f5f9; color:#475569; margin-left:0.25rem;">
                  ${isOnline ? '🌐 Online Video Meet' : '🏢 Offline In-Person'}
                </span>
              </div>
              <div style="display:flex; gap:0.35rem; align-items:center;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="openPostMinutesModal(${m.id}, '${escapeAttr(m.title)}', '${formatDate(m.meeting_date)} ${escapeAttr(m.meeting_time)}')" style="font-size:0.75rem; padding:0.25rem 0.55rem; color:#15803d; border-color:#86efac; background:#f0fdf4;">
                  📝 Minutes & Decisions
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="editMeeting(${m.id})" style="font-size:0.75rem; padding:0.25rem 0.5rem;">
                  ✏️ Edit
                </button>
              </div>
            </div>

            <div style="font-size:0.8rem; color:#64748b; display:flex; align-items:center; gap:0.85rem; flex-wrap:wrap; margin-bottom:0.4rem;">
              <span>📅 <strong>${formatDate(m.meeting_date)}</strong> at <strong>${escapeAttr(m.meeting_time)}</strong></span>
              ${m.location ? `<span>📍 ${isOnline ? `<a href="${escapeAttr(m.location)}" target="_blank" style="color:#0284c7; font-weight:700;">Join Meeting Link ↗</a>` : escapeAttr(m.location)}</span>` : ''}
            </div>

            ${m.agenda ? `
              <div style="font-size:0.82rem; color:#334155; margin-bottom:0.5rem;">
                <strong>Agenda:</strong> ${escapeAttr(m.agenda)}
              </div>
            ` : ''}

            ${m.minutes_notes ? `
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:0.6rem 0.75rem; font-size:0.8rem; color:#166534; line-height:1.45;">
                <strong style="display:block; margin-bottom:2px;">✓ Post-Meeting Decisions & Action Items:</strong>
                <div style="white-space:pre-line;">${escapeAttr(m.minutes_notes)}</div>
              </div>
            ` : `
              <div style="font-size:0.75rem; color:#94a3b8; font-style:italic;">
                No post-meeting minutes recorded yet. Click "Minutes & Decisions" to add key decisions after meeting completes.
              </div>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// --- RENDER CALL LOGS LIST ---
function renderCallLogsList(logs = []) {
  if (logs.length === 0) {
    return `<div style="padding:2.5rem; text-align:center; color:#94a3b8;">No manual call interactions logged yet.</div>`;
  }

  return `
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      ${logs.map(log => `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:3px solid #0284c7; border-radius:8px; padding:0.85rem 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.25rem;">
            <div>
              <strong style="color:var(--text-main); font-size:0.9rem;">${escapeAttr(log.title)}</strong>
              <span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.7rem; margin-left:0.4rem;">${escapeAttr(log.outcome)}</span>
              <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.7rem; margin-left:0.2rem;">⏱️ ${escapeAttr(log.duration)}</span>
            </div>
            <span style="font-size:0.75rem; color:#64748b;">${formatDate(log.created_at)}</span>
          </div>
          ${log.notes ? `
            <div style="font-size:0.82rem; color:#334155; line-height:1.4; margin-top:0.35rem; white-space:pre-line;">
              ${escapeAttr(log.notes)}
            </div>
          ` : ''}
          ${log.follow_up_date ? `
            <div style="font-size:0.74rem; color:#0284c7; font-weight:700; margin-top:0.35rem;">
              ⏰ Next Follow-Up Scheduled: ${formatDate(log.follow_up_date)}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// --- RENDER QUOTATIONS & NEGOTIATIONS ---
function renderQuotationsAndNegotiations(enquiries = [], timeline = []) {
  if (enquiries.length === 0 && timeline.length === 0) {
    return `<div style="padding:2.5rem; text-align:center; color:#94a3b8;">No initial enquiry quotation records found for this client.</div>`;
  }

  const negotiations = timeline.filter(t => t.event_type === 'NEGOTIATION');
  const quotes = timeline.filter(t => t.event_type === 'QUOTATION');

  return `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
      <!-- Negotiation Rounds -->
      <div style="background:#fffaf5; border:1px solid #fed7aa; border-radius:8px; padding:1rem;">
        <h4 style="margin:0 0 0.75rem 0; color:#c2410c; font-size:0.92rem; display:flex; align-items:center; gap:0.35rem;">
          <span>🤝</span> Price Negotiation History (${negotiations.length} Rounds)
        </h4>
        ${negotiations.length > 0 ? `
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            ${negotiations.map((neg, idx) => `
              <div style="background:#ffffff; border:1px solid #fed7aa; border-radius:6px; padding:0.6rem 0.75rem;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; color:#9a3412;">
                  <span>Round #${idx + 1}: ${escapeAttr(neg.title)}</span>
                  <span style="font-size:0.7rem; color:#64748b;">${formatDate(neg.created_at)}</span>
                </div>
                ${neg.details ? `<div style="font-size:0.78rem; color:#334155; margin-top:0.25rem; white-space:pre-line;">${escapeAttr(neg.details)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : `<div style="font-size:0.8rem; color:#9a3412;">No negotiation rounds logged.</div>`}
      </div>

      <!-- Quotations & Proposal History -->
      <div style="background:#faf5ff; border:1px solid #e9d5ff; border-radius:8px; padding:1rem;">
        <h4 style="margin:0 0 0.75rem 0; color:#7e22ce; font-size:0.92rem; display:flex; align-items:center; gap:0.35rem;">
          <span>📄</span> Proposal Documents & Initial Scope
        </h4>
        ${quotes.length > 0 ? `
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            ${quotes.map(q => `
              <div style="background:#ffffff; border:1px solid #e9d5ff; border-radius:6px; padding:0.6rem 0.75rem;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; color:#6b21a8;">
                  <span>${escapeAttr(q.title)}</span>
                  <span style="font-size:0.7rem; color:#64748b;">${formatDate(q.created_at)}</span>
                </div>
                ${q.details ? `<div style="font-size:0.78rem; color:#334155; margin-top:0.25rem; white-space:pre-line;">${escapeAttr(q.details)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : `<div style="font-size:0.8rem; color:#6b21a8;">No quotation timeline entries logged.</div>`}
      </div>
    </div>
  `;
}

// --- RENDER UNIFIED TIMELINE ---
function renderUnifiedTimeline(data) {
  const events = [];

  // Invoices
  (data.invoices || []).forEach(inv => {
    events.push({
      date: new Date(inv.invoice_date || inv.created_at),
      type: 'INVOICE',
      title: `Invoice #${inv.invoice_number} Generated`,
      details: `Total Amount: ${formatINR(inv.total_amount)} (${inv.status})`,
      icon: '📄',
      color: '#0284c7'
    });
  });

  // Payments
  (data.payments || []).forEach(p => {
    events.push({
      date: new Date(p.payment_date || p.created_at),
      type: 'PAYMENT',
      title: `Payment Received: ${formatINR(p.amount)}`,
      details: `Paid for Invoice #${p.invoice_number} via ${p.payment_mode || 'Bank'}`,
      icon: '✓',
      color: '#15803d'
    });
  });

  // Meetings
  (data.meetings || []).forEach(m => {
    events.push({
      date: new Date(m.meeting_date),
      type: 'MEETING',
      title: `Meeting: ${m.title} (${m.status})`,
      details: `${m.meeting_mode} meeting at ${m.meeting_time}. ${m.minutes_notes || m.agenda || ''}`,
      icon: '🤝',
      color: '#0891b2'
    });
  });

  // Calls
  (data.call_logs || []).forEach(c => {
    events.push({
      date: new Date(c.created_at),
      type: 'CALL',
      title: `Call: ${c.title}`,
      details: `Duration: ${c.duration}, Outcome: ${c.outcome}. ${c.notes || ''}`,
      icon: '📞',
      color: '#0284c7'
    });
  });

  // Ads
  (data.ads || []).forEach(ad => {
    events.push({
      date: new Date(ad.created_at),
      type: 'ADS',
      title: `Ad Campaign: ${ad.campaign_name}`,
      details: `Platform: ${ad.platform}, Budget: ${formatINR(ad.ad_fund_budget)}, Status: ${ad.status}`,
      icon: '📢',
      color: '#7e22ce'
    });
  });

  // Sort descending
  events.sort((a, b) => b.date - a.date);

  if (events.length === 0) {
    return `<div style="padding:2.5rem; text-align:center; color:#94a3b8;">No events recorded.</div>`;
  }

  return `
    <div style="position:relative; padding-left:28px; margin-top:0.5rem;">
      <div style="position:absolute; left:11px; top:6px; bottom:6px; width:2px; background:#e2e8f0;"></div>
      ${events.map(ev => `
        <div style="position:relative; margin-bottom:1rem;">
          <div style="position:absolute; left:-28px; top:2px; width:24px; height:24px; border-radius:50%; background:#ffffff; border:2px solid ${ev.color}; color:${ev.color}; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:bold;">
            ${ev.icon}
          </div>
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:0.65rem 0.85rem;">
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:700; color:var(--text-main);">
              <span>${escapeAttr(ev.title)}</span>
              <span style="font-size:0.72rem; color:#64748b; font-weight:500;">${formatDate(ev.date)}</span>
            </div>
            ${ev.details ? `<div style="font-size:0.78rem; color:#475569; margin-top:0.25rem;">${escapeAttr(ev.details)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// --- MODAL HANDLERS ---

// Schedule Meeting Modal
function openScheduleMeetingModal() {
  if (!clientData || !clientData.client) return;
  const form = document.getElementById('meetingForm');
  if (form) form.reset();

  document.getElementById('meetingId').value = '';
  document.getElementById('meetingModalTitle').textContent = 'Schedule / Record Meeting';
  document.getElementById('meetingDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('meetingTime').value = '11:30 AM';
  document.getElementById('meetingLocation').value = 'https://meet.google.com/dgr-app';

  document.getElementById('meetingModal').classList.add('active');
}

function closeMeetingModal() {
  document.getElementById('meetingModal').classList.remove('active');
}

function handleMeetingModeChange(mode) {
  const label = document.getElementById('meetingLocationLabel');
  const input = document.getElementById('meetingLocation');
  if (mode === 'ONLINE') {
    label.textContent = 'Google Meet / Zoom URL';
    input.placeholder = 'https://meet.google.com/xyz-abc';
  } else {
    label.textContent = 'Location Venue / Physical Address';
    input.placeholder = 'D-GROW Office / Client HQ, Chennai';
  }
}

async function submitMeetingForm(e) {
  e.preventDefault();
  if (!clientData || !clientData.client) return;

  const id = document.getElementById('meetingId').value;
  const title = document.getElementById('meetingTitle').value.trim();
  const meeting_mode = document.getElementById('meetingMode').value;
  const status = document.getElementById('meetingStatus').value;
  const meeting_date = document.getElementById('meetingDate').value;
  const meeting_time = document.getElementById('meetingTime').value.trim();
  const location = document.getElementById('meetingLocation').value.trim();
  const agenda = document.getElementById('meetingAgenda').value.trim();
  const minutes_notes = document.getElementById('meetingMinutesNotes').value.trim();

  const btn = document.getElementById('btnSubmitMeeting');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (id) {
      await apiFetch(`/meetings/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title, meeting_mode, status, meeting_date, meeting_time, location, agenda, minutes_notes
        })
      });
      showToast('✓ Meeting updated successfully!', 'success');
    } else {
      await apiFetch('/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title,
          client_id: clientData.client.id,
          client_name: clientData.client.company_name,
          meeting_mode,
          status,
          meeting_date,
          meeting_time,
          location,
          agenda,
          minutes_notes
        })
      });
      showToast('✓ Meeting scheduled successfully!', 'success');
    }

    closeMeetingModal();
    loadClient360Page(clientData.client.id);
  } catch (err) {
    showToast('Failed to save meeting: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Save Meeting';
  }
}

// Post-Meeting Minutes Modal
function openPostMinutesModal(id, title, meta) {
  document.getElementById('postMinutesMeetingId').value = id;
  document.getElementById('postMinutesMeetingTitle').textContent = title;
  document.getElementById('postMinutesMeetingMeta').textContent = meta;
  document.getElementById('postMinutesText').value = '';

  const meeting = (clientData.meetings || []).find(m => m.id === id);
  if (meeting && meeting.minutes_notes) {
    document.getElementById('postMinutesText').value = meeting.minutes_notes;
  }

  document.getElementById('postMinutesModal').classList.add('active');
}

function closePostMinutesModal() {
  document.getElementById('postMinutesModal').classList.remove('active');
}

async function submitPostMinutes(e) {
  e.preventDefault();
  const id = document.getElementById('postMinutesMeetingId').value;
  const minutes_notes = document.getElementById('postMinutesText').value.trim();
  const mark_done = document.getElementById('postMinutesMarkDone').checked;

  const btn = document.getElementById('btnSubmitMinutes');
  btn.disabled = true;
  btn.textContent = 'Saving Minutes...';

  try {
    await apiFetch(`/meetings/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ minutes_notes, mark_done })
    });

    showToast('✓ Meeting minutes & decisions recorded!', 'success');
    closePostMinutesModal();
    loadClient360Page(clientData.client.id);
  } catch (err) {
    showToast('Failed to update minutes: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Save Meeting Minutes';
  }
}

// Manual Call Modal
function openClientCallModal() {
  if (!clientData || !clientData.client) return;
  const form = document.getElementById('clientCallForm');
  if (form) form.reset();

  document.getElementById('clientCallTitle').value = `Call with ${clientData.client.contact_person || clientData.client.company_name}`;
  document.getElementById('clientCallModal').classList.add('active');
}

function closeClientCallModal() {
  document.getElementById('clientCallModal').classList.remove('active');
}

async function submitClientCallForm(e) {
  e.preventDefault();
  if (!clientData || !clientData.client) return;

  const call_type = document.getElementById('clientCallType').value;
  const duration = document.getElementById('clientCallDuration').value;
  const outcome = document.getElementById('clientCallOutcome').value;
  const title = document.getElementById('clientCallTitle').value.trim();
  const follow_up_date = document.getElementById('clientCallFollowUp').value;
  const notes = document.getElementById('clientCallNotes').value.trim();

  const btn = document.getElementById('btnSubmitClientCall');
  btn.disabled = true;
  btn.textContent = 'Saving Call...';

  try {
    await apiFetch(`/clients/${clientData.client.id}/call-log`, {
      method: 'POST',
      body: JSON.stringify({
        call_type, duration, outcome, title, follow_up_date, notes
      })
    });

    showToast('✓ Call interaction saved!', 'success');
    closeClientCallModal();
    loadClient360Page(clientData.client.id);
  } catch (err) {
    showToast('Failed to save call log: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Save Call Log';
  }
}

// Ad Campaign Modal
function openAdCampaignModal() {
  const form = document.getElementById('adCampaignForm');
  if (form) form.reset();

  document.getElementById('adCampaignId').value = '';
  document.getElementById('adModalTitle').textContent = 'Add Live Ad Campaign';
  document.getElementById('adStartDate').value = new Date().toISOString().split('T')[0];

  document.getElementById('adCampaignModal').classList.add('active');
}

function closeAdCampaignModal() {
  document.getElementById('adCampaignModal').classList.remove('active');
}

function editAdCampaign(id) {
  const ad = (clientData.ads || []).find(a => a.id === id);
  if (!ad) return;

  document.getElementById('adCampaignId').value = ad.id;
  document.getElementById('adModalTitle').textContent = 'Edit Ad Campaign';
  document.getElementById('adCampaignName').value = ad.campaign_name;
  document.getElementById('adPlatform').value = ad.platform || 'META';
  document.getElementById('adStatus').value = ad.status || 'ACTIVE';
  document.getElementById('adBudget').value = ad.ad_fund_budget || 0;
  document.getElementById('adSpent').value = ad.spent_amount || 0;
  document.getElementById('adLeads').value = ad.leads_generated || 0;
  document.getElementById('adStartDate').value = ad.start_date ? ad.start_date.split('T')[0] : '';
  document.getElementById('adNotes').value = ad.notes || '';

  document.getElementById('adCampaignModal').classList.add('active');
}

async function submitAdCampaignForm(e) {
  e.preventDefault();
  if (!clientData || !clientData.client) return;

  const id = document.getElementById('adCampaignId').value;
  const campaign_name = document.getElementById('adCampaignName').value.trim();
  const platform = document.getElementById('adPlatform').value;
  const status = document.getElementById('adStatus').value;
  const ad_fund_budget = parseFloat(document.getElementById('adBudget').value) || 0;
  const spent_amount = parseFloat(document.getElementById('adSpent').value) || 0;
  const leads_generated = parseInt(document.getElementById('adLeads').value, 10) || 0;
  const start_date = document.getElementById('adStartDate').value;
  const notes = document.getElementById('adNotes').value.trim();

  const btn = document.getElementById('btnSubmitAd');
  btn.disabled = true;
  btn.textContent = 'Saving Campaign...';

  try {
    if (id) {
      await apiFetch(`/clients/${clientData.client.id}/ads/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          campaign_name, platform, status, ad_fund_budget, spent_amount, leads_generated, start_date, notes
        })
      });
      showToast('✓ Ad campaign updated successfully!', 'success');
    } else {
      await apiFetch(`/clients/${clientData.client.id}/ads`, {
        method: 'POST',
        body: JSON.stringify({
          campaign_name, platform, status, ad_fund_budget, spent_amount, leads_generated, start_date, notes
        })
      });
      showToast('✓ Ad campaign added successfully!', 'success');
    }

    closeAdCampaignModal();
    loadClient360Page(clientData.client.id);
  } catch (err) {
    showToast('Failed to save ad campaign: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Save Campaign';
  }
}

function getInitials(name) {
  if (!name) return 'CL';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// 1-Click Marketer Assignment from 360 View
async function openAssignMarketerModalFromView() {
  if (!clientData || !clientData.client) return;
  const client = clientData.client;

  let modal = document.getElementById('assignMarketerModalView');
  if (!modal) {
    // Dynamically insert modal
    const div = document.createElement('div');
    div.id = 'assignMarketerModalView';
    div.className = 'modal-overlay';
    div.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(3px);';
    div.innerHTML = `
      <div class="modal-card" style="background:#ffffff; border-radius:12px; max-width:460px; width:90%; padding:1.5rem; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid #f1f5f9; padding-bottom:0.75rem;">
          <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:#0f172a;">Assign Client to Marketer</h3>
          <button type="button" onclick="closeAssignMarketerModalFromView()" style="background:none; border:none; font-size:1.25rem; color:#94a3b8; cursor:pointer;">&times;</button>
        </div>
        <p style="font-size:0.875rem; color:#64748b; margin-bottom:1.25rem;">
          Assign <strong id="viewModalCompanyName" style="color:#0f172a;"></strong> to a field marketer profile (Sai, Siva, Angel, etc.). Only the assigned marketer will see this client upon login.
        </p>
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">Select Field Marketer</label>
          <select id="viewModalMarketerSelect" class="form-select" style="width:100%;">
            <option value="">-- Unassigned (Direct Client) --</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="closeAssignMarketerModalFromView()">Cancel</button>
          <button type="button" class="btn btn-primary" id="btnSaveAssignmentView" onclick="submitMarketerAssignmentFromView()" style="background:var(--primary, #e11d48); font-weight:700;">
            Save Assignment
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    modal = div;
  }

  document.getElementById('viewModalCompanyName').textContent = client.company_name;

  try {
    const res = await apiFetch('/auth/users');
    if (res.success && Array.isArray(res.users)) {
      const marketers = res.users.filter(u => u.role === 'MARKETING' || u.role_id === 4 || String(u.role).toUpperCase() === 'MARKETING');
      const select = document.getElementById('viewModalMarketerSelect');
      if (select) {
        select.innerHTML = '<option value="">-- Unassigned (Direct Client) --</option>' +
          marketers.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('');
        select.value = client.assigned_to || '';
      }
    }
  } catch (e) {
    console.warn('Error loading marketers:', e);
  }

  modal.style.display = 'flex';
}

function closeAssignMarketerModalFromView() {
  const modal = document.getElementById('assignMarketerModalView');
  if (modal) modal.style.display = 'none';
}

async function submitMarketerAssignmentFromView() {
  if (!clientData || !clientData.client) return;
  const clientId = clientData.client.id;
  const marketerId = document.getElementById('viewModalMarketerSelect').value;
  const btn = document.getElementById('btnSaveAssignmentView');

  try {
    if (btn) btn.disabled = true;
    const res = await apiFetch(`/clients/${clientId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ marketer_id: marketerId ? parseInt(marketerId, 10) : null })
    });

    if (!res.success) throw new Error(res.message || 'Failed to update assignment.');

    showToast(res.message, 'success');
    closeAssignMarketerModalFromView();
    loadClient360Page(clientId);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
