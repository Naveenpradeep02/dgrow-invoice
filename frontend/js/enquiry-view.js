// Nested Enquiry Details, Negotiation Rounds Tracker & Call Logs Controller (Vector Icons & Clean Theme)

let currentEnquiry = null;
let currentTimeline = [];
let activeTimelineFilter = 'ALL';

// Common Vector SVG Icons
const SVG_ICONS = {
  USER: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  PHONE: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  MAIL: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  CALENDAR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  HANDSHAKE: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"/><path d="M10 12l2 2 4-4"/></svg>`,
  WHATSAPP: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  QUOTE: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4z"/></svg>`,
  BUILDING: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><line x1="15" y1="22" x2="15" y2="22.01"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><line x1="9" y1="18" x2="9" y2="18.01"/><line x1="15" y1="18" x2="15" y2="18.01"/></svg>`,
  TARGET: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  BRIEFCASE: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  CHAT: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  CLOCK: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  CHECK: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:text-bottom; margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>`,
  FIRE: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:4px;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"/></svg>`,
  DOLLAR: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:2px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const enquiryId = params.get('id');

  if (!enquiryId) {
    document.getElementById('enquiryNestedPageContent').innerHTML = `
      <div class="card" style="padding:2rem; text-align:center;">
        <h3 style="color:#dc2626;">Missing Enquiry ID</h3>
        <p style="color:#64748b; margin-bottom:1rem;">Please select an enquiry from the Enquiries list to view its details.</p>
        <a href="enquiries.html" class="btn btn-primary">← Go to Enquiries List</a>
      </div>
    `;
    return;
  }

  loadEnquiryNestedPage(enquiryId);
});

