/**
 * D-GROW Marketing Agency - Assigned Clients & Follow-up Flow Controller
 * Handles live pipeline tracking for all leads assigned to marketing executives.
 */

let allAssignedClients = [];
let allMarketersList = [];
let currentViewMode = 'cards';
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof checkAuth === 'function') checkAuth();
  await initAssignedClientsPage();
});

async function initAssignedClientsPage() {
  try {
    await loadMarketersDropdown();
    await loadAssignedClients();
  } catch (err) {
    console.error('Failed to initialize assigned clients page:', err);
    showToast('Failed to load page: ' + err.message, 'error');
  }
}

// 1. Fetch & Populate Marketers Dropdown
async function loadMarketersDropdown() {
  try {
    const res = await apiFetch('/auth/users');
    if (res && res.success && Array.isArray(res.users)) {
      allMarketersList = res.users.filter(u => 
        u.role === 'MARKETING' || 
        u.role_id === 4 || 
        String(u.role).toUpperCase() === 'MARKETING' ||
        (typeof isMarketingRole === 'function' && isMarketingRole(u.role))
      );

      const filterSelect = document.getElementById('filterAssignedMarketer');
      const modalSelect = document.getElementById('modalReassignSelect');

      if (filterSelect) {
        filterSelect.innerHTML = `<option value="ALL">All Marketing Executives</option>` +
          allMarketersList.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
      }

      if (modalSelect) {
        modalSelect.innerHTML = `<option value="">-- Unassigned --</option>` +
          allMarketersList.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
      }
    }
  } catch (err) {
    console.warn('Could not load marketers list:', err);
  }
}

// 2. Fetch Assigned Clients from Backend
async function loadAssignedClients() {
  const container = document.getElementById('assignedCardsContainer');
  const tbody = document.getElementById('assignedTableBody');
  const countLabel = document.getElementById('assignedClientsCountLabel');

  const user = typeof getUser === 'function' ? getUser() : null;
  const isMarketing = user && (user.role === 'MARKETING' || (typeof isMarketingRole === 'function' && isMarketingRole(user.role)));

  // UI adjustments for marketing users
  const filterContainer = document.getElementById('filterAssignedMarketerContainer');
  const subtitleEl = document.getElementById('assignedClientsSubtitle');
  if (isMarketing) {
    if (filterContainer) filterContainer.style.display = 'none';
    if (subtitleEl && user.name) {
      subtitleEl.textContent = `Showing all client leads assigned to you (${user.name}) for follow-ups, calls, and negotiations.`;
    }
  } else {
    if (filterContainer) filterContainer.style.display = 'flex';
  }

  const searchVal = document.getElementById('filterAssignedSearch')?.value.trim() || '';
  const marketerVal = document.getElementById('filterAssignedMarketer')?.value || 'ALL';
  const statusVal = document.getElementById('filterAssignedStatus')?.value || 'ALL';

  if (container) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:3rem 1rem; color:#64748b;">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="2" class="spin" style="margin-bottom:0.5rem;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        <div>Loading assigned client leads & interaction flow...</div>
      </div>
    `;
  }
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:2rem;">Loading assigned clients...</td></tr>`;
  }

  try {
    const params = new URLSearchParams();
    if (searchVal) params.append('search', searchVal);
    if (statusVal && statusVal !== 'ALL') params.append('status', statusVal);

    if (isMarketing && user?.id) {
      // Marketer sees their own assigned leads
      params.append('assigned_to', user.id);
    } else {
      if (marketerVal && marketerVal !== 'ALL') {
        params.append('assigned_to', marketerVal);
      } else {
        params.append('assigned_to', 'assigned');
      }
    }

    const res = await apiFetch(`/enquiries?${params.toString()}`);
    allAssignedClients = res?.enquiries || [];

    // Calculate metrics
    updateMetrics(allAssignedClients);

    if (countLabel) {
      countLabel.textContent = `${allAssignedClients.length} Assigned Client${allAssignedClients.length === 1 ? '' : 's'}`;
    }

    if (allAssignedClients.length === 0) {
      const emptyHtml = `
        <div style="grid-column: 1/-1; text-align:center; padding:3.5rem 1rem; background:#fff; border:1px solid #e2e8f0; border-radius:12px;">
          <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:0.75rem;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="8"/></svg>
          <h3 style="margin:0 0 0.4rem 0; color:#334155;">No Assigned Clients Found</h3>
          <p style="color:#64748b; font-size:0.88rem; max-width:400px; margin:0 auto 1.25rem auto;">
            No enquiries match your current filter. You can assign marketing employees to leads from the Enquiries page.
          </p>
          <a href="enquiries.html" class="btn btn-primary btn-sm">+ Go to Enquiries to Assign</a>
        </div>
      `;
      if (container) container.innerHTML = emptyHtml;
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:2rem; color:#64748b;">No assigned clients found matching criteria.</td></tr>`;
      return;
    }

    renderCardsView(allAssignedClients);
    renderTableView(allAssignedClients);

  } catch (err) {
    const errHtml = `<div style="grid-column: 1/-1; padding:2rem; color:#dc2626; text-align:center;">Error loading assigned clients: ${escapeHtml(err.message)}</div>`;
    if (container) container.innerHTML = errHtml;
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-danger" style="padding:2rem;">${escapeHtml(err.message)}</td></tr>`;
  }
}

