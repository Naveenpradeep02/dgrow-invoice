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
