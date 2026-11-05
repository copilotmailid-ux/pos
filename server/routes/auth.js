const express = require('express');
const router = express.Router();
const { get } = require('../config/db');
const { protect } = require('../middleware/auth');

// @route   GET /api/auth/config
// @desc    Get public auth config (whether login password is enabled)
// @access  Public
router.get('/config', async (req, res) => {
  try {
    const settings = await get('SELECT enableLoginPassword FROM settings WHERE id = 1');
    res.json({
      enableLoginPassword: settings ? settings.enableLoginPassword !== 0 : true
    });
  } catch (err) {
    res.json({ enableLoginPassword: true });
  }
});

// @route   POST /api/auth/login
// @desc    Login using admin passcode only (no email required)
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;

    // Retrieve custom admin login password from database settings (fallback to 'admin123')
    const settings = await get('SELECT loginPassword, enableLoginPassword FROM settings WHERE id = 1');
    const isLoginPassRequired = settings ? settings.enableLoginPassword !== 0 : true;

    // If login password requirement is disabled in settings, allow immediate access
    if (!isLoginPassRequired) {
      return res.json({
        _id: 'admin_id',
        name: 'Admin',
        role: 'admin',
        token: 'supermart-session-active',
      });
    }

    if (!password) {
      return res.status(400).json({ message: 'Please provide passcode' });
    }

    const expectedPassword = settings?.loginPassword || process.env.ADMIN_LOGIN_PASSWORD || process.env.ADMIN_DELETE_PASSWORD || 'admin123';

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
