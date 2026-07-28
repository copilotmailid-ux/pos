const express = require('express');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

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
// @desc    Get all products (with optional search and optional pagination)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search, category, page, limit } = req.query;
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

    // Support pagination if explicitly requested
    if (page || limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 15;
      const skip = (pageNum - 1) * limitNum;

      const total = await Product.countDocuments(filter);
      const products = await Product.find(filter)
        .sort({ name: 1 }) // Sorted alphabetically
        .skip(skip)
        .limit(limitNum);
      const pages = Math.ceil(total / limitNum) || 1;

      return res.json({ products, total, pages, page: pageNum });
    }

    // Fallback standard un-paginated catalog list
    const products = await Product.find(filter).sort({ name: 1 });
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
