const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'database.sqlite');
console.log('Seeding sales to SQLite database at:', dbPath);

const db = new sqlite3.Database(dbPath);

const customersList = [
  { name: 'Deva', mobile: '9360480902' },
  { name: 'Suresh Kumar', mobile: '9398989898' },
  { name: 'Ravi Teja', mobile: '9876543210' },
  { name: 'Ananya', mobile: '9123456789' },
  { name: 'Vijay', mobile: '9444123456' },
  { name: 'Karthik', mobile: '9840123456' },
  { name: 'Priya', mobile: '9962123456' },
  { name: 'Sandhya', mobile: '9884123456' },
  { name: '', mobile: '' } // Walk-ins
];

const paymentMethods = ['Cash Tendered', 'UPI / Card', 'Cash Tendered', 'UPI / Card'];

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const seedHeavySales = async () => {
  try {
    const products = await all(`SELECT * FROM products`);
    if (products.length === 0) {
      console.error('No products found in the database. Please seed products first using seed_thousand.js!');
      process.exit(1);
    }
    console.log(`Loaded ${products.length} products to choose from.`);

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      db.run("DELETE FROM sales");
      db.run("DELETE FROM sale_items");
      db.run("DELETE FROM counters WHERE id = 'invoiceNo'");
      db.run("INSERT INTO counters (id, seq) VALUES ('invoiceNo', 10000)");

      const saleStmt = db.prepare(`
        INSERT INTO sales (id, invoiceNo, customerMobile, customerName, paymentMethod, amountPaid, changeReturned, subtotal, gstSubtotal, nonGstSubtotal, taxAmount, cgstAmount, sgstAmount, grandTotal, reportGstTax, reportNonGstAmount, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, ?)
      `);

      const itemStmt = db.prepare(`
        INSERT INTO sale_items (saleId, productId, productName, variant, barcode, quantity, gstQuantity, nonGstQuantity, price, purchasePrice, total, gstRate, taxAmount, reportGstTax, reportNonGstAmount, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const totalSalesToSeed = 10000;
      const now = new Date();

      // Build a running stock tracker to FIFO allocate gstStock vs nonGstStock across sales
      const stockTracker = {};
      for (const p of products) {
        stockTracker[p.id] = {
          gstStock: p.gstStock || 0,
          nonGstStock: p.nonGstStock || 0
        };
      }

      let itemIdCounter = 1;

      for (let i = 1; i <= totalSalesToSeed; i++) {
        const cust = customersList[Math.floor(Math.random() * customersList.length)];
        const numItems = Math.floor(Math.random() * 4) + 1;
        const saleId = i;

        let subtotal = 0;
        let taxAmount = 0;
        let gstSubtotal = 0;
        let nonGstSubtotal = 0;
        let reportGstTaxSum = 0;
        let reportNonGstAmountSum = 0;

        const saleDate = new Date(now);
        const daysAgo = Math.floor(Math.random() * 30);
        const hour = Math.floor(Math.random() * 12) + 9; // 9 AM to 9 PM
        const minute = Math.floor(Math.random() * 60);
        saleDate.setDate(saleDate.getDate() - daysAgo);
        saleDate.setHours(hour, minute, 0, 0);
        const saleDateStr = saleDate.toISOString().replace('T', ' ').slice(0, 19);

        for (let j = 0; j < numItems; j++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const qty = Math.floor(Math.random() * 3) + 1;
          const itemGst = product.gstRate ?? 12;

          const tracker = stockTracker[product.id];
          let gstQty = 0;
          let nonGstQty = 0;

          if (tracker.gstStock >= qty) {
            gstQty = qty;
            tracker.gstStock -= qty;
          } else {
            gstQty = tracker.gstStock;
            const remaining = qty - gstQty;
            tracker.gstStock = 0;
            if (tracker.nonGstStock >= remaining) {
              nonGstQty = remaining;
              tracker.nonGstStock -= remaining;
            } else {
              nonGstQty = tracker.nonGstStock;
              tracker.nonGstStock = 0;
              const deficit = remaining - nonGstQty;
              gstQty += Math.ceil(deficit * 0.6);
              nonGstQty += deficit - Math.ceil(deficit * 0.6);
            }
          }

          const itemSubtotal = product.sellingPrice * qty;
          const itemTax = itemSubtotal * (itemGst / 100);
          const itemGstSubtotal = product.sellingPrice * gstQty;
          const itemNonGstSubtotal = product.sellingPrice * nonGstQty;

          const reportGstTax = itemGstSubtotal * (itemGst / 100);
          const reportNonGstAmount = itemNonGstSubtotal;

          subtotal += itemSubtotal;
          taxAmount += itemTax;
          gstSubtotal += itemGstSubtotal;
          nonGstSubtotal += itemNonGstSubtotal;
          reportGstTaxSum += reportGstTax;
          reportNonGstAmountSum += reportNonGstAmount;

          const totalLineVal = itemSubtotal + itemTax;

          itemStmt.run(
            saleId,
            product.id,
            product.name,
            product.variant || '',
            product.barcode,
            qty,
            gstQty,
            nonGstQty,
            product.sellingPrice,
            product.purchasePrice || 0,
            Number(totalLineVal.toFixed(2)),
            itemGst,
            Number(itemTax.toFixed(2)),
            Number(reportGstTax.toFixed(2)),
            Number(reportNonGstAmount.toFixed(2)),
            saleDateStr,
            saleDateStr
          );
        }

        const grandTotal = subtotal + taxAmount;
        const cgstAmount = taxAmount / 2;
        const sgstAmount = taxAmount / 2;

        const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        let amountPaid = grandTotal;
        let changeReturned = 0;
        if (method === 'Cash Tendered') {
          const nextHundred = Math.ceil(grandTotal / 100) * 100;
          amountPaid = nextHundred;
          changeReturned = nextHundred - grandTotal;
        }

        saleStmt.run(
          saleId,
          `INV-${String(i).padStart(5, '0')}`,
          cust.mobile,
          cust.name,
          method,
          Number(amountPaid.toFixed(2)),
          Number(changeReturned.toFixed(2)),
          Number(subtotal.toFixed(2)),
          Number(gstSubtotal.toFixed(2)),
          Number(nonGstSubtotal.toFixed(2)),
          Number(taxAmount.toFixed(2)),
          Number(cgstAmount.toFixed(2)),
          Number(sgstAmount.toFixed(2)),
          Number(grandTotal.toFixed(2)),
          Number(reportGstTaxSum.toFixed(2)),
          Number(reportNonGstAmountSum.toFixed(2)),
          saleDateStr,
          saleDateStr
        );
      }

      saleStmt.finalize();
      itemStmt.finalize();

      db.run("COMMIT", (err) => {
        if (err) {
          console.error('Commit failed:', err.message);
          process.exit(1);
        } else {
          console.log(`Successfully seeded exactly 10000 sales receipts and sale_items in SQLite!`);
          db.close();
          process.exit(0);
        }
      });
    });
  } catch (error) {
    console.error('Seeding process crashed:', error.message);
    process.exit(1);
  }
};

seedHeavySales();
