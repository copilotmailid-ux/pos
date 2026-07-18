const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');

// GET all purchases
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    if (search) {
      query = {
        $or: [
          { purchaseNumber: { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const purchases = await Purchase.find(query)
      .populate('supplier', 'name phone contactPerson')
      .sort({ createdAt: -1 });
      
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching purchases' });
  }
});

// GET specific purchase by ID
router.get('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier')
      .populate('items.product');
      
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching purchase details' });
  }
});

// POST record new purchase
router.post('/', async (req, res) => {
  try {
    const { supplier, items, paymentMethod, notes, invoiceDate } = req.body;
    
    if (!supplier || !items || items.length === 0) {
      return res.status(400).json({ message: 'Supplier and items are required' });
    }

    // Verify supplier exists
    const existingSupplier = await Supplier.findById(supplier);
    if (!existingSupplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Generate unique purchase number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const purchaseNumber = `PUR-${dateStr}-${randomSuffix}`;

    let subtotal = 0;
    let tax = 0;
    let total = 0;
    const processedItems = [];

    // Begin processing each item
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productName} not found` });
      }

      const itemQty = Number(item.quantity);
      const itemPurchasePrice = Number(item.purchasePrice);
      const itemSellingPrice = Number(item.sellingPrice);
      const itemGst = Number(item.gstRate || 12);
      
      const itemSubtotal = itemQty * itemPurchasePrice;
      const itemTax = itemSubtotal * (itemGst / 100);
      const itemTotal = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      tax += itemTax;
      total += itemTotal;

      processedItems.push({
        product: product._id,
        productName: product.name,
        variant: product.variant || '',
        barcode: product.barcode,
        quantity: itemQty,
        purchasePrice: itemPurchasePrice,
        sellingPrice: itemSellingPrice,
        gstRate: itemGst,
        total: itemTotal
      });

      // Update product inventory levels, purchase price, and selling price
      product.stock = (product.stock || 0) + itemQty;
      product.purchasePrice = itemPurchasePrice;
      product.sellingPrice = itemSellingPrice;
      await product.save();
    }

    const newPurchase = new Purchase({
      purchaseNumber,
      supplier,
      items: processedItems,
      subtotal,
      tax,
      total,
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      status: 'Received',
      invoiceDate: invoiceDate || new Date()
    });

    const savedPurchase = await newPurchase.save();
    res.status(201).json(savedPurchase);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error recording purchase' });
  }
});

// POST trigger purchase return
router.post('/:id/return', async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    if (purchase.status === 'Returned') {
      return res.status(400).json({ message: 'This purchase has already been fully returned' });
    }

    // Process return: reduce stock of all items in this purchase
    for (const item of purchase.items) {
      const product = await Product.findById(item.product);
      if (product) {
        // Decrease stock (do not allow negative stock if it's already sold, but let's deduct up to quantity)
        const deductQty = Math.min(product.stock, item.quantity);
        product.stock = Math.max(0, product.stock - deductQty);
        await product.save();
      }
    }

    purchase.status = 'Returned';
    const updatedPurchase = await purchase.save();
    res.json(updatedPurchase);
  } catch (error) {
    res.status(500).json({ message: 'Server error returning purchase' });
  }
});

module.exports = router;
