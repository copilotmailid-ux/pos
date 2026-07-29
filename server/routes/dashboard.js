const express = require('express');
const { get, all } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

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
    // Helper to get today's date boundaries in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = today.toISOString().split('T')[0] + ' 00:00:00';
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endDate = tomorrow.toISOString().split('T')[0] + ' 00:00:00';

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

    // 5. Today's profit calculation
    const profitRow = await get(`
      SELECT 
        COALESCE(SUM((si.price - si.purchasePrice) * (si.quantity - si.returnedQuantity)), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.saleId = s.id
      WHERE s.createdAt >= ? AND s.createdAt < ? AND s.status != 'Cancelled'
    `, [startDate, endDate]);
    const todayProfit = profitRow?.profit || 0;

    // 6. Recent sales (last 5, ignoring cancelled)
    const recentSalesRows = await all(`
      SELECT id FROM sales 
      WHERE status != 'Cancelled' 
      ORDER BY id DESC 
      LIMIT 5
    `);

    const recentSales = [];
    for (const row of recentSalesRows) {
      const populated = await getCompleteSale(row.id);
      recentSales.push(populated);
    }

    res.json({
      totalProducts,
      totalStock,
      todaySales,
      todaySalesCount,
      todayProfit,
      lowStockCount,
      recentSales
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
