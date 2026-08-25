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

    // Ensure upi_id exists in company_settings
    try {
      await connection.query("ALTER TABLE company_settings ADD COLUMN upi_id VARCHAR(100) NULL DEFAULT '7373509585@okbizaxis'");
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
          source VARCHAR(50) NOT NULL DEFAULT 'WEBSITE',
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

      try {
        await connection.query("ALTER TABLE enquiries MODIFY COLUMN source VARCHAR(50) NOT NULL DEFAULT 'WEBSITE'");
      } catch (e) {}

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

      // Tables initialized without dummy seed data
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
