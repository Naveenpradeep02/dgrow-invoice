const db = require('../config/database');
const { logAudit } = require('../services/auditService');

async function seedDefaultServicesIfEmpty() {
  try {
    const services = await db.query('SELECT COUNT(*) as cnt FROM services');
    const cnt = services[0] ? (services[0].cnt || services[0]['COUNT(*)']) : 0;

    if (cnt === 0) {
      const defaultServices = [
        ['Email Marketing Tool Buying', 'Third-party tool procurement & setup', '998311', 5800.00, 18.00],
        ['Email Credits Buying', 'Bulk email dispatch credits', '998311', 1500.00, 18.00],
        ['WhatsApp API Tool Purchase', 'Meta API setup & tool license', '998313', 2000.00, 18.00],
        ['WhatsApp Messaging Credits', 'Messaging volume credits recovery', '998313', 2000.00, 18.00],
        ['Digital Marketing Retainer', 'Monthly strategic digital marketing services', '998311', 15000.00, 18.00],
        ['SEO Optimization & Analytics', 'Search engine optimization & audit', '998311', 8500.00, 18.00]
      ];

      for (const s of defaultServices) {
        await db.query(
          'INSERT INTO services (name, description, hsn_sac, default_rate, default_gst_rate) VALUES (?, ?, ?, ?, ?)',
          s
        );
      }
      console.log('[Service Seed] Default agency services seeded.');
    }
  } catch (err) {
    console.error('[Service Seed Warning]', err.message);
  }
}

async function getAllServices(req, res) {
  try {
    const services = await db.query('SELECT * FROM services WHERE status = "ACTIVE" ORDER BY name ASC');
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createService(req, res) {
  try {
    const { name, description, hsn_sac = '998311', default_rate = 0, default_gst_rate = 18 } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Service name is required' });

    const result = await db.query(
      'INSERT INTO services (name, description, hsn_sac, default_rate, default_gst_rate) VALUES (?, ?, ?, ?, ?)',
      [name, description, hsn_sac, default_rate, default_gst_rate]
    );

    await logAudit({
      user: req.user,
      action: 'CREATE',
      entity_type: 'SERVICE',
      entity_id: result.insertId,
      new_data: req.body,
      req
    });

    res.status(201).json({ success: true, message: 'Service created successfully', serviceId: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateService(req, res) {
  try {
    const { id } = req.params;
    const old = await db.query('SELECT * FROM services WHERE id = ?', [id]);
    if (!old[0]) return res.status(404).json({ success: false, message: 'Service not found' });

    const { name, description, hsn_sac, default_rate, default_gst_rate, status } = req.body;
    await db.query(
      'UPDATE services SET name = ?, description = ?, hsn_sac = ?, default_rate = ?, default_gst_rate = ?, status = ? WHERE id = ?',
      [
        name || old[0].name,
        description || old[0].description,
        hsn_sac || old[0].hsn_sac,
        default_rate !== undefined ? default_rate : old[0].default_rate,
        default_gst_rate !== undefined ? default_gst_rate : old[0].default_gst_rate,
        status || old[0].status,
        id
      ]
    );

    await logAudit({
      user: req.user,
      action: 'UPDATE',
      entity_type: 'SERVICE',
      entity_id: id,
      old_data: old[0],
      new_data: req.body,
      req
    });

    res.json({ success: true, message: 'Service updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  seedDefaultServicesIfEmpty,
  getAllServices,
  createService,
  updateService
};