// 3. Update Metric KPI Counters
function updateMetrics(list = []) {
  const total = list.length;
  const inDiscussion = list.filter(e => e.status === 'IN_DISCUSSION' || e.status === 'NEGOTIATION').length;
  const quotes = list.filter(e => e.status === 'QUOTATION_SENT').length;
  const onboarded = list.filter(e => e.status === 'ONBOARDED').length;
  const pipelineSum = list.reduce((acc, e) => acc + (parseFloat(e.estimated_budget) || 0), 0);

  const elTotal = document.getElementById('metricTotalAssigned');
  const elDisc = document.getElementById('metricInDiscussion');
  const elQuotes = document.getElementById('metricQuoteSent');
  const elOnboarded = document.getElementById('metricOnboarded');
  const elPipeline = document.getElementById('metricTotalPipelineValue');

  if (elTotal) elTotal.textContent = total;
  if (elDisc) elDisc.textContent = inDiscussion;
  if (elQuotes) elQuotes.textContent = quotes;
  if (elOnboarded) elOnboarded.textContent = onboarded;
  if (elPipeline) elPipeline.textContent = typeof formatINR === 'function' ? formatINR(pipelineSum) : `₹${pipelineSum.toLocaleString('en-IN')}`;
}

// 4. Render Cards View
function renderCardsView(list = []) {
  const container = document.getElementById('assignedCardsContainer');
  if (!container) return;

  const isAdmin = typeof getUser === 'function' && getUser()?.role === 'ADMIN';

  container.innerHTML = list.map(enq => {
    const initials = getInitials(enq.business_name || enq.name);
    const sourceBadge = getEnquirySourceBadge(enq.source, enq.marketing_person);
    const statusBadge = getEnquiryStatusBadge(enq.status);
    const budgetFormatted = parseFloat(enq.estimated_budget || 0) > 0 
      ? (typeof formatINR === 'function' ? formatINR(enq.estimated_budget) : `₹${parseFloat(enq.estimated_budget).toLocaleString('en-IN')}`)
      : '<span style="color:#94a3b8;">Flexible / TBD</span>';

    const cleanMobile = (enq.mobile || '').replace(/[^0-9]/g, '');
    const waLink = cleanMobile ? `https://wa.me/91${cleanMobile.slice(-10)}` : '#';

    const statusClass = `status-${(enq.status || 'new').toLowerCase().replace(/_/g, '-')}`;

    return `
      <div class="client-flow-card ${statusClass}">
        <div>
          <!-- Card Top Header -->
          <div class="card-top-header">
            <div class="client-avatar-badge">${initials}</div>
            <div class="client-title-info">
              <h3 class="client-business-name" title="${escapeAttr(enq.business_name)}">
                <a href="enquiry-view.html?id=${enq.id}">${escapeHtml(enq.business_name)}</a>
              </h3>
              <div style="font-size:0.75rem; color:#64748b; display:flex; align-items:center; gap:0.35rem;">
                <span style="font-weight:700; color:#334155;">#ID ${enq.id}</span>
                <span>&bull;</span>
                <span>${formatDate(enq.created_at)}</span>
              </div>
            </div>
            ${statusBadge}
          </div>

          <!-- Badges Strip (Preserved Lead Source + Assigned Marketer) -->
          <div class="badges-row">
            <!-- Preserved Lead Source -->
            <div title="Original Lead Source (Preserved)">
              ${sourceBadge}
            </div>

            <!-- Assigned Marketer Badge -->
            <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700; border:1px solid #bfdbfe; font-size:0.74rem; display:inline-flex; align-items:center; gap:3px;" title="Assigned Marketing Executive">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${escapeHtml(enq.assigned_marketer_name || 'Assigned Marketer')}
            </span>

            ${isAdmin ? `
              <button type="button" onclick="openReassignModal(${enq.id}, '${escapeAttr(enq.business_name)}', ${enq.assigned_to})" class="btn btn-secondary btn-sm" title="Reassign to another marketer" style="padding:0.12rem 0.4rem; font-size:0.68rem; color:#0369a1; border-color:#bae6fd; background:#f0f9ff; cursor:pointer;">
                Reassign
              </button>
            ` : ''}
          </div>

          <!-- Contact Snippet Box -->
          <div class="contact-snippet-box">
            <div class="contact-line">
              <span>👤 <strong>${escapeHtml(enq.name)}</strong></span>
              ${enq.mobile ? `
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <a href="tel:${escapeAttr(enq.mobile)}" title="Call Client">📞 ${escapeHtml(enq.mobile)}</a>
                  <a href="${waLink}" target="_blank" title="Chat on WhatsApp" style="color:#16a34a; display:inline-flex; align-items:center;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.587 1.761.947 2.796.947 3.179 0 5.766-2.587 5.767-5.766.001-3.18-2.585-5.767-5.767-5.767zm7.426 5.766c-.001 4.101-3.339 7.437-7.428 7.437-1.309 0-2.537-.349-3.606-.957l-4.004 1.05 1.069-3.904c-.689-1.111-1.054-2.404-1.055-3.626.002-4.101 3.34-7.438 7.429-7.438 4.089 0 7.427 3.337 7.428 7.438z"/></svg>
                  </a>
                </div>
              ` : ''}
            </div>
            ${enq.email ? `
              <div class="contact-line">
                <span style="font-size:0.75rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px;">
                  ✉️ <a href="mailto:${escapeAttr(enq.email)}">${escapeHtml(enq.email)}</a>
                </span>
                ${enq.services_interested ? `<span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.65rem;">${escapeHtml(truncateStr(enq.services_interested, 20))}</span>` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Deal Budget & Services Strip -->
          <div class="deal-summary-strip">
            <div>
              <span style="color:#64748b; font-size:0.74rem; display:block;">Estimated Budget</span>
              <span class="deal-budget-val">${budgetFormatted}</span>
            </div>
            <div style="text-align:right;">
              <span style="color:#64748b; font-size:0.74rem; display:block;">Pipeline Stage</span>
              <select onchange="handleQuickStageChange(${enq.id}, this.value)" style="font-size:0.75rem; padding:0.2rem 0.4rem; border-radius:4px; border:1px solid #cbd5e1; font-weight:700; color:#1e293b; background:#fff; cursor:pointer;">
                <option value="NEW" ${enq.status === 'NEW' ? 'selected' : ''}>NEW</option>
                <option value="IN_DISCUSSION" ${enq.status === 'IN_DISCUSSION' ? 'selected' : ''}>DISCUSSION</option>
                <option value="QUOTATION_SENT" ${enq.status === 'QUOTATION_SENT' ? 'selected' : ''}>QUO SENT</option>
                <option value="NEGOTIATION" ${enq.status === 'NEGOTIATION' ? 'selected' : ''}>NEGOTIATION</option>
                <option value="ONBOARDED" ${enq.status === 'ONBOARDED' ? 'selected' : ''}>ONBOARDED</option>
                <option value="LOST" ${enq.status === 'LOST' ? 'selected' : ''}>LOST</option>
              </select>
            </div>
          </div>

          <!-- Flow Timeline Interaction Summary Box -->
          <div class="flow-timeline-box">
            <div class="flow-timeline-header">
              <span>Follow-up Flow & Activity</span>
              <div class="flow-stat-pills">
                <span class="flow-stat-pill call" title="Total calls logged">
                  📞 ${enq.total_calls || 0}
                </span>
                <span class="flow-stat-pill neg" title="Negotiation rounds">
                  🤝 ${enq.total_negotiations || 0}
                </span>
                <span class="flow-stat-pill quote" title="Quotations issued">
                  📄 ${enq.total_quotations || 0}
                </span>
              </div>
            </div>

            <div class="flow-latest-activity">
              ${enq.latest_timeline_detail ? `
                <strong>Latest:</strong> ${escapeHtml(enq.latest_timeline_detail)}
                <span style="font-size:0.7rem; color:#94a3b8; display:block; margin-top:2px;">${formatDate(enq.latest_activity_at)}</span>
              ` : `
                <span style="color:#94a3b8; font-style:italic;">No calls or interaction notes logged yet.</span>
              `}
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="card-action-footer">
          <div style="display:flex; gap:0.35rem; align-items:center;">
            <button type="button" onclick="openQuickLogModal(${enq.id}, '${escapeAttr(enq.business_name)}')" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:#15803d; border-color:#86efac; background:#f0fdf4; font-weight:700;">
              📞 Log Call
            </button>
            <a href="quotations.html?enquiry_id=${enq.id}" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:#0284c7; border-color:#bae6fd; font-weight:700; text-decoration:none;">
              📄 Quote
            </a>
          </div>

          <div style="display:flex; gap:0.35rem; align-items:center;">
            ${enq.status !== 'ONBOARDED' ? `
              <button type="button" onclick="handleConvertAssignedLead(${enq.id}, '${escapeAttr(enq.business_name)}')" class="btn btn-primary btn-sm" style="background:linear-gradient(135deg, #16a34a, #15803d); border:none; padding:0.25rem 0.55rem; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:0.2rem;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Onboard
              </button>
            ` : `
              <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.7rem; padding:0.2rem 0.45rem; font-weight:800;">Won</span>
            `}
            <a href="enquiry-view.html?id=${enq.id}" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.55rem; font-size:0.75rem; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:0.2rem;">
              👁️ 360° Flow
            </a>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// 5. Render Table View
function renderTableView(list = []) {
  const tbody = document.getElementById('assignedTableBody');
  if (!tbody) return;

  const isAdmin = typeof getUser === 'function' && getUser()?.role === 'ADMIN';

  tbody.innerHTML = list.map(enq => {
    const sourceBadge = getEnquirySourceBadge(enq.source, enq.marketing_person);
    const statusBadge = getEnquiryStatusBadge(enq.status);
    const budgetFormatted = parseFloat(enq.estimated_budget || 0) > 0 
      ? (typeof formatINR === 'function' ? formatINR(enq.estimated_budget) : `₹${parseFloat(enq.estimated_budget).toLocaleString('en-IN')}`)
      : '-';

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:0.75rem 1rem;">
          <strong style="font-size:0.92rem;"><a href="enquiry-view.html?id=${enq.id}" style="color:var(--primary); text-decoration:none;">${escapeHtml(enq.business_name)}</a></strong>
          <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
            ${escapeHtml(enq.name)} &bull; <a href="tel:${escapeAttr(enq.mobile)}" style="color:#2563eb; text-decoration:none;">${escapeHtml(enq.mobile)}</a>
          </div>
        </td>
        <td style="padding:0.75rem 1rem;">
          <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
            <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700; border:1px solid #bfdbfe; font-size:0.75rem;">
              👤 ${escapeHtml(enq.assigned_marketer_name || 'Assigned')}
            </span>
            ${isAdmin ? `
              <button type="button" onclick="openReassignModal(${enq.id}, '${escapeAttr(enq.business_name)}', ${enq.assigned_to})" class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem; color:#0369a1; border-color:#bae6fd; margin-top:2px;">
                Reassign
              </button>
            ` : ''}
          </div>
        </td>
        <td style="padding:0.75rem 1rem;">
          ${sourceBadge}
        </td>
        <td style="padding:0.75rem 1rem; font-weight:700; color:#0f172a;">
          ${budgetFormatted}
        </td>
        <td style="padding:0.75rem 1rem;">
          ${statusBadge}
        </td>
        <td style="padding:0.75rem 1rem;">
          <div style="font-size:0.78rem; color:#475569;">
            <span>📞 ${enq.total_calls || 0} calls &bull; 🤝 ${enq.total_negotiations || 0} neg</span>
            ${enq.latest_timeline_detail ? `<div style="font-size:0.72rem; color:#64748b; margin-top:2px; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(enq.latest_timeline_detail)}</div>` : ''}
          </div>
        </td>
        <td style="padding:0.75rem 1rem; text-align:right;">
          <div style="display:inline-flex; gap:0.3rem; align-items:center;">
            <button type="button" onclick="openQuickLogModal(${enq.id}, '${escapeAttr(enq.business_name)}')" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.45rem; font-size:0.72rem; color:#15803d; border-color:#86efac;" title="Log Call">
              📞 Log
            </button>
            <a href="enquiry-view.html?id=${enq.id}" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.45rem; font-size:0.72rem;" title="View Details">
              👁️ View
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 6. View Switcher (Cards vs Table)
function switchAssignedView(mode) {
  currentViewMode = mode;
  const cardsCont = document.getElementById('assignedCardsContainer');
  const tableCont = document.getElementById('assignedTableContainer');
  const btnCards = document.getElementById('btnViewCards');
  const btnTable = document.getElementById('btnViewTable');

  if (mode === 'cards') {
    if (cardsCont) cardsCont.style.display = 'grid';
    if (tableCont) tableCont.style.display = 'none';
    if (btnCards) { btnCards.style.background = '#fff'; btnCards.style.color = '#0f172a'; btnCards.style.fontWeight = '700'; }
    if (btnTable) { btnTable.style.background = 'transparent'; btnTable.style.color = '#64748b'; btnTable.style.fontWeight = '600'; }
  } else {
    if (cardsCont) cardsCont.style.display = 'none';
    if (tableCont) tableCont.style.display = 'block';
    if (btnCards) { btnCards.style.background = 'transparent'; btnCards.style.color = '#64748b'; btnCards.style.fontWeight = '600'; }
    if (btnTable) { btnTable.style.background = '#fff'; btnTable.style.color = '#0f172a'; btnTable.style.fontWeight = '700'; }
  }
}

// 7. Quick Stage Changer from Card Dropdown
async function handleQuickStageChange(enquiryId, newStatus) {
  try {
    await apiFetch(`/enquiries/${enquiryId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(`✓ Stage updated to ${newStatus}!`, 'success');
    await loadAssignedClients();
  } catch (err) {
    showToast('Failed to update stage: ' + err.message, 'error');
    await loadAssignedClients();
  }
}

// 8. Reassign Marketer Modal Handlers
function openReassignModal(enquiryId, businessName, currentMarketerId) {
  const modal = document.getElementById('reassignModal');
  if (!modal) return;

  document.getElementById('modalReassignEnquiryId').value = enquiryId;
  document.getElementById('modalReassignClientName').textContent = businessName || `#ID ${enquiryId}`;

  const select = document.getElementById('modalReassignSelect');
  if (select) {
    select.value = currentMarketerId ? String(currentMarketerId) : '';
  }

  modal.classList.add('active');
}

function closeReassignModal() {
  const modal = document.getElementById('reassignModal');
  if (modal) modal.classList.remove('active');
}

async function submitReassignMarketer() {
  const enquiryId = document.getElementById('modalReassignEnquiryId').value;
  const marketerId = document.getElementById('modalReassignSelect').value;
  const btn = document.getElementById('btnSaveReassign');

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

    showToast(res.message || '✓ Marketer assigned successfully!', 'success');
    closeReassignModal();
    await loadAssignedClients();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save & Assign'; }
  }
}

// 9. Quick Log Call & Interaction Modal Handlers
function openQuickLogModal(enquiryId, businessName) {
  const modal = document.getElementById('quickLogCallModal');
  if (!modal) return;

  document.getElementById('quickLogEnquiryId').value = enquiryId;
  document.getElementById('quickLogClientName').textContent = businessName || `#ID ${enquiryId}`;
  document.getElementById('quickLogTitle').value = '';
  document.getElementById('quickLogDetails').value = '';
  document.getElementById('quickLogStatus').value = '';

  modal.classList.add('active');
}

function closeQuickLogModal() {
  const modal = document.getElementById('quickLogCallModal');
  if (modal) modal.classList.remove('active');
}

async function submitQuickLog(e) {
  e.preventDefault();

  const enquiryId = document.getElementById('quickLogEnquiryId').value;
  const event_type = document.getElementById('quickLogType').value;
  const title = document.getElementById('quickLogTitle').value.trim();
  const details = document.getElementById('quickLogDetails').value.trim();
  const newStatus = document.getElementById('quickLogStatus').value;

  const btn = document.getElementById('btnSubmitQuickLog');
  if (!enquiryId || !title) return;

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    // 1. Log timeline note
    await apiFetch(`/enquiries/${enquiryId}/timeline`, {
      method: 'POST',
      body: JSON.stringify({ event_type, title, details })
    });

    // 2. If status was changed, update stage as well
    if (newStatus) {
      await apiFetch(`/enquiries/${enquiryId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
    }

    showToast('✓ Interaction logged in client flow!', 'success');
    closeQuickLogModal();
    await loadAssignedClients();
  } catch (err) {
    showToast('Failed to log interaction: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Interaction'; }
  }
}

// 10. Convert Assigned Lead to Client Master
async function handleConvertAssignedLead(enquiryId, businessName) {
  if (!confirm(`Are you sure you want to onboard "${businessName}" into Client Master? This will create a permanent client record and mark the lead as ONBOARDED.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/enquiries/${enquiryId}/convert`, {
      method: 'POST'
    });

    if (res.success) {
      showToast(`🎉 Success: Onboarded as Client #${res.clientId}!`, 'success');
      await loadAssignedClients();
    } else {
      showToast(res.message || 'Could not onboard client.', 'error');
    }
  } catch (err) {
    showToast('Failed to onboard: ' + err.message, 'error');
  }
}

// Helper: Debounce Search
function debounceAssignedSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadAssignedClients();
  }, 300);
}

// Helper: Initials
function getInitials(name) {
  if (!name) return 'CL';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Helper: Truncate string
function truncateStr(str, max = 25) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '...' : str;
}

// Helper: Badges
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
      return '<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800; border:1px solid #86efac;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:text-bottom; margin-right:2px;"><polyline points="20 6 9 17 4 12"/></svg>ONBOARDED</span>';
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

// Window exports
window.loadAssignedClients = loadAssignedClients;
window.switchAssignedView = switchAssignedView;
window.handleQuickStageChange = handleQuickStageChange;
window.openReassignModal = openReassignModal;
window.closeReassignModal = closeReassignModal;
window.submitReassignMarketer = submitReassignMarketer;
window.openQuickLogModal = openQuickLogModal;
window.closeQuickLogModal = closeQuickLogModal;
window.submitQuickLog = submitQuickLog;
window.handleConvertAssignedLead = handleConvertAssignedLead;
window.debounceAssignedSearch = debounceAssignedSearch;
