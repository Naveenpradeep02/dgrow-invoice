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
});

function redirectUserByRole(role) {
  const prefix = (window.location.port === '5500' || window.location.port === '5501') ? '/frontend' : '';
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
  const prefix = (window.location.port === '5500' || window.location.port === '5501') ? '/frontend' : '';

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
}

function handleLogout() {
  const prefix = (window.location.port === '5500' || window.location.port === '5501') ? '/frontend' : '';
  clearAuthSession();
  window.location.href = `${prefix}/login.html`;
}
