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
// @desc    Create a new sale with full customer billing and internal report tax partitioning
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
    let gstSubtotal = 0;
    let nonGstSubtotal = 0;
    let totalTax = 0; // Full tax billed to customer
    let reportGstTaxSum = 0; // Tax for GST Tax Report (Supplier A portion)
    let reportNonGstAmountSum = 0; // Non-GST report amount (Supplier B portion)

    const saleItemsData = [];
    const productsToSave = [];

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

      // FIFO Allocation: allocate from gstStock first, then nonGstStock
      const totalQtyNeeded = Number(item.quantity);
      const currentGstStock = Math.max(0, product.gstStock || 0);

      const allocGst = Math.min(totalQtyNeeded, currentGstStock);
      const allocNonGst = totalQtyNeeded - allocGst;

      // Update product stocks
      product.gstStock = Math.max(0, (product.gstStock || 0) - allocGst);
      product.nonGstStock = Math.max(0, (product.nonGstStock || 0) - allocNonGst);
      product.stock = product.gstStock + product.nonGstStock;
      productsToSave.push(product);

      const itemGstRate = product.gstRate ?? 12;
      const itemSubtotal = product.sellingPrice * totalQtyNeeded;
      
      // Full customer tax on 100% of items (e.g. 15 items @ ₹10 = ₹150 + ₹18 GST = ₹168)
      const fullItemTax = itemSubtotal * (itemGstRate / 100);

      const itemGstSubtotal = product.sellingPrice * allocGst;
      const itemNonGstSubtotal = product.sellingPrice * allocNonGst;
      
      // Internal accounting breakdown
      const itemReportGstTax = itemGstSubtotal * (itemGstRate / 100);
      const itemReportNonGstAmount = itemNonGstSubtotal + (itemNonGstSubtotal * (itemGstRate / 100));

      subtotal += itemSubtotal;
      gstSubtotal += itemGstSubtotal;
      nonGstSubtotal += itemNonGstSubtotal;
      totalTax += fullItemTax;
      reportGstTaxSum += itemReportGstTax;
      reportNonGstAmountSum += itemReportNonGstAmount;

      saleItemsData.push({
        product: product._id,
        productName: product.name,
        variant: product.variant || '',
        barcode: product.barcode,
        quantity: totalQtyNeeded,
        gstQuantity: allocGst,
        nonGstQuantity: allocNonGst,
        price: product.sellingPrice,
        purchasePrice: product.purchasePrice || 0,
        gstRate: itemGstRate,
        taxAmount: fullItemTax,
        reportGstTax: itemReportGstTax,
        reportNonGstAmount: itemReportNonGstAmount,
        total: itemSubtotal + fullItemTax,
      });
    }

    // Save updated product stock levels
    for (const prod of productsToSave) {
      await prod.save();
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
      gstSubtotal,
      nonGstSubtotal,
      taxAmount: totalTax,
      cgstAmount,
      sgstAmount,
      grandTotal,
      reportGstTax: reportGstTaxSum,
      reportNonGstAmount: reportNonGstAmountSum,
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

    // Return the complete sale with populated items
    const completeSale = await Sale.findById(sale._id).populate('items');
    res.status(201).json(completeSale);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/sales
// @desc    Get all sales with pagination & search
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search, startDate, endDate, page = 1, limit = 15 } = req.query;
    let filter = {};

    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerMobile: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const total = await Sale.countDocuments(filter);
    const sales = await Sale.find(filter)
      .populate('items')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const pages = Math.ceil(total / limitNum) || 1;

    res.json({ sales, total, pages, page: pageNum });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/sales/:id
// @desc    Get single sale details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('items');
    if (!sale) {
      return res.status(404).json({ message: 'Sale invoice not found' });
    }
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/sales/:id/return
// @desc    Process partial or full sale return
// @access  Private
router.post('/:id/return', async (req, res) => {
  try {
    const { items, itemsToReturn, reason } = req.body;
    const targetItems = items || itemsToReturn || [];

    const sale = await Sale.findById(req.params.id).populate('items');

    if (!sale) {
      return res.status(404).json({ message: 'Sale invoice not found' });
    }

    if (sale.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot return items from a cancelled invoice' });
    }

    let refundSum = 0;

    for (const ret of targetItems) {
      const saleItem = await SaleItem.findById(ret.saleItemId);
      if (!saleItem) continue;

      const returnQty = Number(ret.returnedQty !== undefined ? ret.returnedQty : (ret.quantity || 0));
      if (returnQty <= 0) continue;

      const remainingQty = saleItem.quantity - (saleItem.returnedQuantity || 0);
      const actualReturnQty = Math.min(returnQty, remainingQty);

      if (actualReturnQty > 0) {
        saleItem.returnedQuantity = (saleItem.returnedQuantity || 0) + actualReturnQty;
        await saleItem.save();

        const unitTotal = saleItem.total / saleItem.quantity;
        refundSum += unitTotal * actualReturnQty;

        // Restore stock to product (restore to gstStock first if gstQuantity existed, remainder to nonGstStock)
        const product = await Product.findById(saleItem.product);
        if (product) {
          const originalGstQty = saleItem.gstQuantity || 0;
          const prevReturned = (saleItem.returnedQuantity || 0) - actualReturnQty;
          const remainingGstQty = Math.max(0, originalGstQty - prevReturned);

          const gstQtyToRestore = Math.min(actualReturnQty, remainingGstQty);
          const nonGstQtyToRestore = actualReturnQty - gstQtyToRestore;

          product.gstStock = (product.gstStock || 0) + gstQtyToRestore;
          product.nonGstStock = (product.nonGstStock || 0) + nonGstQtyToRestore;
          product.stock = product.gstStock + product.nonGstStock;
          await product.save();
        }
      }
    }

    sale.returnedAmount = (sale.returnedAmount || 0) + refundSum;
    sale.returnReason = reason || sale.returnReason || 'Customer Return';

    // Check if fully returned
    const allItems = await SaleItem.find({ sale: sale._id });
    const isFullyReturned = allItems.every(i => i.returnedQuantity >= i.quantity);

    sale.status = isFullyReturned ? 'Returned' : 'Partially Returned';
    await sale.save();

    const updatedSale = await Sale.findById(sale._id).populate('items');
    res.json(updatedSale);
  } catch (error) {
    res.status(500).json({ message: 'Server error processing return', error: error.message });
  }
});

// @route   POST /api/sales/:id/cancel
// @desc    Cancel sale invoice with Admin authorization
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
      return res.status(404).json({ message: 'Sale invoice not found' });
    }

    if (sale.status === 'Cancelled') {
      return res.status(400).json({ message: 'Invoice is already cancelled' });
    }

    // Restore stock for all items
    for (const item of sale.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const netQtyToRestore = item.quantity - (item.returnedQuantity || 0);
        const gstQtyToRestore = Math.min(netQtyToRestore, item.gstQuantity || 0);
        const nonGstQtyToRestore = netQtyToRestore - gstQtyToRestore;

        product.gstStock = (product.gstStock || 0) + gstQtyToRestore;
        product.nonGstStock = (product.nonGstStock || 0) + nonGstQtyToRestore;
        product.stock = product.gstStock + product.nonGstStock;
        await product.save();
      }
    }

    sale.status = 'Cancelled';
    await sale.save();

    res.json({ message: 'Invoice cancelled successfully', sale });
  } catch (error) {
    res.status(500).json({ message: 'Server error cancelling sale', error: error.message });
  }
});

module.exports = router;
