/**
 * config/db.js – MongoDB Connection Manager via Mongoose
 *
 * Connects to MongoDB using `process.env.MONGO_URI`.
 * Handles connection lifecycle, re-connections, and status reporting.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamsmart_db';

let isConnected = false;

/**
 * Connect to MongoDB using Mongoose.
 */
async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    isConnected = false;
    throw error;
  }
}

/**
 * Compatibility helper matching previous server initialization flow.
 * Attempts to connect and optionally seeds initial data if collections are empty.
 */
async function initializeAndConnect(options = { verbose: true }) {
  try {
    const conn = await connectDB();
    // Run initial seed if necessary
    const initDatabase = require('../scripts/initDatabase');
    await initDatabase(options);
    return conn;
  } catch (err) {
    if (options.verbose) {
      console.warn('⚠️ Warning: MongoDB unavailable during initialization.');
      console.warn(`   Error: ${err.message}`);
    }
    throw err;
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️ MongoDB connection lost.');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('🔄 MongoDB connection restored.');
});

module.exports = {
  connectDB,
  initializeAndConnect,
  mongoose,
  connection: mongoose.connection,
  get isConnected() {
    return mongoose.connection.readyState === 1;
  },
  DB_CONFIG: {
    uri: MONGO_URI,
    database: MONGO_URI.split('/').pop().split('?')[0] || 'streamsmart_db'
  }
};
