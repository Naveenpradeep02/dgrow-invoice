// Authentication & Access Control Handler

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();

      const btn = loginForm.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Signing in...';
      btn.disabled = true;

      try {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        setAuthSession(res.token, res.user);
        showToast('Login successful!', 'success');

        setTimeout(() => {
          redirectUserByRole(res.user.role);
        }, 600);
      } catch (err) {
        showToast(err.message || 'Invalid credentials.', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }

  checkAuthGuard();
  initSidebarCollapse();
});

function getAppPathPrefix() {
  const path = window.location.pathname;
  const match = path.match(/^(.*?)(\/(?:admin|client|auditor|login\.html|index\.html|$))/i);
  if (match && match[1]) {
    return match[1].replace(/\/+$/, '');
  }
  return '';
}

function redirectUserByRole(role) {
  const prefix = getAppPathPrefix();
  if (role === 'ADMIN') {
    window.location.href = `${prefix}/admin/dashboard.html`;
  } else if (role === 'CLIENT') {
    window.location.href = `${prefix}/client/dashboard.html`;
  } else if (role === 'AUDITOR') {
    window.location.href = `${prefix}/auditor/dashboard.html`;
  } else {
    window.location.href = `${prefix}/login.html`;
  }
}

function checkAuthGuard() {
  const user = getUser();
  const path = window.location.pathname;
  const prefix = getAppPathPrefix();

  if (path === '/' || path === '/index.html' || path === '/frontend/' || path === '/frontend/index.html') {
    if (user) {
      redirectUserByRole(user.role);
    } else {
      window.location.href = `${prefix}/login.html`;
    }
    return;
  }

  if (path.includes('/login.html')) {
    if (user) redirectUserByRole(user.role);
    return;
  }

  if (!user) {
    window.location.href = `${prefix}/login.html`;
    return;
  }

  // Role path protection
  if (path.includes('/admin/') && user.role !== 'ADMIN') {
    showToast('Unauthorized role access.', 'error');
    redirectUserByRole(user.role);
  } else if (path.includes('/client/') && user.role !== 'CLIENT') {
    showToast('Unauthorized role access.', 'error');
    redirectUserByRole(user.role);
  } else if (path.includes('/auditor/') && user.role !== 'AUDITOR' && user.role !== 'ADMIN') {
    showToast('Unauthorized role access.', 'error');
    redirectUserByRole(user.role);
  }

  // Update user name in sidebar if present
  const userNameEl = document.getElementById('sidebarUserName');
  const userRoleEl = document.getElementById('sidebarUserRole');
  if (userNameEl) userNameEl.textContent = user.name || 'User';
  if (userRoleEl) userRoleEl.textContent = user.role || '';

  // Update Top Navbar Profile Info
  populateTopNavbarUser(user);

  // Load Real Dynamic Notifications (Invoice Ready based on onboard date + Payment Pending)
  loadTopbarRealNotifications();
}

function populateTopNavbarUser(user) {
  if (!user) return;
  const name = user.name || 'D-GROW Admin';
  const role = user.role || 'ADMIN';
  const email = user.email || 'admin@dgrow.com';

  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'AD';

  if (document.getElementById('topbarUserName')) document.getElementById('topbarUserName').textContent = name;
  if (document.getElementById('topbarUserRole')) document.getElementById('topbarUserRole').textContent = role;
  if (document.getElementById('topbarUserInitials')) document.getElementById('topbarUserInitials').textContent = initials;
  if (document.getElementById('dropdownAvatarInitials')) document.getElementById('dropdownAvatarInitials').textContent = initials;
  if (document.getElementById('dropdownUserName')) document.getElementById('dropdownUserName').textContent = name;
  if (document.getElementById('dropdownUserEmail')) document.getElementById('dropdownUserEmail').textContent = email;
  if (document.getElementById('dropdownUserRole')) document.getElementById('dropdownUserRole').textContent = `${role} ROLE`;
}

function toggleNotificationDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('notifDropdownMenu');
  const profileMenu = document.getElementById('profileDropdownMenu');
  if (profileMenu) profileMenu.classList.remove('show');
  if (menu) menu.classList.toggle('show');
}

function toggleUserProfileDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('profileDropdownMenu');
  const notifMenu = document.getElementById('notifDropdownMenu');
  if (notifMenu) notifMenu.classList.remove('show');
  if (menu) menu.classList.toggle('show');
}

function getStoredReadNotifIds() {
  try {
    return JSON.parse(localStorage.getItem('dgrow_read_notif_ids') || '[]');
  } catch (e) {
    return [];
  }
}

