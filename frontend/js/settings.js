// Company Settings & Terms Management Script

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('companySettingsForm')) {
    loadSettingsPage();
  }
});

async function loadSettingsPage() {
  try {
    const res = await apiFetch('/settings');
    if (!res.success) return;

    const { company, terms } = res;

    // Fill Company Form
    if (company) {
      document.getElementById('company_name').value = company.company_name || '';
      document.getElementById('gstin').value = company.gstin || '';
      document.getElementById('phone').value = company.phone || '';
      document.getElementById('email').value = company.email || '';
      document.getElementById('address').value = company.address || '';
      document.getElementById('city').value = company.city || '';
      document.getElementById('state').value = company.state || '';
      document.getElementById('pincode').value = company.pincode || '';
      document.getElementById('bank_name').value = company.bank_name || '';
      document.getElementById('account_number').value = company.account_number || '';
      document.getElementById('ifsc_code').value = company.ifsc_code || '';
      document.getElementById('banking_name').value = company.banking_name || '';
      document.getElementById('branch_name').value = company.branch_name || '';
      document.getElementById('gpay_number').value = company.gpay_number || '';
      document.getElementById('upi_id').value = company.upi_id || '';
      document.getElementById('authorized_person').value = company.authorized_person || '';
      document.getElementById('signature_title').value = company.signature_title || '';
    }

    // Fill Terms Form
    if (terms) {
      document.getElementById('scope_of_work').value = terms.scope_of_work || '';
      document.getElementById('payment_terms').value = terms.payment_terms || '';
      document.getElementById('ownership_usage').value = terms.ownership_usage || '';
      document.getElementById('confidentiality').value = terms.confidentiality || '';
      document.getElementById('cancellation_policy').value = terms.cancellation_policy || '';
    }
  } catch (err) {
    showToast('Failed to load settings: ' + err.message, 'error');
  }
}

