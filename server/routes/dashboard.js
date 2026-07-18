const express = require('express');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// @route   GET /api/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get('/', async (req, res) => {
  try {
    // Total products count
    const totalProducts = await Product.countDocuments();

    // Total stock (sum of all product stock)
    const stockAgg = await Product.aggregate([
      { $group: { _id: null, totalStock: { $sum: '$stock' } } },
    ]);
    const totalStock = stockAgg.length > 0 ? stockAgg[0].totalStock : 0;

    // Today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySalesAgg = await Sale.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalRefunded: { $sum: '$returnedAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const rawSales = todaySalesAgg.length > 0 ? todaySalesAgg[0].totalSales : 0;
    const rawRefunds = todaySalesAgg.length > 0 ? todaySalesAgg[0].totalRefunded : 0;
    const todaySales = Math.max(0, rawSales - rawRefunds);
    const todaySalesCount = todaySalesAgg.length > 0 ? todaySalesAgg[0].count : 0;

    // Low stock products count (stock < 10)
    const lowStockCount = await Product.countDocuments({ stock: { $lt: 10 } });

    // Today's profit calculation
    const todaySalesData = await Sale.find({ 
      createdAt: { $gte: today, $lt: tomorrow }, 
      status: { $ne: 'Cancelled' } 
    }).populate('items');
    
    let todayProfit = 0;
    for (const sale of todaySalesData) {
      if (sale.items) {
        for (const item of sale.items) {
          const activeQty = item.quantity - (item.returnedQuantity || 0);
          if (activeQty > 0) {
            const itemProfit = (item.price - (item.purchasePrice || 0)) * activeQty;
            todayProfit += itemProfit;
          }
        }
      }
    }

    // Recent sales (last 5, ignoring cancelled)
    const recentSales = await Sale.find({ status: { $ne: 'Cancelled' } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('items');

    res.json({
      totalProducts,
      totalStock,
      todaySales,
      todaySalesCount,
      todayProfit,
      lowStockCount,
      recentSales,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
