/**
 * auth.js – Simple session/role middleware
 * For the hackathon, we use a basic user_id header approach.
 * In production, replace with JWT or proper session auth.
 */

const User = require('../models/User');

async function requireAuth(req, res, next) {
  // Accept user_id from header or query for hackathon simplicity
  const userId = req.headers['x-user-id'] || req.query.userId || 1;
  try {
    const user = await User.findById(userId);
    if (!user) {
      // Default to tester role if user not found (demo mode)
      req.user = { user_id: 1, username: 'demo_tester', role: 'tester' };
    } else {
      req.user = user;
    }
    next();
  } catch (err) {
    req.user = { user_id: 1, username: 'demo_tester', role: 'tester' };
    next();
  }
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Admin access required' });
    }
  });
}

module.exports = { requireAuth, requireAdmin };

