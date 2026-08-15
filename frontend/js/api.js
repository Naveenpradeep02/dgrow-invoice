// D-GROW API Helper & Utilities

// API Base URL detection for local development (Live Server port 5500 / Express port 5000) and production (Render)
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalhost
  ? (window.location.port === '5000' ? '/api' : 'http://localhost:5000/api')
  : 'https://dgrow-invoice.onrender.com/api';


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

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
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
      if (res.status === 401 || res.status === 403) {
        if (!window.location.pathname.includes('/login.html')) {
          showToast(data.message || 'Session expired. Please login again.', 'error');
          setTimeout(() => {
            clearAuthSession();
            const prefix = window.location.pathname.includes('/frontend/') ? '/frontend' : '';
            window.location.href = `${prefix}/login.html`;
          }, 1200);
        }
      }
      throw new Error(data.message || `Request failed (${res.status})`);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
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
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
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
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
