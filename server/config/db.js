const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'database.sqlite');
console.log('Using SQLite database at:', dbPath);

// Ensure parent directory exists
const parentDir = path.dirname(dbPath);
if (!fs.existsSync(parentDir)) {
  fs.mkdirSync(parentDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

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

const exec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// SQLite Transaction helper
const transaction = async (callback) => {
  await exec('BEGIN TRANSACTION');
  try {
    const result = await callback();
    await exec('COMMIT');
    return result;
  } catch (error) {
    await exec('ROLLBACK');
    throw error;
  }
};

const initializeDB = async () => {
  // Create tables sequentially to ensure integrity
  const tables = [
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      variant TEXT DEFAULT '',
      barcode TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      purchasePrice REAL NOT NULL,
      sellingPrice REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      gstStock INTEGER DEFAULT 0,
      nonGstStock INTEGER DEFAULT 0,
      gstRate INTEGER DEFAULT 12,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mobile TEXT UNIQUE NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      supplierType TEXT CHECK(supplierType IN ('GST', 'Non-GST')) DEFAULT 'GST',
      contactPerson TEXT DEFAULT '',
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchaseNumber TEXT UNIQUE NOT NULL,
      supplierId INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      purchaseTaxType TEXT CHECK(purchaseTaxType IN ('GST', 'Non-GST')) DEFAULT 'GST',
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      total REAL NOT NULL,
      paymentMethod TEXT CHECK(paymentMethod IN ('Cash', 'Bank Transfer', 'UPI', 'Credit')) DEFAULT 'Cash',
      status TEXT CHECK(status IN ('Received', 'Returned', 'Partially Returned')) DEFAULT 'Received',
      invoiceDate TEXT DEFAULT CURRENT_TIMESTAMP,
      notes TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchaseId INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
      productId INTEGER REFERENCES products(id) ON DELETE SET NULL,
      productName TEXT NOT NULL,
      variant TEXT DEFAULT '',
      barcode TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      purchasePrice REAL NOT NULL,
      sellingPrice REAL NOT NULL,
      gstRate INTEGER DEFAULT 12,
      total REAL NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNo TEXT UNIQUE NOT NULL,
      customerMobile TEXT DEFAULT '',
      customerName TEXT DEFAULT '',
      paymentMethod TEXT DEFAULT 'Cash Tendered',
      amountPaid REAL DEFAULT 0,
      changeReturned REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      gstSubtotal REAL DEFAULT 0,
      nonGstSubtotal REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      cgstAmount REAL DEFAULT 0,
      sgstAmount REAL DEFAULT 0,
      grandTotal REAL NOT NULL,
      reportGstTax REAL DEFAULT 0,
      reportNonGstAmount REAL DEFAULT 0,
      status TEXT CHECK(status IN ('Completed', 'Cancelled', 'Returned', 'Partially Returned')) DEFAULT 'Completed',
      returnReason TEXT DEFAULT '',
      returnedAmount REAL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saleId INTEGER REFERENCES sales(id) ON DELETE CASCADE,
      productId INTEGER REFERENCES products(id) ON DELETE SET NULL,
      productName TEXT NOT NULL,
      variant TEXT DEFAULT '',
      barcode TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      gstQuantity INTEGER DEFAULT 0,
      nonGstQuantity INTEGER DEFAULT 0,
      price REAL NOT NULL,
      purchasePrice REAL DEFAULT 0,
      total REAL NOT NULL,
      gstRate INTEGER DEFAULT 12,
      taxAmount REAL DEFAULT 0,
      reportGstTax REAL DEFAULT 0,
      reportNonGstAmount REAL DEFAULT 0,
      returnedQuantity INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY,
      seq INTEGER DEFAULT 0
    )`
  ];

  for (const tableSql of tables) {
    await exec(tableSql);
  }

  // Create helper indexes if they do not exist
  await exec(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_sales_invoiceNo ON sales(invoiceNo)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_sales_createdAt ON sales(createdAt)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_saleId ON sale_items(saleId)`);
  
  // Seed initial counters table row if empty
  const countRow = await get(`SELECT COUNT(*) as count FROM counters WHERE id = 'invoiceNo'`);
  if (countRow.count === 0) {
    await run(`INSERT INTO counters (id, seq) VALUES ('invoiceNo', 0)`);
  }

  // Auto-sync invoice counter based on existing sales records
  await syncInvoiceCounter();
};

const syncInvoiceCounter = async () => {
  try {
    const latestSale = await get(`SELECT invoiceNo FROM sales WHERE invoiceNo LIKE 'INV-%' ORDER BY id DESC LIMIT 1`);
    if (latestSale && latestSale.invoiceNo) {
      const match = latestSale.invoiceNo.match(/^INV-(\d+)$/);
      if (match) {
        const maxSeq = parseInt(match[1], 10);
        await run(`UPDATE counters SET seq = ? WHERE id = 'invoiceNo'`, [maxSeq]);
      }
    } else {
      await run(`UPDATE counters SET seq = 0 WHERE id = 'invoiceNo'`);
    }
  } catch (err) {
    console.error('Invoice counter sync warning:', err.message);
  }
};

module.exports = {
  db,
  get,
  all,
  run,
  exec,
  transaction,
  initializeDB,
  syncInvoiceCounter
};
