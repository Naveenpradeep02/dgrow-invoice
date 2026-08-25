// D-GROW API Helper & Utilities

// API Base URL detection for local development (port 5000/5500) and production (/api)
function getApiBaseUrl() {
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  if (isLocalhost) {
    return window.location.port === '5000' ? '/api' : 'http://localhost:5000/api';
  }

  // Production backend API is mounted at /api
  return '/api';
}

const API_BASE = getApiBaseUrl();


function getToken() {
  return localStorage.getItem('dgrow_token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('dgrow_user'));
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, user) {
  localStorage.setItem('dgrow_token', token);
  localStorage.setItem('dgrow_user', JSON.stringify(user));
}

function clearAuthSession() {
  localStorage.removeItem('dgrow_token');
  localStorage.removeItem('dgrow_user');
}

// Active requests tracker for Global Top Progress Bar
let activeApiRequests = 0;
let topLoaderTimeout = null;

function getTopProgressBar() {
  let bar = document.getElementById('topProgressBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'topProgressBar';
    document.body.appendChild(bar);
  }
  return bar;
}

function startTopLoader() {
  activeApiRequests++;
  const bar = getTopProgressBar();
  if (activeApiRequests === 1) {
    clearTimeout(topLoaderTimeout);
    bar.style.opacity = '1';
    bar.style.width = '30%';
    topLoaderTimeout = setTimeout(() => {
      if (activeApiRequests > 0) {
        bar.style.width = '75%';
      }
    }, 200);
  }
}

function endTopLoader() {
  activeApiRequests = Math.max(0, activeApiRequests - 1);
  if (activeApiRequests === 0) {
    clearTimeout(topLoaderTimeout);
    const bar = getTopProgressBar();
    bar.style.width = '100%';
    topLoaderTimeout = setTimeout(() => {
      bar.style.opacity = '0';
      setTimeout(() => {
        if (activeApiRequests === 0) {
          bar.style.width = '0%';
        }
      }, 300);
    }, 200);
  }
}

// Reusable Loading Animation Renderers
function renderTableLoader(colspan = 7, text = 'Loading data...') {
  return `
    <tr>
      <td colspan="${colspan}" style="padding: 0; border: none;">
        <div class="data-loader-container">
          <div class="dgrow-spinner"></div>
          <div class="data-loader-text">${text}</div>
        </div>
      </td>
    </tr>
  `;
}

function renderDataLoader(text = 'Loading details...', size = '') {
  return `
    <div class="data-loader-container">
      <div class="dgrow-spinner ${size}"></div>
      <div class="data-loader-text">${text}</div>
    </div>
  `;
}

let isLoggingOut = false;

function getAppPathPrefix() {
  const path = window.location.pathname;
  const match = path.match(/^(.*?)(\/(?:admin|client|auditor|login\.html|index\.html|$))/i);
  if (match && match[1]) {
    return match[1].replace(/\/+$/, '');
  }
  return '';
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
  }

  startTopLoader();

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      body
    });

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { message: res.ok ? text : `Server returned status ${res.status}` };
    }

    if (!res.ok) {
      if (res.status === 401) {
        if (!window.location.pathname.includes('/login.html') && !isLoggingOut) {
          isLoggingOut = true;
          const prefix = getAppPathPrefix();
          if (data.errorCode === 'ACCOUNT_DEACTIVATED') {
            sessionStorage.setItem('deactivated_logout_reason', data.message || 'Your account has been deactivated by administrator. You have been logged out.');
            clearAuthSession();
            window.location.href = `${prefix}/login.html`;
            return;
          }
          showToast(data.message || 'Session expired. Please login again.', 'error');
          clearAuthSession();
          setTimeout(() => {
            window.location.href = `${prefix}/login.html`;
          }, 800);
        }
      }
      throw new Error(data.message || `Request failed (${res.status})`);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  } finally {
    endTopLoader();
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const iconSvg = type === 'success' ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' :
                  type === 'error' ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' :
                  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

  toast.innerHTML = `
    <span style="display:flex; align-items:center;">${iconSvg}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Formatting helpers
function formatINR(amount) {
  const val = parseFloat(amount || 0);
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

