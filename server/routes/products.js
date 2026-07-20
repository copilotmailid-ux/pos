const express = require('express');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

// In-memory queue for remote scans
const remoteScans = {};

// @route   POST /api/products/remote-scan
// @desc    Receive barcode from mobile phone camera
// @access  Public
router.post('/remote-scan', (req, res) => {
  const { barcode, sessionId } = req.body;
  if (!barcode || !sessionId) {
    return res.status(400).json({ message: 'Barcode and sessionId required' });
  }
  if (!remoteScans[sessionId]) {
    remoteScans[sessionId] = [];
  }
  remoteScans[sessionId].push(barcode);
  res.json({ success: true });
});

// @route   GET /api/products/remote-scan/:sessionId
// @desc    Retrieve scanned barcodes for the laptop session
// @access  Public
router.get('/remote-scan/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const barcodes = remoteScans[sessionId] || [];
  remoteScans[sessionId] = []; // Clear queue after reading
  res.json({ barcodes });
});

// @route   GET /api/products/public-barcode/:code
// @desc    Get product details by barcode (no auth required for mobile scanner lookup)
// @access  Public
router.get('/public-barcode/:code', async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.code });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({
      _id: product._id,
      name: product.name,
      barcode: product.barcode,
      category: product.category,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      gstStock: product.gstStock || 0,
      nonGstStock: product.nonGstStock || 0,
      gstRate: product.gstRate ?? 12
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/products/remote-stock-in
// @desc    Replenish stock directly from mobile scanner
// @access  Public
router.post('/remote-stock-in', async (req, res) => {
  const { barcode, quantity, sessionId } = req.body;
  if (!barcode || quantity === undefined) {
    return res.status(400).json({ message: 'Barcode and quantity required' });
  }
  try {
    const qty = Number(quantity);
    const product = await Product.findOne({ barcode });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    product.gstStock = (product.gstStock || 0) + qty;
    product.stock = (product.gstStock || 0) + (product.nonGstStock || 0);
    await product.save();

    // If a session ID was provided, signal the laptop to refresh its products list
    if (sessionId) {
      if (!remoteScans[sessionId]) {
        remoteScans[sessionId] = [];
      }
      remoteScans[sessionId].push(barcode);
    }

    res.json({ name: product.name, stock: product.stock, gstStock: product.gstStock });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// All routes below are protected
router.use(protect);

// @route   GET /api/products/low-stock
// @desc    Get products with stock below 10
// @access  Private
router.get('/low-stock', async (req, res) => {
  try {
    const products = await Product.find({ stock: { $lt: 10 } }).sort({ stock: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/products/barcode/:code
// @desc    Get product by barcode
// @access  Private
router.get('/barcode/:code', async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.code });

    if (!product) {
      return res.status(404).json({ message: 'Product not found with this barcode' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/products
// @desc    Get all products (with optional search)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let filter = {};

    if (search) {
      filter = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ],
      };
    }

    if (category) {
      filter.category = category;
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/products
// @desc    Create a product
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name, variant, barcode, category, purchasePrice, sellingPrice, stock, gstStock, nonGstStock, gstRate } = req.body;

    // Validate required fields
    if (!name || !category || purchasePrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const gStock = gstStock !== undefined ? Number(gstStock) : Number(stock || 0);
    const nStock = nonGstStock !== undefined ? Number(nonGstStock) : 0;

    const productData = {
      name,
      variant: variant || '',
      category,
      purchasePrice,
      sellingPrice,
      gstStock: gStock,
      nonGstStock: nStock,
      stock: gStock + nStock,
      gstRate: gstRate !== undefined ? Number(gstRate) : 12,
    };

    // Only set barcode if provided (otherwise auto-generated)
    if (barcode) {
      productData.barcode = barcode;
    }

    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A product with this barcode already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { name, variant, barcode, category, purchasePrice, sellingPrice, stock, gstStock, nonGstStock, gstRate } = req.body;

    product.name = name || product.name;
    product.variant = variant !== undefined ? variant : product.variant;
    product.barcode = barcode || product.barcode;
    product.category = category || product.category;
    product.purchasePrice = purchasePrice !== undefined ? purchasePrice : product.purchasePrice;
    product.sellingPrice = sellingPrice !== undefined ? sellingPrice : product.sellingPrice;
    
    if (gstStock !== undefined) product.gstStock = Number(gstStock);
    if (nonGstStock !== undefined) product.nonGstStock = Number(nonGstStock);
    if (stock !== undefined && gstStock === undefined && nonGstStock === undefined) {
      product.gstStock = Number(stock);
    }
    product.stock = (product.gstStock || 0) + (product.nonGstStock || 0);
    product.gstRate = gstRate !== undefined ? Number(gstRate) : product.gstRate;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A product with this barcode already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