async function handleSaveCompanySettings(e) {
  e.preventDefault();
  const data = {
    company_name: document.getElementById('company_name').value,
    gstin: document.getElementById('gstin').value,
    phone: document.getElementById('phone').value,
    email: document.getElementById('email').value,
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    state: document.getElementById('state').value,
    pincode: document.getElementById('pincode').value,
    bank_name: document.getElementById('bank_name').value,
    account_number: document.getElementById('account_number').value,
    ifsc_code: document.getElementById('ifsc_code').value,
    banking_name: document.getElementById('banking_name').value,
    branch_name: document.getElementById('branch_name').value,
    gpay_number: document.getElementById('gpay_number').value,
    upi_id: document.getElementById('upi_id').value,
    authorized_person: document.getElementById('authorized_person').value,
    signature_title: document.getElementById('signature_title').value
  };

  try {
    const res = await apiFetch('/settings/company', { method: 'PUT', body: JSON.stringify(data) });
    showToast(res.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSaveTerms(e) {
  e.preventDefault();
  const data = {
    scope_of_work: document.getElementById('scope_of_work').value,
    payment_terms: document.getElementById('payment_terms').value,
    ownership_usage: document.getElementById('ownership_usage').value,
    confidentiality: document.getElementById('confidentiality').value,
    cancellation_policy: document.getElementById('cancellation_policy').value
  };

  try {
    const res = await apiFetch('/settings/terms', { method: 'PUT', body: JSON.stringify(data) });
    showToast(res.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// -------------------------------------------------------------
// Staff & Marketing Logins Management
// -------------------------------------------------------------
let staffUsersList = [];

async function loadStaffUsers() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/auth/users');
    if (!res.success || !Array.isArray(res.users)) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Failed to load staff list.</td></tr>`;
      return;
    }

    staffUsersList = res.users;
    if (staffUsersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No staff accounts created yet. Click "+ Create Marketing Staff" to add one.</td></tr>`;
      return;
    }

    tbody.innerHTML = staffUsersList.map(u => {
      const isSelf = (getUser()?.id === u.id);
      const isPrimaryAdmin = (u.id === 1);
      
      let roleBadgeColor = '#64748b';
      let roleBg = '#f1f5f9';
      let accessScope = 'Full System Access';
      
      if (u.role === 'ADMIN') {
        roleBadgeColor = '#2563eb';
        roleBg = '#dbeafe';
        accessScope = 'Full Administrator (All Modules)';
      } else if (u.role === 'MARKETING') {
        roleBadgeColor = '#059669';
        roleBg = '#d1fae5';
        accessScope = 'Enquiries, Meetings, Quotes, Clients, Services (No Delete)';
      } else if (u.role === 'AUDITOR') {
        roleBadgeColor = '#d97706';
        roleBg = '#fef3c7';
        accessScope = 'Financial Review & GST Reports';
      } else if (u.role === 'CLIENT') {
        roleBadgeColor = '#7c3aed';
        roleBg = '#ede9fe';
        accessScope = 'Client Invoice Portal';
      }

      const statusBadge = u.status === 'ACTIVE'
        ? `<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700; font-size:0.75rem; padding:0.2rem 0.55rem;">ACTIVE</span>`
        : `<span class="badge" style="background:#fee2e2; color:#dc2626; font-weight:700; font-size:0.75rem; padding:0.2rem 0.55rem;">INACTIVE</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--text-main);">${escapeHtml(u.name)}</div>
            ${isSelf ? `<span style="font-size:0.7rem; color:#2563eb; font-weight:600;">(Current Login)</span>` : ''}
          </td>
          <td><code style="font-size:0.85rem; color:#0f172a; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${escapeHtml(u.email)}</code></td>
          <td style="text-align:center;">
            <span class="badge" style="background:${roleBg}; color:${roleBadgeColor}; font-weight:700; font-size:0.75rem; padding:0.25rem 0.6rem;">
              ${escapeHtml(u.role)}
            </span>
          </td>
          <td style="text-align:center; font-size:0.8rem; color:#475569;">
            ${accessScope}
          </td>
          <td style="text-align:center;">
            ${statusBadge}
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:0.35rem; align-items:center;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="openEditStaffModal(${u.id})" style="padding:0.25rem 0.55rem; font-size:0.78rem;">Edit</button>
              ${!isPrimaryAdmin && !isSelf ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="handleToggleStaffStatus(${u.id}, '${u.status}')" style="padding:0.25rem 0.55rem; font-size:0.78rem; color:${u.status === 'ACTIVE' ? '#b91c1c' : '#15803d'};">
                  ${u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" class="btn btn-danger btn-sm" onclick="handleDeleteStaff(${u.id}, '${escapeHtml(u.name)}')" style="padding:0.25rem 0.55rem; font-size:0.78rem;">
                  Delete
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#ef4444;">Error loading staff: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openCreateStaffModal() {
  document.getElementById('staffModalTitle').textContent = 'Create Marketing Staff Login';
  document.getElementById('staffUserId').value = '';
  document.getElementById('staffName').value = '';
  document.getElementById('staffEmail').value = '';
  document.getElementById('staffPassword').value = '';
  document.getElementById('staffPassword').required = true;
  document.getElementById('staffPasswordRequired').style.display = 'inline';
  document.getElementById('staffPasswordHelp').style.display = 'none';
  document.getElementById('staffRoleId').value = '4'; // MARKETING
  document.getElementById('staffStatus').value = 'ACTIVE';
  document.getElementById('staffModal').classList.add('active');
}

function openEditStaffModal(userId) {
  const u = staffUsersList.find(item => item.id === userId);
  if (!u) return;

  document.getElementById('staffModalTitle').textContent = `Edit Staff: ${u.name}`;
  document.getElementById('staffUserId').value = u.id;
  document.getElementById('staffName').value = u.name || '';
  document.getElementById('staffEmail').value = u.email || '';
  document.getElementById('staffPassword').value = '';
  document.getElementById('staffPassword').required = false;
  document.getElementById('staffPasswordRequired').style.display = 'none';
  document.getElementById('staffPasswordHelp').style.display = 'block';
  document.getElementById('staffRoleId').value = String(u.role_id || 4);
  document.getElementById('staffStatus').value = u.status || 'ACTIVE';
  document.getElementById('staffModal').classList.add('active');
}

function closeStaffModal() {
  document.getElementById('staffModal').classList.remove('active');
}

async function handleSaveStaff(e) {
  e.preventDefault();
  const userId = document.getElementById('staffUserId').value;
  const name = document.getElementById('staffName').value.trim();
  const email = document.getElementById('staffEmail').value.trim();
  const password = document.getElementById('staffPassword').value.trim();
  const role_id = parseInt(document.getElementById('staffRoleId').value) || 4;
  const status = document.getElementById('staffStatus').value;

  const btn = document.getElementById('btnSaveStaff');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Saving...';
  btn.disabled = true;

  try {
    if (userId) {
      // Update
      const body = { name, email, role_id, status };
      if (password) body.password = password;
      const res = await apiFetch(`/auth/users/${userId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast(res.message || 'Staff updated successfully.', 'success');
    } else {
      // Create
      if (!password) throw new Error('Password is required when creating a new account.');
      const res = await apiFetch('/auth/users', { method: 'POST', body: JSON.stringify({ name, email, password, role_id, status }) });
      showToast(res.message || 'Staff account created successfully.', 'success');
    }
    closeStaffModal();
    loadStaffUsers();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleToggleStaffStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  if (!confirm(`Are you sure you want to change this staff account status to ${newStatus}?`)) return;

  try {
    const res = await apiFetch(`/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(res.message || 'Status updated', 'success');
    loadStaffUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteStaff(userId, name) {
  if (!confirm(`Are you sure you want to permanently delete login account for "${name}"? This action cannot be undone.`)) return;

  try {
    const res = await apiFetch(`/auth/users/${userId}`, { method: 'DELETE' });
    showToast(res.message || 'Staff user deleted successfully.', 'success');
    loadStaffUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Hook loadStaffUsers into page load
const originalLoadSettingsPage = loadSettingsPage;
loadSettingsPage = async function() {
  await originalLoadSettingsPage();
  await loadStaffUsers();
};
