const express = require('express');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// @route   POST /api/sales
// @desc    Create a new sale, save items, reduce stock
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { items, customerMobile, customerName, paymentMethod, amountPaid, changeReturned } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in the sale' });
    }

    // Auto-Register customer in Database if mobile is provided and doesn't exist
    if (customerMobile && customerName) {
      const existingCustomer = await Customer.findOne({ mobile: customerMobile.trim() });
      if (!existingCustomer) {
        await Customer.create({
          name: customerName.trim(),
          mobile: customerMobile.trim(),
        });
      }
    }

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    const saleItemsData = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        });
      }

      const itemGstRate = product.gstRate ?? 12;
      const itemSubtotal = product.sellingPrice * item.quantity;
      const itemTax = itemSubtotal * (itemGstRate / 100);

      subtotal += itemSubtotal;
      totalTax += itemTax;

      saleItemsData.push({
        product: product._id,
        productName: product.name,
        variant: product.variant || '',
        barcode: product.barcode,
        quantity: item.quantity,
        price: product.sellingPrice,
        purchasePrice: product.purchasePrice || 0,
        gstRate: itemGstRate,
        taxAmount: itemTax,
        total: itemSubtotal + itemTax,
      });
    }

    const cgstAmount = totalTax / 2;
    const sgstAmount = totalTax / 2;
    const grandTotal = subtotal + totalTax;

    // Create the sale with customer & payment metadata
    const sale = await Sale.create({
      customerMobile: customerMobile || '',
      customerName: customerName || '',
      paymentMethod: paymentMethod || 'Cash Tendered',
      amountPaid: amountPaid !== undefined ? Number(amountPaid) : grandTotal,
      changeReturned: changeReturned !== undefined ? Number(changeReturned) : 0,
      subtotal,
      taxAmount: totalTax,
      cgstAmount,
      sgstAmount,
      grandTotal,
    });

    // Create sale items and link to sale
    const createdItems = [];
    for (const itemData of saleItemsData) {
      const saleItem = await SaleItem.create({
        ...itemData,
        sale: sale._id,
      });
      createdItems.push(saleItem._id);
    }

    // Update sale with item references
    sale.items = createdItems;
    await sale.save();

    // Reduce stock for each product
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    // Return the complete sale with populated items
    const completeSale = await Sale.findById(sale._id).populate('items');

    res.status(201).json(completeSale);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/sales
// @desc    Get all sales (with optional search by invoice or date)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search, startDate, endDate, page = 1, limit = 20 } = req.query;
    let filter = {};

    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerMobile: { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Sale.countDocuments(filter);

    const sales = await Sale.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items');

    res.json({
      sales,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/sales/:id
// @desc    Get single sale with items
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('items');

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/sales/:id/return
// @desc    Process return for specific items in a sale
// @access  Private
router.post('/:id/return', async (req, res) => {
  try {
    const { items, reason } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items specified for return' });
    }

    const sale = await Sale.findById(req.params.id).populate('items');
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    if (sale.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot process return on a cancelled sale' });
    }

    let totalRefund = 0;

    for (const returnItem of items) {
      const dbItem = sale.items.find(item => item._id.toString() === returnItem.saleItemId);
      if (!dbItem) {
        return res.status(400).json({ message: `Item ${returnItem.saleItemId} not found in this sale` });
      }

      const returnedQty = Number(returnItem.returnedQty || 0);
      if (returnedQty <= 0) continue;

      const maxReturnable = dbItem.quantity - (dbItem.returnedQuantity || 0);
      if (returnedQty > maxReturnable) {
        return res.status(400).json({ 
          message: `Cannot return ${returnedQty} units of ${dbItem.productName}. Maximum returnable is ${maxReturnable}.`
        });
      }

      // Update returned quantity on SaleItem
      dbItem.returnedQuantity = (dbItem.returnedQuantity || 0) + returnedQty;
      await dbItem.save();

      // Calculate refund: Price * Quantity * (1 + GST)
      const gstRate = dbItem.gstRate ?? 12;
      const refundAmount = returnedQty * dbItem.price * (1 + gstRate / 100);
      totalRefund += refundAmount;

      // Increase product stock
      const product = await Product.findById(dbItem.product);
      if (product) {
        product.stock = (product.stock || 0) + returnedQty;
        await product.save();
      }
    }

    // Recalculate if all items are fully returned
    let allReturned = true;
    for (const item of sale.items) {
      if ((item.returnedQuantity || 0) < item.quantity) {
        allReturned = false;
        break;
      }
    }

    sale.returnedAmount = (sale.returnedAmount || 0) + totalRefund;
    sale.status = allReturned ? 'Returned' : 'Partially Returned';
    if (reason) {
      sale.returnReason = reason;
    }

    const updatedSale = await sale.save();
    res.json(updatedSale);
  } catch (error) {
    res.status(500).json({ message: 'Server error processing return', error: error.message });
  }
});

// @route   POST /api/sales/:id/cancel
// @desc    Cancel a fresh sale invoice (Admin protected)
// @access  Private
router.post('/:id/cancel', async (req, res) => {
  try {
    const { password, savedPassword } = req.body;
    const expectedPassword = savedPassword || process.env.ADMIN_DELETE_PASSWORD || 'admin123';
    
    if (password !== expectedPassword) {
      return res.status(401).json({ message: 'Incorrect Admin Password! Cancellation blocked.' });
    }

    const sale = await Sale.findById(req.params.id).populate('items');
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    if (sale.status === 'Cancelled') {
      return res.status(400).json({ message: 'Sale is already cancelled' });
    }

    // Restore stock for all non-returned items
    for (const item of sale.items) {
      const activeQty = item.quantity - (item.returnedQuantity || 0);
      if (activeQty > 0) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock = (product.stock || 0) + activeQty;
          await product.save();
        }
      }
    }

    sale.status = 'Cancelled';
    const updatedSale = await sale.save();
    res.json(updatedSale);
  } catch (error) {
    res.status(500).json({ message: 'Server error cancelling sale', error: error.message });
  }
});

module.exports = router;
