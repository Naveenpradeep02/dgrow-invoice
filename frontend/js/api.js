// D-GROW API Helper & Utilities

const isLiveServer = window.location.port === '5500' || window.location.port === '5501' || window.location.protocol === 'file:';
const API_BASE = isLiveServer ? 'http://localhost:5000/api' : '/api';

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

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (window.location.pathname !== '/login.html') {
          showToast(data.message || 'Session expired. Please login again.', 'error');
          setTimeout(() => {
            clearAuthSession();
            window.location.href = '/login.html';
          }, 1200);
        }
      }
      throw new Error(data.message || 'API request failed');
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
