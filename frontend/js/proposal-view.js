// Public Client 3-Tier Proposal View Controller

function getApiBaseUrl() {
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  if (isLocalhost) {
    return window.location.port === '5000' ? '/api' : 'http://localhost:5000/api';
  }
  return '/api';
}

const API_BASE = getApiBaseUrl();

let currentProposal = null;
let currentToken = '';
let selectedPkgIndex = null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentToken = urlParams.get('token') || urlParams.get('id') || '';

  if (!currentToken) {
    showErrorState('Invalid proposal link. No share token was provided in the URL.');
    return;
  }

  loadProposalData(currentToken);
});

async function loadProposalData(token) {
  try {
    const res = await fetch(`${API_BASE}/proposals/public/${encodeURIComponent(token)}`);
    const data = await res.json();

    if (!data || !data.success || !data.proposal) {
      showErrorState(data.message || 'Proposal not found or link has expired.');
      return;
    }

    currentProposal = data.proposal;
    const company = data.company || {};

    renderProposalHeader(currentProposal, company);
    renderPricingGrid(currentProposal.packages || []);

    // Check if already confirmed
    if (currentProposal.status === 'ACCEPTED' || currentProposal.status === 'CONVERTED') {
      const banner = document.getElementById('confirmedBanner');
      const bannerText = document.getElementById('confirmedBannerText');
      if (banner && bannerText) {
        banner.classList.add('active');
        bannerText.innerHTML = `You have officially confirmed the <strong>${escapeHtml(currentProposal.selected_package_name || 'selected plan')}</strong>. Our team is working on your onboarding.`;
      }
    }

    document.getElementById('proposalLoader').style.display = 'none';
    document.getElementById('pricingGrid').style.display = 'grid';
  } catch (err) {
    console.error('Error fetching proposal:', err);
    showErrorState('Unable to connect to server. Please try again later.');
  }
}

function renderProposalHeader(proposal, company) {
  if (proposal.title) {
    document.title = `${proposal.title} - D-GROW Marketing Agency`;
    const titleEl = document.getElementById('proposalTitle');
    if (titleEl) {
      titleEl.textContent = proposal.title;
    }
  }

  if (proposal.client_name) {
    const badge = document.getElementById('clientBadge');
    const badgeText = document.getElementById('clientNameText');
    if (badge && badgeText) {
      badge.style.display = 'inline-flex';
      badgeText.textContent = `Prepared Exclusively for: ${proposal.client_name}`;
    }
  }

  const footerName = document.getElementById('footerAgencyName');
  if (footerName && company.company_name) {
    footerName.textContent = company.company_name;
  }

  const footerAddr = document.getElementById('footerAddressInfo');
  if (footerAddr && company.address) {
    footerAddr.textContent = `${company.address}, ${company.city || 'Chennai'} - ${company.pincode || '600087'}`;
  }

  const footerContact = document.getElementById('footerContactInfo');
  if (footerContact) {
    const webUrl = (company.website || 'https://dgrowmarketing.com/').startsWith('http') 
      ? (company.website || 'https://dgrowmarketing.com/') 
      : `https://${company.website}`;

    footerContact.innerHTML = `
      <span>Phone: <strong>${escapeHtml(company.phone || '+91 9600401582 | +91 7373509585')}</strong></span> &bull; 
      <span>Email: <strong>${escapeHtml(company.email || 'dgrowmarkting@gmail.com')}</strong></span> &bull; 
      <span>Website: <a href="${escapeAttr(webUrl)}" target="_blank">${escapeHtml(webUrl)}</a></span>
    `;
  }
}

