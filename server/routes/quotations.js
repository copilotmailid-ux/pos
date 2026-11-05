const express = require('express');
const { get, all, run, transaction } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Helper to retrieve complete quotation populated with items
const getCompleteQuotation = async (quotationId) => {
  const quotation = await get(`SELECT * FROM quotations WHERE id = ?`, [quotationId]);
  if (!quotation) return null;

  const items = await all(`SELECT * FROM quotation_items WHERE quotationId = ?`, [quotationId]);

  return {
    ...quotation,
    _id: quotation.id,
    items: items.map(item => ({
      ...item,
      _id: item.id,
      product: {
        _id: item.productId,
        id: item.productId,
        name: item.productName,
        variant: item.variant,
        unit: item.unit,
        barcode: item.barcode
      }
    }))
  };
};

// @route   GET /api/quotations
// @desc    Get all quotations with search, status filter & pagination
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search, status, startDate, endDate, page = 1, limit = 15 } = req.query;
    let sql = `SELECT * FROM quotations`;
    let countSql = `SELECT COUNT(*) as count FROM quotations`;
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push(`(quotationNo LIKE ? OR customerName LIKE ? OR customerMobile LIKE ?)`);
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status && status !== 'All') {
      if (status === 'Pending' || status === 'Draft') {
        conditions.push(`status IN ('Draft', 'Pending')`);
      } else {
        conditions.push(`status = ?`);
        params.push(status);
      }
    }

    if (startDate) {
      conditions.push(`createdAt >= ?`);
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      conditions.push(`createdAt <= ?`);
      params.push(`${endDate} 23:59:59`);
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
    const total = totalRow?.count || 0;

    const querySql = sql + ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    const queryParams = [...params, limitNum, skip];

    const quotationRows = await all(querySql, queryParams);
    const quotations = [];
    for (const row of quotationRows) {
      const populated = await getCompleteQuotation(row.id);
      quotations.push(populated);
    }

    const pages = Math.ceil(total / limitNum) || 1;
    res.json({ quotations, total, pages, page: pageNum });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/quotations/:id
// @desc    Get single quotation details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const quotation = await getCompleteQuotation(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    res.json(quotation);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/quotations
// @desc    Create a new quotation / price estimate (does not alter inventory)
// @access  Private
router.post('/', async (req, res) => {
  const { items, customerMobile, customerName, customerType, validUntil, notes } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items in the quotation' });
  }

  try {
    const processedId = await transaction(async () => {
      // 1. Auto-Register customer in database if mobile is provided and doesn't exist
      if (customerMobile && customerName) {
        const existingCustomer = await get(`SELECT id FROM customers WHERE mobile = ?`, [customerMobile.trim()]);
        if (!existingCustomer) {
          await run(
            `INSERT INTO customers (name, mobile, customerType) VALUES (?, ?, ?)`,
            [customerName.trim(), customerMobile.trim(), customerType || 'Shop']
          );
        }
      }

      // 2. Generate unique sequential quotation ID from counters table
      const counterRow = await get(`SELECT seq FROM counters WHERE id = 'quotationNo'`);
      const newSeq = (counterRow?.seq || 0) + 1;
      await run(`UPDATE counters SET seq = ? WHERE id = 'quotationNo'`, [newSeq]);
      const quotationNo = `QTN-${String(newSeq).padStart(5, '0')}`;

      // Check store GST settings
      const storeSettings = await get('SELECT enableGst FROM settings WHERE id = 1');
      const isGstEnabled = !storeSettings || storeSettings.enableGst !== 0;

      // 3. Compute totals
      let subtotal = 0;
      let totalTax = 0;
      const quotationItemsData = [];

      for (const item of items) {
        const prodId = item.productId?._id || item.productId?.id || item.productId;
        let product = null;
        if (prodId) {
          product = await get(`SELECT * FROM products WHERE id = ?`, [prodId]);
        }

        const qty = Number(item.quantity || 1);
        const itemPrice = Number(item.price || (product ? (item.priceType === 'Shop' ? (product.wholesalePrice || product.sellingPrice) : (product.retailPrice || product.sellingPrice)) : 0));
        const itemGstRate = isGstEnabled ? Number(item.gstRate !== undefined ? item.gstRate : (product?.gstRate || 0)) : 0;
        
        const itemSubtotal = round2(itemPrice * qty);
        const itemTax = round2(itemSubtotal * (itemGstRate / 100));
        const itemTotal = round2(itemSubtotal + itemTax);

        subtotal = round2(subtotal + itemSubtotal);
        totalTax = round2(totalTax + itemTax);

        quotationItemsData.push({
          productId: product ? product.id : null,
          productName: item.productName || product?.name || 'Item',
          variant: item.variant || product?.variant || '',
          unit: item.unit || product?.unit || 'Pcs',
          barcode: item.barcode || product?.barcode || '',
          quantity: qty,
          priceType: item.priceType || customerType || 'Shop',
          price: itemPrice,
          gstRate: itemGstRate,
          taxAmount: itemTax,
          total: itemTotal,
        });
      }

      const grandTotal = round2(subtotal + totalTax);
      const nowStr = new Date().toISOString();

      // Insert quotation
      const { id: qId } = await run(
        `INSERT INTO quotations (quotationNo, customerMobile, customerName, customerType, subtotal, taxAmount, grandTotal, status, validUntil, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quotationNo,
          customerMobile || '',
          customerName || '',
          customerType || 'Shop',
          subtotal,
          totalTax,
          grandTotal,
          'Draft',
          validUntil || '',
          notes || '',
          nowStr,
          nowStr
        ]
      );

      // Insert quotation items
      for (const qi of quotationItemsData) {
        await run(
          `INSERT INTO quotation_items (quotationId, productId, productName, variant, unit, barcode, quantity, priceType, price, gstRate, taxAmount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            qId,
            qi.productId,
            qi.productName,
            qi.variant,
            qi.unit,
            qi.barcode,
            qi.quantity,
            qi.priceType,
            qi.price,
            qi.gstRate,
            qi.taxAmount,
            qi.total
          ]
        );
      }

      return qId;
    });

    const completeQuotation = await getCompleteQuotation(processedId);
    res.status(201).json(completeQuotation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/quotations/:id
// @desc    Update an existing quotation (items, notes, customer, validUntil)
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const existing = await get(`SELECT * FROM quotations WHERE id = ?`, [req.params.id]);
    if (!existing) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    const { items, customerMobile, customerName, customerType, validUntil, notes, status } = req.body;

    await transaction(async () => {
      let subtotal = 0;
      let totalTax = 0;
      const targetItems = items || [];

      // If items are provided, replace them
      if (targetItems.length > 0) {
        await run(`DELETE FROM quotation_items WHERE quotationId = ?`, [existing.id]);

        for (const item of targetItems) {
          const qty = Number(item.quantity || 1);
          const itemPrice = Number(item.price || 0);
          const itemGstRate = Number(item.gstRate !== undefined ? item.gstRate : 12);
          
          const itemSubtotal = round2(itemPrice * qty);
          const itemTax = round2(itemSubtotal * (itemGstRate / 100));
          const itemTotal = round2(itemSubtotal + itemTax);

          subtotal = round2(subtotal + itemSubtotal);
          totalTax = round2(totalTax + itemTax);

          await run(
            `INSERT INTO quotation_items (quotationId, productId, productName, variant, unit, barcode, quantity, priceType, price, gstRate, taxAmount, total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              existing.id,
              item.productId?._id || item.productId || null,
              item.productName || '',
              item.variant || '',
              item.unit || 'Pcs',
              item.barcode || '',
              qty,
              item.priceType || 'Shop',
              itemPrice,
              itemGstRate,
              itemTax,
              itemTotal
            ]
          );
        }
      } else {
        subtotal = existing.subtotal;
        totalTax = existing.taxAmount;
      }

      const grandTotal = round2(subtotal + totalTax);
      const newStatus = status || existing.status;
      const newCustomerMobile = customerMobile !== undefined ? customerMobile : existing.customerMobile;
      const newCustomerName = customerName !== undefined ? customerName : existing.customerName;
      const newCustomerType = customerType !== undefined ? customerType : existing.customerType;
      const newValidUntil = validUntil !== undefined ? validUntil : existing.validUntil;
      const newNotes = notes !== undefined ? notes : existing.notes;

      await run(
        `UPDATE quotations 
         SET customerMobile = ?, customerName = ?, customerType = ?, subtotal = ?, taxAmount = ?, grandTotal = ?, status = ?, validUntil = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newCustomerMobile, newCustomerName, newCustomerType, subtotal, totalTax, grandTotal, newStatus, newValidUntil, newNotes, existing.id]
      );
    });

    const updated = await getCompleteQuotation(existing.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/quotations/:id/convert
// @desc    Mark quotation as converted with linked invoice number
// @access  Private
router.post('/:id/convert', async (req, res) => {
  try {
    const { invoiceNo } = req.body;
    const existing = await get(`SELECT id FROM quotations WHERE id = ?`, [req.params.id]);
    if (!existing) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    await run(
      `UPDATE quotations SET status = 'Converted', convertedInvoiceNo = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [invoiceNo || '', req.params.id]
    );

    const updated = await getCompleteQuotation(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/quotations/:id
// @desc    Delete a quotation
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const quotation = await get(`SELECT id FROM quotations WHERE id = ?`, [req.params.id]);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    await run(`DELETE FROM quotations WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
