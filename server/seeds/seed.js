const { db, initializeDB, run } = require('../config/db');

const seedData = async () => {
  try {
    console.log('Initializing SQLite Database Tables...');
    await initializeDB();

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      // Clear existing data
      db.run("DELETE FROM products");
      db.run("DELETE FROM suppliers");
      db.run("DELETE FROM customers");
      db.run("DELETE FROM sales");
      db.run("DELETE FROM sale_items");
      db.run("DELETE FROM purchases");
      db.run("DELETE FROM purchase_items");
      db.run("DELETE FROM counters");

      // Seed initial counters row
      db.run(`INSERT INTO counters (id, seq) VALUES ('invoiceNo', 0)`);

      // 1. Create Supplier A (GST) and Supplier B (Non-GST)
      const suppliers = [
        ['Supplier A (GST Tax Invoices)', 'GST', 'Anand Kumar', '9876543210', 'anand@supplier-a.com', 'GST Trade Complex, Chennai', '33AAAAA0000A1Z5'],
        ['Supplier B (Non-GST / Local Wholesale)', 'Non-GST', 'Bala Subbu', '9444123456', 'bala@supplier-b.com', 'Wholesale Market, Madurai', '']
      ];

      const supplierStmt = db.prepare(`
        INSERT INTO suppliers (name, supplierType, contactPerson, phone, email, address, gstin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const sup of suppliers) {
        supplierStmt.run(sup);
      }
      supplierStmt.finalize();
      console.log('Suppliers registered (Supplier A - GST & Supplier B - Non-GST)');

      // 2. Create customer registry profiles
      const customers = [
        ['Deva', '9360480902'],
        ['Suresh Kumar', '9398989898'],
        ['Ravi Teja', '9876543210'],
        ['Ananya', '9123456789']
      ];

      const customerStmt = db.prepare(`
        INSERT INTO customers (name, mobile)
        VALUES (?, ?)
      `);

      for (const cust of customers) {
        customerStmt.run(cust);
      }
      customerStmt.finalize();
      console.log('Loyal customer profiles registered');

      // 3. Create products
      const products = [
        ['Dabur Red Paste', '10 Rs', '8901207010', 'Personal Care', 8.0, 10.0, 100, 50, 50, 18],
        ['Dabur Red Paste', '20 Rs', '8901207020', 'Personal Care', 16.0, 20.0, 35, 25, 10, 18],
        ['Amul Milk', '500ml', '8901262050', 'Dairy', 24.0, 28.0, 60, 40, 20, 5],
        ['Coca Cola', '250ml Can', '8901764025', 'Beverages', 28.0, 35.0, 40, 30, 10, 28],
        ['Lays Classic', '20g', '8901491020', 'Snacks', 8.5, 10.0, 150, 100, 50, 12],
        ['Aashirvaad Atta', '5kg', '8901725181', 'Grocery', 240.0, 285.0, 15, 10, 5, 5],
        ['Fortune Sunflower Oil', '1L Pouch', '8906007281', 'Grocery', 130.0, 155.0, 25, 20, 5, 5]
      ];

      const productStmt = db.prepare(`
        INSERT INTO products (name, variant, barcode, category, purchasePrice, sellingPrice, stock, gstStock, nonGstStock, gstRate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const prod of products) {
        productStmt.run(prod);
      }
      productStmt.finalize();
      console.log('Dual-stock products seeded (GST Stock + Non-GST Stock)');

      db.run("COMMIT", (err) => {
        if (err) {
          console.error('Commit failed:', err.message);
          process.exit(1);
        } else {
          console.log('\n--- Seeding Process Completed Successfully ---');
          console.log('Unlock Passcode: admin123');
          db.close();
          process.exit(0);
        }
      });
    });
  } catch (error) {
    console.error('Seeding critical failure:', error.message);
    process.exit(1);
  }
};

seedData();
