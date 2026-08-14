const mysql = require('mysql2/promise');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbDriver = 'mysql';
let mysqlPool = null;
let sqliteDb = null;

// Initial setup helper
async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'dgrow_invoice_db';
  const port = process.env.DB_PORT || 3306;

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
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(schemaSql);
    }
    
    // Add preset_services_json column if missing
    try {
      await connection.query("ALTER TABLE clients ADD COLUMN preset_services_json TEXT NULL");
    } catch (e) {
      // Column already exists
    }

    connection.release();
    console.log(`[DB] Successfully connected to MySQL database '${database}' on ${host}:${port}`);
    dbDriver = 'mysql';
  } catch (err) {
    console.warn(`[DB Warning] MySQL connection failed (${err.message}). Initializing automatic SQLite storage mode...`);
    dbDriver = 'sqlite';
    setupSqliteFallback();
  }
}

function setupSqliteFallback() {
  const dbPath = path.join(__dirname, '..', '..', 'dgrow_invoice.sqlite');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  // Load and adapt schema script for SQLite
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');
    // Remove MySQL specific directives & map data types for SQLite
    schemaSql = schemaSql.replace(/CREATE DATABASE IF NOT EXISTS dgrow_invoice_db;/g, '');
    schemaSql = schemaSql.replace(/USE dgrow_invoice_db;/g, '');
    schemaSql = schemaSql.replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;/g, ';');
    schemaSql = schemaSql.replace(/INT AUTO_INCREMENT PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    schemaSql = schemaSql.replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT');
    schemaSql = schemaSql.replace(/LONGTEXT/gi, 'TEXT');
    schemaSql = schemaSql.replace(/ENUM\([^)]+\)/gi, 'TEXT');
    schemaSql = schemaSql.replace(/INSERT IGNORE INTO/gi, 'INSERT OR IGNORE INTO');
    schemaSql = schemaSql.replace(/,?\s*INDEX\s+[a-z0-9_]+\s*\([^)]+\)/gi, '');
    schemaSql = schemaSql.replace(/ON DUPLICATE KEY UPDATE [^;]+/gi, '');
    schemaSql = schemaSql.replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '');

    // Split statements and execute individually
    const statements = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    statements.forEach(stmt => {
      try {
        sqliteDb.exec(stmt + ';');
      } catch (e) {
        // Ignore duplicate inserts if table exists
        if (!e.message.includes('already exists') && !e.message.includes('UNIQUE constraint failed')) {
          console.warn('[DB SQLite Init Notice]', e.message);
        }
      }
    });
    console.log('[DB] SQLite database initialized and synced at:', dbPath);
  }
}

// Universal query function compatible with both MySQL and SQLite
async function query(sql, params = []) {
  if (dbDriver === 'mysql') {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  } else {
    // Convert ? parameters for sqlite if needed
    // Mysql uses ?, sqlite uses ? as well for positional
    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
      return stmt.all(...params);
    } else {
      const info = stmt.run(...params);
      return {
        insertId: info.lastInsertRowid,
        affectedRows: info.changes
      };
    }
  }
}

// Transaction wrapper
async function transaction(callback) {
  if (dbDriver === 'mysql') {
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
  } else {
    const execute = async (sql, params = []) => {
      const stmt = sqliteDb.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params);
      } else {
        const info = stmt.run(...params);
        return { insertId: info.lastInsertRowid, affectedRows: info.changes };
      }
    };
    const txn = sqliteDb.transaction(() => callback({ execute }));
    return txn();
  }
}

function getDriver() {
  return dbDriver;
}

module.exports = {
  initDatabase,
  query,
  transaction,
  getDriver
};
