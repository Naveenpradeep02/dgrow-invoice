const db = require('../config/database');
const { logAudit } = require('../services/auditService');

async function getAllClients(req, res) {
  try {
    const { search = '', status = '' } = req.query;
    let sql = 'SELECT * FROM clients WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR gstin LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY company_name ASC';

    const clients = await db.query(sql, params);
    res.json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getClientById(req, res) {
  try {
    const { id } = req.params;
    const clients = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!clients[0]) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.json({ success: true, client: clients[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createClient(req, res) {
  try {
    const {
      company_name,
      contact_person,
      mobile,
      email,
      address,
      city,
      state = 'Tamil Nadu',
      pincode,
      gstin,
      pan,
      billing_address,
      shipping_address,
      preset_services_json
    } = req.body;

    if (!company_name || !mobile || !email || !address) {
      return res.status(400).json({ success: false, message: 'Company Name, Mobile, Email, and Address are required.' });
    }

    const presetJson = typeof preset_services_json === 'object' ? JSON.stringify(preset_services_json) : (preset_services_json || null);

    const result = await db.query(
      `INSERT INTO clients 
      (company_name, contact_person, mobile, email, address, city, state, pincode, gstin, pan, billing_address, shipping_address, preset_services_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company_name,
        contact_person || null,
        mobile,
        email,
        address,
        city || null,
        state || 'Tamil Nadu',
        pincode || null,
        gstin || null,
        pan || null,
        billing_address || address || null,
        shipping_address || address || null,
        presetJson
      ]
    );

    const newClientId = result.insertId;

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'CLIENT',
      entity_id: newClientId,
      new_data: req.body,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Client created successfully.',
      clientId: newClientId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const oldClient = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!oldClient[0]) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const {
      company_name,
      contact_person,
      mobile,
      email,
      address,
      city,
      state,
      pincode,
      gstin,
      pan,
      billing_address,
      shipping_address,
      preset_services_json,
      status
    } = req.body;

    const presetJson = typeof preset_services_json === 'object' ? JSON.stringify(preset_services_json) : (preset_services_json !== undefined ? preset_services_json : oldClient[0].preset_services_json);

    await db.query(
      `UPDATE clients SET
        company_name = ?,
        contact_person = ?,
        mobile = ?,
        email = ?,
        address = ?,
        city = ?,
        state = ?,
        pincode = ?,
        gstin = ?,
        pan = ?,
        billing_address = ?,
        shipping_address = ?,
        preset_services_json = ?,
        status = ?
      WHERE id = ?`,
      [
        company_name || oldClient[0].company_name,
        contact_person !== undefined ? contact_person : oldClient[0].contact_person,
        mobile || oldClient[0].mobile,
        email || oldClient[0].email,
        address || oldClient[0].address,
        city !== undefined ? city : oldClient[0].city,
        state !== undefined ? state : oldClient[0].state,
        pincode !== undefined ? pincode : oldClient[0].pincode,
        gstin !== undefined ? gstin : oldClient[0].gstin,
        pan !== undefined ? pan : oldClient[0].pan,
        billing_address !== undefined ? billing_address : oldClient[0].billing_address,
        shipping_address !== undefined ? shipping_address : oldClient[0].shipping_address,
        presetJson,
        status || oldClient[0].status,
        id
      ]
    );

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'CLIENT',
      entity_id: id,
      old_data: oldClient[0],
      new_data: req.body,
      req
    });

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllClients,
  getClientById,
  createClient,
  updateClient
};
