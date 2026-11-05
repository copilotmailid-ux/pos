const express = require('express');
const { get, all } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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

// @route   GET /api/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get('/', async (req, res) => {
  try {
    // Support picking an arbitrary local date (format: YYYY-MM-DD)
    const selectedDate = req.query.date; // e.g. '2026-08-03'
    let startDate, endDate;
    
    if (selectedDate) {
      const parts = selectedDate.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      
      const localStart = new Date(y, m, d, 0, 0, 0, 0);
      startDate = localStart.toISOString();
      
      const localEnd = new Date(y, m, d + 1, 0, 0, 0, 0);
      endDate = localEnd.toISOString();
    } else {
      // Default to today's local boundaries
      const localStart = new Date();
      localStart.setHours(0, 0, 0, 0);
      startDate = localStart.toISOString();
      
      const localEnd = new Date();
      localEnd.setHours(24, 0, 0, 0);
      endDate = localEnd.toISOString();
    }

    // 1. Total products count
    const productsCountRow = await get(`SELECT COUNT(*) as count FROM products`);
    const totalProducts = productsCountRow?.count || 0;

    // 2. Total stock (sum of all product stock)
    const stockRow = await get(`SELECT SUM(stock) as total FROM products`);
    const totalStock = stockRow?.total || 0;

    // 3. Today's sales count and total sum
    const todaySalesRow = await get(`
      SELECT 
        COALESCE(SUM(grandTotal), 0) as totalSales,
        COALESCE(SUM(returnedAmount), 0) as totalRefunded,
        COUNT(*) as count
      FROM sales
      WHERE createdAt >= ? AND createdAt < ? AND status != 'Cancelled'
    `, [startDate, endDate]);

    const rawSales = todaySalesRow?.totalSales || 0;
    const rawRefunds = todaySalesRow?.totalRefunded || 0;
    const todaySales = Math.max(0, rawSales - rawRefunds);
    const todaySalesCount = todaySalesRow?.count || 0;

    // 4. Low stock products count (stock < 10)
    const lowStockCountRow = await get(`SELECT COUNT(*) as count FROM products WHERE stock < 10`);
    const lowStockCount = lowStockCountRow?.count || 0;

    // 5. Today's profit calculation (Includes pre-tax product margins + collected Non-GST tax pocketed by the store)
    const todaySalesItems = await all(`
      SELECT 
        si.*
      FROM sale_items si
      JOIN sales s ON si.saleId = s.id
      WHERE s.createdAt >= ? AND s.createdAt < ? AND s.status != 'Cancelled'
    `, [startDate, endDate]);

    let todayProfit = 0;
    let todayNonGstTaxProfit = 0;
    for (const item of todaySalesItems) {
      const qty = item.quantity || 0;
      const returnedQty = item.returnedQuantity || 0;
      const netQty = Math.max(0, qty - returnedQty);
      
      // Basic pre-tax margin profit (round at each step to avoid float drift)
      const baseProfit = round2(((item.price || 0) - (item.purchasePrice || 0)) * netQty);
      
      // Calculate collected Non-GST tax (extra profit retained by the store)
      const nonGstQty = item.nonGstQuantity || 0;
      const returnedNonGstQty = Math.max(0, returnedQty - (item.gstQuantity || 0));
      const effectiveNonGstQty = Math.max(0, nonGstQty - returnedNonGstQty);
      
      const nonGstSubtotal = round2((item.price || 0) * effectiveNonGstQty);
      const rate = item.gstRate !== undefined ? Number(item.gstRate) : 12;
      const collectedNonGstTax = round2(nonGstSubtotal * (rate / 100));
      
      todayProfit = round2(todayProfit + baseProfit);
      todayNonGstTaxProfit = round2(todayNonGstTaxProfit + collectedNonGstTax);
    }

    // Pagination parameters
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 15);
    const offset = (page - 1) * limit;

    // Get total count of completed transactions for this day
    const salesCountRow = await get(`
      SELECT COUNT(*) as count FROM sales 
      WHERE status != 'Cancelled' AND createdAt >= ? AND createdAt < ?
    `, [startDate, endDate]);
    const totalSalesOnDay = salesCountRow?.count || 0;
    const totalPagesOnDay = Math.ceil(totalSalesOnDay / limit);

    // Get paged transaction rows
    const recentSalesRows = await all(`
      SELECT id FROM sales 
      WHERE status != 'Cancelled' AND createdAt >= ? AND createdAt < ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `, [startDate, endDate, limit, offset]);

    const recentSales = [];
    for (const row of recentSalesRows) {
      const populated = await getCompleteSale(row.id);
      recentSales.push(populated);
    }

    // 6. Pending quotations count
    const pendingQtnRow = await get(`SELECT COUNT(*) as count FROM quotations WHERE status = 'Draft'`);
    const pendingQuotationsCount = pendingQtnRow?.count || 0;

    res.json({
      totalProducts,
      totalStock,
      todaySales,
      todaySalesCount,
      todayProfit,
      todayNonGstTaxProfit,
      lowStockCount,
      pendingQuotationsCount,
      recentSales,
      page,
      totalPages: totalPagesOnDay,
      totalSales: totalSalesOnDay
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
