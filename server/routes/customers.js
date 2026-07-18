const express = require('express');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
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

    // Fetch all customers from DB
    const dbCustomers = await Customer.find().sort({ createdAt: -1 }).lean();

    // Fetch aggregated sales metrics grouped by customer mobile
    const salesData = await Sale.aggregate([
      { $match: { customerMobile: { $ne: '' } } },
      {
        $group: {
          _id: '$customerMobile',
          totalVisits: { $sum: 1 },
          totalSpend: { $sum: '$grandTotal' },
          lastVisit: { $max: '$createdAt' }
        }
      }
    ]);

    // Create a map for fast lookup of metrics
    const salesMap = new Map(salesData.map(s => [s._id, s]));

    // Merge manual customers with aggregated visit metrics
    let merged = dbCustomers.map(c => {
      const stats = salesMap.get(c.mobile) || { totalVisits: 0, totalSpend: 0, lastVisit: null };
      return {
        _id: c._id,
        name: c.name,
        mobile: c.mobile,
        totalVisits: stats.totalVisits,
        totalSpend: stats.totalSpend,
        lastVisit: stats.lastVisit
      };
    });

    // Handle text query filtering (search by name or mobile)
    if (search) {
      const query = search.toLowerCase();
      merged = merged.filter(
        c => 
          c.mobile.includes(query) || 
          c.name.toLowerCase().includes(query)
      );
    }

    res.json(merged);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customers/lookup/:mobile
// @desc    Find a single customer by their mobile number for auto-fill in billing
// @access  Private
router.get('/lookup/:mobile', async (req, res) => {
  try {
    const customer = await Customer.findOne({ mobile: req.params.mobile });
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
    const existing = await Customer.findOne({ mobile });
    if (existing) {
      return res.status(400).json({ message: 'A customer with this mobile number already exists' });
    }

    const customer = await Customer.create({ name, mobile });
    res.status(201).json(customer);
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
    
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check unique constraint if mobile changed
    if (mobile && mobile !== customer.mobile) {
      const existing = await Customer.findOne({ mobile });
      if (existing) {
        return res.status(400).json({ message: 'Another customer is registered with this mobile number' });
      }
      customer.mobile = mobile;
    }

    customer.name = name || customer.name;
    const updated = await customer.save();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/customers/:id
// @desc    Delete a customer
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await customer.deleteOne();
    res.json({ message: 'Customer removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
