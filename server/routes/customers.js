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
        c.customerType,
        c.address,
        c.gstin,
        COUNT(s.id) as totalVisits,
        COALESCE(SUM(s.grandTotal), 0) as totalSpend,
        MAX(s.createdAt) as lastVisit
      FROM customers c
      LEFT JOIN sales s ON c.mobile = s.customerMobile AND s.customerMobile != ''
    `;
    const params = [];

    if (search) {
      sql += ` WHERE c.name LIKE ? OR c.mobile LIKE ? OR c.gstin LIKE ?`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` GROUP BY c.id, c.name, c.mobile, c.customerType, c.address, c.gstin ORDER BY c.id DESC`;

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
      `SELECT id as _id, name, mobile, customerType, address, gstin FROM customers WHERE mobile = ?`,
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

// @route   GET /api/customers/:id/ledger
// @desc    Get customer ledger and all past purchase bills
// @access  Private
router.get('/:id/ledger', async (req, res) => {
  try {
    const customer = await get(
      `SELECT id as _id, name, mobile, customerType, address, gstin FROM customers WHERE id = ?`,
      [req.params.id]
    );
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get all sales for this customer
    const sales = await all(
      `SELECT * FROM sales WHERE customerMobile = ? ORDER BY id DESC`,
      [customer.mobile]
    );

    // Populate items for each sale
    const populatedSales = await Promise.all(
      sales.map(async (sale) => {
        const items = await all(`SELECT * FROM sale_items WHERE saleId = ?`, [sale.id]);
        return {
          ...sale,
          _id: sale.id,
          items: items.map(item => ({
            ...item,
            _id: item.id
          }))
        };
      })
    );

    const totalSpend = sales.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0);
    const totalVisits = sales.length;
    const avgOrderValue = totalVisits > 0 ? (totalSpend / totalVisits) : 0;

    res.json({
      customer,
      summary: {
        totalSpend,
        totalVisits,
        avgOrderValue,
        firstVisit: sales[sales.length - 1]?.createdAt || null,
        lastVisit: sales[0]?.createdAt || null
      },
      sales: populatedSales
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/customers
// @desc    Add a new customer manually
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name, mobile, customerType, address, gstin } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ message: 'Name and mobile number are required' });
    }

    // Check if customer already exists
    const existing = await get(`SELECT id FROM customers WHERE mobile = ?`, [mobile]);
    if (existing) {
      return res.status(400).json({ message: 'A customer with this mobile number already exists' });
    }

    const finalType = customerType === 'Shop' ? 'Shop' : 'Home';

    const { id } = await run(
      `INSERT INTO customers (name, mobile, customerType, address, gstin) VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), mobile.trim(), finalType, (address || '').trim(), (gstin || '').trim()]
    );

    res.status(201).json({ _id: id, name, mobile, customerType: finalType, address, gstin });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/customers/:id
// @desc    Update customer details
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { name, mobile, customerType, address, gstin } = req.body;
    
    const customer = await get(`SELECT id, name, mobile, customerType, address, gstin FROM customers WHERE id = ?`, [req.params.id]);
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
    const finalType = customerType !== undefined ? (customerType === 'Shop' ? 'Shop' : 'Home') : (customer.customerType || 'Home');
    const finalAddress = address !== undefined ? address.trim() : (customer.address || '');
    const finalGstin = gstin !== undefined ? gstin.trim() : (customer.gstin || '');

    await run(
      `UPDATE customers SET name = ?, mobile = ?, customerType = ?, address = ?, gstin = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [finalName, finalMobile, finalType, finalAddress, finalGstin, req.params.id]
    );

    // If mobile number changed, update historical sales and quotations to preserve customer invoice ledger
    if (finalMobile !== customer.mobile) {
      await run(`UPDATE sales SET customerMobile = ? WHERE customerMobile = ?`, [finalMobile, customer.mobile]);
      await run(`UPDATE quotations SET customerMobile = ? WHERE customerMobile = ?`, [finalMobile, customer.mobile]);
    }

    res.json({ _id: req.params.id, name: finalName, mobile: finalMobile, customerType: finalType, address: finalAddress, gstin: finalGstin });
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
