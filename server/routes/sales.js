const express = require('express');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Precision helper: round monetary values to 2 decimal places
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// All routes are protected
router.use(protect);

// @route   POST /api/sales
// @desc    Create a new sale with full customer billing and internal report tax partitioning
// @access  Private
router.post('/', async (req, res) => {
  const { items, customerMobile, customerName, paymentMethod, amountPaid, changeReturned } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items in the sale' });
  }

  // Detect transaction capability (Requires replica set / type !== 'Single')
  let session = null;
  let useTransaction = false;
  try {
    const client = mongoose.connection.getClient();
    const topologyType = client?.topology?.description?.type;
    if (topologyType && topologyType !== 'Single') {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    }
  } catch (err) {
    if (session) {
      session.endSession();
      session = null;
    }
    useTransaction = false;
  }

  try {
    const mongoose = require('mongoose');

    // Auto-Register customer in Database if mobile is provided and doesn't exist
    if (customerMobile && customerName) {
      const existingCustomer = await Customer.findOne({ mobile: customerMobile.trim() }).session(session);
      if (!existingCustomer) {
        await Customer.create([{
          name: customerName.trim(),
          mobile: customerMobile.trim(),
        }], { session });
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

    for (const item of items) {
      // Find product in transaction session
      const product = await Product.findById(item.productId).session(session);

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const totalQtyNeeded = Number(item.quantity);
      if (product.stock < totalQtyNeeded) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
      }

      // FIFO Allocation: allocate from gstStock first, then nonGstStock
      const currentGstStock = Math.max(0, product.gstStock || 0);
      const allocGst = Math.min(totalQtyNeeded, currentGstStock);
      const allocNonGst = totalQtyNeeded - allocGst;

      const newGstStock = Math.max(0, (product.gstStock || 0) - allocGst);
      const newNonGstStock = Math.max(0, (product.nonGstStock || 0) - allocNonGst);
      const newStock = newGstStock + newNonGstStock;

      // Atomic update matching the checked stock constraint to block concurrent overselling
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: totalQtyNeeded } },
        { 
          $set: { 
            gstStock: newGstStock, 
            nonGstStock: newNonGstStock, 
            stock: newStock 
          } 
        },
        { session, new: true }
      );

      if (!updatedProduct) {
        throw new Error(`Concurrency stock conflict or insufficient stock for ${product.name}`);
      }

      const itemGstRate = product.gstRate ?? 12;
      const itemSubtotal = round2(product.sellingPrice * totalQtyNeeded);
      
      // Full customer tax on 100% of items
      const fullItemTax = round2(itemSubtotal * (itemGstRate / 100));

      const itemGstSubtotal = round2(product.sellingPrice * allocGst);
      const itemNonGstSubtotal = round2(product.sellingPrice * allocNonGst);
      
      // Internal accounting breakdown
      const itemReportGstTax = round2(itemGstSubtotal * (itemGstRate / 100));
      const itemReportNonGstAmount = round2(itemNonGstSubtotal + round2(itemNonGstSubtotal * (itemGstRate / 100)));

      subtotal = round2(subtotal + itemSubtotal);
      gstSubtotal = round2(gstSubtotal + itemGstSubtotal);
      nonGstSubtotal = round2(nonGstSubtotal + itemNonGstSubtotal);
      totalTax = round2(totalTax + fullItemTax);
      reportGstTaxSum = round2(reportGstTaxSum + itemReportGstTax);
      reportNonGstAmountSum = round2(reportNonGstAmountSum + itemReportNonGstAmount);

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
        total: round2(itemSubtotal + fullItemTax),
      });
    }

    const cgstAmount = round2(totalTax / 2);
    const sgstAmount = round2(totalTax / 2);
    const grandTotal = round2(subtotal + totalTax);

    const saleData = {
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
    };

    // Create the sale with customer & payment metadata (Array syntax required for session creation)
    const sales = await Sale.create([saleData], { session });
    const sale = sales[0];

    // Create sale items and link to sale
    const createdItems = [];
    for (const itemData of saleItemsData) {
      const saleItems = await SaleItem.create([{
        ...itemData,
        sale: sale._id,
      }], { session });
      createdItems.push(saleItems[0]._id);
    }

    // Update sale with item references
    sale.items = createdItems;
    await sale.save({ session });

    if (useTransaction && session) {
      await session.commitTransaction();
    }
    if (session) {
      session.endSession();
    }

    // Return the complete sale with populated items
    const completeSale = await Sale.findById(sale._id).populate('items');
    res.status(201).json(completeSale);
  } catch (error) {
    if (useTransaction && session) {
      await session.abortTransaction();
    }
    if (session) {
      session.endSession();
    }
    res.status(400).json({ message: error.message });
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
      if (startDate) {
        const parts = startDate.split('-');
        filter.createdAt.$gte = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      if (endDate) {
        const parts = endDate.split('-');
        const end = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
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

        const unitTotal = round2(saleItem.total / saleItem.quantity);
        refundSum = round2(refundSum + round2(unitTotal * actualReturnQty));

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
      if (!item || !item.product) continue;
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
