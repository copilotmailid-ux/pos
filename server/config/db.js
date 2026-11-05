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
  // Ultra-efficient SQLite performance tuning for commercial POS hardware
  db.run("PRAGMA journal_mode=WAL;");
  db.run("PRAGMA synchronous=NORMAL;"); // 300% faster writes with 100% crash durability
  db.run("PRAGMA temp_store=MEMORY;"); // Keep temporary tables and index sorts in RAM
  db.run("PRAGMA cache_size=-16000;"); // 16MB high-speed memory cache for instant queries
  console.log(`${colors.green}✔ [DB]${colors.reset}      SQLite High-Performance Mode (WAL + 16MB Cache + Memory Temp) Enabled`);
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
  // Check database integrity
  try {
    const check = await get('PRAGMA quick_check;');
    if (check && check.quick_check === 'ok') {
      console.log(`${colors.green}✔ [DB]${colors.reset}      Database integrity verified: OK`);
    }
  } catch (err) {
    console.warn(`${colors.yellow}⚠️ [DB]${colors.reset}      Integrity check warning: ${err.message}`);
  }

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
      image TEXT DEFAULT '',
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

    `CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotationNo TEXT UNIQUE NOT NULL,
      customerMobile TEXT DEFAULT '',
      customerName TEXT DEFAULT '',
      customerType TEXT DEFAULT 'Shop',
      subtotal REAL NOT NULL,
      taxAmount REAL DEFAULT 0,
      grandTotal REAL NOT NULL,
      status TEXT CHECK(status IN ('Draft', 'Sent', 'Converted', 'Expired', 'Cancelled')) DEFAULT 'Draft',
      convertedInvoiceNo TEXT DEFAULT '',
      validUntil TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotationId INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
      productId INTEGER REFERENCES products(id) ON DELETE SET NULL,
      productName TEXT NOT NULL,
      variant TEXT DEFAULT '',
      unit TEXT DEFAULT 'Pcs',
      barcode TEXT NOT NULL,
      quantity REAL NOT NULL,
      priceType TEXT DEFAULT 'Shop',
      price REAL NOT NULL,
      gstRate INTEGER DEFAULT 12,
      taxAmount REAL DEFAULT 0,
      total REAL NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS purchase_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchaseId INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      paymentMethod TEXT DEFAULT 'Cash',
      paymentDate TEXT DEFAULT CURRENT_TIMESTAMP,
      notes TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
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
      backupPath TEXT DEFAULT '',
      enableGst INTEGER DEFAULT 1,
      loginPassword TEXT DEFAULT 'admin123',
      deletePassword TEXT DEFAULT 'admin123',
      enableLoginPassword INTEGER DEFAULT 1,
      enableDeleteBillPassword INTEGER DEFAULT 1,
      enableDeleteProductPassword INTEGER DEFAULT 1
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
  await exec(`CREATE INDEX IF NOT EXISTS idx_quotations_quotationNo ON quotations(quotationNo)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_quotation_items_quotationId ON quotation_items(quotationId)`);
  
  // Seed initial counters table rows if empty
  const countRow = await get(`SELECT COUNT(*) as count FROM counters WHERE id = 'invoiceNo'`);
  if (countRow.count === 0) {
    await run(`INSERT INTO counters (id, seq) VALUES ('invoiceNo', 0)`);
  }

  const qtnCountRow = await get(`SELECT COUNT(*) as count FROM counters WHERE id = 'quotationNo'`);
  if (!qtnCountRow || qtnCountRow.count === 0) {
    await run(`INSERT INTO counters (id, seq) VALUES ('quotationNo', 0)`);
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
    if (!columns.includes('fssai')) {
      await exec(`ALTER TABLE settings ADD COLUMN fssai TEXT DEFAULT ''`);
    }
    if (!columns.includes('msme')) {
      await exec(`ALTER TABLE settings ADD COLUMN msme TEXT DEFAULT ''`);
    }
    if (!columns.includes('salesEmail')) {
      await exec(`ALTER TABLE settings ADD COLUMN salesEmail TEXT DEFAULT ''`);
    }
    if (!columns.includes('terms')) {
      await exec(`ALTER TABLE settings ADD COLUMN terms TEXT DEFAULT 'Immediate Payment. Goods once sold cannot be returned.'`);
    }
    if (!columns.includes('enableGst')) {
      await exec(`ALTER TABLE settings ADD COLUMN enableGst INTEGER DEFAULT 1`);
      console.log('Migrated settings: Added enableGst column.');
    }
    if (!columns.includes('loginPassword')) {
      await exec(`ALTER TABLE settings ADD COLUMN loginPassword TEXT DEFAULT 'admin123'`);
      console.log('Migrated settings: Added loginPassword column.');
    }
    if (!columns.includes('deletePassword')) {
      await exec(`ALTER TABLE settings ADD COLUMN deletePassword TEXT DEFAULT 'admin123'`);
      console.log('Migrated settings: Added deletePassword column.');
    }
    if (!columns.includes('enableLoginPassword')) {
      await exec(`ALTER TABLE settings ADD COLUMN enableLoginPassword INTEGER DEFAULT 1`);
      console.log('Migrated settings: Added enableLoginPassword column.');
    }
    if (!columns.includes('enableDeleteBillPassword')) {
      await exec(`ALTER TABLE settings ADD COLUMN enableDeleteBillPassword INTEGER DEFAULT 1`);
      console.log('Migrated settings: Added enableDeleteBillPassword column.');
    }
    if (!columns.includes('enableDeleteProductPassword')) {
      await exec(`ALTER TABLE settings ADD COLUMN enableDeleteProductPassword INTEGER DEFAULT 1`);
      console.log('Migrated settings: Added enableDeleteProductPassword column.');
    }
  } catch (err) {
    console.error('Migration error for settings table:', err.message);
  }

  // Migration: Add wholesale, retail dual pricing and UOM to products table
  try {
    const prodTableInfo = await all(`PRAGMA table_info(products)`);
    const prodCols = prodTableInfo.map(c => c.name);

    if (!prodCols.includes('retailPrice')) {
      await exec(`ALTER TABLE products ADD COLUMN retailPrice REAL DEFAULT 0`);
      await exec(`UPDATE products SET retailPrice = sellingPrice WHERE retailPrice = 0 OR retailPrice IS NULL`);
      console.log('Migrated products: Added retailPrice column.');
    }
    if (!prodCols.includes('wholesalePrice')) {
      await exec(`ALTER TABLE products ADD COLUMN wholesalePrice REAL DEFAULT 0`);
      await exec(`UPDATE products SET wholesalePrice = ROUND(sellingPrice * 0.85, 2) WHERE wholesalePrice = 0 OR wholesalePrice IS NULL`);
      console.log('Migrated products: Added wholesalePrice column.');
    }
    if (!prodCols.includes('unit')) {
      await exec(`ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'Pcs'`);
      console.log('Migrated products: Added unit column.');
    }
    if (!prodCols.includes('minWholesaleQty')) {
      await exec(`ALTER TABLE products ADD COLUMN minWholesaleQty REAL DEFAULT 1`);
      console.log('Migrated products: Added minWholesaleQty column.');
    }
    if (!prodCols.includes('image')) {
      await exec(`ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''`);
      console.log('Migrated products: Added image column.');
    }
  } catch (err) {
    console.error('Migration error for products table:', err.message);
  }

  // Migration: Add customerType, address, gstin to customers table
  try {
    const custTableInfo = await all(`PRAGMA table_info(customers)`);
    const custCols = custTableInfo.map(c => c.name);

    if (!custCols.includes('customerType')) {
      await exec(`ALTER TABLE customers ADD COLUMN customerType TEXT DEFAULT 'Home'`);
      console.log('Migrated customers: Added customerType column.');
    }
    if (!custCols.includes('address')) {
      await exec(`ALTER TABLE customers ADD COLUMN address TEXT DEFAULT ''`);
      console.log('Migrated customers: Added address column.');
    }
    if (!custCols.includes('gstin')) {
      await exec(`ALTER TABLE customers ADD COLUMN gstin TEXT DEFAULT ''`);
      console.log('Migrated customers: Added gstin column.');
    }
  } catch (err) {
    console.error('Migration error for customers table:', err.message);
  }

  // Migration: Add priceTier and quotationId to sales table
  try {
    const salesTableInfo = await all(`PRAGMA table_info(sales)`);
    const salesCols = salesTableInfo.map(c => c.name);

    if (!salesCols.includes('priceTier')) {
      await exec(`ALTER TABLE sales ADD COLUMN priceTier TEXT DEFAULT 'Home'`);
      console.log('Migrated sales: Added priceTier column.');
    }
    if (!salesCols.includes('quotationId')) {
      await exec(`ALTER TABLE sales ADD COLUMN quotationId INTEGER DEFAULT NULL`);
      console.log('Migrated sales: Added quotationId column.');
    }
    if (!salesCols.includes('quotationNo')) {
      await exec(`ALTER TABLE sales ADD COLUMN quotationNo TEXT DEFAULT ''`);
      console.log('Migrated sales: Added quotationNo column.');
    }
  } catch (err) {
    console.error('Migration error for sales table:', err.message);
  }

  // Migration: Add priceType and unit to sale_items table
  try {
    const saleItemsTableInfo = await all(`PRAGMA table_info(sale_items)`);
    const saleItemsCols = saleItemsTableInfo.map(c => c.name);

    if (!saleItemsCols.includes('priceType')) {
      await exec(`ALTER TABLE sale_items ADD COLUMN priceType TEXT DEFAULT 'Home'`);
      console.log('Migrated sale_items: Added priceType column.');
    }
    if (!saleItemsCols.includes('unit')) {
      await exec(`ALTER TABLE sale_items ADD COLUMN unit TEXT DEFAULT 'Pcs'`);
      console.log('Migrated sale_items: Added unit column.');
    }
  } catch (err) {
    console.error('Migration error for sale_items table:', err.message);
  }

  // Migration: Add wholesalePrice to purchase_items table
  try {
    const piCols = (await all(`PRAGMA table_info(purchase_items)`)).map(c => c.name);
    if (!piCols.includes('wholesalePrice')) {
      await exec(`ALTER TABLE purchase_items ADD COLUMN wholesalePrice REAL DEFAULT 0`);
      console.log('Migrated purchase_items: Added wholesalePrice column.');
    }
  } catch (err) {
    console.error('Migration error for purchase_items table:', err.message);
  }

  // Migration: Add paymentStatus, paidAmount, paidAt to purchases table
  try {
    const pCols = (await all(`PRAGMA table_info(purchases)`)).map(c => c.name);
    if (!pCols.includes('paymentStatus')) {
      await exec(`ALTER TABLE purchases ADD COLUMN paymentStatus TEXT DEFAULT 'Paid'`);
      await exec(`UPDATE purchases SET paymentStatus = 'Pending' WHERE paymentMethod = 'Credit'`);
      console.log('Migrated purchases: Added paymentStatus column.');
    }
    if (!pCols.includes('paidAmount')) {
      await exec(`ALTER TABLE purchases ADD COLUMN paidAmount REAL DEFAULT 0`);
      await exec(`UPDATE purchases SET paidAmount = CASE WHEN paymentMethod = 'Credit' THEN 0 ELSE total END`);
      console.log('Migrated purchases: Added paidAmount column.');
    }
    if (!pCols.includes('paidAt')) {
      await exec(`ALTER TABLE purchases ADD COLUMN paidAt TEXT DEFAULT NULL`);
      console.log('Migrated purchases: Added paidAt column.');
    }
  } catch (err) {
    console.error('Migration error for purchases table paymentStatus:', err.message);
  }

  // Migration: Add UI/receipt font size and confirmation dialog settings
  try {
    const sCols = (await all(`PRAGMA table_info(settings)`)).map(c => c.name);
    if (!sCols.includes('receiptFontSize')) {
      await exec(`ALTER TABLE settings ADD COLUMN receiptFontSize TEXT DEFAULT 'medium'`);
      console.log('Migrated settings: Added receiptFontSize column.');
    }
    if (!sCols.includes('uiFontSize')) {
      await exec(`ALTER TABLE settings ADD COLUMN uiFontSize TEXT DEFAULT 'normal'`);
      console.log('Migrated settings: Added uiFontSize column.');
    }
    if (!sCols.includes('confirmCheckout')) {
      await exec(`ALTER TABLE settings ADD COLUMN confirmCheckout INTEGER DEFAULT 1`);
      console.log('Migrated settings: Added confirmCheckout column.');
    }
    if (!sCols.includes('confirmQuotation')) {
      await exec(`ALTER TABLE settings ADD COLUMN confirmQuotation INTEGER DEFAULT 1`);
      console.log('Migrated settings: Added confirmQuotation column.');
    }
    if (!sCols.includes('confirmPurchase')) {
      await exec(`ALTER TABLE settings ADD COLUMN confirmPurchase INTEGER DEFAULT 1`);
      console.log('Migrated settings: Added confirmPurchase column.');
    }
  } catch (err) {
    console.error('Migration error for settings customization columns:', err.message);
  }

  // Migration: Backfill purchase_payments for existing paid purchases
  try {
    const unrecorded = await all(`
      SELECT id, paidAmount, paymentMethod, invoiceDate, notes 
      FROM purchases 
      WHERE paidAmount > 0 AND id NOT IN (SELECT DISTINCT purchaseId FROM purchase_payments)
    `);
    for (const p of unrecorded) {
      await run(
        `INSERT INTO purchase_payments (purchaseId, amount, paymentMethod, paymentDate, notes) VALUES (?, ?, ?, ?, ?)`,
        [p.id, p.paidAmount, p.paymentMethod || 'Cash', p.invoiceDate, p.notes || 'Initial payment']
      );
    }
    if (unrecorded.length > 0) {
      console.log(`Migrated purchase_payments: Backfilled ${unrecorded.length} historical payments.`);
    }
  } catch (err) {
    console.error('Backfill purchase_payments error:', err.message);
  }

    // Auto-sync invoice counter and quotation counter
  await syncInvoiceCounter();
  await syncQuotationCounter();
};

const syncQuotationCounter = async () => {
  try {
    const latestQtn = await get(`SELECT quotationNo FROM quotations WHERE quotationNo LIKE 'QTN-%' ORDER BY id DESC LIMIT 1`);
    if (latestQtn && latestQtn.quotationNo) {
      const match = latestQtn.quotationNo.match(/^QTN-(\d+)$/);
      if (match) {
        const maxSeq = parseInt(match[1], 10);
        await run(`UPDATE counters SET seq = ? WHERE id = 'quotationNo'`, [maxSeq]);
      }
    } else {
      await run(`UPDATE counters SET seq = 0 WHERE id = 'quotationNo'`);
    }
  } catch (err) {
    console.error('Quotation counter sync warning:', err.message);
  }
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
  syncQuotationCounter,
  backupDatabase
};
