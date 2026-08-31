// 3-Tier Interactive Package Proposals CRM Controller
// Handles 3-Tier Multi-Package Proposals, Shareable Client Links, and 1-Click Quotation Conversion

let allPackageProposals = [];
let availableServiceMasterItems = [];

const DEFAULT_CANVA_PRESETS = [
  {
    name: 'Starter Boost',
    subtitle: 'Foundation Growth Plan',
    price: 29999,
    price_formatted: 'Rs.29,999/ Month',
    badge_type: 'STARTER',
    badge_text: 'STARTER',
    is_recommended: false,
    services: [
      {
        title: '1. Social Media Management & Marketing',
        sub_items: [
          'Manage 4 platforms (Facebook, Instagram, Pinterest, YouTube)',
          'Create and schedule 5 posts + 7 Videos per month'
        ]
      },
      {
        title: '2. Meta Ads (Lead Generation)',
        sub_items: [
          'Ad Campaign Management & Targeted Ads Creation',
          'Pixel Setup & Business Verification',
          'Audience Segmentation & A/B Testing',
          'Performance Tracking & Campaign Optimization'
        ]
      }
    ]
  },
  {
    name: 'Pro Accelerator',
    subtitle: '+ Starter Boost',
    price: 37999,
    price_formatted: 'Rs. 37,999/ Month',
    badge_type: 'MOST_POPULAR',
    badge_text: 'MOST POPULAR',
    is_recommended: false,
    services: [
      {
        title: '1. Keyword Rankings',
        sub_items: [
          '8 - 12 Main Keywords for your business'
        ]
      },
      {
        title: '2. Google My Business (GMB) Listing',
        sub_items: [
          'Setup and optimization of GMB listing',
          'Accurate information, photos, and regular updates'
        ]
      },
      {
        title: '3. Google My Business Optimization',
        sub_items: [
          'Advanced optimization techniques to enhance visibility & engagement'
        ]
      },
      {
        title: '4. Google Analytics & Search Console Setup',
        sub_items: [
          'Configure GA4 account & integrate tracking code',
          'Set up conversion tracking and verify website ownership'
        ]
      }
    ]
  },
  {
    name: 'Growth Plan',
    subtitle: 'Starter Boost + Pro Accelerator (All In One)',
    price: 44999,
    price_formatted: 'Rs.44,999/ Month',
    badge_type: 'RECOMMENDED',
    badge_text: 'RECOMMENDED',
    is_recommended: true,
    services: [
      {
        title: '1. Keyword Rankings',
        sub_items: [
          'Unlimited Keywords for your business'
        ]
      },
      {
        title: '2. Local SEO Research & Ranking',
        sub_items: [
          'In-depth research on local SEO keywords, competitors & market trends',
          'Implementation of strategies to improve local search rankings'
        ]
      },
      {
        title: '3. Google My Business Regular Updates',
        sub_items: [
          'Regular updates on Google My Business with 26 posts per month',
          'Content creation, scheduling, and continuous optimization'
        ]
      },
      {
        title: '4. Google Tags Implementation',
        sub_items: [
          'Configure tags for tracking user interactions and conversions'
        ]
      }
    ]
  }
];

// Current working copy of the 3 packages in modal
let modalPackages = JSON.parse(JSON.stringify(DEFAULT_CANVA_PRESETS));

document.addEventListener('DOMContentLoaded', () => {
  loadPackageProposals();
  loadServiceMasterOptions();

  // Check URL parameters for active tab
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'quotes' || tabParam === 'standard') {
      switchMainQuotationsTab('STANDARD_QUOTES');
    } else {
      switchMainQuotationsTab('PROPOSALS');
    }
  } catch(e) {}
});

// Load Services Master for Autocomplete in proposals
async function loadServiceMasterOptions() {
  try {
    const res = await apiFetch('/services');
    if (res && res.services) {
      availableServiceMasterItems = res.services;
    }
  } catch (err) {
    console.error('Error fetching service master options:', err);
  }
}

