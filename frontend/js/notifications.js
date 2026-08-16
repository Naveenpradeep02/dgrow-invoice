// Notifications Center & Hub Controller (Strictly Real Notifications)

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let allNotifications = [];
let activeNotifFilter = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('notificationsListContainer')) {
    initNotificationsPage();
  }
});

async function initNotificationsPage() {
  await loadRealNotifications();
}

async function loadRealNotifications() {
  const container = document.getElementById('notificationsListContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; padding:3rem; color:var(--text-muted);">
      <div class="loader-spinner" style="margin: 0 auto 1rem auto;"></div>
      <p>Loading real notifications...</p>
    </div>
  `;

  try {
    const res = await apiFetch('/notifications');
    if (!res || !res.success || !Array.isArray(res.notifications)) {
      allNotifications = [];
    } else {
      const readIds = typeof getStoredReadNotifIds === 'function' ? new Set(getStoredReadNotifIds()) : new Set();
      allNotifications = res.notifications.filter(n => !readIds.has(n.id));
    }

    renderNotificationsList();
    updatePillCounts();
  } catch (err) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem; color:#ef4444;">
        <p>Failed to load notifications: ${err.message}</p>
        <button class="btn btn-secondary" onclick="loadRealNotifications()" style="margin-top:1rem;">Try Again</button>
      </div>
    `;
  }
}

function filterNotifications(type, btnElement) {
  activeNotifFilter = type;
  
  const pills = document.querySelectorAll('.notif-filter-pill');
  pills.forEach(p => p.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  renderNotificationsList();
}

function renderNotificationsList() {
  const container = document.getElementById('notificationsListContainer');
  if (!container) return;

  const filtered = activeNotifFilter === 'ALL' 
    ? allNotifications 
    : allNotifications.filter(n => n.type === activeNotifFilter || (activeNotifFilter === 'URGENT' && n.isUrgent));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted); border-radius:18px;">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:0.75rem;"><polyline points="20 6 9 17 4 12"/></svg>
        <h3 style="margin:0 0 0.25rem 0; color:var(--text-main); font-size:1.1rem;">All caught up!</h3>
        <p style="margin:0; font-size:0.85rem;">No pending notifications in this category.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.65rem; max-width:880px;">
      ${filtered.map(item => {
        // Compute client initials for avatar
        const words = (item.company_name || 'Client').trim().split(/\s+/);
        const initials = words.length > 1 
          ? (words[0][0] + words[1][0]).toUpperCase()
          : words[0].substring(0, 2).toUpperCase();

        const isInvoice = item.type === 'INVOICE_READY';
        const avatarType = isInvoice ? (item.isUrgent ? 'urgent' : 'invoice') : (item.isUrgent ? 'urgent' : 'payment');

        let feedTitleHtml = '';
        let feedSubtitleHtml = '';

        if (isInvoice) {
          feedTitleHtml = `<strong class="entity-name">${escapeAttr(item.company_name)}</strong> monthly billing renewal is <strong class="target-highlight">${item.diff_days <= 0 ? 'Due Today' : item.diff_days <= 3 ? `Due in ${item.diff_days} days` : `Due in ${item.diff_days} days`}</strong>`;
          feedSubtitleHtml = `Invoice Reminder <span class="sub-dot">•</span> ${item.badge} <span class="sub-dot">•</span> Cycle ${formatDate(item.cycle_date)}`;
        } else {
          feedTitleHtml = `<strong class="entity-name">${escapeAttr(item.company_name)}</strong> pending balance for <strong class="target-highlight">${escapeAttr(item.invoice_number)} (₹${(item.balance_amount || 0).toLocaleString('en-IN')})</strong>`;
          feedSubtitleHtml = `${item.diff_days < 0 ? `<span style="color:#dc2626; font-weight:700;">Overdue by ${Math.abs(item.diff_days)}d</span>` : `Due on ${formatDate(item.due_date)}`} <span class="sub-dot">•</span> Payment Pending`;
        }

        return `
          <div class="notif-page-card ${item.isUrgent ? 'unread' : ''}" id="notif-card-${item.id}">
            <div class="notif-avatar-circle ${avatarType}">
              <span>${initials}</span>
            </div>

            <div class="notif-content-main">
              <p class="notif-feed-title">${feedTitleHtml}</p>
              <div class="notif-feed-subtitle">${feedSubtitleHtml}</div>
            </div>

            <div class="notif-card-actions">
              <a href="${item.actionUrl}" class="notif-action-pill-btn ${isInvoice ? 'invoice' : 'payment'}">
                <span>${item.actionLabel}</span>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
              <button type="button" class="notif-dismiss-btn" title="Mark as read" onclick="markIndividualNotificationAsRead('${item.id}', event)">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function updatePillCounts() {
  const countAll = allNotifications.length;
  const countUrgent = allNotifications.filter(n => n.isUrgent).length;
  const countInvoice = allNotifications.filter(n => n.type === 'INVOICE_READY').length;
  const countPayment = allNotifications.filter(n => n.type === 'PAYMENT_PENDING').length;

  if (document.getElementById('countAll')) document.getElementById('countAll').textContent = countAll;
  if (document.getElementById('countUrgent')) document.getElementById('countUrgent').textContent = countUrgent;
  if (document.getElementById('countInvoice')) document.getElementById('countInvoice').textContent = countInvoice;
  if (document.getElementById('countPayment')) document.getElementById('countPayment').textContent = countPayment;

  const countEl = document.getElementById('unreadNotifTotal');
  if (countEl) {
    countEl.textContent = countAll > 0 ? `${countAll} Pending Actions` : '0 Actions';
    countEl.style.background = countAll > 0 ? '#fee2e2' : '#f1f5f9';
    countEl.style.color = countAll > 0 ? '#dc2626' : '#64748b';
  }

  const badge = document.getElementById('notifBadgeCount');
  if (badge) {
    if (countAll > 0) {
      badge.textContent = countAll;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function markIndividualNotificationAsRead(notifId, event) {
  if (event) event.stopPropagation();

  // Save to stored read IDs
  if (typeof addStoredReadNotifIds === 'function') {
    addStoredReadNotifIds([notifId]);
  }

  // Animation
  const cardEl = document.getElementById(`notif-card-${notifId}`);
  if (cardEl) {
    cardEl.classList.add('dismissing');
  }

  setTimeout(() => {
    allNotifications = allNotifications.filter(n => n.id !== notifId);
    renderNotificationsList();
    updatePillCounts();
    if (typeof loadTopbarRealNotifications === 'function') {
      loadTopbarRealNotifications();
    }
    showToast('Notification marked as read', 'success');
  }, 220);
}

function markAllPageNotificationsAsRead() {
  const allIds = allNotifications.map(n => n.id);
  if (allIds.length > 0 && typeof addStoredReadNotifIds === 'function') {
    addStoredReadNotifIds(allIds);
  }
  allNotifications = [];
  renderNotificationsList();
  updatePillCounts();
  if (typeof loadTopbarRealNotifications === 'function') {
    loadTopbarRealNotifications();
  }
  showToast('All notifications marked as read', 'success');
}

window.markIndividualNotificationAsRead = markIndividualNotificationAsRead;
window.markAllPageNotificationsAsRead = markAllPageNotificationsAsRead;



