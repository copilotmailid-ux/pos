const express = require('express');
const { get, all, run } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const mapSupplier = (s) => {
  if (!s) return s;
  return { ...s, _id: s.id };
};

// GET all suppliers
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT * FROM suppliers`;
    const params = [];

    if (search) {
      sql += ` WHERE name LIKE ? OR contactPerson LIKE ? OR phone LIKE ?`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    sql += ` ORDER BY name ASC`;

    const suppliers = await all(sql, params);
    res.json(suppliers.map(mapSupplier));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching suppliers', error: error.message });
  }
});

// GET supplier by ID (including their purchase history)
router.get('/:id', async (req, res) => {
  try {
    const supplier = await get(`SELECT * FROM suppliers WHERE id = ?`, [req.params.id]);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const purchases = await all(
      `SELECT id as _id, * FROM purchases WHERE supplierId = ? ORDER BY id DESC`,
      [req.params.id]
    );

    res.json({ supplier: mapSupplier(supplier), purchases });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching supplier details', error: error.message });
  }
});

// POST create supplier
router.post('/', async (req, res) => {
  try {
    const { name, supplierType, contactPerson, phone, email, address, gstin } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ message: 'Supplier name and phone are required' });
    }

    const finalType = supplierType || (gstin ? 'GST' : 'Non-GST');
    const finalContact = contactPerson || '';
    const finalEmail = email || '';
    const finalAddress = address || '';
    const finalGstin = gstin || '';

    const { id } = await run(
      `INSERT INTO suppliers (name, supplierType, contactPerson, phone, email, address, gstin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), finalType, finalContact.trim(), phone.trim(), finalEmail.trim(), finalAddress.trim(), finalGstin.trim()]
    );

    const saved = await get(`SELECT * FROM suppliers WHERE id = ?`, [id]);
    res.status(201).json(mapSupplier(saved));
  } catch (error) {
    res.status(500).json({ message: 'Server error saving supplier', error: error.message });
  }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const { name, supplierType, contactPerson, phone, email, address, gstin } = req.body;
    const supplier = await get(`SELECT * FROM suppliers WHERE id = ?`, [req.params.id]);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    const finalName = name || supplier.name;
    const finalType = supplierType || supplier.supplierType;
    const finalContact = contactPerson !== undefined ? contactPerson : supplier.contactPerson;
    const finalPhone = phone || supplier.phone;
    const finalEmail = email !== undefined ? email : supplier.email;
    const finalAddress = address !== undefined ? address : supplier.address;
    const finalGstin = gstin !== undefined ? gstin : supplier.gstin;

    await run(
      `UPDATE suppliers 
       SET name = ?, supplierType = ?, contactPerson = ?, phone = ?, email = ?, address = ?, gstin = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [finalName.trim(), finalType, finalContact.trim(), finalPhone.trim(), finalEmail.trim(), finalAddress.trim(), finalGstin.trim(), req.params.id]
    );

    const updated = await get(`SELECT * FROM suppliers WHERE id = ?`, [req.params.id]);
    res.json(mapSupplier(updated));
  } catch (error) {
    res.status(500).json({ message: 'Server error updating supplier', error: error.message });
  }
});

// DELETE supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await get(`SELECT id FROM suppliers WHERE id = ?`, [req.params.id]);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Check if supplier has purchases to prevent deletion of active history
    const hasPurchases = await get(`SELECT id FROM purchases WHERE supplierId = ? LIMIT 1`, [req.params.id]);
    if (hasPurchases) {
      return res.status(400).json({ message: 'Cannot delete supplier with active purchase history' });
    }

    await run(`DELETE FROM suppliers WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting supplier', error: error.message });
  }
});

module.exports = router;