// Fetch all 3-Tier proposals from backend
async function loadPackageProposals() {
  const tableBody = document.getElementById('proposalsTableBody');
  if (!tableBody) return;

  try {
    const res = await apiFetch('/proposals');
    if (!res || !res.success) {
      tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#94a3b8;">Failed to load proposals.</td></tr>';
      return;
    }

    allPackageProposals = res.proposals || [];
    renderProposalsTable(allPackageProposals);
    updateProposalMetrics(allPackageProposals);
  } catch (err) {
    console.error('Error loading package proposals:', err);
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#ef4444;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function updateProposalMetrics(proposals = []) {
  const total = proposals.length;
  let accepted = 0;
  let viewed = 0;
  let converted = 0;

  proposals.forEach(p => {
    if (p.status === 'ACCEPTED') accepted++;
    else if (p.status === 'VIEWED') viewed++;
    else if (p.status === 'CONVERTED') converted++;
  });

  if (document.getElementById('statTotalProposals')) {
    document.getElementById('statTotalProposals').textContent = total;
  }
  if (document.getElementById('statAcceptedProposals')) {
    document.getElementById('statAcceptedProposals').textContent = accepted;
  }
  if (document.getElementById('statViewedProposals')) {
    document.getElementById('statViewedProposals').textContent = viewed;
  }
  if (document.getElementById('statConvertedProposals')) {
    document.getElementById('statConvertedProposals').textContent = converted;
  }
}

function renderProposalsTable(proposals = []) {
  const tableBody = document.getElementById('proposalsTableBody');
  if (!tableBody) return;

  if (proposals.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3.5rem 1rem; color:#64748b;">
          <div style="width:56px; height:56px; border-radius:50%; background:#f1f5f9; color:#64748b; display:flex; align-items:center; justify-content:center; margin:0 auto 0.75rem;">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <div style="font-weight:800; font-size:1.05rem; color:var(--text-main, #0f172a); margin-bottom:0.35rem;">No 3-Tier Package Proposals Created Yet</div>
          <p style="font-size:0.86rem; color:#94a3b8; max-width:460px; margin:0 auto 1.25rem;">
            Create your first bespoke 3-tier quotation proposal (Starter, Pro, Growth) and generate a shareable client link.
          </p>
          <a href="create-proposal.html" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.55rem 1.25rem; font-weight:700;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create New 3-Tier Proposal
          </a>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = proposals.map(p => {
    const packages = p.packages || [];
    const prefix = typeof getAppPathPrefix === 'function' ? getAppPathPrefix() : '';
    const publicUrl = `${window.location.origin}${prefix}/proposal.html?token=${encodeURIComponent(p.share_token)}`;

    // Status Badge Formatting with Vector Icons
    let statusBadge = '';
    if (p.status === 'ACCEPTED') {
      statusBadge = `
        <span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-weight:800; display:inline-flex; align-items:center; gap:0.3rem;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          ACCEPTED: ${escapeHtml(p.selected_package_name || 'Plan')}
        </span>
      `;
    } else if (p.status === 'CONVERTED') {
      statusBadge = `
        <span class="badge" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-weight:800; display:inline-flex; align-items:center; gap:0.3rem;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          CONVERTED
        </span>
      `;
    } else if (p.status === 'VIEWED') {
      statusBadge = `
        <span class="badge" style="background:#fefce8; color:#a16207; border:1px solid #fef08a; font-weight:700; display:inline-flex; align-items:center; gap:0.3rem;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          VIEWED
        </span>
      `;
    } else {
      statusBadge = `
        <span class="badge" style="background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; font-weight:700; display:inline-flex; align-items:center; gap:0.3rem;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          SENT
        </span>
      `;
    }

    // Pricing pills summary: strictly highlight the CLIENT-SELECTED plan in red
    const isAcceptedOrConfirmed = (p.status === 'ACCEPTED' || p.status === 'CONVERTED' || Boolean(p.confirmed_at));
    const selectedIdx = (p.selected_package_index !== null && p.selected_package_index !== undefined) ? parseInt(p.selected_package_index, 10) : null;
    const selectedName = (p.selected_package_name || '').trim().toLowerCase();

    const pricingPills = packages.map((pkg, idx) => {
      const pkgNameClean = (pkg.name || '').trim().toLowerCase();
      const isClientSelected = (selectedIdx !== null && selectedIdx === idx) || (selectedName && selectedName === pkgNameClean);
      const isRecommended = (pkg.badge_type === 'RECOMMENDED' || pkg.is_recommended || idx === 2);
      
      // If client confirmed a plan, highlight ONLY the chosen plan in red!
      // If not yet confirmed, highlight recommended tier in soft red.
      const shouldHighlightRed = isAcceptedOrConfirmed ? isClientSelected : isRecommended;

      return `
        <div style="margin-bottom:3px;">
          <span style="display:inline-flex; align-items:center; gap:0.3rem; font-size:0.75rem; padding:2px 7px; border-radius:5px; background:${shouldHighlightRed ? '#ffe4e6' : '#f1f5f9'}; color:${shouldHighlightRed ? '#e11d48' : '#334155'}; font-weight:${shouldHighlightRed ? '800' : '600'}; border:1px solid ${shouldHighlightRed ? '#fecdd3' : '#e2e8f0'};">
            ${isClientSelected ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            <span>${escapeHtml(pkg.name)}: <strong>${pkg.price_formatted || ('Rs.' + Number(pkg.price||0).toLocaleString('en-IN') + '/M')}</strong></span>
            ${isClientSelected ? '<span style="font-size:0.62rem; background:#e11d48; color:#ffffff; padding:1px 4px; border-radius:3px; font-weight:800; letter-spacing:0.3px;">CHOSEN</span>' : ''}
          </span>
        </div>
      `;
    }).join('');

    return `
      <tr style="border-bottom:1px solid #e2e8f0; transition:background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
        <!-- Code & Date -->
        <td style="padding:0.85rem 1rem; vertical-align:middle;">
          <div style="font-weight:800; font-family:'Outfit',sans-serif; color:var(--primary, #e11d48); font-size:0.92rem;">${escapeHtml(p.proposal_code)}</div>
          <div style="font-size:0.72rem; color:#94a3b8;">${formatDate(p.created_at)}</div>
        </td>

        <!-- Client & Contact -->
        <td style="padding:0.85rem 1rem; vertical-align:middle;">
          <div style="font-weight:800; color:var(--text-main, #0f172a); font-size:0.92rem;">${escapeHtml(p.client_name)}</div>
          <div style="font-size:0.75rem; color:#64748b; display:flex; align-items:center; gap:0.4rem; margin-top:2px;">
            ${p.contact_person ? `<span>${escapeHtml(p.contact_person)}</span> &bull; ` : ''}
            <a href="tel:${escapeAttr(p.mobile)}" style="color:inherit; font-weight:600;">${escapeHtml(p.mobile)}</a>
          </div>
        </td>

        <!-- Proposal Title -->
        <td style="padding:0.85rem 1rem; vertical-align:middle;">
          <div style="font-weight:700; color:#334155; font-size:0.85rem;">${escapeHtml(p.title || 'Digital Marketing Growth Proposal')}</div>
          <div style="font-size:0.72rem; color:#94a3b8;">Cycle: ${escapeHtml(p.billing_cycle || 'Monthly')}</div>
        </td>

        <!-- 3 Packages Pricing -->
        <td style="padding:0.85rem 1rem; vertical-align:middle; max-width:280px;">
          <div>${pricingPills}</div>
        </td>

        <!-- Status Badge -->
        <td style="padding:0.85rem 1rem; vertical-align:middle; text-align:center;">
          ${statusBadge}
          ${p.confirmed_at ? `<div style="font-size:0.68rem; color:#16a34a; margin-top:3px;">Confirmed ${formatDate(p.confirmed_at)}</div>` : ''}
        </td>

        <!-- Action Buttons (Icon-Only with Tooltips) -->
        <td style="padding:0.85rem 1rem; vertical-align:middle; text-align:right;">
          <div style="display:inline-flex; align-items:center; gap:0.35rem; justify-content:flex-end;">
            
            <!-- WhatsApp Share Button -->
            <button type="button" class="btn btn-sm" onclick="shareProposalOnWhatsApp('${escapeAttr(p.share_token)}', '${escapeAttr(p.client_name)}', '${escapeAttr(p.mobile)}')" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:6px;" title="Send Proposal via WhatsApp">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </button>

            <!-- Copy Link Button -->
            <button type="button" class="btn btn-secondary btn-sm" onclick="copyProposalLink('${escapeAttr(p.share_token)}')" style="width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:6px;" title="Copy Public Client Link">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>

            <!-- Live Client Preview Button -->
            <a href="${publicUrl}" target="_blank" class="btn btn-secondary btn-sm" style="width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:6px;" title="Open Client View Page">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>

            <!-- Edit Proposal in Inner Page -->
            <a href="create-proposal.html?id=${p.id}" class="btn btn-secondary btn-sm" style="width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:6px;" title="Edit Proposal">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>

            <!-- Convert to Official Quotation -->
            ${p.status !== 'CONVERTED' ? `
              <button type="button" class="btn btn-primary btn-sm" onclick="handleConvertProposalToQuotation(${p.id})" style="background:linear-gradient(135deg, #16a34a, #15803d); border:none; width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:6px;" title="Convert confirmed package to official quotation">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </button>
            ` : `
              <span style="width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; color:#16a34a; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px;" title="Converted to Official Quotation">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            `}

            <!-- Delete Proposal -->
            <button type="button" class="btn-delete" onclick="handleDeleteProposal(${p.id}, '${escapeAttr(p.proposal_code)}')" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; width:32px; height:32px; padding:0; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Delete Proposal">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Redirects directly to the dedicated create proposal page
function openCreateProposalModal() {
  window.location.href = 'create-proposal.html';
}

// Open Modal to Create a New 3-Tier Proposal
function openCreateProposalModal() {
  document.getElementById('proposalModalTitle').textContent = 'Create 3-Tier Package Proposal (Shareable Link)';
  document.getElementById('proposalEditId').value = '';
  document.getElementById('proposalTitleInput').value = 'Digital Marketing Growth Proposal';
  document.getElementById('proposalCycleInput').value = 'Monthly';

  // Populate client dropdown
  populateProposalClientsDropdown();

  // Reset to default 3 packages
  modalPackages = JSON.parse(JSON.stringify(DEFAULT_CANVA_PRESETS));
  renderModalPackageCards();

  document.getElementById('proposalModal').classList.add('active');
}

function closeProposalModal() {
  document.getElementById('proposalModal').classList.remove('active');
}

function populateProposalClientsDropdown() {
  const select = document.getElementById('proposalClientSelect');
  if (!select) return;

  const clients = (typeof allAvailableClients !== 'undefined' && allAvailableClients.length > 0) ? allAvailableClients : [];
  
  select.innerHTML = '<option value="">-- Choose Existing Client (or Type New Below) --</option>' + clients.map(c => `
    <option value="${escapeAttr(c.company_name)}" data-person="${escapeAttr(c.contact_person || '')}" data-mobile="${escapeAttr(c.mobile || '')}" data-email="${escapeAttr(c.email || '')}" data-id="${c.id}">
      ${escapeHtml(c.company_name)} (${escapeHtml(c.contact_person || 'Client')})
    </option>
  `).join('');
}

function onProposalClientSelected(e) {
  const select = e.target;
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) return;

  document.getElementById('propClientName').value = opt.value;
  document.getElementById('propContactPerson').value = opt.dataset.person || '';
  document.getElementById('propMobile').value = opt.dataset.mobile || '';
  document.getElementById('propEmail').value = opt.dataset.email || '';
}

function loadPresetCanvaPackages() {
  modalPackages = JSON.parse(JSON.stringify(DEFAULT_CANVA_PRESETS));
  renderModalPackageCards();
  showToast('Loaded standard 3-Tier Canva Preset (Starter Boost, Pro Accelerator, Growth Plan)!', 'success');
}

// Render the 3 package editor cards inside modal
function renderModalPackageCards() {
  const container = document.getElementById('modalPackageCardsContainer');
  if (!container) return;

  container.innerHTML = modalPackages.map((pkg, pIdx) => {
    const isRecommended = pkg.badge_type === 'RECOMMENDED' || pkg.is_recommended;

    return `
      <div class="tier-editor-box" style="background:#ffffff; border:2px solid ${isRecommended ? '#e11d48' : '#e2e8f0'}; border-radius:12px; padding:1.15rem; position:relative; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; border-bottom:1px solid #f1f5f9; padding-bottom:0.5rem;">
          <span style="font-weight:900; font-size:0.95rem; color:${isRecommended ? '#e11d48' : '#0f172a'};">
            ${isRecommended ? '⭐ ' : ''}Tier #${pIdx + 1}: ${escapeHtml(pkg.name)}
          </span>
          <span style="font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:4px; background:${isRecommended ? '#ffe4e6' : '#f1f5f9'}; color:${isRecommended ? '#e11d48' : '#64748b'};">
            ${escapeHtml(pkg.badge_type || 'STANDARD')}
          </span>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
          <div>
            <label style="font-size:0.72rem; font-weight:700; color:#475569; display:block; margin-bottom:2px;">Package Name</label>
            <input type="text" class="form-input form-input-sm" value="${escapeAttr(pkg.name)}" oninput="modalPackages[${pIdx}].name = this.value" style="font-weight:700;">
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:700; color:#475569; display:block; margin-bottom:2px;">Price (₹ / Month)</label>
            <input type="number" class="form-input form-input-sm" value="${pkg.price}" oninput="modalPackages[${pIdx}].price = parseFloat(this.value)||0; modalPackages[${pIdx}].price_formatted = 'Rs.' + Number(this.value).toLocaleString('en-IN') + '/ Month';" style="font-weight:800; color:#e11d48;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.75rem;">
          <div>
            <label style="font-size:0.72rem; font-weight:700; color:#475569; display:block; margin-bottom:2px;">Subtitle Copy</label>
            <input type="text" class="form-input form-input-sm" value="${escapeAttr(pkg.subtitle || '')}" oninput="modalPackages[${pIdx}].subtitle = this.value" placeholder="e.g. + Starter Boost">
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:700; color:#475569; display:block; margin-bottom:2px;">Top Badge Ribbon</label>
            <select class="form-select form-select-sm" onchange="modalPackages[${pIdx}].badge_type = this.value; modalPackages[${pIdx}].is_recommended = (this.value === 'RECOMMENDED'); renderModalPackageCards();">
              <option value="STARTER" ${pkg.badge_type === 'STARTER' ? 'selected' : ''}>Checkmark Circle (Starter)</option>
              <option value="MOST_POPULAR" ${pkg.badge_type === 'MOST_POPULAR' ? 'selected' : ''}>MOST POPULAR (Thumbs Up)</option>
              <option value="RECOMMENDED" ${pkg.badge_type === 'RECOMMENDED' ? 'selected' : ''}>RECOMMENDED (Box Badge)</option>
            </select>
          </div>
        </div>

        <!-- Service Features Breakdown -->
        <div style="margin-bottom:0.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label style="font-size:0.75rem; font-weight:800; color:#0f172a;">Services & Feature Bullets (${(pkg.services || []).length})</label>
            <div style="display:inline-flex; gap:0.25rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="addCustomFeatureToPackage(${pIdx})" style="font-size:0.7rem; padding:2px 6px;">+ Add Custom Bullet</button>
            </div>
          </div>

          <!-- Quick pick from Services Master -->
          <div style="display:flex; gap:0.35rem; margin-bottom:0.5rem;">
            <select id="quickPickService_${pIdx}" class="form-select form-select-sm" style="font-size:0.75rem; flex:1;">
              <option value="">-- Add Service from Services Master --</option>
              ${availableServiceMasterItems.map(s => `<option value="${escapeAttr(s.name)}">${escapeHtml(s.name)} (₹${parseFloat(s.default_rate).toLocaleString('en-IN')})</option>`).join('')}
            </select>
            <button type="button" class="btn btn-primary btn-sm" onclick="addServiceFromMasterToPackage(${pIdx})" style="font-size:0.72rem; padding:2px 8px;">+ Add</button>
          </div>

          <!-- Features List -->
          <div id="packageFeaturesList_${pIdx}" style="display:flex; flex-direction:column; gap:0.35rem; max-height:220px; overflow-y:auto; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.5rem;">
            ${renderModalFeatureRows(pkg, pIdx)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderModalFeatureRows(pkg, pIdx) {
  const services = pkg.services || [];
  if (services.length === 0) {
    return '<div style="font-size:0.75rem; color:#94a3b8; text-align:center; padding:0.5rem;">No features added yet. Click "+ Add Custom Bullet" or choose from Services Master above.</div>';
  }

  return services.map((s, sIdx) => {
    const title = typeof s === 'string' ? s : (s.title || s.name || '');
    const subItems = (typeof s === 'object' && s.sub_items) ? s.sub_items.join('\n') : '';

    return `
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:0.4rem 0.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem; margin-bottom:3px;">
          <input type="text" class="form-input form-input-sm" value="${escapeAttr(title)}" placeholder="Main Feature / Service Title" oninput="updatePackageFeatureTitle(${pIdx}, ${sIdx}, this.value)" style="font-weight:700; font-size:0.78rem; flex:1;">
          <button type="button" onclick="removePackageFeature(${pIdx}, ${sIdx})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-weight:800; font-size:0.9rem;" title="Delete bullet">&times;</button>
        </div>
        <textarea rows="2" class="form-input form-input-sm" placeholder="Sub-bullets (one per line, e.g. Facebook, Instagram, Local SEO)" oninput="updatePackageFeatureSubItems(${pIdx}, ${sIdx}, this.value)" style="font-size:0.72rem; color:#475569; width:100%;">${escapeHtml(subItems)}</textarea>
      </div>
    `;
  }).join('');
}

function addCustomFeatureToPackage(pIdx) {
  if (!modalPackages[pIdx].services) modalPackages[pIdx].services = [];
  modalPackages[pIdx].services.push({
    title: 'New Service / Deliverable',
    sub_items: ['• Detail item #1']
  });
  renderModalPackageCards();
}

function addServiceFromMasterToPackage(pIdx) {
  const select = document.getElementById(`quickPickService_${pIdx}`);
  if (!select || !select.value) return;

  if (!modalPackages[pIdx].services) modalPackages[pIdx].services = [];
  modalPackages[pIdx].services.push({
    title: select.value,
    sub_items: ['• End-to-end execution & monthly reporting']
  });

  select.value = '';
  renderModalPackageCards();
}

function updatePackageFeatureTitle(pIdx, sIdx, val) {
  if (!modalPackages[pIdx].services[sIdx]) return;
  if (typeof modalPackages[pIdx].services[sIdx] === 'string') {
    modalPackages[pIdx].services[sIdx] = { title: val, sub_items: [] };
  } else {
    modalPackages[pIdx].services[sIdx].title = val;
  }
}

function updatePackageFeatureSubItems(pIdx, sIdx, val) {
  if (!modalPackages[pIdx].services[sIdx]) return;
  const lines = val.split('\n').map(l => l.trim()).filter(Boolean);
  if (typeof modalPackages[pIdx].services[sIdx] === 'string') {
    modalPackages[pIdx].services[sIdx] = { title: modalPackages[pIdx].services[sIdx], sub_items: lines };
  } else {
    modalPackages[pIdx].services[sIdx].sub_items = lines;
  }
}

function removePackageFeature(pIdx, sIdx) {
  if (!modalPackages[pIdx].services) return;
  modalPackages[pIdx].services.splice(sIdx, 1);
  renderModalPackageCards();
}

// Save 3-Tier Proposal to Backend
async function handleSaveProposal(e) {
  if (e) e.preventDefault();

  const editId = document.getElementById('proposalEditId').value;
  const clientName = document.getElementById('propClientName').value.trim();
  const contactPerson = document.getElementById('propContactPerson').value.trim();
  const mobile = document.getElementById('propMobile').value.trim();
  const email = document.getElementById('propEmail').value.trim();
  const title = document.getElementById('proposalTitleInput').value.trim();
  const billingCycle = document.getElementById('proposalCycleInput').value;

  if (!clientName || !mobile) {
    showToast('Client / Business Name and Mobile Number are required.', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitProposal');
  const origText = btn.innerHTML;
  btn.innerHTML = 'Saving Proposal...';
  btn.disabled = true;

  try {
    const payload = {
      client_name: clientName,
      contact_person: contactPerson,
      mobile: mobile,
      email: email,
      title: title || 'Digital Marketing Growth Proposal',
      billing_cycle: billingCycle,
      packages: modalPackages
    };

    let res;
    if (editId) {
      res = await apiFetch(`/proposals/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Proposal updated successfully!', 'success');
      closeProposalModal();
      loadPackageProposals();
    } else {
      res = await apiFetch('/proposals', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('3-Tier Package Proposal created successfully!', 'success');
      closeProposalModal();
      loadPackageProposals();

      // Open Share Popover automatically
      if (res.shareToken) {
        openShareProposalModal(res.proposalId, res.proposalCode, res.shareToken, clientName, mobile);
      }
    }
  } catch (err) {
    showToast(err.message || 'Failed to save proposal', 'error');
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

// Share Popover Modal
function openShareProposalModal(id, code, token, clientName, mobile) {
  const prefix = typeof getAppPathPrefix === 'function' ? getAppPathPrefix() : '';
  const publicUrl = `${window.location.origin}${prefix}/proposal.html?token=${encodeURIComponent(token)}`;

  document.getElementById('shareModalCode').textContent = code || 'Proposal';
  document.getElementById('shareModalClient').textContent = clientName || 'Client';
  document.getElementById('shareModalUrlInput').value = publicUrl;

  document.getElementById('shareModalWhatsAppBtn').onclick = () => {
    shareProposalOnWhatsApp(token, clientName, mobile);
  };
  document.getElementById('shareModalViewBtn').href = publicUrl;

  document.getElementById('shareProposalModal').classList.add('active');
}

function closeShareProposalModal() {
  document.getElementById('shareProposalModal').classList.remove('active');
}

function copyProposalLink(token) {
  const prefix = typeof getAppPathPrefix === 'function' ? getAppPathPrefix() : '';
  const publicUrl = `${window.location.origin}${prefix}/proposal.html?token=${encodeURIComponent(token)}`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(publicUrl).then(() => {
      showToast('Public Proposal Link copied to clipboard!', 'success');
    }).catch(() => {
      prompt('Copy proposal link:', publicUrl);
    });
  } else {
    prompt('Copy proposal link:', publicUrl);
  }
}

function shareProposalOnWhatsApp(token, clientName, mobile) {
  const prefix = typeof getAppPathPrefix === 'function' ? getAppPathPrefix() : '';
  const publicUrl = `${window.location.origin}${prefix}/proposal.html?token=${encodeURIComponent(token)}`;
  const cleanMobile = (mobile || '').replace(/[^0-9]/g, '');

  const msg = `Hi ${clientName || 'there'},

Here is your customized Digital Marketing Growth Strategy Proposal from *D-GROW Marketing Agency*:
Proposal Link: ${publicUrl}

Please review the 3 tailored package options (Starter Boost, Pro Accelerator, Growth Plan) and select your preferred plan directly on the link.

Feel free to reach out if you have any questions!`;

  const waUrl = cleanMobile 
    ? `https://wa.me/${cleanMobile.startsWith('91') ? cleanMobile : '91' + cleanMobile}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  window.open(waUrl, '_blank');
}

// Convert 3-tier confirmed package into official quotation in CRM
async function handleConvertProposalToQuotation(proposalId) {
  if (!confirm('Convert this confirmed package proposal into an Official Quotation in the CRM?')) return;

  try {
    const res = await apiFetch(`/proposals/${proposalId}/convert-quotation`, {
      method: 'POST'
    });

    showToast(res.message || 'Converted to official quotation!', 'success');

    // Add newly created quotation object directly into localStorage and memory so it shows up in Quotations table immediately!
    if (res.quotation) {
      let storedQuotes = [];
      try {
        const storedStr = localStorage.getItem('dgrow_quotations_v2');
        if (storedStr) storedQuotes = JSON.parse(storedStr);
      } catch (e) {
        storedQuotes = [];
      }

      // Check if already exists in list
      const exists = storedQuotes.some(q => q.quoteNumber === res.quotation.quoteNumber || q.id === res.quotation.id);
      if (!exists) {
        storedQuotes.unshift(res.quotation);
        localStorage.setItem('dgrow_quotations_v2', JSON.stringify(storedQuotes));
      }

      // If quotationsList exists in current page scope
      if (typeof quotationsList !== 'undefined' && Array.isArray(quotationsList)) {
        if (!quotationsList.some(q => q.quoteNumber === res.quotation.quoteNumber || q.id === res.quotation.id)) {
          quotationsList.unshift(res.quotation);
        }
        if (typeof applyQuotationFilters === 'function') {
          applyQuotationFilters();
        }
        if (typeof updateQuotationMetrics === 'function') {
          updateQuotationMetrics();
        }
      }
    }

    await loadPackageProposals();

    // Switch to quotations tab to view
    switchMainQuotationsTab('STANDARD_QUOTES');
  } catch (err) {
    showToast(err.message || 'Failed to convert proposal', 'error');
  }
}

async function handleDeleteProposal(proposalId, proposalCode) {
  if (!confirm(`Are you sure you want to permanently delete proposal #${proposalCode}? This action cannot be undone.`)) return;

  try {
    const res = await apiFetch(`/proposals/${proposalId}`, {
      method: 'DELETE'
    });
    showToast(res.message || 'Proposal deleted.', 'success');
    loadPackageProposals();
  } catch (err) {
    showToast(err.message || 'Failed to delete proposal', 'error');
  }
}

// Tab Switcher between 3-Tier Proposals and Standard Quotations
function switchMainQuotationsTab(tabKey) {
  const tabProposals = document.getElementById('tabNavProposals');
  const tabStandard = document.getElementById('tabNavStandard');
  const viewProposals = document.getElementById('proposalsViewSection');
  const viewStandard = document.getElementById('standardQuotesViewSection');
  const sidebarProposals = document.getElementById('sidebarNavProposals');
  const sidebarQuotations = document.getElementById('sidebarNavQuotations');

  if (tabKey === 'PROPOSALS') {
    if (tabProposals) tabProposals.classList.add('active');
    if (tabStandard) tabStandard.classList.remove('active');
    if (viewProposals) viewProposals.style.display = 'block';
    if (viewStandard) viewStandard.style.display = 'none';

    // Sidebar active state
    if (sidebarProposals) sidebarProposals.classList.add('active');
    if (sidebarQuotations) sidebarQuotations.classList.remove('active');

    // Update URL query param cleanly without reload
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', 'quotations.html?tab=proposals');
    }
  } else {
    if (tabProposals) tabProposals.classList.remove('active');
    if (tabStandard) tabStandard.classList.add('active');
    if (viewProposals) viewProposals.style.display = 'none';
    if (viewStandard) viewStandard.style.display = 'block';

    // Sidebar active state
    if (sidebarQuotations) sidebarQuotations.classList.add('active');
    if (sidebarProposals) sidebarProposals.classList.remove('active');

    // Update URL query param cleanly without reload
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', 'quotations.html?tab=quotes');
    }

    if (typeof applyQuotationFilters === 'function') {
      applyQuotationFilters();
    }
  }
}
