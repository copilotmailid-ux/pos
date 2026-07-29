const express = require('express');
const { get, all } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Helper to get populated sales in the same format as MongoDB (Optimized to avoid N+1 queries)
const getPopulatedSales = async (conditions, params) => {
  let sql = `SELECT * FROM sales`;
  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }
  sql += ` ORDER BY id ASC`;
  const sales = await all(sql, params);
  if (sales.length === 0) return [];

  const saleIds = sales.map(s => s.id);
  const itemsMap = new Map();
  const batchSize = 500;

  for (let i = 0; i < saleIds.length; i += batchSize) {
    const batchIds = saleIds.slice(i, i + batchSize);
    const placeholders = batchIds.map(() => '?').join(',');
    const items = await all(`SELECT * FROM sale_items WHERE saleId IN (${placeholders})`, batchIds);
    for (const item of items) {
      if (!itemsMap.has(item.saleId)) {
        itemsMap.set(item.saleId, []);
      }
      itemsMap.get(item.saleId).push({
        ...item,
        _id: item.id,
        product: {
          _id: item.productId,
          id: item.productId,
          name: item.productName,
          variant: item.variant,
          barcode: item.barcode
        }
      });
    }
  }

  for (const sale of sales) {
    sale._id = sale.id;
    sale.items = itemsMap.get(sale.id) || [];
  }
  return sales;
};

// Helper to get populated purchases in the same format as MongoDB
const getPopulatedPurchases = async (conditions, params) => {
  let sql = `
    SELECT 
      p.*,
      s.name as supplierName, s.phone as supplierPhone, s.contactPerson as supplierContact, s.supplierType as supplierType, s.gstin as supplierGstin
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplierId = s.id
  `;
  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }
  sql += ` ORDER BY p.id ASC`;
  const rows = await all(sql, params);
  return rows.map(row => ({
    _id: row.id,
    id: row.id,
    purchaseNumber: row.purchaseNumber,
    purchaseTaxType: row.purchaseTaxType,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    paymentMethod: row.paymentMethod,
    status: row.status,
    notes: row.notes,
    invoiceDate: row.invoiceDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    supplier: {
      _id: row.supplierId,
      id: row.supplierId,
      name: row.supplierName || 'Unknown Supplier',
      phone: row.supplierPhone || '',
      contactPerson: row.supplierContact || '',
      supplierType: row.supplierType || 'GST',
      gstin: row.supplierGstin || ''
    }
  }));
};

const addDateConditions = (conditions, params, startDate, endDate, dateField) => {
  if (startDate) {
    conditions.push(`${dateField} >= ?`);
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    conditions.push(`${dateField} <= ?`);
    params.push(`${endDate} 23:59:59`);
  }
};

// 1. Sales Report Endpoint (All Sales)
router.get('/sales', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const conditions = [`status != 'Cancelled'`];
    const params = [];
    addDateConditions(conditions, params, startDate, endDate, 'createdAt');

    const sales = await getPopulatedSales(conditions, params);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales report data', error: error.message });
  }
});

// 2. Purchase Report Endpoint
router.get('/purchases', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const conditions = [];
    const params = [];
    addDateConditions(conditions, params, startDate, endDate, 'invoiceDate');

    const purchases = await getPopulatedPurchases(conditions, params);
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchase report data', error: error.message });
  }
});

// 3. GST Report Endpoint (Lists ONLY GST-allocated stock sales & GST purchases)
router.get('/gst', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const salesConditions = [`status != 'Cancelled'`];
    const salesParams = [];
    addDateConditions(salesConditions, salesParams, startDate, endDate, 'createdAt');

    const purchasesConditions = [`status != 'Returned'`];
    const purchasesParams = [];
    addDateConditions(purchasesConditions, purchasesParams, startDate, endDate, 'invoiceDate');

    const sales = await getPopulatedSales(salesConditions, salesParams);
    const purchases = await getPopulatedPurchases(purchasesConditions, purchasesParams);

    // Itemized GST sales: filter for items where gstQuantity > 0
    const gstSaleLines = [];
    for (const sale of sales) {
      if (!sale || !sale.items) continue;
      for (const item of sale.items) {
        if (!item) continue;
        const effectiveGstQty = Math.max(0, (item.gstQuantity !== undefined ? item.gstQuantity : item.quantity) - (item.returnedQuantity || 0));
        if (effectiveGstQty > 0) {
          const itemSubtotal = round2(item.price * effectiveGstQty);
          const rate = item.gstRate !== undefined ? Number(item.gstRate) : 12;
          const itemTax = round2(itemSubtotal * (rate / 100));
          gstSaleLines.push({
            invoiceNo: sale.invoiceNo,
            date: sale.createdAt,
            customerName: sale.customerName || 'Walk-in',
            productName: item.productName || 'Unknown Product',
            variant: item.variant || '',
            gstQuantity: effectiveGstQty,
            price: item.price || 0,
            gstRate: rate,
            subtotal: itemSubtotal,
            taxAmount: itemTax,
            total: round2(itemSubtotal + itemTax),
          });
        }
      }
    }

    res.json({ sales, purchases, gstSaleLines });
  } catch (error) {
    res.status(500).json({ message: 'Error compiling GST report data', error: error.message });
  }
});

