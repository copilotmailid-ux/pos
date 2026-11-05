const express = require('express');
const { get, all, run, transaction } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Helper to map relational row to the nested supplier format expected by the client UI
const mapPurchaseRow = (row) => {
  if (!row) return row;
  const isCredit = row.paymentMethod === 'Credit';
  const paidAmount = Number(row.paidAmount !== null && row.paidAmount !== undefined ? row.paidAmount : (isCredit ? 0 : row.total));
  const dueAmount = Math.max(0, Math.round(((Number(row.total) || 0) - paidAmount) * 100) / 100);
  
  let paymentStatus = row.paymentStatus;
  if (!paymentStatus) {
    if (paidAmount >= (Number(row.total) || 0)) {
      paymentStatus = 'Paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'Partial';
    } else {
      paymentStatus = isCredit ? 'Pending' : 'Paid';
    }
  }

  return {
    _id: row.id,
    id: row.id,
    purchaseNumber: row.purchaseNumber,
    purchaseTaxType: row.purchaseTaxType,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    paymentMethod: row.paymentMethod,
    paymentStatus,
    paidAmount,
    dueAmount,
    paidAt: row.paidAt,
    status: row.status,
    notes: row.notes,
    invoiceDate: row.invoiceDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    supplier: {
      _id: row.supplierId || null,
      id: row.supplierId || null,
      name: row.supplierName || 'Walk-in / Cash Supplier',
      phone: row.supplierPhone || '',
      contactPerson: row.supplierContact || '',
      supplierType: row.supplierType || (row.purchaseTaxType || 'Non-GST'),
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
      sql += ` WHERE p.purchaseNumber LIKE ? OR p.notes LIKE ? OR s.name LIKE ?`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY p.id DESC`;

    const rows = await all(sql, params);
    res.json(rows.map(mapPurchaseRow));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching purchases', error: error.message });
  }
});

// GET specific purchase by ID (including items and payment installments history)
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

    const [items, payments] = await Promise.all([
      all(`
        SELECT 
          pi.*,
          pi.productId as product,
          p.name as productName,
          p.variant
        FROM purchase_items pi
        LEFT JOIN products p ON pi.productId = p.id
        WHERE pi.purchaseId = ?
      `, [req.params.id]),
      all(`
        SELECT * FROM purchase_payments 
        WHERE purchaseId = ? 
        ORDER BY id ASC
      `, [req.params.id])
    ]);

    purchase.items = items.map(item => ({
      ...item,
      product: {
        _id: item.productId,
        id: item.productId,
        name: item.productName,
        variant: item.variant
      }
    }));

    purchase.payments = payments || [];

    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching purchase details', error: error.message });
  }
});

// POST record new purchase (Supports Credit with optional initial down payment)
router.post('/', async (req, res) => {
  try {
    const {
      supplier,
      purchaseTaxType,
      items,
      paymentMethod,
      notes,
      invoiceDate,
      initialPaidAmount,
      initialPaymentMethod
    } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Purchase items are required' });
    }

    // Verify supplier if provided (supplier is optional for cash / walk-in purchases)
    let existingSupplier = null;
    let supplierId = null;
    if (supplier) {
      existingSupplier = await get(`SELECT * FROM suppliers WHERE id = ?`, [supplier]);
      if (existingSupplier) {
        supplierId = existingSupplier.id;
      }
    }

    // Determine if this is a GST purchase
    const isGstPurchase = purchaseTaxType ? (purchaseTaxType === 'GST') : (existingSupplier ? (existingSupplier.supplierType === 'GST' || Boolean(existingSupplier.gstin)) : false);

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
        const prodId = item.product?._id || item.product?.id || item.product;
        const product = await get(`SELECT * FROM products WHERE id = ?`, [prodId]);
        if (!product) {
          throw new Error(`Product ${item.productName || 'with ID ' + prodId} not found`);
        }

        const itemQty = Number(item.quantity) || 1;
        const itemPurchasePrice = Number(item.purchasePrice) || 0;
        const itemSellingPrice = Number(item.sellingPrice !== undefined ? item.sellingPrice : (item.retailPrice !== undefined ? item.retailPrice : (product.sellingPrice || 0)));
        const itemWholesalePrice = Number(item.wholesalePrice !== undefined ? item.wholesalePrice : (product.wholesalePrice || 0));
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
          wholesalePrice: itemWholesalePrice,
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

        // Update product pricing (both retail & wholesale) & stock
        await run(
          `UPDATE products 
           SET gstStock = ?, nonGstStock = ?, stock = ?, purchasePrice = ?, sellingPrice = ?, retailPrice = ?, wholesalePrice = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newGstStock, newNonGstStock, newStock, itemPurchasePrice, itemSellingPrice, itemSellingPrice, itemWholesalePrice, product.id]
        );
      }

      const finalDate = invoiceDate || new Date().toISOString();
      const finalNotes = notes || '';
      const finalMethod = paymentMethod || 'Cash';
      const isCredit = finalMethod === 'Credit';

      // Partial / Initial Down Payment calculation
      let paidAmount = 0;
      let paymentStatus = 'Paid';
      let paidAt = null;

      if (isCredit) {
        paidAmount = Math.min(total, Math.max(0, Number(initialPaidAmount) || 0));
        paymentStatus = (paidAmount >= total) ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Pending');
        paidAt = (paidAmount >= total) ? finalDate : null;
      } else {
        paidAmount = total;
        paymentStatus = 'Paid';
        paidAt = finalDate;
      }

      const dueAmount = Math.max(0, Math.round((total - paidAmount) * 100) / 100);

      // Insert purchase
      const { id: purchaseId } = await run(
        `INSERT INTO purchases (purchaseNumber, supplierId, purchaseTaxType, subtotal, tax, total, paymentMethod, paymentStatus, paidAmount, paidAt, status, invoiceDate, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [purchaseNumber, supplierId, isGstPurchase ? 'GST' : 'Non-GST', subtotal, tax, total, finalMethod, paymentStatus, paidAmount, paidAt, 'Received', finalDate, finalNotes]
      );

      // Insert purchase items
      for (const pi of processedItems) {
        await run(
          `INSERT INTO purchase_items (purchaseId, productId, productName, variant, barcode, quantity, purchasePrice, sellingPrice, wholesalePrice, gstRate, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [purchaseId, pi.productId, pi.productName, pi.variant, pi.barcode, pi.quantity, pi.purchasePrice, pi.sellingPrice, pi.wholesalePrice, pi.gstRate, pi.total]
        );
      }

      // Record initial payment step in purchase_payments if any amount paid
      if (paidAmount > 0) {
        const methodUsed = isCredit ? (initialPaymentMethod || 'Cash') : finalMethod;
        const noteText = isCredit ? 'Initial down payment / advance' : 'Full payment at purchase';
        await run(
          `INSERT INTO purchase_payments (purchaseId, amount, paymentMethod, paymentDate, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [purchaseId, paidAmount, methodUsed, finalDate, noteText]
        );
      }

      return {
        purchaseId,
        purchaseNumber,
        supplier: supplierId,
        purchaseTaxType: isGstPurchase ? 'GST' : 'Non-GST',
        subtotal,
        tax,
        total,
        paymentMethod: finalMethod,
        paymentStatus,
        paidAmount,
        dueAmount,
        paidAt,
        notes: finalNotes,
        invoiceDate: finalDate
      };
    });

    res.status(201).json({ _id: processedPurchase.purchaseId, ...processedPurchase });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error recording purchase' });
  }
});

// POST record installment payment / settle payment
router.post('/:id/pay', async (req, res) => {
  try {
    const { amount, paymentMethod, notes, paymentDate } = req.body;
    const purchase = await get(`SELECT * FROM purchases WHERE id = ?`, [req.params.id]);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const currentPaid = Number(purchase.paidAmount || 0);
    const remainingDue = Math.max(0, Math.round((Number(purchase.total || 0) - currentPaid) * 100) / 100);
    const payAmount = (amount !== undefined && amount !== null && Number(amount) > 0)
      ? Math.min(remainingDue, Number(amount))
      : remainingDue;

    if (payAmount <= 0) {
      return res.status(400).json({ message: 'This purchase is already paid in full' });
    }

    const settleMethod = paymentMethod || 'Cash';
    const settleDate = paymentDate || new Date().toISOString();
    const settlementNote = notes && notes.trim()
      ? notes.trim()
      : (payAmount >= remainingDue ? 'Full final settlement' : 'Installment payment');

    await transaction(async () => {
      // 1. Insert step into purchase_payments
      await run(
        `INSERT INTO purchase_payments (purchaseId, amount, paymentMethod, paymentDate, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, payAmount, settleMethod, settleDate, settlementNote]
      );

      // 2. Sum up total payments made
      const sumRow = await get(`SELECT COALESCE(SUM(amount), 0) as totalPaid FROM purchase_payments WHERE purchaseId = ?`, [req.params.id]);
      const newPaid = Math.round(Number(sumRow.totalPaid) * 100) / 100;
      const isFullyPaid = newPaid >= purchase.total;
      const newStatus = isFullyPaid ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Pending');

      await run(
        `UPDATE purchases 
         SET paidAmount = ?,
             paymentStatus = ?,
             paidAt = ?,
             updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newPaid, newStatus, isFullyPaid ? settleDate : purchase.paidAt, req.params.id]
      );
    });

    const updated = await get(`
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

    const mapped = mapPurchaseRow(updated);
    mapped.payments = await all(`SELECT * FROM purchase_payments WHERE purchaseId = ? ORDER BY id ASC`, [req.params.id]);

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Error recording payment', error: error.message });
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
