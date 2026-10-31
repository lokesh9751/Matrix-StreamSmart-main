const db = require('../config/db');
const fallback = require('../utils/inMemoryFallbackStore');

class User {
  static async findAll() {
    try {
      const [rows] = await db.execute('SELECT user_id, username, role, created_at FROM users');
      return rows;
    } catch (err) {
      console.warn('[User.findAll] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getUsers();
    }
  }

  static async findById(userId) {
    try {
      const [rows] = await db.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
      return rows[0] || null;
    } catch (err) {
      console.warn('[User.findById] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getUserById(userId);
    }
  }

  static async findByUsername(username) {
    try {
      const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
      return rows[0] || null;
    } catch (err) {
      console.warn('[User.findByUsername] MySQL unavailable, using fallback store:', err.code || err.message);
      return fallback.getUserByUsername(username);
    }
  }

  static async create({ username, role = 'tester' }) {
    try {
      const [result] = await db.execute(
        'INSERT INTO users (username, role) VALUES (?, ?)',
        [username, role]
      );
      return { userId: result.insertId, username, role };
    } catch (err) {
      console.warn('[User.create] MySQL unavailable, using fallback store:', err.code || err.message);
      const u = { user_id: Date.now(), username, role, created_at: new Date().toISOString() };
      return { userId: u.user_id, ...u };
    }
  }
}

module.exports = User;
