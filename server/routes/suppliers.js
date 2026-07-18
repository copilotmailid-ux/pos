const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');

// GET all suppliers
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { contactPerson: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      };
    }
    const suppliers = await Supplier.find(query).sort({ name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching suppliers' });
  }
});

// GET supplier by ID (including their purchase history)
router.get('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    const purchases = await Purchase.find({ supplier: req.params.id }).sort({ createdAt: -1 });
    res.json({ supplier, purchases });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching supplier details' });
  }
});

// POST create supplier
router.post('/', async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, gstin } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ message: 'Supplier name and phone are required' });
    }
    const newSupplier = new Supplier({
      name,
      contactPerson,
      phone,
      email,
      address,
      gstin
    });
    const saved = await newSupplier.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Server error saving supplier' });
  }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, gstin } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    if (name) supplier.name = name;
    if (contactPerson !== undefined) supplier.contactPerson = contactPerson;
    if (phone) supplier.phone = phone;
    if (email !== undefined) supplier.email = email;
    if (address !== undefined) supplier.address = address;
    if (gstin !== undefined) supplier.gstin = gstin;

    const updated = await supplier.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error updating supplier' });
  }
});

// DELETE supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Check if supplier has purchases to prevent deletion of active history
    const hasPurchases = await Purchase.findOne({ supplier: req.params.id });
    if (hasPurchases) {
      return res.status(400).json({ message: 'Cannot delete supplier with active purchase history' });
    }

    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting supplier' });
  }
});

module.exports = router;
