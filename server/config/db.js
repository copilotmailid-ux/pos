const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m',
  red: '\x1b[31m'
};

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'database.sqlite');
console.log(`${colors.blue}ℹ [DB]${colors.reset}      Database path: ${colors.dim}${dbPath}${colors.reset}`);

// Ensure parent directory exists
const parentDir = path.dirname(dbPath);
if (!fs.existsSync(parentDir)) {
  fs.mkdirSync(parentDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Enable WAL (Write-Ahead Logging) mode
db.serialize(() => {
  db.run("PRAGMA journal_mode=WAL;", (err) => {
    if (err) {
      console.error(`${colors.red}✖ [DB]${colors.reset}      Failed to enable WAL mode: ${err.message}`);
    } else {
      console.log(`${colors.green}✔ [DB]${colors.reset}      SQLite WAL (Write-Ahead Logging) Mode Enabled`);
    }
  });
});

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
    )`,

    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      storeName TEXT DEFAULT 'SuperMart',
      storeAddress TEXT DEFAULT '123, Main Street, City',
      storePhone TEXT DEFAULT '+91 9876543210',
      storeGstin TEXT DEFAULT '00AAAAA0000A0Z0',
      receiptFooter TEXT DEFAULT 'Thank you for shopping with us!',
      defaultPaymentMethod TEXT DEFAULT 'Cash Tendered',
      defaultGstRate INTEGER DEFAULT 12,
      backupRetention INTEGER DEFAULT 5,
      autoPrint INTEGER DEFAULT 0,
      barcodeAutoSubmit INTEGER DEFAULT 1,
      storeLogo TEXT DEFAULT '',
      printerName TEXT DEFAULT '',
      paperSize TEXT DEFAULT '80mm',
      backupPath TEXT DEFAULT ''
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

  // Seed initial settings table row if empty
  const settingsCountRow = await get(`SELECT COUNT(*) as count FROM settings`);
  if (settingsCountRow.count === 0) {
    await run(`
      INSERT INTO settings (id, storeName, storeAddress, storePhone, storeGstin, receiptFooter, defaultPaymentMethod, defaultGstRate, backupRetention, autoPrint, barcodeAutoSubmit, storeLogo, printerName, paperSize)
      VALUES (1, 'SuperMart', '123, Main Street, City', '+91 9876543210', '00AAAAA0000A0Z0', 'Thank you for shopping with us!', 'Cash Tendered', 12, 5, 0, 1, '', '', '80mm')
    `);
  }

  // Migration: Add new columns if missing from existing settings table
  try {
    const tableInfo = await all(`PRAGMA table_info(settings)`);
    const columns = tableInfo.map(c => c.name);
    
    if (!columns.includes('storeLogo')) {
      await exec(`ALTER TABLE settings ADD COLUMN storeLogo TEXT DEFAULT ''`);
      console.log('Migrated settings: Added storeLogo column.');
    }
    if (!columns.includes('printerName')) {
      await exec(`ALTER TABLE settings ADD COLUMN printerName TEXT DEFAULT ''`);
      console.log('Migrated settings: Added printerName column.');
    }
    if (!columns.includes('paperSize')) {
      await exec(`ALTER TABLE settings ADD COLUMN paperSize TEXT DEFAULT '80mm'`);
      console.log('Migrated settings: Added paperSize column.');
    }
    if (!columns.includes('backupPath')) {
      await exec(`ALTER TABLE settings ADD COLUMN backupPath TEXT DEFAULT ''`);
      console.log('Migrated settings: Added backupPath column.');
    }
  } catch (err) {
    console.error('Migration error for settings table:', err.message);
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

const backupDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      const backupsDir = path.join(path.dirname(dbPath), 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const now = new Date();
      const localTimestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .replace(/Z$/, '')
        .replace(/[:.]/g, '-');
      const backupFile = path.join(backupsDir, `backup_${localTimestamp}.sqlite`);

      // SQLite atomic VACUUM INTO copies active WAL and main db into a single consolidated file
      db.run(`VACUUM INTO ?`, [backupFile], (err) => {
        if (err) {
          console.error(`${colors.red}✖ [BACKUP]${colors.reset}  Database backup failed: ${err.message}`);
          reject(err);
        } else {
          console.log(`${colors.green}📦 [BACKUP]${colors.reset}  Database backup saved to: ${colors.dim}${backupFile}${colors.reset}`);
          cleanOldBackups(backupsDir, 5);
          resolve(backupFile);
        }
      });
    } catch (err) {
      console.error(`${colors.red}✖ [BACKUP]${colors.reset}  Database backup error: ${err.message}`);
      reject(err);
    }
  });
};

const cleanOldBackups = (dir, keepCount) => {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .map(f => ({
        name: f,
        path: path.join(dir, f),
        time: fs.statSync(path.join(dir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Newest first

    if (files.length > keepCount) {
      const extraFiles = files.slice(keepCount);
      for (const file of extraFiles) {
        fs.unlinkSync(file.path);
        console.log(`${colors.yellow}🧹 [CLEANUP]${colors.reset} Deleted old backup: ${colors.dim}${file.name}${colors.reset}`);
      }
    }
  } catch (err) {
    console.error(`${colors.red}✖ [CLEANUP]${colors.reset} Error cleaning old backups: ${err.message}`);
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
  syncInvoiceCounter,
  backupDatabase
};
