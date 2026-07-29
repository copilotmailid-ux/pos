const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'database.sqlite');
console.log('Checking database at:', dbPath);

const db = new sqlite3.Database(dbPath);

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const check = async () => {
  try {
    const sales = await all(`SELECT * FROM sales`);
    
    let sumSalesTax = 0;
    let sumGstReportTax = 0;
    let sumNonGstReportTax = 0;

    for (const s of sales) {
      sumSalesTax += s.taxAmount;
      const items = await all(`SELECT * FROM sale_items WHERE saleId = ?`, [s.id]);
      
      for (const item of items) {
        const effectiveGstQty = Math.max(0, (item.gstQuantity !== undefined ? item.gstQuantity : item.quantity) - (item.returnedQuantity || 0));
        if (effectiveGstQty > 0) {
          const itemSub = item.price * effectiveGstQty;
          const rate = item.gstRate !== undefined ? Number(item.gstRate) : 12;
          sumGstReportTax += itemSub * (rate / 100);
        }

        const returnedNonGstQty = Math.max(0, (item.returnedQuantity || 0) - (item.gstQuantity || 0));
        const effectiveNonGstQty = Math.max(0, (item.nonGstQuantity || 0) - returnedNonGstQty);
        if (effectiveNonGstQty > 0) {
          const itemSub = item.price * effectiveNonGstQty;
          const rate = item.gstRate !== undefined ? Number(item.gstRate) : 12;
          sumNonGstReportTax += itemSub * (rate / 100);
        }
      }
    }

    console.log('Sum of s.taxAmount (Sales Report):', sumSalesTax);
    console.log('Sum of GST Report Tax:', sumGstReportTax);
    console.log('Sum of Non-GST Report Tax:', sumNonGstReportTax);
    console.log('Sum of GST + Non-GST:', sumGstReportTax + sumNonGstReportTax);

    db.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

check();
