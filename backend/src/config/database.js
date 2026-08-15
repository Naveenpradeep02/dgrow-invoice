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
    } catch (e) {
      // Column already exists
    }

    // Ensure invoice_type column accommodates GST, GST_CLIENT, and NON_GST
    try {
      await connection.query("ALTER TABLE invoices MODIFY COLUMN invoice_type VARCHAR(20) DEFAULT 'GST'");
    } catch (e) {
      // Error adjusting column
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