function renderPricingGrid(packages = []) {
  const container = document.getElementById('pricingGrid');
  if (!container) return;

  if (packages.length === 0) {
    container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#94a3b8;">No package tiers configured in this proposal.</p>';
    return;
  }

  container.innerHTML = packages.map((pkg, idx) => {
    const isMiddle = (idx === 1);
    const cardTypeClass = isMiddle ? 'tier-featured-card' : 'tier-dark-card';

    // Price Formatting: e.g. "₹29,999/m"
    const rawPriceNum = Number(String(pkg.price || 0).replace(/[^0-9.]/g, '')) || 0;
    const formattedPriceStr = rawPriceNum > 0 ? `₹${rawPriceNum.toLocaleString('en-IN')}/m` : 'Custom';

    const isCurrentlySelected = (currentProposal.status === 'ACCEPTED' || currentProposal.status === 'CONVERTED') && 
                                (currentProposal.selected_package_index === idx || currentProposal.selected_package_name === pkg.name);

    const featuresHtml = renderPackageFeatures(pkg);
    const planTagName = (pkg.name || `Plan #${idx + 1}`).toUpperCase();

    return `
      <div class="pricing-card ${cardTypeClass} ${isCurrentlySelected ? 'selected-by-client' : ''}" id="cardTier_${idx}">
        <div class="card-plan-tag">${escapeHtml(planTagName)}</div>
        
        <div class="card-price-val">${escapeHtml(formattedPriceStr)}</div>
        <div class="card-billing-cycle">Billed ${escapeHtml(currentProposal.billing_cycle || 'Monthly')}</div>

        <hr class="card-divider">

        <div class="card-features-list">
          ${featuresHtml}
        </div>

        <button type="button" class="btn-select-tier ${isCurrentlySelected ? 'active-selected' : ''}" onclick="openConfirmModal(${idx}, '${escapeAttr(pkg.name || '')}', '${escapeAttr(formattedPriceStr)}')">
          ${isCurrentlySelected 
            ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Selected Plan`
            : `Select Plan`}
        </button>
      </div>
    `;
  }).join('');
}

function renderPackageFeatures(pkg) {
  let serviceBlocks = [];

  if (Array.isArray(pkg.services) && pkg.services.length > 0) {
    pkg.services.forEach((s, idx) => {
      if (typeof s === 'string') {
        const lines = s.split('\n').map(l => l.trim()).filter(Boolean);
        const title = lines[0] || s;
        const subItems = lines.slice(1).map(l => l.replace(/^[•\-\*]\s*/, ''));
        serviceBlocks.push({ title, subItems });
      } else if (typeof s === 'object') {
        const title = s.title || s.name || `Service #${idx + 1}`;
        const subItems = Array.isArray(s.sub_items) 
          ? s.sub_items 
          : (s.subDetails ? (Array.isArray(s.subDetails) ? s.subDetails : [s.subDetails]) : []);
        serviceBlocks.push({ title, subItems });
      }
    });
  }

  if (serviceBlocks.length === 0 && pkg.features_text) {
    const rawLines = pkg.features_text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentBlock = null;
    rawLines.forEach(line => {
      if (/^(\d+[\.\)]|[A-Z][\w\s&–-]+:)/.test(line) || !currentBlock) {
        currentBlock = { title: line.replace(/^[•\-\*]\s*/, ''), subItems: [] };
        serviceBlocks.push(currentBlock);
      } else {
        currentBlock.subItems.push(line.replace(/^[•\-\*]\s*/, ''));
      }
    });
  }

  if (serviceBlocks.length === 0) {
    serviceBlocks = [
      { title: '1. Strategy & Onboarding Consultation', subItems: ['Full brand & competitor digital audit', 'Customized monthly roadmap'] },
      { title: '2. Campaign Execution & Optimization', subItems: ['High-converting multi-platform ad campaigns', 'Continuous audience A/B testing'] },
      { title: '3. Dedicated Account Management', subItems: ['Weekly performance reporting & 24/7 priority support'] }
    ];
  }

  return serviceBlocks.map((block, bIdx) => {
    // Format main title (with number count if not present)
    let displayTitle = block.title;
    if (!/^\d+[\.\)]/.test(displayTitle) && serviceBlocks.length > 1) {
      displayTitle = `${bIdx + 1}. ${displayTitle}`;
    }

    return `
      <div class="service-feature-block" style="margin-bottom:0.85rem;">
        <div class="feature-item" style="font-weight:700; font-size:0.92rem; margin-bottom:0.3rem;">
          <svg class="check-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12 11 14.5 15.5 9.5"/></svg>
          <span>${escapeHtml(displayTitle)}</span>
        </div>
        ${block.subItems && block.subItems.length > 0 ? `
          <div class="sub-feature-list" style="padding-left:1.65rem;">
            ${block.subItems.map(sub => `
              <div class="sub-item" style="font-size:0.83rem; line-height:1.45; opacity:0.9; margin-bottom:0.25rem; display:flex; align-items:flex-start; gap:0.45rem;">
                <span style="font-size:0.9rem; line-height:1.2;">•</span>
                <span>${escapeHtml(sub)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function openConfirmModal(idx, name, price) {
  selectedPkgIndex = idx;
  document.getElementById('modalPackageName').textContent = name;
  document.getElementById('modalPackagePrice').textContent = price;
  document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('active');
}

async function submitPackageConfirmation() {
  if (selectedPkgIndex === null || !currentProposal) return;

  const btn = document.getElementById('btnSubmitConfirmation');
  const origText = btn.innerHTML;
  btn.innerHTML = 'Confirming...';
  btn.disabled = true;

  const notes = document.getElementById('confirmNotes')?.value || '';

  try {
    const res = await fetch(`${API_BASE}/proposals/public/${encodeURIComponent(currentToken)}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package_index: selectedPkgIndex,
        package_name: document.getElementById('modalPackageName').textContent,
        notes
      })
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Failed to submit confirmation');
      return;
    }

    closeConfirmModal();

    // Show celebratory confirmation banner
    const banner = document.getElementById('confirmedBanner');
    const bannerText = document.getElementById('confirmedBannerText');
    if (banner && bannerText) {
      banner.classList.add('active');
      bannerText.innerHTML = `You have successfully confirmed the <strong>${escapeHtml(data.proposal.selected_package_name)}</strong>. Our team will contact you shortly to begin execution!`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Refresh proposal display
    loadProposalData(currentToken);
  } catch (err) {
    alert('Failed to connect to server. Please try again.');
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

function showErrorState(message) {
  const loader = document.getElementById('proposalLoader');
  if (loader) {
    loader.innerHTML = `
      <div style="background:rgba(225,29,72,0.12); border:1px solid rgba(225,29,72,0.3); border-radius:12px; max-width:480px; margin:0 auto; padding:2rem; color:#f8fafc; text-align:center;">
        <div style="width:52px; height:52px; border-radius:50%; background:rgba(225,29,72,0.2); color:#f43f5e; display:flex; align-items:center; justify-content:center; margin:0 auto 0.75rem;">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 style="font-size:1.35rem; font-weight:800; color:#ffffff; margin-bottom:0.5rem;">Proposal Unavailable</h2>
        <p style="font-size:0.95rem; color:#94a3b8; line-height:1.5;">${escapeHtml(message)}</p>
      </div>
    `;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}
