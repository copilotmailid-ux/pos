const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/login
// @desc    Login using admin passcode only (no email required)
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Please provide passcode' });
    }

    // Retrieve custom admin password if set (fallback to 'admin123')
    const expectedPassword = process.env.ADMIN_DELETE_PASSWORD || 'admin123';

    if (password !== expectedPassword) {
      return res.status(401).json({ message: 'Incorrect passcode!' });
    }

    // Return mock admin login payload with session token
    res.json({
      _id: 'admin_id',
      name: 'Admin',
      role: 'admin',
      token: 'supermart-session-active',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user session
// @access  Private
router.get('/me', protect, async (req, res) => {
  res.json({
    _id: 'admin_id',
    name: 'Admin',
    role: 'admin',
  });
});

module.exports = router;
