const express = require('express');
const { get, all, run, transaction } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Helper to map relational row to the nested supplier format expected by the client UI
const mapPurchaseRow = (row) => {
  if (!row) return row;
  return {
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
  };
};

// GET all purchases
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT 
        p.*,
        s.name as supplierName,
        s.phone as supplierPhone,
        s.contactPerson as supplierContact,
        s.supplierType as supplierType,
        s.gstin as supplierGstin
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplierId = s.id
    `;
    const params = [];

    if (search) {
      sql += ` WHERE p.purchaseNumber LIKE ? OR p.notes LIKE ?`;
      const term = `%${search}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY p.id DESC`;

    const rows = await all(sql, params);
    res.json(rows.map(mapPurchaseRow));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching purchases', error: error.message });
  }
});

// GET specific purchase by ID
router.get('/:id', async (req, res) => {
  try {
    const row = await get(`
      SELECT 
        p.*,
        s.name as supplierName,
        s.phone as supplierPhone,
        s.contactPerson as supplierContact,
        s.supplierType as supplierType,
        s.gstin as supplierGstin
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplierId = s.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!row) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const purchase = mapPurchaseRow(row);

    const items = await all(`
      SELECT 
        pi.*,
        pi.productId as product,
        p.name as productName,
        p.variant
      FROM purchase_items pi
      LEFT JOIN products p ON pi.productId = p.id
      WHERE pi.purchaseId = ?
    `, [req.params.id]);

    purchase.items = items.map(item => ({
      ...item,
      product: {
        _id: item.productId,
        id: item.productId,
        name: item.productName,
        variant: item.variant
      }
    }));

    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching purchase details', error: error.message });
  }
});

// POST record new purchase
router.post('/', async (req, res) => {
  try {
    const { supplier, purchaseTaxType, items, paymentMethod, notes, invoiceDate } = req.body;
    
    if (!supplier || !items || items.length === 0) {
      return res.status(400).json({ message: 'Supplier and items are required' });
    }

    // Verify supplier exists
    const existingSupplier = await get(`SELECT * FROM suppliers WHERE id = ?`, [supplier]);
    if (!existingSupplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Determine if this is a GST purchase based on purchaseTaxType sent from client, or fallback to supplier configuration
    const isGstPurchase = purchaseTaxType ? (purchaseTaxType === 'GST') : (existingSupplier.supplierType === 'GST' || Boolean(existingSupplier.gstin));

    // Generate unique purchase number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const purchaseNumber = `PUR-${dateStr}-${randomSuffix}`;

    const processedPurchase = await transaction(async () => {
      let subtotal = 0;
      let tax = 0;
      let total = 0;
      const processedItems = [];

      for (const item of items) {
        const prodId = item.product._id || item.product;
        const product = await get(`SELECT * FROM products WHERE id = ?`, [prodId]);
        if (!product) {
          throw new Error(`Product ${item.productName || 'with ID ' + prodId} not found`);
        }

        const itemQty = Number(item.quantity);
        const itemPurchasePrice = Number(item.purchasePrice);
        const itemSellingPrice = Number(item.sellingPrice);
        const itemGst = isGstPurchase ? Number(item.gstRate !== undefined ? item.gstRate : (product.gstRate ?? 12)) : 0;
        
        const itemSubtotal = itemQty * itemPurchasePrice;
        const itemTax = itemSubtotal * (itemGst / 100);
        const itemTotal = itemSubtotal + itemTax;

        subtotal += itemSubtotal;
        tax += itemTax;
        total += itemTotal;

        processedItems.push({
          productId: product.id,
          productName: product.name,
          variant: product.variant || '',
          barcode: product.barcode,
          quantity: itemQty,
          purchasePrice: itemPurchasePrice,
          sellingPrice: itemSellingPrice,
          gstRate: itemGst,
          total: itemTotal
        });

        // Update product inventory levels (GST Stock vs Non-GST Stock)
        let newGstStock = product.gstStock || 0;
        let newNonGstStock = product.nonGstStock || 0;

        if (isGstPurchase) {
          newGstStock += itemQty;
        } else {
          newNonGstStock += itemQty;
        }
        const newStock = newGstStock + newNonGstStock;

        await run(
          `UPDATE products 
           SET gstStock = ?, nonGstStock = ?, stock = ?, purchasePrice = ?, sellingPrice = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newGstStock, newNonGstStock, newStock, itemPurchasePrice, itemSellingPrice, product.id]
        );
      }

      const finalDate = invoiceDate || new Date().toISOString();
      const finalNotes = notes || '';
      const finalMethod = paymentMethod || 'Cash';

      // Insert purchase
      const { id: purchaseId } = await run(
        `INSERT INTO purchases (purchaseNumber, supplierId, purchaseTaxType, subtotal, tax, total, paymentMethod, status, invoiceDate, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [purchaseNumber, supplier, isGstPurchase ? 'GST' : 'Non-GST', subtotal, tax, total, finalMethod, 'Received', finalDate, finalNotes]
      );

      // Insert purchase items
      for (const pi of processedItems) {
        await run(
          `INSERT INTO purchase_items (purchaseId, productId, productName, variant, barcode, quantity, purchasePrice, sellingPrice, gstRate, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [purchaseId, pi.productId, pi.productName, pi.variant, pi.barcode, pi.quantity, pi.purchasePrice, pi.sellingPrice, pi.gstRate, pi.total]
        );
      }

      return { purchaseId, purchaseNumber, supplier, purchaseTaxType: isGstPurchase ? 'GST' : 'Non-GST', subtotal, tax, total, paymentMethod: finalMethod, notes: finalNotes, invoiceDate: finalDate };
    });

    res.status(201).json({ _id: processedPurchase.purchaseId, ...processedPurchase });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error recording purchase' });
  }
});

// POST trigger purchase return
router.post('/:id/return', async (req, res) => {
  try {
    const purchase = await get(`SELECT * FROM purchases WHERE id = ?`, [req.params.id]);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    if (purchase.status === 'Returned') {
      return res.status(400).json({ message: 'This purchase has already been fully returned' });
    }

    const items = await all(`SELECT * FROM purchase_items WHERE purchaseId = ?`, [req.params.id]);
    const isGstPurchase = purchase.purchaseTaxType === 'GST';

    await transaction(async () => {
      // Process return: reduce stock of all items in this purchase
      for (const item of items) {
        if (item.productId) {
          const product = await get(`SELECT * FROM products WHERE id = ?`, [item.productId]);
          if (product) {
            let newGstStock = product.gstStock || 0;
            let newNonGstStock = product.nonGstStock || 0;

            if (isGstPurchase) {
              const deductQty = Math.min(newGstStock, item.quantity);
              newGstStock = Math.max(0, newGstStock - deductQty);
            } else {
              const deductQty = Math.min(newNonGstStock, item.quantity);
              newNonGstStock = Math.max(0, newNonGstStock - deductQty);
            }
            const newStock = newGstStock + newNonGstStock;

            await run(
              `UPDATE products SET gstStock = ?, nonGstStock = ?, stock = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
              [newGstStock, newNonGstStock, newStock, product.id]
            );
          }
        }
      }

      await run(
        `UPDATE purchases SET status = 'Returned', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        [req.params.id]
      );
    });

    const updated = await get(`SELECT * FROM purchases WHERE id = ?`, [req.params.id]);
    res.json(mapPurchaseRow(updated));
  } catch (error) {
    res.status(500).json({ message: 'Server error returning purchase', error: error.message });
  }
});

module.exports = router;
