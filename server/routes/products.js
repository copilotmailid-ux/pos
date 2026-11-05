const express = require('express');
const path = require('path');
const fs = require('fs');
const { get, all, run } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes below are protected
router.use(protect);

const uploadsProductsDir = path.join(__dirname, '..', 'uploads', 'products');
if (!fs.existsSync(uploadsProductsDir)) {
  fs.mkdirSync(uploadsProductsDir, { recursive: true });
}

// Helper to save base64 image data to local disk and return relative path
const saveImageIfBase64 = (imageData, existingImage = '') => {
  if (!imageData || typeof imageData !== 'string') {
    return existingImage;
  }
  
  if (imageData.startsWith('/uploads') || imageData.startsWith('http')) {
    return imageData;
  }

  if (imageData.startsWith('data:image/')) {
    try {
      const matches = imageData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!matches || matches.length < 3) {
        return existingImage;
      }
      
      let ext = matches[1].toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      if (ext.includes('svg')) ext = 'svg';
      
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const filePath = path.join(uploadsProductsDir, filename);
      
      fs.writeFileSync(filePath, buffer);
      return `/uploads/products/${filename}`;
    } catch (err) {
      console.error('Error saving image to local disk:', err);
      return existingImage;
    }
  }

  return existingImage;
};

// Helper to standardise MongoDB "_id" field in SQLite rows response
const mapProduct = (p) => {
  if (!p) return p;
  return { ...p, _id: p.id };
};

// @route   POST /api/products/upload-image
// @desc    Save local product image to server/uploads/products/
// @access  Private
router.post('/upload-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ message: 'No image provided' });
    }
    const savedPath = saveImageIfBase64(image);
    res.json({ imageUrl: savedPath });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save image', error: error.message });
  }
});

