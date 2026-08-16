// Auditor Audit Trail & Version Diff Script

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('auditLogsTableBody')) {
    loadAuditLogs();
  }
});

async function loadAuditLogs() {
  const tbody = document.getElementById('auditLogsTableBody');
  if (!tbody) return;

  const entityType = document.getElementById('filterEntityType')?.value || '';
  const action = document.getElementById('filterAction')?.value || '';

  try {
    tbody.innerHTML = renderTableLoader(7, 'Loading audit logs...');
    const query = new URLSearchParams({ entity_type: entityType, action }).toString();
    const res = await apiFetch(`/audit-logs?${query}`);

    if (!res.logs || res.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No audit logs recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = res.logs.map(log => `
      <tr>
        <td>${formatDate(log.created_at)}</td>
        <td><strong>${log.user_email || 'System'}</strong><br><span style="font-size:0.72rem; color:var(--text-muted);">${log.user_role}</span></td>
        <td><span class="badge badge-${log.action === 'CREATE' ? 'paid' : log.action === 'CANCEL' ? 'overdue' : 'issued'}">${log.action}</span></td>
        <td><strong>${log.entity_type}</strong> #${log.entity_id}</td>
        <td><code>${log.ip_address || '127.0.0.1'}</code></td>
        <td>
          ${(log.old_data || log.new_data) ? `
            <button class="btn btn-secondary btn-sm" onclick="viewAuditDiff(${log.id}, '${log.entity_type}', '${log.entity_id}')">Compare Changes</button>
          ` : '<span class="text-muted">-</span>'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

async function viewAuditDiff(logId, entityType, entityId) {
  try {
    let res;
    if (entityType === 'INVOICE') {
      res = await apiFetch(`/audit-logs/invoice/${entityId}`);
    } else {
      res = await apiFetch(`/audit-logs?entity_id=${entityId}`);
    }

    const modal = document.getElementById('diffModal');
    const container = document.getElementById('diffModalBody');
    if (!modal || !container) return;

    if (entityType === 'INVOICE' && res.history) {
      container.innerHTML = `
        <h3>Invoice #${entityId} Change History</h3>
        ${res.history.map((item, idx) => `
          <div style="margin-top:1.5rem; padding:1rem; background-color:var(--bg-dark); border-radius:var(--radius-md); border:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <strong>Version ${idx + 1} (${item.action})</strong>
              <span style="font-size:0.8rem; color:var(--text-muted);">${formatDate(item.created_at)} by ${item.user_email}</span>
            </div>
            ${item.diffs && item.diffs.length > 0 ? `
              <table class="table" style="margin-top:0.5rem; font-size:0.8rem;">
                <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                <tbody>
                  ${item.diffs.map(d => `
                    <tr>
                      <td><strong>${d.field}</strong></td>
                      <td class="text-danger"><pre>${JSON.stringify(d.old_value, null, 2)}</pre></td>
                      <td class="text-success"><pre>${JSON.stringify(d.new_value, null, 2)}</pre></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p style="font-size:0.8rem; color:var(--text-muted);">Initial creation or no field-level diff.</p>'}
          </div>
        `).join('')}
      `;
    } else {
      container.innerHTML = `<pre style="font-size:0.8rem;">${JSON.stringify(res.logs || res, null, 2)}</pre>`;
    }

    modal.classList.add('active');
  } catch (err) {
    showToast('Failed to load version comparison: ' + err.message, 'error');
  }
}

function closeDiffModal() {
  const modal = document.getElementById('diffModal');
  if (modal) modal.classList.remove('active');
}
