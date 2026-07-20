const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');

router.use(protect);

// Helper to construct date filters
const buildDateFilter = (startDate, endDate, dateField = 'createdAt') => {
  let filter = {};
  if (startDate || endDate) {
    filter[dateField] = {};
    if (startDate) {
      filter[dateField].$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter[dateField].$lte = end;
    }
  }
  return filter;
};

// 1. Sales Report Endpoint (All Sales)
router.get('/sales', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate, 'createdAt');
    const filter = { ...dateFilter, status: { $ne: 'Cancelled' } };

    const sales = await Sale.find(filter).sort({ createdAt: 1 }).populate('items');
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales report data', error: error.message });
  }
});

// 2. Purchase Report Endpoint
router.get('/purchases', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate, 'invoiceDate');
    const filter = { ...dateFilter };

    const purchases = await Purchase.find(filter).populate('supplier', 'name gstin supplierType').sort({ invoiceDate: 1 });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchase report data', error: error.message });
  }
});

// 3. GST Report Endpoint (Lists ONLY GST-allocated stock sales & GST purchases)
router.get('/gst', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const salesFilter = { ...buildDateFilter(startDate, endDate, 'createdAt'), status: { $ne: 'Cancelled' } };
    const purchasesFilter = { ...buildDateFilter(startDate, endDate, 'invoiceDate'), status: { $ne: 'Returned' } };

    const sales = await Sale.find(salesFilter).populate('items');
    const purchases = await Purchase.find(purchasesFilter).populate('supplier');

    // Itemized GST sales: filter for items where gstQuantity > 0
    const gstSaleLines = [];
    for (const sale of sales) {
      for (const item of sale.items) {
        const effectiveGstQty = Math.max(0, (item.gstQuantity !== undefined ? item.gstQuantity : item.quantity) - (item.returnedQuantity || 0));
        if (effectiveGstQty > 0) {
          const itemSubtotal = item.price * effectiveGstQty;
          const itemTax = itemSubtotal * ((item.gstRate || 12) / 100);
          gstSaleLines.push({
            invoiceNo: sale.invoiceNo,
            date: sale.createdAt,
            customerName: sale.customerName || 'Walk-in',
            productName: item.productName,
            variant: item.variant || '',
            gstQuantity: effectiveGstQty,
            price: item.price,
            gstRate: item.gstRate || 12,
            subtotal: itemSubtotal,
            taxAmount: itemTax,
            total: itemSubtotal + itemTax,
          });
        }
      }
    }

    res.json({ sales, purchases, gstSaleLines });
  } catch (error) {
    res.status(500).json({ message: 'Error compiling GST report data', error: error.message });
  }
});

// 4. Non-GST Sales Report Endpoint (Lists ONLY units sold from Supplier B / Non-GST stock, including collected tax balance)
router.get('/non-gst', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate, 'createdAt');
    const filter = { ...dateFilter, status: { $ne: 'Cancelled' } };

    const sales = await Sale.find(filter).populate('items');

    const nonGstLines = [];
    for (const sale of sales) {
      for (const item of sale.items) {
        const returnedNonGstQty = Math.max(0, (item.returnedQuantity || 0) - (item.gstQuantity || 0));
        const effectiveNonGstQty = Math.max(0, (item.nonGstQuantity || 0) - returnedNonGstQty);

        if (effectiveNonGstQty > 0) {
          const itemSubtotal = item.price * effectiveNonGstQty;
          const collectedTax = itemSubtotal * ((item.gstRate || 12) / 100);
          const itemTotal = itemSubtotal + collectedTax;

          nonGstLines.push({
            invoiceNo: sale.invoiceNo,
            date: sale.createdAt,
            customerName: sale.customerName || 'Walk-in',
            productName: item.productName,
            variant: item.variant || '',
            nonGstQuantity: effectiveNonGstQty,
            price: item.price,
            subtotal: itemSubtotal,
            collectedTax: collectedTax,
            total: itemTotal,
          });
        }
      }
    }

    res.json(nonGstLines);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Non-GST sales report data', error: error.message });
  }
});

// 5. Stock Valuation Report Endpoint (shows breakdown of GST Stock vs Non-GST Stock)
router.get('/stock', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ name: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error generating stock report data', error: error.message });
  }
});

// 6. Supplier Ledger Endpoint
router.get('/supplier-ledger', async (req, res) => {
  try {
    const { supplierId, startDate, endDate } = req.query;
    if (!supplierId) {
      return res.status(400).json({ message: 'Supplier ID is required' });
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const dateFilter = buildDateFilter(startDate, endDate, 'invoiceDate');
    const filter = { ...dateFilter, supplier: supplierId };

    const transactions = await Purchase.find(filter).sort({ invoiceDate: 1 });
    res.json({ supplier, transactions });
  } catch (error) {
    res.status(500).json({ message: 'Error loading supplier ledger', error: error.message });
  }
});

// 7. Customer Ledger Endpoint
router.get('/customer-ledger', async (req, res) => {
  try {
    const { mobile, startDate, endDate } = req.query;
    if (!mobile) {
      return res.status(400).json({ message: 'Customer mobile is required' });
    }

    const customer = await Customer.findOne({ mobile: mobile.trim() });
    const dateFilter = buildDateFilter(startDate, endDate, 'createdAt');
    const filter = { ...dateFilter, customerMobile: mobile.trim() };

    const transactions = await Sale.find(filter).sort({ createdAt: 1 });
    res.json({ 
      customer: customer || { name: 'Walk-in Customer', mobile }, 
      transactions 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading customer ledger', error: error.message });
  }
});

module.exports = router;