// 3.5. GST Tax Rate & Type Summary Endpoint
router.get('/gst-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const conditions = [`status != 'Cancelled'`];
    const params = [];
    addDateConditions(conditions, params, startDate, endDate, 'createdAt');

    const sales = await getPopulatedSales(conditions, params);

    const defaultSlabs = [0, 5, 12, 18, 28];
    const slabs = {};
    defaultSlabs.forEach(rate => {
      slabs[rate] = { taxableSales: 0, gstAmount: 0 };
    });

    let totalTaxable = 0;
    let totalGst = 0;

    for (const sale of sales) {
      if (!sale || !sale.items) continue;
      for (const item of sale.items) {
        if (!item) continue;
        // Only count GST stock (Supplier A) — same logic as /gst report
        const effectiveGstQty = Math.max(0, (item.gstQuantity !== undefined ? item.gstQuantity : item.quantity) - (item.returnedQuantity || 0));
        if (effectiveGstQty <= 0) continue;

        const rate = item.gstRate !== undefined ? Number(item.gstRate) : 12;
        const lineTaxable = (item.price || 0) * effectiveGstQty;
        const lineGst = lineTaxable * (rate / 100);

        if (!slabs[rate]) {
          slabs[rate] = { taxableSales: 0, gstAmount: 0 };
        }

        slabs[rate].taxableSales += lineTaxable;
        slabs[rate].gstAmount += lineGst;

        totalTaxable += lineTaxable;
        totalGst += lineGst;
      }
    }

    const slabBreakdown = Object.keys(slabs)
      .map(r => Number(r))
      .sort((a, b) => a - b)
      .map(r => ({
        gstRate: `${r}%`,
        taxableSales: round2(slabs[r].taxableSales),
        gstAmount: round2(slabs[r].gstAmount)
      }));

    const cgst = round2(totalGst / 2);
    const sgst = round2(totalGst / 2);
    const igst = 0;

    const typeSummary = [
      { gstType: 'CGST', amount: cgst },
      { gstType: 'SGST', amount: sgst },
      { gstType: 'IGST', amount: igst },
    ];

    res.json({
      slabBreakdown,
      typeSummary,
      totals: {
        totalTaxable: round2(totalTaxable),
        totalGst: round2(totalGst),
        cgst,
        sgst,
        igst
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error compiling GST summary report data', error: error.message });
  }
});

// 4. Non-GST Sales Report Endpoint (Lists ONLY units sold from Supplier B / Non-GST stock, including collected tax balance)
router.get('/non-gst', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const conditions = [`status != 'Cancelled'`];
    const params = [];
    addDateConditions(conditions, params, startDate, endDate, 'createdAt');

    const sales = await getPopulatedSales(conditions, params);

    const nonGstLines = [];
    for (const sale of sales) {
      if (!sale || !sale.items) continue;
      for (const item of sale.items) {
        if (!item) continue;
        const returnedNonGstQty = Math.max(0, (item.returnedQuantity || 0) - (item.gstQuantity || 0));
        const effectiveNonGstQty = Math.max(0, (item.nonGstQuantity || 0) - returnedNonGstQty);

        if (effectiveNonGstQty > 0) {
          const itemSubtotal = round2(item.price * effectiveNonGstQty);
          const rate = item.gstRate !== undefined ? Number(item.gstRate) : 12;
          const collectedTax = round2(itemSubtotal * (rate / 100));
          const itemTotal = round2(itemSubtotal + collectedTax);

          nonGstLines.push({
            invoiceNo: sale.invoiceNo,
            date: sale.createdAt,
            customerName: sale.customerName || 'Walk-in',
            productName: item.productName || 'Unknown Product',
            variant: item.variant || '',
            nonGstQuantity: effectiveNonGstQty,
            price: item.price || 0,
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
    const products = await all(`SELECT id as _id, * FROM products ORDER BY name ASC`);
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

    const supplier = await get(`SELECT * FROM suppliers WHERE id = ?`, [supplierId]);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const conditions = [`supplierId = ?`];
    const params = [supplierId];
    addDateConditions(conditions, params, startDate, endDate, 'invoiceDate');

    const transactions = await getPopulatedPurchases(conditions, params);
    
    res.json({ supplier: { ...supplier, _id: supplier.id }, transactions });
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

    const customer = await get(`SELECT * FROM customers WHERE mobile = ?`, [mobile.trim()]);
    
    const conditions = [`customerMobile = ?`];
    const params = [mobile.trim()];
    addDateConditions(conditions, params, startDate, endDate, 'createdAt');

    let sql = `SELECT * FROM sales WHERE customerMobile = ?`;
    const salesParams = [mobile.trim()];
    if (startDate || endDate) {
      const datesConditions = [];
      addDateConditions(datesConditions, salesParams, startDate, endDate, 'createdAt');
      sql += ` AND ` + datesConditions.join(` AND `);
    }
    sql += ` ORDER BY id ASC`;

    const transactions = await all(sql, salesParams);
    const formattedTransactions = transactions.map(t => ({ ...t, _id: t.id }));

    res.json({ 
      customer: customer ? { ...customer, _id: customer.id } : { name: 'Walk-in Customer', mobile }, 
      transactions: formattedTransactions
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading customer ledger', error: error.message });
  }
});

module.exports = router;
