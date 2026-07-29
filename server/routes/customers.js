const express = require('express');
const { get, all, run } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// @route   GET /api/customers
// @desc    Get customer list with dynamically merged visits & total spend stats
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT 
        c.id as _id,
        c.name,
        c.mobile,
        COUNT(s.id) as totalVisits,
        COALESCE(SUM(s.grandTotal), 0) as totalSpend,
        MAX(s.createdAt) as lastVisit
      FROM customers c
      LEFT JOIN sales s ON c.mobile = s.customerMobile AND s.customerMobile != ''
    `;
    const params = [];

    if (search) {
      sql += ` WHERE c.name LIKE ? OR c.mobile LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` GROUP BY c.id, c.name, c.mobile ORDER BY c.id DESC`;

    const customers = await all(sql, params);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customers/lookup/:mobile
// @desc    Find a single customer by their mobile number for auto-fill in billing
// @access  Private
router.get('/lookup/:mobile', async (req, res) => {
  try {
    const customer = await get(
      `SELECT id as _id, name, mobile FROM customers WHERE mobile = ?`,
      [req.params.mobile]
    );
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/customers
// @desc    Add a new customer manually
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name, mobile } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ message: 'Name and mobile number are required' });
    }

    // Check if customer already exists
    const existing = await get(`SELECT id FROM customers WHERE mobile = ?`, [mobile]);
    if (existing) {
      return res.status(400).json({ message: 'A customer with this mobile number already exists' });
    }

    const { id } = await run(
      `INSERT INTO customers (name, mobile) VALUES (?, ?)`,
      [name.trim(), mobile.trim()]
    );

    res.status(201).json({ _id: id, name, mobile });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/customers/:id
// @desc    Update customer details
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { name, mobile } = req.body;
    
    const customer = await get(`SELECT id, name, mobile FROM customers WHERE id = ?`, [req.params.id]);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    let finalMobile = customer.mobile;
    if (mobile && mobile !== customer.mobile) {
      const existing = await get(`SELECT id FROM customers WHERE mobile = ?`, [mobile]);
      if (existing) {
        return res.status(400).json({ message: 'Another customer is registered with this mobile number' });
      }
      finalMobile = mobile;
    }

    const finalName = name || customer.name;
    await run(
      `UPDATE customers SET name = ?, mobile = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [finalName, finalMobile, req.params.id]
    );

    res.json({ _id: req.params.id, name: finalName, mobile: finalMobile });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/customers/:id
// @desc    Delete a customer
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const customer = await get(`SELECT id FROM customers WHERE id = ?`, [req.params.id]);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await run(`DELETE FROM customers WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Customer removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
