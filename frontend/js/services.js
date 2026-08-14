// Service Master Management Script

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('servicesTableBody')) {
    loadServices();
  }
});

let loadedServicesMap = {};

async function loadServices() {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading services...</td></tr>';
    const res = await apiFetch('/services');

    if (!res.services || res.services.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No services configured.</td></tr>';
      return;
    }

    loadedServicesMap = {};
    res.services.forEach(s => { loadedServicesMap[s.id] = s; });

    tbody.innerHTML = res.services.map(s => `
      <tr>
        <td><strong>${s.name}</strong><br><span style="font-size:0.75rem; color:var(--text-muted); line-height:1.4;">${s.description ? s.description.replace(/\n/g, '<br>') : ''}</span></td>
        <td><code>${s.hsn_sac || '998311'}</code></td>
        <td><strong>${formatINR(s.default_rate)}</strong></td>
        <td>${s.default_gst_rate}%</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editService(${s.id})">Edit</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

function openAddServiceModal() {
  document.getElementById('serviceModalTitle').textContent = 'Add New Service';
  document.getElementById('serviceForm').reset();
  document.getElementById('serviceId').value = '';
  document.getElementById('serviceModal').classList.add('active');
}

function closeServiceModal() {
  document.getElementById('serviceModal').classList.remove('active');
}

function editService(id) {
  const s = loadedServicesMap[id];
  if (!s) return;

  document.getElementById('serviceModalTitle').textContent = 'Edit Service';
  document.getElementById('serviceId').value = s.id;
  document.getElementById('service_name').value = s.name;
  document.getElementById('service_desc').value = s.description || '';
  document.getElementById('hsn_sac').value = s.hsn_sac || '998311';
  document.getElementById('default_rate').value = s.default_rate || 0;
  document.getElementById('default_gst_rate').value = s.default_gst_rate || 18;
  document.getElementById('serviceModal').classList.add('active');
}

async function handleSaveService(e) {
  e.preventDefault();
  const id = document.getElementById('serviceId').value;
  const data = {
    name: document.getElementById('service_name').value,
    description: document.getElementById('service_desc').value,
    hsn_sac: document.getElementById('hsn_sac').value,
    default_rate: parseFloat(document.getElementById('default_rate').value) || 0,
    default_gst_rate: parseFloat(document.getElementById('default_gst_rate').value) || 18
  };

  try {
    if (id) {
      await apiFetch(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Service updated successfully', 'success');
    } else {
      await apiFetch('/services', { method: 'POST', body: JSON.stringify(data) });
      showToast('Service created successfully', 'success');
    }
    closeServiceModal();
    loadServices();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
