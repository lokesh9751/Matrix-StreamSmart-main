/**
 * config/db.js – MySQL Connection Pool & Initialization Manager
 *
 * Implements a connection pool using `mysql2/promise` configured from environment variables.
 * Automatically initializes the database if needed, and provides standard query/execute
 * interfaces across the StreamSmart backend.
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const initDatabase = require('../scripts/initDatabase');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'streamsmart_db';

let pool = null;

/**
 * Get or create the shared MySQL connection pool.
 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return pool;
}

/**
 * Ensures the target database and all schema tables exist,
 * then verifies connection pool health.
 */
async function initializeAndConnect() {
  // Step 1: Ensure database & schema exist (connects to MySQL server first)
  await initDatabase({ verbose: true });

  // Step 2: Establish and verify pool connection to the target database
  const p = getPool();
  const conn = await p.getConnection();
  try {
    await conn.query('SELECT 1');
    console.log(`✅ MySQL connection pool established to database '${DB_NAME}'.`);
  } finally {
    conn.release();
  }

  return p;
}

/**
 * Execute parameterized query.
 */
async function execute(sql, params = []) {
  const p = getPool();
  return p.execute(sql, params);
}

/**
 * Query shorthand (for raw SQL statements).
 */
async function query(sql, params = []) {
  const p = getPool();
  return p.query(sql, params);
}

/**
 * Acquire raw connection from pool.
 */
async function getConnection() {
  const p = getPool();
  return p.getConnection();
}

module.exports = {
  getPool,
  execute,
  query,
  getConnection,
  initializeAndConnect,
  initDatabase,
  DB_CONFIG: {
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    database: DB_NAME
  }
};