function addStoredReadNotifIds(ids) {
  const existing = new Set(getStoredReadNotifIds());
  ids.forEach(id => existing.add(id));
  localStorage.setItem('dgrow_read_notif_ids', JSON.stringify(Array.from(existing)));
}

let cachedNotificationItems = [];

async function loadTopbarRealNotifications() {
  const notifList = document.getElementById('topbarNotifList');
  const badge = document.getElementById('notifBadgeCount');
  if (!notifList && !badge) return;

  try {
    const res = await apiFetch('/notifications');
    if (!res || !res.success || !Array.isArray(res.notifications)) {
      if (badge) badge.style.display = 'none';
      return;
    }

    cachedNotificationItems = res.notifications;
    const readIds = new Set(getStoredReadNotifIds());

    // Filter to only unread notifications
    const unreadItems = res.notifications.filter(n => !readIds.has(n.id));
    const count = unreadItems.length;

    // Update Badge Count
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // Update Dropdown Header Badge if present
    const notifHeaderBadge = document.querySelector('.notif-header .badge');
    if (notifHeaderBadge) {
      notifHeaderBadge.textContent = count > 0 ? `${count} Action${count > 1 ? 's' : ''}` : '0 Actions';
      notifHeaderBadge.style.background = count > 0 ? '#fee2e2' : '#f1f5f9';
      notifHeaderBadge.style.color = count > 0 ? '#dc2626' : '#64748b';
    }

    // Populate Dropdown List
    if (notifList) {
      if (count === 0) {
        notifList.innerHTML = `
          <div style="padding:2rem 1rem; text-align:center; color:var(--text-muted); font-size:0.82rem;">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:0.4rem;"><polyline points="20 6 9 17 4 12"/></svg>
            <p style="margin:0; font-weight:700; color:var(--text-main);">All Caught Up!</p>
            <span style="font-size:0.72rem; color:#94a3b8;">All notifications have been marked as read.</span>
          </div>
        `;
        return;
      }

      notifList.innerHTML = unreadItems.map(item => {
        const words = (item.company_name || 'Client').trim().split(/\s+/);
        const initials = words.length > 1 
          ? (words[0][0] + words[1][0]).toUpperCase()
          : words[0].substring(0, 2).toUpperCase();

        const isInvoice = item.type === 'INVOICE_READY';
        const avatarClass = isInvoice ? (item.isUrgent ? 'urgent' : 'invoice') : (item.isUrgent ? 'urgent' : 'payment');

        return `
          <div class="notif-item unread" style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; border-bottom:1px solid #f8fafc; transition:background 0.15s ease;">
            <a href="${item.actionUrl}" style="text-decoration:none; display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0;">
              <div class="notif-avatar-circle ${avatarClass}" style="width:34px; height:34px; font-size:0.75rem; flex-shrink:0;">
                <span>${initials}</span>
              </div>
              <div class="notif-body" style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.25rem;">
                  <strong style="font-size:0.8rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;">${escapeAttr(item.company_name)}</strong>
                  <span style="font-size:0.6rem; font-weight:700; padding:0.1rem 0.35rem; border-radius:3px; background:${item.isUrgent ? '#fee2e2' : '#e0e7ff'}; color:${item.isUrgent ? '#dc2626' : '#3730a3'};">${item.badge}</span>
                </div>
                <span style="display:block; font-size:0.72rem; color:var(--text-muted); margin-top:0.15rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeAttr(item.desc)}</span>
              </div>
            </a>
            <button type="button" class="notif-dismiss-btn" style="width:26px; height:26px; border:none; background:#f1f5f9; color:#94a3b8; flex-shrink:0;" title="Mark as read" onclick="dismissTopbarItem('${item.id}', event)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load topbar notifications:', err);
  }
}

function dismissTopbarItem(notifId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  addStoredReadNotifIds([notifId]);
  loadTopbarRealNotifications();
  if (typeof loadRealNotifications === 'function') {
    loadRealNotifications();
  }
  showToast('Marked as read', 'info');
}

function clearAllNotifications() {
  const allIds = cachedNotificationItems.map(n => n.id);
  if (allIds.length > 0) {
    addStoredReadNotifIds(allIds);
  }

  const badge = document.getElementById('notifBadgeCount');
  if (badge) {
    badge.style.display = 'none';
    badge.textContent = '0';
  }

  const notifHeaderBadge = document.querySelector('.notif-header .badge');
  if (notifHeaderBadge) {
    notifHeaderBadge.textContent = '0 Actions';
    notifHeaderBadge.style.background = '#f1f5f9';
    notifHeaderBadge.style.color = '#64748b';
  }

  const notifList = document.getElementById('topbarNotifList');
  if (notifList) {
    notifList.innerHTML = `
      <div style="padding:2rem 1rem; text-align:center; color:var(--text-muted); font-size:0.82rem;">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:0.4rem;"><polyline points="20 6 9 17 4 12"/></svg>
        <p style="margin:0; font-weight:700; color:var(--text-main);">All Caught Up!</p>
        <span style="font-size:0.72rem; color:#94a3b8;">All notifications have been marked as read.</span>
      </div>
    `;
  }

  // If on the notifications hub page, sync the page list too
  if (typeof markAllPageNotificationsAsRead === 'function') {
    markAllPageNotificationsAsRead();
  }

  showToast('All notifications marked as read and cleared', 'success');
}

function handleGlobalSearch(e) {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (query) {
      window.location.href = `invoices.html?search=${encodeURIComponent(query)}`;
    }
  }
}

// Sidebar Collapse / Expand Functionality
function toggleSidebarCollapse() {
  const container = document.querySelector('.app-container') || document.body;
  const isCollapsed = container.classList.toggle('sidebar-collapsed');
  if (container !== document.body) {
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  }
  try {
    localStorage.setItem('dgrow_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  } catch(e) {}
  updateSidebarToggleBtn();
}

function initSidebarCollapse() {
  const container = document.querySelector('.app-container') || document.body;
  let isCollapsed = false;
  try {
    isCollapsed = localStorage.getItem('dgrow_sidebar_collapsed') === 'true';
  } catch(e) {}

  if (isCollapsed) {
    container.classList.add('sidebar-collapsed');
    document.body.classList.add('sidebar-collapsed');
  } else {
    container.classList.remove('sidebar-collapsed');
    document.body.classList.remove('sidebar-collapsed');
  }

  // Ensure mini logo icon is present in brand header
  const brandHeader = document.querySelector('.brand-header');
  if (brandHeader && !brandHeader.querySelector('.brand-mini-icon')) {
    const miniSpan = document.createElement('span');
    miniSpan.className = 'brand-mini-icon';
    miniSpan.textContent = 'DG';
    brandHeader.appendChild(miniSpan);
  }

  // Ensure sidebar toggle button exists in navbar
  const navbarLeft = document.querySelector('.top-navbar-left');
  if (navbarLeft && !document.getElementById('sidebarToggleBtn')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'sidebar-toggle-btn';
    toggleBtn.id = 'sidebarToggleBtn';
    toggleBtn.title = isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)';
    toggleBtn.onclick = toggleSidebarCollapse;
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
    navbarLeft.insertBefore(toggleBtn, navbarLeft.firstChild);
  }

  updateSidebarToggleBtn();
}

function updateSidebarToggleBtn() {
  const btn = document.getElementById('sidebarToggleBtn');
  if (!btn) return;
  const container = document.querySelector('.app-container') || document.body;
  const isCollapsed = container.classList.contains('sidebar-collapsed');
  btn.title = isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)';
}

// Global hotkey Ctrl+B to toggle sidebar
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    // Avoid triggering when focused on input
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea') {
      e.preventDefault();
      toggleSidebarCollapse();
    }
  }
});

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
  const notifWrapper = document.getElementById('notifDropdownWrapper');
  const profileWrapper = document.getElementById('profileDropdownWrapper');
  if (notifWrapper && !notifWrapper.contains(e.target)) {
    document.getElementById('notifDropdownMenu')?.classList.remove('show');
  }
  if (profileWrapper && !profileWrapper.contains(e.target)) {
    document.getElementById('profileDropdownMenu')?.classList.remove('show');
  }
});

function handleLogout() {
  const prefix = getAppPathPrefix();
  clearAuthSession();
  window.location.href = `${prefix}/login.html`;
}

window.toggleNotificationDropdown = toggleNotificationDropdown;
window.toggleUserProfileDropdown = toggleUserProfileDropdown;
window.clearAllNotifications = clearAllNotifications;
window.dismissTopbarItem = dismissTopbarItem;
window.handleGlobalSearch = handleGlobalSearch;
window.handleLogout = handleLogout;
window.loadTopbarRealNotifications = loadTopbarRealNotifications;
window.getStoredReadNotifIds = getStoredReadNotifIds;
window.addStoredReadNotifIds = addStoredReadNotifIds;
window.toggleSidebarCollapse = toggleSidebarCollapse;
window.initSidebarCollapse = initSidebarCollapse;
