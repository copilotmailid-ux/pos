const express = require('express');
const { get, all, run, transaction } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

let invoiceCount = 0;

// Helper to retrieve a complete sale populated with items in the MongoDB style
const getCompleteSale = async (saleId) => {
  const sale = await get(`SELECT * FROM sales WHERE id = ?`, [saleId]);
  if (!sale) return null;

  const items = await all(`SELECT * FROM sale_items WHERE saleId = ?`, [saleId]);

  return {
    ...sale,
    _id: sale.id,
    items: items.map(item => ({
      ...item,
      _id: item.id,
      product: {
        _id: item.productId,
        id: item.productId,
        name: item.productName,
        variant: item.variant,
        barcode: item.barcode
      }
    }))
  };
};

// @route   POST /api/sales
// @desc    Create a new sale with full customer billing and internal report tax partitioning
// @access  Private
router.post('/', async (req, res) => {
  const { items, customerMobile, customerName, paymentMethod, amountPaid, changeReturned } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items in the sale' });
  }

  try {
    const processedSale = await transaction(async () => {
      // 1. Auto-Register customer in Database if mobile is provided and doesn't exist
      if (customerMobile && customerName) {
        const existingCustomer = await get(`SELECT id FROM customers WHERE mobile = ?`, [customerMobile.trim()]);
        if (!existingCustomer) {
          await run(
            `INSERT INTO customers (name, mobile) VALUES (?, ?)`,
            [customerName.trim(), customerMobile.trim()]
          );
        }
      }

      // 2. Generate unique sequential invoice ID from counters table
      const counterRow = await get(`SELECT seq FROM counters WHERE id = 'invoiceNo'`);
      const newSeq = (counterRow?.seq || 0) + 1;
      await run(`UPDATE counters SET seq = ? WHERE id = 'invoiceNo'`, [newSeq]);
      const invoiceNo = `INV-${String(newSeq).padStart(5, '0')}`;

      // Calculate totals
      let subtotal = 0;
      let gstSubtotal = 0;
      let nonGstSubtotal = 0;
      let totalTax = 0;
      let reportGstTaxSum = 0;
      let reportNonGstAmountSum = 0;

      const saleItemsData = [];

      for (const item of items) {
        const prodId = item.productId._id || item.productId;
        const product = await get(`SELECT * FROM products WHERE id = ?`, [prodId]);
        if (!product) {
          throw new Error(`Product not found: ${prodId}`);
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

        // Perform stock update
        await run(
          `UPDATE products SET gstStock = ?, nonGstStock = ?, stock = ? WHERE id = ?`,
          [newGstStock, newNonGstStock, newStock, product.id]
        );

        const itemGstRate = product.gstRate ?? 12;
        const itemSubtotal = round2(product.sellingPrice * totalQtyNeeded);
        const fullItemTax = round2(itemSubtotal * (itemGstRate / 100));

        const itemGstSubtotal = round2(product.sellingPrice * allocGst);
        const itemNonGstSubtotal = round2(product.sellingPrice * allocNonGst);
        
        const itemReportGstTax = round2(itemGstSubtotal * (itemGstRate / 100));
        const itemReportNonGstAmount = round2(itemNonGstSubtotal + round2(itemNonGstSubtotal * (itemGstRate / 100)));

        subtotal = round2(subtotal + itemSubtotal);
        gstSubtotal = round2(gstSubtotal + itemGstSubtotal);
        nonGstSubtotal = round2(nonGstSubtotal + itemNonGstSubtotal);
        totalTax = round2(totalTax + fullItemTax);
        reportGstTaxSum = round2(reportGstTaxSum + itemReportGstTax);
        reportNonGstAmountSum = round2(reportNonGstAmountSum + itemReportNonGstAmount);

        saleItemsData.push({
          productId: product.id,
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
      const sgstAmount = round2(totalTax - cgstAmount);
      const grandTotal = round2(subtotal + totalTax);

      const finalAmountPaid = amountPaid !== undefined ? Number(amountPaid) : grandTotal;
      const finalChangeReturned = changeReturned !== undefined ? Number(changeReturned) : 0;

      // Insert sale (Explicitly insert timezone-aware ISO string for createdAt and updatedAt)
      const nowStr = new Date().toISOString();
      const { id: saleId } = await run(
        `INSERT INTO sales (invoiceNo, customerMobile, customerName, paymentMethod, amountPaid, changeReturned, subtotal, gstSubtotal, nonGstSubtotal, taxAmount, cgstAmount, sgstAmount, grandTotal, reportGstTax, reportNonGstAmount, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoiceNo, customerMobile || '', customerName || '', paymentMethod || 'Cash Tendered', finalAmountPaid, finalChangeReturned, subtotal, gstSubtotal, nonGstSubtotal, totalTax, cgstAmount, sgstAmount, grandTotal, reportGstTaxSum, reportNonGstAmountSum, 'Completed', nowStr, nowStr]
      );

      // Insert sale items
      for (const si of saleItemsData) {
        await run(
          `INSERT INTO sale_items (saleId, productId, productName, variant, barcode, quantity, gstQuantity, nonGstQuantity, price, purchasePrice, total, gstRate, taxAmount, reportGstTax, reportNonGstAmount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [saleId, si.productId, si.productName, si.variant, si.barcode, si.quantity, si.gstQuantity, si.nonGstQuantity, si.price, si.purchasePrice, si.total, si.gstRate, si.taxAmount, si.reportGstTax, si.reportNonGstAmount]
        );
      }

      return saleId;
    });

    const completeSale = await getCompleteSale(processedSale);
    res.status(201).json(completeSale);

    // Auto-checkpoint WAL log every 5 invoices
    invoiceCount++;
    if (invoiceCount % 5 === 0) {
      console.log(`Every 5 invoices reached (${invoiceCount}). Running automatic WAL checkpoint (merging log)...`);
      run('PRAGMA wal_checkpoint(TRUNCATE)')
        .then(() => console.log('Automatic WAL Checkpoint complete.'))
        .catch(err => console.error('Automatic WAL Checkpoint failed:', err.message));
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/sales
// @desc    Get all sales with pagination & search
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search, startDate, endDate, page = 1, limit = 15 } = req.query;
    let sql = `SELECT * FROM sales`;
    let countSql = `SELECT COUNT(*) as count FROM sales`;
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push(`(invoiceNo LIKE ? OR customerName LIKE ? OR customerMobile LIKE ?)`);
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (startDate || endDate) {
      if (startDate) {
        conditions.push(`createdAt >= ?`);
        params.push(`${startDate} 00:00:00`);
      }
      if (endDate) {
        conditions.push(`createdAt <= ?`);
        params.push(`${endDate} 23:59:59`);
      }
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ` + conditions.join(` AND `);
      sql += whereClause;
      countSql += whereClause;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const totalRow = await get(countSql, params);
    const total = totalRow.count;

    const querySql = sql + ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    const queryParams = [...params, limitNum, skip];

    const salesRows = await all(querySql, queryParams);
    const sales = [];
    for (const row of salesRows) {
      const populated = await getCompleteSale(row.id);
      sales.push(populated);
    }

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
    const sale = await getCompleteSale(req.params.id);
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

    const sale = await get(`SELECT * FROM sales WHERE id = ?`, [req.params.id]);
    if (!sale) {
      return res.status(404).json({ message: 'Sale invoice not found' });
    }

    if (sale.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot return items from a cancelled invoice' });
    }

    await transaction(async () => {
      let refundSum = 0;

      for (const ret of targetItems) {
        const itemId = ret.saleItemId || ret.id;
        const saleItem = await get(`SELECT * FROM sale_items WHERE id = ?`, [itemId]);
        if (!saleItem) continue;

        const returnQty = Number(ret.returnedQty !== undefined ? ret.returnedQty : (ret.quantity || 0));
        if (returnQty <= 0) continue;

        const remainingQty = saleItem.quantity - (saleItem.returnedQuantity || 0);
        const actualReturnQty = Math.min(returnQty, remainingQty);

        if (actualReturnQty > 0) {
          const newReturnedQuantity = (saleItem.returnedQuantity || 0) + actualReturnQty;
          await run(`UPDATE sale_items SET returnedQuantity = ? WHERE id = ?`, [newReturnedQuantity, saleItem.id]);

          const unitTotal = round2(saleItem.total / saleItem.quantity);
          refundSum = round2(refundSum + round2(unitTotal * actualReturnQty));

          // Restore stock to product (restore to gstStock first if gstQuantity existed, remainder to nonGstStock)
          if (saleItem.productId) {
            const product = await get(`SELECT * FROM products WHERE id = ?`, [saleItem.productId]);
            if (product) {
              const originalGstQty = saleItem.gstQuantity || 0;
              const prevReturned = saleItem.returnedQuantity || 0;
              const remainingGstQty = Math.max(0, originalGstQty - prevReturned);

              const gstQtyToRestore = Math.min(actualReturnQty, remainingGstQty);
              const nonGstQtyToRestore = actualReturnQty - gstQtyToRestore;

              const newGstStock = (product.gstStock || 0) + gstQtyToRestore;
              const newNonGstStock = (product.nonGstStock || 0) + nonGstQtyToRestore;
              const newStock = newGstStock + newNonGstStock;

              await run(
                `UPDATE products SET gstStock = ?, nonGstStock = ?, stock = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
                [newGstStock, newNonGstStock, newStock, product.id]
              );
            }
          }
        }
      }

      const newReturnedAmount = (sale.returnedAmount || 0) + refundSum;
      const finalReason = reason || sale.returnReason || 'Customer Return';

      // Check if fully returned
      const allItems = await all(`SELECT quantity, returnedQuantity FROM sale_items WHERE saleId = ?`, [sale.id]);
      const isFullyReturned = allItems.every(i => i.returnedQuantity >= i.quantity);
      const newStatus = isFullyReturned ? 'Returned' : 'Partially Returned';

      await run(
        `UPDATE sales SET returnedAmount = ?, returnReason = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        [newReturnedAmount, finalReason, newStatus, sale.id]
      );
    });

    const updatedSale = await getCompleteSale(sale.id);
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

    const sale = await get(`SELECT * FROM sales WHERE id = ?`, [req.params.id]);
    if (!sale) {
      return res.status(404).json({ message: 'Sale invoice not found' });
    }

    if (sale.status === 'Cancelled') {
      return res.status(400).json({ message: 'Invoice is already cancelled' });
    }

    const items = await all(`SELECT * FROM sale_items WHERE saleId = ?`, [sale.id]);

    await transaction(async () => {
      // Restore stock for all items
      for (const item of items) {
        if (item.productId) {
          const product = await get(`SELECT * FROM products WHERE id = ?`, [item.productId]);
          if (product) {
            const netQtyToRestore = item.quantity - (item.returnedQuantity || 0);
            const gstQtyToRestore = Math.min(netQtyToRestore, item.gstQuantity || 0);
            const nonGstQtyToRestore = netQtyToRestore - gstQtyToRestore;

            const newGstStock = (product.gstStock || 0) + gstQtyToRestore;
            const newNonGstStock = (product.nonGstStock || 0) + nonGstQtyToRestore;
            const newStock = newGstStock + newNonGstStock;

            await run(
              `UPDATE products SET gstStock = ?, nonGstStock = ?, stock = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
              [newGstStock, newNonGstStock, newStock, product.id]
            );
          }
        }
      }

      await run(`UPDATE sales SET status = 'Cancelled', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [sale.id]);
    });

    const updated = await getCompleteSale(sale.id);
    res.json({ message: 'Invoice cancelled successfully', sale: updated });
  } catch (error) {
    res.status(500).json({ message: 'Server error cancelling sale', error: error.message });
  }
});

// @route   POST /api/sales/backup
// @desc    Trigger an on-demand database compaction backup
// @access  Private
router.post('/backup', async (req, res) => {
  try {
    const { backupDatabase } = require('../config/db');
    const backupFile = await backupDatabase();
    res.json({ message: 'Backup created successfully', path: backupFile });
  } catch (error) {
    res.status(500).json({ message: 'Backup execution error', error: error.message });
  }
});

module.exports = router;