// @route   GET /api/products/low-stock
// @desc    Get products with stock below 10
// @access  Private
router.get('/low-stock', async (req, res) => {
  try {
    const products = await all(`SELECT * FROM products WHERE stock < 10 ORDER BY stock ASC`);
    res.json(products.map(mapProduct));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/products/barcode/:code
// @desc    Get product by barcode
// @access  Private
router.get('/barcode/:code', async (req, res) => {
  try {
    const product = await get(`SELECT * FROM products WHERE barcode = ?`, [req.params.code]);
    if (!product) {
      return res.status(404).json({ message: 'Product not found with this barcode' });
    }
    res.json(mapProduct(product));
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
    let sql = `SELECT * FROM products`;
    let countSql = `SELECT COUNT(*) as count FROM products`;
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push(`(name LIKE ? OR barcode LIKE ? OR category LIKE ?)`);
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (category) {
      conditions.push(`category = ?`);
      params.push(category);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ` + conditions.join(` AND `);
      sql += whereClause;
      countSql += whereClause;
    }

    // Support pagination if explicitly requested
    if (page || limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 15;
      const skip = (pageNum - 1) * limitNum;

      const totalRow = await get(countSql, params);
      const total = totalRow.count;

      const paginatedSql = sql + ` ORDER BY name ASC LIMIT ? OFFSET ?`;
      const paginatedParams = [...params, limitNum, skip];

      const products = await all(paginatedSql, paginatedParams);
      const pages = Math.ceil(total / limitNum) || 1;

      return res.json({
        products: products.map(mapProduct),
        total,
        pages,
        page: pageNum
      });
    }

    // Fallback standard un-paginated catalog list
    sql += ` ORDER BY name ASC`;
    const products = await all(sql, params);
    res.json(products.map(mapProduct));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const product = await get(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(mapProduct(product));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/products
// @desc    Create a product
// @access  Private
router.post('/', async (req, res) => {
  try {
    const {
      name,
      variant,
      barcode,
      category,
      purchasePrice,
      sellingPrice,
      retailPrice,
      wholesalePrice,
      unit,
      minWholesaleQty,
      stock,
      gstStock,
      nonGstStock,
      gstRate
    } = req.body;

    const finalRetailPrice = retailPrice !== undefined ? Number(retailPrice) : (sellingPrice !== undefined ? Number(sellingPrice) : undefined);

    // Validate required fields
    if (!name || !category || purchasePrice === undefined || finalRetailPrice === undefined) {
      return res.status(400).json({ message: 'Please provide all required fields (name, category, purchase price, retail price)' });
    }

    const finalWholesalePrice = wholesalePrice !== undefined ? Number(wholesalePrice) : Math.round(finalRetailPrice * 0.85 * 100) / 100;
    const finalUnit = (unit && unit.trim()) || 'Pcs';
    const finalMinWholesaleQty = minWholesaleQty !== undefined ? Number(minWholesaleQty) : 1;

    const gStock = gstStock !== undefined ? Number(gstStock) : Number(stock || 0);
    const nStock = nonGstStock !== undefined ? Number(nonGstStock) : 0;
    const finalStock = gStock + nStock;

    // Auto-generate barcode if not provided
    let finalBarcode = barcode;
    if (!finalBarcode) {
      const prefix = '200';
      const timestamp = Date.now().toString().slice(-7);
      const random = Math.floor(Math.random() * 900 + 100).toString();
      finalBarcode = prefix + timestamp + random;
    }

    const finalGstRate = gstRate !== undefined ? Number(gstRate) : 0;
    const finalVariant = variant || '';
    const finalImage = req.body.image ? saveImageIfBase64(req.body.image, '') : '';

    // Check unique constraint for barcode
    const existing = await get(`SELECT id FROM products WHERE barcode = ?`, [finalBarcode]);
    if (existing) {
      return res.status(400).json({ message: 'A product with this barcode already exists' });
    }

    const { id } = await run(
      `INSERT INTO products (name, variant, barcode, category, purchasePrice, sellingPrice, retailPrice, wholesalePrice, unit, minWholesaleQty, stock, gstStock, nonGstStock, gstRate, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        finalVariant.trim(),
        finalBarcode.trim(),
        category.trim(),
        purchasePrice,
        finalRetailPrice,
        finalRetailPrice,
        finalWholesalePrice,
        finalUnit,
        finalMinWholesaleQty,
        finalStock,
        gStock,
        nStock,
        finalGstRate,
        finalImage
      ]
    );

    const created = await get(`SELECT * FROM products WHERE id = ?`, [id]);
    res.status(201).json(mapProduct(created));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const product = await get(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const {
      name,
      variant,
      barcode,
      category,
      purchasePrice,
      sellingPrice,
      retailPrice,
      wholesalePrice,
      unit,
      minWholesaleQty,
      stock,
      gstStock,
      nonGstStock,
      gstRate,
      image
    } = req.body;

    const finalName = name || product.name;
    const finalVariant = variant !== undefined ? variant : product.variant;
    const finalBarcode = barcode || product.barcode;
    const finalCategory = category || product.category;
    const finalPurchasePrice = purchasePrice !== undefined ? purchasePrice : product.purchasePrice;
    
    let finalRetailPrice = product.retailPrice || product.sellingPrice;
    if (retailPrice !== undefined) finalRetailPrice = Number(retailPrice);
    else if (sellingPrice !== undefined) finalRetailPrice = Number(sellingPrice);

    let finalWholesalePrice = product.wholesalePrice || (product.retailPrice ? Math.round(product.retailPrice * 0.85 * 100) / 100 : product.sellingPrice);
    if (wholesalePrice !== undefined) finalWholesalePrice = Number(wholesalePrice);

    const finalUnit = unit !== undefined ? unit : (product.unit || 'Pcs');
    const finalMinWholesaleQty = minWholesaleQty !== undefined ? Number(minWholesaleQty) : (product.minWholesaleQty || 1);

    let gStock = product.gstStock;
    let nStock = product.nonGstStock;
    if (gstStock !== undefined) gStock = Number(gstStock);
    if (nonGstStock !== undefined) nStock = Number(nonGstStock);
    if (stock !== undefined && gstStock === undefined && nonGstStock === undefined) {
      gStock = Number(stock);
    }
    const finalStock = gStock + nStock;
    const finalGstRate = gstRate !== undefined ? Number(gstRate) : product.gstRate;
    const finalImage = image !== undefined ? saveImageIfBase64(image, product.image || '') : (product.image || '');

    // Check unique constraint for barcode if changed
    if (finalBarcode !== product.barcode) {
      const existing = await get(`SELECT id FROM products WHERE barcode = ?`, [finalBarcode]);
      if (existing) {
        return res.status(400).json({ message: 'A product with this barcode already exists' });
      }
    }

    await run(
      `UPDATE products 
       SET name = ?, variant = ?, barcode = ?, category = ?, purchasePrice = ?, sellingPrice = ?, retailPrice = ?, wholesalePrice = ?, unit = ?, minWholesaleQty = ?, stock = ?, gstStock = ?, nonGstStock = ?, gstRate = ?, image = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        finalName.trim(),
        finalVariant.trim(),
        finalBarcode.trim(),
        finalCategory.trim(),
        finalPurchasePrice,
        finalRetailPrice,
        finalRetailPrice,
        finalWholesalePrice,
        finalUnit,
        finalMinWholesaleQty,
        finalStock,
        gStock,
        nStock,
        finalGstRate,
        finalImage,
        req.params.id
      ]
    );

    const updated = await get(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    res.json(mapProduct(updated));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const product = await get(`SELECT id FROM products WHERE id = ?`, [req.params.id]);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await run(`DELETE FROM products WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