async function loadEnquiryNestedPage(id) {
  const container = document.getElementById('enquiryNestedPageContent');
  if (!container) return;

  try {
    const res = await apiFetch(`/enquiries/${id}`);
    if (!res || !res.success || !res.enquiry) {
      container.innerHTML = `
        <div class="card" style="padding:2rem; text-align:center;">
          <h3 style="color:#dc2626;">Enquiry Not Found</h3>
          <p style="color:#64748b; margin-bottom:1rem;">The requested lead #ID ${escapeAttr(id)} does not exist or has been deleted.</p>
          <a href="enquiries.html" class="btn btn-primary">← Go to Enquiries List</a>
        </div>
      `;
      return;
    }

    currentEnquiry = res.enquiry;
    currentTimeline = res.timeline || [];

    // Update document & breadcrumb title
    document.title = `${currentEnquiry.business_name} - Enquiry Details - D-GROW`;
    const breadcrumb = document.getElementById('breadcrumbTitle');
    if (breadcrumb) {
      breadcrumb.textContent = `${currentEnquiry.business_name} (#${currentEnquiry.id})`;
    }

    renderNestedEnquiryPage(currentEnquiry, currentTimeline);
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="padding:2rem; text-align:center; color:#dc2626;">
        <h3>Error Loading Enquiry</h3>
        <p>${escapeAttr(err.message)}</p>
        <a href="enquiries.html" class="btn btn-secondary" style="margin-top:1rem;">← Return to Enquiries</a>
      </div>
    `;
  }
}

function countNegotiationRounds(timeline = []) {
  return timeline.filter(t => t.event_type === 'NEGOTIATION').length;
}

function countTotalCalls(timeline = []) {
  return timeline.filter(t => t.event_type === 'CALL').length;
}

function countTotalQuotes(timeline = []) {
  return timeline.filter(t => t.event_type === 'QUOTATION').length;
}

function renderEnquiryHero(enq, timeline = []) {
  const initials = getInitials(enq.business_name || enq.name);
  const budgetFormatted = parseFloat(enq.estimated_budget || 0) > 0 ? formatINR(enq.estimated_budget) : 'Flexible / TBD';
  const negCount = countNegotiationRounds(timeline);
  const callCount = countTotalCalls(timeline);

  return `
    <!-- Top Hero Banner (Clean D-GROW White Theme with Vector Icons) -->
    <div class="enquiry-hero-clean">
      <div class="hero-clean-top-row">
        <!-- Title & Contact Area -->
        <div class="hero-clean-title-area">
          <div class="hero-clean-avatar">${initials}</div>
          <div>
            <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
              <h1 style="margin:0; font-size:1.45rem; font-weight:800; color:var(--text-main, #0f172a);">${escapeAttr(enq.business_name)}</h1>
              ${getEnquiryStatusBadge(enq.status)}
              ${getEnquirySourceBadge(enq.source, enq.marketing_person)}
            </div>
            <div class="hero-clean-meta-list">
              <span>${SVG_ICONS.USER} <strong>${escapeAttr(enq.name)}</strong></span>
              <span>&bull;</span>
              <span><a href="tel:${escapeAttr(enq.mobile)}">${SVG_ICONS.PHONE} ${escapeAttr(enq.mobile)}</a></span>
              ${enq.email ? `<span>&bull;</span><span><a href="mailto:${escapeAttr(enq.email)}">${SVG_ICONS.MAIL} ${escapeAttr(enq.email)}</a></span>` : ''}
              <span>&bull;</span>
              <span>${SVG_ICONS.CALENDAR} Created ${formatDate(enq.created_at)}</span>
            </div>
          </div>
        </div>

        <!-- Metric Counter Stat Cards -->
        <div style="display:flex; gap:0.65rem; align-items:center; flex-wrap:wrap;">
          <!-- Negotiation Counter Box -->
          <div class="hero-stat-card negotiation">
            <div class="hero-stat-label">${SVG_ICONS.HANDSHAKE} Negotiations</div>
            <div class="hero-stat-val">${negCount} ${negCount === 1 ? 'Round' : 'Rounds'}</div>
          </div>

          <!-- Total Calls Box -->
          <div class="hero-stat-card calls">
            <div class="hero-stat-label">${SVG_ICONS.PHONE} Calls Logged</div>
            <div class="hero-stat-val">${callCount} ${callCount === 1 ? 'Call' : 'Calls'}</div>
          </div>

          <!-- Deal Budget Box -->
          <div class="hero-stat-card budget">
            <div class="hero-stat-label">${SVG_ICONS.DOLLAR} Deal Budget</div>
            <div class="hero-stat-val">${budgetFormatted}</div>
          </div>
        </div>
      </div>

      <!-- Hero Actions Bar -->
      <div class="hero-clean-actions-bar">
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <!-- Quick Status Changer -->
          <div style="display:inline-flex; align-items:center; gap:0.4rem; background:#f8fafc; padding:0.25rem 0.6rem; border-radius:6px; border:1px solid #e2e8f0;">
            <span style="font-size:0.75rem; color:#64748b; font-weight:700;">Status:</span>
            <select id="quickStatusChanger" onchange="handleQuickStatusChange(this.value)" style="background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:4px; padding:0.2rem 0.4rem; font-size:0.8rem; font-weight:700; cursor:pointer; outline:none;">
              <option value="NEW" ${enq.status === 'NEW' ? 'selected' : ''}>New Lead</option>
              <option value="IN_DISCUSSION" ${enq.status === 'IN_DISCUSSION' ? 'selected' : ''}>In Discussion</option>
              <option value="QUOTATION_SENT" ${enq.status === 'QUOTATION_SENT' ? 'selected' : ''}>Quotation Sent</option>
              <option value="NEGOTIATION" ${enq.status === 'NEGOTIATION' ? 'selected' : ''}>In Negotiation</option>
              <option value="ONBOARDED" ${enq.status === 'ONBOARDED' ? 'selected' : ''}>Onboarded / Won</option>
              <option value="LOST" ${enq.status === 'LOST' ? 'selected' : ''}>Lost / Cancelled</option>
            </select>
          </div>

          <!-- Manual Call Logger Trigger -->
          <button type="button" class="btn btn-secondary btn-sm" onclick="openManualCallLogModal()" style="background:#f0f9ff; border-color:#bae6fd; color:#0284c7; font-weight:700; display:inline-flex; align-items:center; gap:0.35rem;">
            ${SVG_ICONS.PHONE} + Log Call Interaction
          </button>

          <!-- WhatsApp Trigger -->
          <a href="https://wa.me/${escapeAttr(enq.mobile.replace(/[^0-9]/g, ''))}" target="_blank" class="btn btn-secondary btn-sm" style="background:#f0fdf4; border-color:#bbf7d0; color:#15803d; font-weight:700; display:inline-flex; align-items:center; gap:0.35rem;">
            ${SVG_ICONS.WHATSAPP} WhatsApp
          </a>
        </div>

        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="handleCreateQuotationFromCurrentEnquiry()" style="display:inline-flex; align-items:center; gap:0.35rem; font-weight:700; color:#7e22ce; border-color:#e9d5ff; background:#faf5ff;">
            ${SVG_ICONS.QUOTE} Create Quotation Proposal
          </button>

          ${!enq.converted_client_id ? `
            <button type="button" class="btn btn-primary btn-sm" onclick="handleConvertToClientOnNestedPage()" style="background:linear-gradient(135deg, #16a34a, #15803d); border:none; display:inline-flex; align-items:center; gap:0.35rem; font-weight:800; padding:0.4rem 0.9rem;">
              ${SVG_ICONS.CHECK} Convert to Client Master
            </button>
          ` : `
            ${typeof isMarketingRole === 'function' && isMarketingRole(getUser()?.role) ? `
              <span class="badge" style="display:inline-flex; align-items:center; gap:0.35rem; color:#15803d; background:#dcfce7; border:1px solid #86efac; font-weight:700; padding:0.35rem 0.65rem; border-radius:6px;">
                ${SVG_ICONS.USER} Onboarded Client #${enq.converted_client_id}
              </span>
            ` : `
              <a href="clients.html?search=${encodeURIComponent(enq.business_name)}" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem; color:#15803d; border-color:#86efac; background:#f0fdf4; font-weight:700;">
                ${SVG_ICONS.USER} View Client Master #${enq.converted_client_id}
              </a>
            `}
          `}

          <button type="button" class="btn btn-secondary btn-sm" onclick="openEditModalFromNested()" style="display:inline-flex; align-items:center; gap:0.35rem;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>

          <button type="button" class="btn btn-secondary btn-sm" onclick="handleDeleteEnquiryFromNested()" style="display:inline-flex; align-items:center; gap:0.35rem; color:#dc2626; border-color:#fecaca; background:#fffbfb;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fffbfb'">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Remove
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderNestedEnquiryPage(enq, timeline) {
  const container = document.getElementById('enquiryNestedPageContent');
  const heroHtml = renderEnquiryHero(enq, timeline);
  const negCount = countNegotiationRounds(timeline);
  const callCount = countTotalCalls(timeline);

  container.innerHTML = `
    ${heroHtml}

    <!-- 2-Column Symmetrical Grid -->
    <div class="nested-grid">
      <!-- Left Column: Profile & Requirements -->
      <div>
        <!-- Prospect Profile Card -->
        <div class="info-card">
          <div class="info-card-header">
            <h3 class="info-card-title">
              ${SVG_ICONS.BUILDING} Prospect Profile
            </h3>
            <button type="button" class="btn btn-secondary btn-sm" onclick="openEditModalFromNested()" style="padding:0.2rem 0.5rem; font-size:0.75rem;">Edit</button>
          </div>
          <div class="info-row">
            <span class="info-label">Company:</span>
            <span class="info-val"><strong>${escapeAttr(enq.business_name)}</strong></span>
          </div>
          <div class="info-row">
            <span class="info-label">Contact Person:</span>
            <span class="info-val">${escapeAttr(enq.name)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-val"><a href="tel:${escapeAttr(enq.mobile)}" style="color:var(--primary, #e11d48); font-weight:700;">${escapeAttr(enq.mobile)}</a></span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-val">${enq.email ? `<a href="mailto:${escapeAttr(enq.email)}" style="color:#0284c7;">${escapeAttr(enq.email)}</a>` : '<span class="text-muted">Not provided</span>'}</span>
          </div>
        </div>

        <!-- Requirements & Channel Card -->
        <div class="info-card">
          <div class="info-card-header">
            <h3 class="info-card-title">
              ${SVG_ICONS.TARGET} Requirements & Source
            </h3>
          </div>
          <div class="info-row">
            <span class="info-label">Lead Source:</span>
            <span class="info-val">${getEnquirySourceBadge(enq.source, enq.marketing_person)}</span>
          </div>
          ${enq.marketing_person ? `
            <div class="info-row">
              <span class="info-label">Marketing Rep:</span>
              <span class="info-val"><strong>${escapeAttr(enq.marketing_person)}</strong></span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Services Interested:</span>
            <span class="info-val" style="color:var(--primary, #e11d48); font-weight:700;">${escapeAttr(enq.services_interested || 'Digital Marketing Services')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Deal Budget:</span>
            <span class="info-val"><strong style="font-size:0.95rem; color:#15803d;">${formatINR(enq.estimated_budget)}</strong></span>
          </div>
          <div class="info-row">
            <span class="info-label">Date Created:</span>
            <span class="info-val">${formatDate(enq.created_at)}</span>
          </div>
          ${enq.notes ? `
            <div style="margin-top:0.85rem; padding-top:0.85rem; border-top:1px solid #f1f5f9;">
              <span class="info-label" style="display:block; margin-bottom:0.25rem;">Initial Context / Notes:</span>
              <div style="background:#f8fafc; padding:0.6rem 0.75rem; border-radius:6px; font-size:0.82rem; color:#334155; line-height:1.45; border:1px solid #e2e8f0;">
                ${escapeAttr(enq.notes)}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Negotiation & Call Engagement Summary Card -->
        <div class="info-card" style="border-left: 4px solid #f97316; background: #fffaf5;">
          <div class="info-card-header" style="border-bottom-color: #ffedd5;">
            <h3 class="info-card-title" style="color:#c2410c;">
              ${SVG_ICONS.FIRE} Engagement & Negotiation Stats
            </h3>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-bottom:0.75rem;">
            <div style="background:#ffffff; border:1px solid #fed7aa; border-radius:8px; padding:0.6rem; text-align:center;">
              <div style="font-size:0.7rem; color:#9a3412; font-weight:700; text-transform:uppercase;">${SVG_ICONS.HANDSHAKE} Negotiation Count</div>
              <div style="font-size:1.35rem; font-weight:900; color:#ea580c; margin-top:2px;">
                ${negCount} ${negCount === 1 ? 'Time' : 'Times'}
              </div>
            </div>
            <div style="background:#ffffff; border:1px solid #bae6fd; border-radius:8px; padding:0.6rem; text-align:center;">
              <div style="font-size:0.7rem; color:#0369a1; font-weight:700; text-transform:uppercase;">${SVG_ICONS.PHONE} Calls Logged</div>
              <div style="font-size:1.35rem; font-weight:900; color:#0284c7; margin-top:2px;">
                ${callCount} ${callCount === 1 ? 'Call' : 'Calls'}
              </div>
            </div>
          </div>
          <div style="font-size:0.75rem; color:#9a3412; line-height:1.4;">
            ${negCount > 0 
              ? `<strong>${negCount} rounds of negotiation</strong> have been conducted with this prospect. View breakdown in the activity stream.`
              : `No negotiations logged yet. Use the negotiation tool or create a quotation to begin terms discussion.`}
          </div>
        </div>

        <!-- Client Master Onboarding Status Card -->
        <div class="info-card" style="border-left: 4px solid ${enq.converted_client_id ? '#16a34a' : '#d97706'};">
          <div class="info-card-header">
            <h3 class="info-card-title">
              ${SVG_ICONS.BRIEFCASE} Onboarding Status
            </h3>
          </div>
          ${enq.converted_client_id ? `
            <div style="background:#dcfce7; border:1px solid #86efac; border-radius:8px; padding:0.85rem 1rem; color:#166534; font-size:0.84rem;">
              <div style="font-weight:800; display:flex; align-items:center; gap:0.35rem; margin-bottom:0.35rem;">
                ${SVG_ICONS.CHECK} Onboarded as Client #${enq.converted_client_id}
              </div>
              <p style="margin:0 0 0.65rem 0; font-size:0.8rem; color:#15803d;">
                This lead has been successfully converted into an active client record in Client Master.
              </p>
              ${typeof isMarketingRole === 'function' && isMarketingRole(getUser()?.role) ? '' : `
                <a href="clients.html?search=${encodeURIComponent(enq.business_name)}" class="btn btn-primary btn-sm" style="background:#15803d; border:none; padding:0.3rem 0.65rem; font-size:0.75rem;">
                  Open Client Master Profile →
                </a>
              `}
            </div>
          ` : `
            <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:0.85rem 1rem; color:#92400e; font-size:0.84rem;">
              <div style="font-weight:700; margin-bottom:0.35rem;">Prospect / Lead in Pipeline</div>
              <p style="margin:0 0 0.75rem 0; font-size:0.8rem; color:#b45309;">
                Ready to seal the deal? Convert this enquiry to permanently add them to the Client Master directory.
              </p>
              <button type="button" class="btn btn-primary btn-sm" onclick="handleConvertToClientOnNestedPage()" style="background:#15803d; border:none; font-weight:700;">
                ${SVG_ICONS.CHECK} 1-Click Onboard to Client Master
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Right Column: Interactive Activity & Negotiation Hub -->
      <div>
        <!-- Quick Action Cards Strip (Aligned with Vector Icons) -->
        <div class="quick-action-strip">
          <button type="button" class="quick-action-card-btn call-action" onclick="openManualCallLogModal()">
            <div style="width:32px; height:32px; border-radius:8px; background:#e0f2fe; color:#0369a1; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${SVG_ICONS.PHONE}
            </div>
            <div>
              <div>Record Call Log</div>
              <span style="font-size:0.7rem; color:#64748b; font-weight:500;">Log duration & notes</span>
            </div>
          </button>
          <button type="button" class="quick-action-card-btn neg-action" onclick="setQuickEventType('NEGOTIATION')">
            <div style="width:32px; height:32px; border-radius:8px; background:#ffedd5; color:#c2410c; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${SVG_ICONS.HANDSHAKE}
            </div>
            <div>
              <div>Log Negotiation</div>
              <span style="font-size:0.7rem; color:#64748b; font-weight:500;">Track discount & round</span>
            </div>
          </button>
          <button type="button" class="quick-action-card-btn quote-action" onclick="handleCreateQuotationFromCurrentEnquiry()">
            <div style="width:32px; height:32px; border-radius:8px; background:#ede9fe; color:#6d28d9; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${SVG_ICONS.QUOTE}
            </div>
            <div>
              <div>Issue Quotation</div>
              <span style="font-size:0.7rem; color:#64748b; font-weight:500;">Build proposal draft</span>
            </div>
          </button>
        </div>

        <!-- Add Interaction / Negotiation Note Form -->
        <div class="info-card" style="box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
          <div class="info-card-header">
            <h3 class="info-card-title">
              ${SVG_ICONS.CHAT} Add Interaction / Negotiation Note
            </h3>
            <span style="font-size:0.75rem; color:#64748b;">Record negotiations, call notes, or follow-ups</span>
          </div>

          <form onsubmit="submitTimelineNoteOnNested(event)">
            <div style="display:grid; grid-template-columns: 180px 1fr; gap:0.65rem; margin-bottom:0.75rem;">
              <div>
                <label class="form-label" style="font-size:0.75rem; margin-bottom:0.25rem;">Event Type</label>
                <select class="form-input" id="nestedEventType" onchange="handleNestedEventTypeChange(this.value)" style="font-size:0.82rem; font-weight:700;">
                  <option value="NEGOTIATION">Negotiation (Round)</option>
                  <option value="CALL">Phone Call Log</option>
                  <option value="NOTE">Discussion Note</option>
                  <option value="QUOTATION">Quotation Detail</option>
                </select>
              </div>
              <div>
                <label class="form-label" style="font-size:0.75rem; margin-bottom:0.25rem;">Summary / Title *</label>
                <input type="text" class="form-input" id="nestedEventTitle" placeholder="e.g. Negotiation Round: Offered 10% discount on SEO package" required style="font-size:0.82rem;">
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0.75rem;">
              <label class="form-label" style="font-size:0.75rem; margin-bottom:0.25rem;">Detailed Conversation, Revised Budget & Next Steps</label>
              <textarea class="form-input" id="nestedEventDetails" rows="2" placeholder="Agreed payment terms, client counter-offer, revised discount, callback schedule..." style="font-size:0.82rem;"></textarea>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.72rem; color:#94a3b8;">
                ${negCount > 0 ? `Current negotiation round will be recorded as <strong>Round #${negCount + 1}</strong>.` : 'First negotiation round will be recorded.'}
              </span>
              <button type="submit" class="btn btn-primary btn-sm" id="btnSubmitNestedTimeline" style="padding:0.4rem 1rem; font-weight:700;">
                + Save To History
              </button>
            </div>
          </form>
        </div>

        <!-- History Timeline Stream Card -->
        <div class="info-card">
          <div class="info-card-header" style="flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 class="info-card-title">
                ${SVG_ICONS.CLOCK} Complete History & Interaction Trail
              </h3>
              <span style="font-size:0.75rem; color:#64748b;">Chronological audit of negotiations, calls, quotes & status changes</span>
            </div>

            <!-- Timeline Filter Pills -->
            <div class="timeline-filter-pills">
              <button type="button" class="timeline-filter-pill ${activeTimelineFilter === 'ALL' ? 'active' : ''}" onclick="filterTimeline('ALL')">All (${timeline.length})</button>
              <button type="button" class="timeline-filter-pill ${activeTimelineFilter === 'NEGOTIATION' ? 'active' : ''}" onclick="filterTimeline('NEGOTIATION')">Negotiations (${negCount})</button>
              <button type="button" class="timeline-filter-pill ${activeTimelineFilter === 'CALL' ? 'active' : ''}" onclick="filterTimeline('CALL')">Calls (${callCount})</button>
              <button type="button" class="timeline-filter-pill ${activeTimelineFilter === 'QUOTATION' ? 'active' : ''}" onclick="filterTimeline('QUOTATION')">Quotes (${countTotalQuotes(timeline)})</button>
            </div>
          </div>

          <div id="timelineStreamContainer">
            ${renderTimelineStream(timeline, activeTimelineFilter)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTimelineStream(timeline = [], filter = 'ALL') {
  const filtered = filter === 'ALL' ? timeline : timeline.filter(t => t.event_type === filter);

  if (filtered.length === 0) {
    return `
      <div style="padding:2.5rem 1rem; text-align:center; color:#94a3b8; font-size:0.85rem;">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.5rem; opacity:0.5;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div>No ${filter === 'ALL' ? 'activity' : filter.toLowerCase()} records found.</div>
      </div>
    `;
  }

  // Calculate sequential negotiation round numbers
  const negotiationEventsAsc = [...timeline].filter(t => t.event_type === 'NEGOTIATION').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const negRoundMap = new Map();
  negotiationEventsAsc.forEach((item, index) => {
    negRoundMap.set(item.id, index + 1);
  });

  return `
    <div class="timeline-stream">
      ${filtered.map(item => {
        let badgeColor = '#64748b';
        let badgeBg = '#f1f5f9';
        let icon = SVG_ICONS.CHAT;
        let extraBadge = '';

        switch (item.event_type) {
          case 'NEGOTIATION': {
            badgeColor = '#c2410c'; 
            badgeBg = '#ffedd5'; 
            icon = SVG_ICONS.HANDSHAKE;
            const roundNum = negRoundMap.get(item.id);
            if (roundNum) {
              extraBadge = `<span class="badge" style="background:#ea580c; color:#ffffff; font-size:0.68rem; padding:0.12rem 0.45rem; font-weight:800; border-radius:4px; margin-left:0.35rem;">Round #${roundNum}</span>`;
            }
            break;
          }
          case 'CALL':
            badgeColor = '#0369a1'; badgeBg = '#e0f2fe'; icon = SVG_ICONS.PHONE; break;
          case 'QUOTATION':
            badgeColor = '#6d28d9'; badgeBg = '#ede9fe'; icon = SVG_ICONS.QUOTE; break;
          case 'STATUS_CHANGE':
            badgeColor = '#92400e'; badgeBg = '#fef3c7'; icon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`; break;
          case 'ONBOARDED':
            badgeColor = '#15803d'; badgeBg = '#dcfce7'; icon = SVG_ICONS.CHECK; break;
          default:
            badgeColor = '#475569'; badgeBg = '#f1f5f9'; icon = SVG_ICONS.CHAT; break;
        }

        return `
          <div class="timeline-stream-item">
            <div class="timeline-stream-dot" style="background:${badgeBg}; color:${badgeColor}; border-color:${badgeColor};">
              ${icon}
            </div>
            <div class="timeline-stream-card" style="border-left: 3px solid ${badgeColor};">
              <div class="timeline-stream-head">
                <div>
                  <strong style="color:var(--text-main); font-size:0.9rem;">${escapeAttr(item.title)}</strong>
                  <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-size:0.68rem; padding:0.1rem 0.4rem; margin-left:0.4rem; font-weight:800; border:1px solid ${badgeColor}33;">
                    ${item.event_type}
                  </span>
                  ${extraBadge}
                </div>
                <span style="font-size:0.75rem; color:#64748b; font-weight:600;">${formatDate(item.created_at)}</span>
              </div>
              ${item.details ? `
                <div style="font-size:0.83rem; color:#334155; line-height:1.45; margin-top:0.35rem; white-space:pre-line;">
                  ${escapeAttr(item.details)}
                </div>
              ` : ''}
              <div style="font-size:0.7rem; color:#94a3b8; margin-top:0.35rem; display:flex; justify-content:space-between; align-items:center;">
                <span>Logged by ${escapeAttr(item.created_by_name || 'Admin')}</span>
                <span style="color:#cbd5e1;">#${item.id}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function filterTimeline(filter) {
  activeTimelineFilter = filter;
  document.querySelectorAll('.timeline-filter-pill').forEach(btn => {
    btn.classList.remove('active');
  });

  const container = document.getElementById('timelineStreamContainer');
  if (container) {
    container.innerHTML = renderTimelineStream(currentTimeline, activeTimelineFilter);
  }
}

function setQuickEventType(type) {
  const select = document.getElementById('nestedEventType');
  if (select) {
    select.value = type;
    handleNestedEventTypeChange(type);
    select.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function handleNestedEventTypeChange(type) {
  const titleInput = document.getElementById('nestedEventTitle');
  if (!titleInput) return;

  const negCount = countNegotiationRounds(currentTimeline);
  if (type === 'NEGOTIATION') {
    titleInput.placeholder = `e.g. Negotiation Round #${negCount + 1}: Client requested 10% discount on ad management fee`;
  } else if (type === 'CALL') {
    titleInput.placeholder = `e.g. Follow-up Call: Discussed contract duration and milestones`;
  } else if (type === 'QUOTATION') {
    titleInput.placeholder = `e.g. Quotation Review: Client requested addition of Social Media package`;
  } else {
    titleInput.placeholder = `e.g. Meeting Note: Discussed project timeline & onboarding date`;
  }
}

// --- ADD TIMELINE NOTE ON NESTED PAGE ---
async function submitTimelineNoteOnNested(e) {
  e.preventDefault();
  if (!currentEnquiry) return;

  const event_type = document.getElementById('nestedEventType').value;
  const title = document.getElementById('nestedEventTitle').value.trim();
  const details = document.getElementById('nestedEventDetails').value.trim();

  if (!title) {
    showToast('Please enter an event summary/title.', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitNestedTimeline');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await apiFetch(`/enquiries/${currentEnquiry.id}/timeline`, {
      method: 'POST',
      body: JSON.stringify({ event_type, title, details })
    });

    // If event is negotiation, automatically set status to NEGOTIATION if not already ONBOARDED
    if (event_type === 'NEGOTIATION' && currentEnquiry.status !== 'ONBOARDED') {
      await apiFetch(`/enquiries/${currentEnquiry.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'NEGOTIATION' })
      });
    }

    showToast('✓ Interaction note added to history timeline!', 'success');
    loadEnquiryNestedPage(currentEnquiry.id);
  } catch (err) {
    showToast('Failed to add note: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Save To History';
  }
}

// --- MANUAL CALL LOG MODAL FUNCTIONS ---
function openManualCallLogModal() {
  if (!currentEnquiry) return;
  const form = document.getElementById('manualCallLogForm');
  if (form) form.reset();

  const titleInput = document.getElementById('callLogTitle');
  if (titleInput) {
    titleInput.value = `Call with ${currentEnquiry.name} (${currentEnquiry.business_name})`;
  }

  document.getElementById('manualCallLogModal').classList.add('active');
}

function closeManualCallLogModal() {
  document.getElementById('manualCallLogModal').classList.remove('active');
}

function handleCallOutcomeChange(outcome) {
  const notes = document.getElementById('callLogNotes');
  if (outcome.includes('Quotation')) {
    notes.placeholder = 'Specify which services they need quotes for and target budget...';
  } else if (outcome.includes('Negotiation')) {
    notes.placeholder = 'Mention discount percentage or budget concessions discussed...';
  } else if (outcome.includes('Callback')) {
    notes.placeholder = 'Client requested call back on specific date/time...';
  }
}

async function submitManualCallLog(e) {
  e.preventDefault();
  if (!currentEnquiry) return;

  const type = document.getElementById('callLogType').value;
  const duration = document.getElementById('callLogDuration').value;
  const outcome = document.getElementById('callLogOutcome').value;
  const title = document.getElementById('callLogTitle').value.trim();
  const followUp = document.getElementById('callLogFollowUp').value;
  const notes = document.getElementById('callLogNotes').value.trim();
  const autoStatus = document.getElementById('callLogAutoStatus').checked;

  const fullDetails = [
    `• Type: ${type}`,
    `• Duration: ${duration}`,
    `• Outcome: ${outcome}`,
    followUp ? `• Next Follow-Up Date: ${formatDate(followUp)}` : null,
    notes ? `• Notes: ${notes}` : null
  ].filter(Boolean).join('\n');

  const btn = document.getElementById('btnSubmitCallLog');
  btn.disabled = true;
  btn.textContent = 'Saving Call Log...';

  try {
    // 1. Post to timeline
    await apiFetch(`/enquiries/${currentEnquiry.id}/timeline`, {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'CALL',
        title: title || `${type} (${duration}) - ${outcome}`,
        details: fullDetails
      })
    });

    // 2. Auto update status if selected
    if (autoStatus && currentEnquiry.status !== 'ONBOARDED') {
      let targetStatus = currentEnquiry.status;
      if (outcome.includes('Negotiation')) {
        targetStatus = 'NEGOTIATION';
      } else if (outcome.includes('Quotation')) {
        targetStatus = 'IN_DISCUSSION';
      } else if (outcome.includes('Interested') && currentEnquiry.status === 'NEW') {
        targetStatus = 'IN_DISCUSSION';
      } else if (outcome.includes('Closed')) {
        targetStatus = 'LOST';
      }

      if (targetStatus !== currentEnquiry.status) {
        await apiFetch(`/enquiries/${currentEnquiry.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: targetStatus })
        });
      }
    }

    closeManualCallLogModal();
    showToast('✓ Call interaction successfully logged to history!', 'success');
    loadEnquiryNestedPage(currentEnquiry.id);
  } catch (err) {
    showToast('Failed to log call: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Save Call Log to History';
  }
}

// --- QUICK STATUS CHANGE ---
async function handleQuickStatusChange(newStatus) {
  if (!currentEnquiry || newStatus === currentEnquiry.status) return;

  try {
    await apiFetch(`/enquiries/${currentEnquiry.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });

    showToast(`✓ Lead status updated to ${newStatus}!`, 'success');
    loadEnquiryNestedPage(currentEnquiry.id);
  } catch (err) {
    showToast('Failed to update status: ' + err.message, 'error');
  }
}

// --- 1-CLICK CONVERT TO CLIENT MASTER ON NESTED PAGE ---
async function handleConvertToClientOnNestedPage() {
  if (!currentEnquiry) return;

  if (!confirm(`Are you sure you want to onboard "${currentEnquiry.business_name}" into Client Master? This will create a permanent client record and mark the lead as ONBOARDED.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/enquiries/${currentEnquiry.id}/convert`, {
      method: 'POST'
    });

    showToast(`✓ "${currentEnquiry.business_name}" successfully converted to Client Master!`, 'success');
    loadEnquiryNestedPage(currentEnquiry.id);
  } catch (err) {
    showToast('Failed to onboard client: ' + err.message, 'error');
  }
}

// --- CREATE QUOTATION SHORTCUT ---
function handleCreateQuotationFromCurrentEnquiry() {
  if (!currentEnquiry) return;

  sessionStorage.setItem('dgrow_quote_prefill', JSON.stringify({
    enquiry_id: currentEnquiry.id,
    client_name: currentEnquiry.name,
    business_name: currentEnquiry.business_name,
    email: currentEnquiry.email,
    mobile: currentEnquiry.mobile,
    services: currentEnquiry.services_interested,
    budget: currentEnquiry.estimated_budget
  }));

  window.location.href = `quotations.html?enquiry_id=${currentEnquiry.id}&open_create=1`;
}

// --- EDIT MODAL ON NESTED PAGE ---
function openEditModalFromNested() {
  if (!currentEnquiry) return;

  const enq = currentEnquiry;
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
}

function closeEditEnquiryModal() {
  document.getElementById('editEnquiryModal').classList.remove('active');
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
    loadEnquiryNestedPage(id);
  } catch (err) {
    showToast('Failed to update enquiry: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

// Badges & Helpers
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
      return `<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800; border:1px solid #86efac;">${SVG_ICONS.CHECK} ONBOARDED</span>`;
    case 'LOST':
      return '<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700; border:1px solid #fecaca;">LOST</span>';
    default:
      return `<span class="badge badge-issued">${status}</span>`;
  }
}

function getEnquirySourceBadge(source, marketingPerson = '') {
  switch (source) {
    case 'WEBSITE':
      return `<span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Website</span>`;
    case 'CALL':
      return `<span class="badge" style="background:#f0fdf4; color:#15803d; font-weight:700;">${SVG_ICONS.PHONE} Phone Call</span>`;
    case 'GMB':
      return `<span class="badge" style="background:#fefce8; color:#a16207; font-weight:700;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> GMB Listing</span>`;
    case 'ADS':
      return `<span class="badge" style="background:#fdf2f8; color:#be185d; font-weight:700;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Paid Ads</span>`;
    case 'MARKETING_PERSON':
      return `<span class="badge" style="background:#faf5ff; color:#7e22ce; font-weight:700;" title="${escapeAttr(marketingPerson)}">${SVG_ICONS.USER} Rep: ${escapeAttr(marketingPerson || 'Field Rep')}</span>`;
    case 'REFERRAL':
      return `<span class="badge" style="background:#fefce8; color:#a16207; font-weight:700; border:1px solid #fef08a;" title="${escapeAttr(marketingPerson)}"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom; margin-right:3px;"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"/><path d="M10 12l2 2 4-4"/></svg> Ref: ${escapeAttr(marketingPerson || 'Referral')}</span>`;
    default:
      return `<span class="badge" style="background:#f1f5f9; color:#475569;">${source || 'Direct'}</span>`;
  }
}

function getInitials(name) {
  if (!name) return 'EN';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// --- DELETE / REMOVE ENQUIRY FROM NESTED VIEW ---
async function handleDeleteEnquiryFromNested() {
  if (!currentEnquiry) return;
  const name = currentEnquiry.business_name || currentEnquiry.name || `#${currentEnquiry.id}`;
  if (!confirm(`Are you sure you want to delete enquiry "${name}"? All timeline history notes will also be removed. This cannot be undone.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/enquiries/${currentEnquiry.id}`, {
      method: 'DELETE'
    });

    if (res && res.success) {
      showToast(`✓ Enquiry "${name}" deleted successfully!`, 'success');
    } else {
      showToast(res?.message || 'Enquiry deleted.', 'success');
    }

    setTimeout(() => {
      window.location.href = 'enquiries.html';
    }, 500);
  } catch (err) {
    showToast('Failed to delete enquiry: ' + err.message, 'error');
  }
}
window.handleDeleteEnquiryFromNested = handleDeleteEnquiryFromNested;
