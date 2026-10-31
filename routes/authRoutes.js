const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/auth – authentication service status & users overview
router.get('/', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({
      success: true,
      service: 'StreamSmart Auth Service',
      usersCount: users.length,
      users,
      endpoints: {
        users: 'GET /api/auth/users',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/users – list all users (demo)
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login – simple username login (hackathon demo)
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    let user = await User.findByUsername(username);
    if (!user) {
      // Auto-create tester account
      user = await User.create({ username, role: 'tester' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me – current user (demo: always returns user 1)
router.get('/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 1;
    const user = await User.findById(userId);
    res.json({ user: user || { user_id: 1, username: 'demo_tester', role: 'tester' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

