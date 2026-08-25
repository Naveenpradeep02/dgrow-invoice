const db = require('../config/database');
const { logAudit } = require('../services/auditService');

async function getSettings(req, res) {
  try {
    const company = await db.query('SELECT * FROM company_settings WHERE id = 1');
    const terms = await db.query('SELECT * FROM invoice_terms WHERE id = 1');
    const sequence = await db.query('SELECT * FROM invoice_sequences WHERE id = 1');
    const taxRates = await db.query('SELECT * FROM tax_rates WHERE is_active = 1 ORDER BY rate_percentage ASC');

    res.json({
      success: true,
      company: company[0] || {},
      terms: terms[0] || {},
      sequence: sequence[0] || {},
      taxRates
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateCompanySettings(req, res) {
  try {
    const old = await db.query('SELECT * FROM company_settings WHERE id = 1');

    const {
      company_name,
      gstin,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      website,
      bank_name,
      account_number,
      ifsc_code,
      banking_name,
      branch_name,
      gpay_number,
      upi_id,
      authorized_person,
      signature_title
    } = req.body;

    await db.query(
      `UPDATE company_settings SET
        company_name = ?, gstin = ?, address = ?, city = ?, state = ?, pincode = ?,
        phone = ?, email = ?, website = ?, bank_name = ?, account_number = ?, ifsc_code = ?,
        banking_name = ?, branch_name = ?, gpay_number = ?, upi_id = ?, authorized_person = ?, signature_title = ?
       WHERE id = 1`,
      [
        company_name !== undefined ? company_name : old[0].company_name,
        gstin !== undefined ? gstin : old[0].gstin,
        address !== undefined ? address : old[0].address,
        city !== undefined ? city : old[0].city,
        state !== undefined ? state : old[0].state,
        pincode !== undefined ? pincode : old[0].pincode,
        phone !== undefined ? phone : old[0].phone,
        email !== undefined ? email : old[0].email,
        website !== undefined ? website : old[0].website,
        bank_name !== undefined ? bank_name : old[0].bank_name,
        account_number !== undefined ? account_number : old[0].account_number,
        ifsc_code !== undefined ? ifsc_code : old[0].ifsc_code,
        banking_name !== undefined ? banking_name : old[0].banking_name,
        branch_name !== undefined ? branch_name : old[0].branch_name,
        gpay_number !== undefined ? gpay_number : old[0].gpay_number,
        upi_id !== undefined ? upi_id : old[0].upi_id,
        authorized_person !== undefined ? authorized_person : old[0].authorized_person,
        signature_title !== undefined ? signature_title : old[0].signature_title
      ]
    );

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'SETTINGS',
      entity_id: 'COMPANY_SETTINGS',
      old_data: old[0],
      new_data: req.body,
      req
    });

    res.json({ success: true, message: 'Company settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateTerms(req, res) {
  try {
    const old = await db.query('SELECT * FROM invoice_terms WHERE id = 1');
    const { scope_of_work, payment_terms, ownership_usage, confidentiality, cancellation_policy, notes } = req.body;

    await db.query(
      `UPDATE invoice_terms SET 
        scope_of_work = ?, payment_terms = ?, ownership_usage = ?, confidentiality = ?, cancellation_policy = ?, notes = ?
       WHERE id = 1`,
      [
        scope_of_work || old[0].scope_of_work,
        payment_terms || old[0].payment_terms,
        ownership_usage || old[0].ownership_usage,
        confidentiality || old[0].confidentiality,
        cancellation_policy || old[0].cancellation_policy,
        notes || old[0].notes
      ]
    );

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'SETTINGS',
      entity_id: 'INVOICE_TERMS',
      old_data: old[0],
      new_data: req.body,
      req
    });

    res.json({ success: true, message: 'Invoice terms updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSettings,
  updateCompanySettings,
  updateTerms
};
