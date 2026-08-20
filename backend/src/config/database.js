const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

let mysqlPool = null;

// Initial setup helper
async function initDatabase() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT || 3306);

  if (!host || !user || !password || !database) {
    const missing = [];
    if (!host) missing.push('DB_HOST');
    if (!user) missing.push('DB_USER');
    if (!password) missing.push('DB_PASSWORD');
    if (!database) missing.push('DB_NAME');
    const errMessage = `[DB ERROR] Missing required database environment variables: ${missing.join(', ')}`;
    console.error(errMessage);
    throw new Error(errMessage);
  }

  console.log(`[DB] Host: ${host}`);
  console.log(`[DB] Port: ${port}`);
  console.log(`[DB] User: ${user}`);
  console.log(`[DB] Database: ${database}`);

  try {
    // Attempt MySQL connection
    mysqlPool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true
    });

    // Test connection & initialize schema
    const connection = await mysqlPool.getConnection();
    console.log('[DB] MySQL connection successful');

    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      if (schemaSql.trim()) {
        await connection.query(schemaSql);
        console.log('[DB] Schema initialized successfully');
      }
    }

    // Add preset_services_json column if missing
    try {
      await connection.query("ALTER TABLE clients ADD COLUMN preset_services_json TEXT NULL");
    } catch (e) {}

    // Add onboarding_date, payment_terms_type, payment_schedule_json columns if missing
    try {
      await connection.query("ALTER TABLE clients ADD COLUMN onboarding_date VARCHAR(50) NULL");
    } catch (e) {}

    try {
      await connection.query("ALTER TABLE clients ADD COLUMN payment_terms_type VARCHAR(50) DEFAULT 'SINGLE'");
    } catch (e) {}

    try {
      await connection.query("ALTER TABLE clients ADD COLUMN payment_schedule_json TEXT NULL");
    } catch (e) {}

    try {
      await connection.query("ALTER TABLE clients MODIFY COLUMN status VARCHAR(50) DEFAULT 'ACTIVE'");
    } catch (e) {}

    // Ensure invoice_type column accommodates GST, GST_CLIENT, and NON_GST
    try {
      await connection.query("ALTER TABLE invoices MODIFY COLUMN invoice_type VARCHAR(20) DEFAULT 'GST'");
    } catch (e) {}

    // Ensure enquiries and enquiry_timeline tables exist
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS enquiries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          email VARCHAR(150),
          mobile VARCHAR(30) NOT NULL,
          business_name VARCHAR(255) NOT NULL,
          source ENUM('WEBSITE', 'CALL', 'GMB', 'ADS', 'MARKETING_PERSON', 'OTHER') NOT NULL DEFAULT 'WEBSITE',
          marketing_person VARCHAR(150) NULL,
          services_interested TEXT NULL,
          estimated_budget DECIMAL(12,2) DEFAULT 0.00,
          status ENUM('NEW', 'IN_DISCUSSION', 'QUOTATION_SENT', 'NEGOTIATION', 'ONBOARDED', 'LOST') NOT NULL DEFAULT 'NEW',
          notes TEXT NULL,
          converted_client_id INT NULL,
          onboarded_at DATETIME NULL,
          created_by INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_enq_status (status),
          INDEX idx_enq_source (source),
          INDEX idx_enq_date (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS enquiry_timeline (
          id INT AUTO_INCREMENT PRIMARY KEY,
          enquiry_id INT NOT NULL,
          event_type ENUM('NOTE', 'CALL', 'NEGOTIATION', 'STATUS_CHANGE', 'QUOTATION', 'ONBOARDED') NOT NULL DEFAULT 'NOTE',
          title VARCHAR(255) NOT NULL,
          details TEXT NULL,
          created_by_name VARCHAR(150) DEFAULT 'Admin',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timeline_enq (enquiry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed sample enquiries if table is empty
      const [rows] = await connection.query('SELECT COUNT(*) as cnt FROM enquiries');
      const count = rows[0] ? (rows[0].cnt || rows[0]['COUNT(*)']) : 0;
      if (count === 0) {
        const [e1] = await connection.query(`
          INSERT INTO enquiries (name, email, mobile, business_name, source, marketing_person, services_interested, estimated_budget, status, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 2 DAY))
        `, ['Suresh Kumar', 'suresh@aerofit.in', '+91 9840112233', 'AeroFit Gym & Wellness', 'WEBSITE', '', 'SEO Optimization, Social Media Marketing', 25000.00, 'IN_DISCUSSION', 'Enquired via website contact form. Looking for local Chennai gym promotion.']);

        await connection.query(`
          INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name, created_at)
          VALUES 
          (?, 'CALL', 'Initial Discovery Call', 'Discussed SEO keyword strategy and target area in Anna Nagar & T.Nagar.', 'Admin', DATE_SUB(NOW(), INTERVAL 2 DAY)),
          (?, 'NOTE', 'Requirement Scoping', 'Client requested a custom 3-month package with Meta Ads included.', 'Admin', DATE_SUB(NOW(), INTERVAL 1 DAY))
        `, [e1.insertId, e1.insertId]);

        const [e2] = await connection.query(`
          INSERT INTO enquiries (name, email, mobile, business_name, source, marketing_person, services_interested, estimated_budget, status, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 4 DAY))
        `, ['Ananya Sharma', 'ananya@zenithcafe.com', '+91 9962554433', 'Zenith Gourmet Cafe', 'GMB', '', 'Google Maps SEO, Food Photography, Instagram Ads', 40000.00, 'QUOTATION_SENT', 'Found us on Google My Business. Expanding to 2nd branch in OMR.']);

        await connection.query(`
          INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name, created_at)
          VALUES 
          (?, 'CALL', 'Meeting at Cafe', 'Showcased food photography portfolio and GMB local rank results.', 'Admin', DATE_SUB(NOW(), INTERVAL 4 DAY)),
          (?, 'QUOTATION', 'Quotation Issued', 'Sent Proposal #QUO002 with 6-month marketing plan worth ₹40,000.', 'Admin', DATE_SUB(NOW(), INTERVAL 3 DAY))
        `, [e2.insertId, e2.insertId]);

        const [e3] = await connection.query(`
          INSERT INTO enquiries (name, email, mobile, business_name, source, marketing_person, services_interested, estimated_budget, status, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 10 DAY))
        `, ['Rajesh Verma', 'rajesh@vermatech.com', '+91 9789001122', 'Verma Tech Solutions', 'ADS', '', 'Performance Meta & Google Ads, Landing Page Design', 65000.00, 'NEGOTIATION', 'Clicked on our Google Search Ad campaign. B2B software lead gen.']);

        await connection.query(`
          INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name, created_at)
          VALUES 
          (?, 'NEGOTIATION', 'Price Negotiation', 'Client requested 10% discount on first month ad setup fees. Agreed upon 5% incentive.', 'Admin', DATE_SUB(NOW(), INTERVAL 7 DAY)),
          (?, 'NOTE', 'Follow-up Scheduled', 'Contract review pending with legal team. Next call on Friday.', 'Admin', DATE_SUB(NOW(), INTERVAL 2 DAY))
        `, [e3.insertId, e3.insertId]);

        const [e4] = await connection.query(`
          INSERT INTO enquiries (name, email, mobile, business_name, source, marketing_person, services_interested, estimated_budget, status, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 15 DAY))
        `, ['Karthik N', 'karthik@novadental.in', '+91 9444123456', 'Nova Dental Clinic', 'MARKETING_PERSON', 'Vimal (Field Executive)', 'WhatsApp Marketing, Local SEO', 18000.00, 'ONBOARDED', 'Introduced by field marketing person Vimal. Converted and onboarded as active client.']);

        await connection.query(`
          INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name, created_at)
          VALUES 
          (?, 'ONBOARDED', 'Client Onboarded Successfully', 'Converted into Client Master. Account activated for WhatsApp campaigns.', 'Admin', DATE_SUB(NOW(), INTERVAL 14 DAY))
        `, [e4.insertId]);

        const [e5] = await connection.query(`
          INSERT INTO enquiries (name, email, mobile, business_name, source, marketing_person, services_interested, estimated_budget, status, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY))
        `, ['Meenakshi Sundaram', 'meena@silkfashion.com', '+91 9884099887', 'Sundaram Silk Sarees', 'CALL', '', 'E-commerce Website & Product Ads', 50000.00, 'NEW', 'Inbound direct call. Wants festive season marketing for Diwali.']);

        await connection.query(`
          INSERT INTO enquiry_timeline (enquiry_id, event_type, title, details, created_by_name, created_at)
          VALUES 
          (?, 'CALL', 'Inbound Inquiry Call', 'Collected basic requirements. Callback scheduled for tomorrow 11 AM.', 'Admin', DATE_SUB(NOW(), INTERVAL 1 DAY))
        `, [e5.insertId]);

        console.log('[DB Seed] Sample enquiries and timelines created.');
      }

      // Create meetings table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS meetings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          client_id INT NULL,
          client_name VARCHAR(255) NULL,
          enquiry_id INT NULL,
          meeting_mode ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
          meeting_date DATE NOT NULL,
          meeting_time VARCHAR(50) NOT NULL,
          location VARCHAR(255) NULL,
          status ENUM('SCHEDULED', 'DONE', 'RESCHEDULED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
          agenda TEXT NULL,
          minutes_notes TEXT NULL,
          created_by INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_meeting_client (client_id),
          INDEX idx_meeting_date (meeting_date),
          INDEX idx_meeting_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Create client_ads table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS client_ads (
          id INT AUTO_INCREMENT PRIMARY KEY,
          client_id INT NOT NULL,
          campaign_name VARCHAR(255) NOT NULL,
          platform ENUM('META', 'GOOGLE', 'INSTAGRAM', 'YOUTUBE', 'OTHER') NOT NULL DEFAULT 'META',
          ad_fund_budget DECIMAL(12,2) DEFAULT 0.00,
          spent_amount DECIMAL(12,2) DEFAULT 0.00,
          status ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'DRAFT') NOT NULL DEFAULT 'ACTIVE',
          leads_generated INT DEFAULT 0,
          start_date DATE NULL,
          end_date DATE NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ads_client (client_id),
          INDEX idx_ads_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Create client_call_logs table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS client_call_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          client_id INT NOT NULL,
          call_type VARCHAR(50) DEFAULT 'Outbound Call',
          duration VARCHAR(50) DEFAULT '5 mins',
          outcome VARCHAR(150) NOT NULL,
          title VARCHAR(255) NOT NULL,
          follow_up_date DATE NULL,
          notes TEXT NULL,
          created_by_name VARCHAR(150) DEFAULT 'Admin',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_call_client (client_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed sample meetings if table is empty
      const [mRows] = await connection.query('SELECT COUNT(*) as cnt FROM meetings');
      const mCount = mRows[0] ? (mRows[0].cnt || mRows[0]['COUNT(*)']) : 0;
      if (mCount === 0) {
        // Fetch first active client to link
        const [cRows] = await connection.query('SELECT id, company_name FROM clients LIMIT 2');
        const c1 = cRows[0] || { id: 1, company_name: 'Marks Biotech' };
        const c2 = cRows[1] || { id: 2, company_name: 'Apex Biotech Technologies' };

        await connection.query(`
          INSERT INTO meetings (title, client_id, client_name, meeting_mode, meeting_date, meeting_time, location, status, agenda, minutes_notes, created_at)
          VALUES 
          (?, ?, ?, 'ONLINE', CURDATE(), '11:30 AM', 'https://meet.google.com/dgr-owmb-app', 'SCHEDULED', 'Monthly Performance Review & Ad Creative Strategy for Q3', NULL, NOW()),
          (?, ?, ?, 'OFFLINE', DATE_ADD(CURDATE(), INTERVAL 2 DAY), '03:00 PM', 'D-GROW Conference Room / Client HQ, Valasaravakkam, Chennai', 'SCHEDULED', 'New E-commerce Product Line Kickoff & SEO Milestone Sign-off', NULL, NOW()),
          (?, ?, ?, 'ONLINE', DATE_SUB(CURDATE(), INTERVAL 5 DAY), '04:00 PM', 'https://meet.google.com/xyz-dgro-met', 'DONE', 'Onboarding Scope Discussion & Retainer Terms Agreement', 'Client agreed to standard 50% advance milestone. Requested weekly ad lead generation summary reports on Mondays. Ad fund budget approved at ₹45,000/month.', DATE_SUB(NOW(), INTERVAL 5 DAY))
        `, [
          'Monthly Performance & Strategy Review', c1.id, c1.company_name,
          'Product Line Kickoff & Campaign Launch', c2.id, c2.company_name,
          'Initial Onboarding & Retainer Agreement', c1.id, c1.company_name
        ]);

        console.log('[DB Seed] Sample meetings created.');
      }

      // Seed sample client ads if empty
      const [aRows] = await connection.query('SELECT COUNT(*) as cnt FROM client_ads');
      const aCount = aRows[0] ? (aRows[0].cnt || aRows[0]['COUNT(*)']) : 0;
      if (aCount === 0) {
        const [cRows] = await connection.query('SELECT id FROM clients LIMIT 2');
        if (cRows.length > 0) {
          const cId = cRows[0].id;
          await connection.query(`
            INSERT INTO client_ads (client_id, campaign_name, platform, ad_fund_budget, spent_amount, status, leads_generated, start_date, end_date, notes)
            VALUES 
            (?, 'Diwali Festive Mega Sale - Meta Advantage+', 'META', 30000.00, 18450.00, 'ACTIVE', 142, DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'High-performing video reels ad campaign with 3.8x ROAS.'),
            (?, 'Local Brand Search & High-Intent Keywords', 'GOOGLE', 20000.00, 12200.00, 'ACTIVE', 89, DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Google Search CPC avg ₹14.50. High conversion rate on landing page.')
          `, [cId, cId]);
          console.log('[DB Seed] Sample client ads created.');
        }
      }
    } catch (e) {
      console.error('[DB Migration Warning]', e.message);
    }

    connection.release();
    console.log(`[DB] Successfully connected to MySQL database '${database}'`);
  } catch (err) {
    console.error(`[DB ERROR] MySQL connection failed: ${err.message}`);
    throw err;
  }
}

// Universal query function
async function query(sql, params = []) {
  if (!mysqlPool) {
    throw new Error('Database pool has not been initialized');
  }
  const [rows] = await mysqlPool.execute(sql, params);
  return rows;
}

// Transaction wrapper
async function transaction(callback) {
  if (!mysqlPool) {
    throw new Error('Database pool has not been initialized');
  }
  const connection = await mysqlPool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback({
      execute: async (sql, params = []) => {
        const [rows] = await connection.execute(sql, params);
        return rows;
      }
    });
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

function getDriver() {
  return 'mysql';
}

module.exports = {
  initDatabase,
  query,
  transaction,
  getDriver
};
