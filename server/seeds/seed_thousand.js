const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'database.sqlite');
console.log('Seeding products to SQLite database at:', dbPath);

const db = new sqlite3.Database(dbPath);

const brands = ['Amul', 'Tata', 'Dabur', 'Himalaya', 'Britannia', 'Parle', 'Nestle', 'Haldirams', 'Cadbury', 'Colgate', 'Dove', 'Vim', 'Surf Excel', 'Aashirvaad', 'Fortune', 'Pepsico', 'CocaCola', 'Loreal', 'Patanjali', 'MTR'];
const items = ['Butter', 'Milk', 'Cheese', 'Salt', 'Tea', 'Coffee', 'Honey', 'Toothpaste', 'Soap', 'Shampoo', 'Biscuit', 'Cookies', 'Noodles', 'Chips', 'Namkeen', 'Chocolate', 'Oil', 'Atta', 'Rice', 'Dishwash', 'Detergent', 'Juice', 'Soda', 'Hair Cream'];
const categories = ['Dairy', 'Beverages', 'Snacks', 'Grocery', 'Personal Care', 'Household', 'Other'];
const variants = ['10 Rs Pack', '20 Rs Pack', '50 Rs Pack', '50g', '100g', '200g', '500g', '1kg', '5kg', '250ml', '500ml', '1L', '2L'];
const gstSlabs = [0, 5, 12, 18, 28];

const seedThousandProducts = () => {
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // Wipe existing products
    db.run("DELETE FROM products", (err) => {
      if (err) console.error('Error clearing products:', err.message);
      else console.log('Cleared existing product records.');
    });

    const stmt = db.prepare(`
      INSERT INTO products (name, variant, barcode, category, purchasePrice, sellingPrice, stock, gstStock, nonGstStock, gstRate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 2500; i++) {
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const item = items[Math.floor(Math.random() * items.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const variant = variants[Math.floor(Math.random() * variants.length)];
      const gstRate = gstSlabs[Math.floor(Math.random() * gstSlabs.length)];

      const productName = `${brand} ${item}`;
      const barcode = `890${String(i).padStart(10, '0')}`;

      // Random pricing
      const purchasePrice = Math.floor(Math.random() * 795 + 5);
      const margin = Math.random() * 0.15 + 0.15;
      const sellingPrice = Math.floor(purchasePrice * (1 + margin));

      // Random stock quantity
      const totalStock = Math.floor(Math.random() * 141) + 10;

      let gstStock = 0;
      let nonGstStock = 0;

      const randType = Math.random();
      if (randType < 0.4) {
        gstStock = totalStock;
      } else if (randType < 0.8) {
        nonGstStock = totalStock;
      } else {
        const gstRatio = Math.random() * 0.4 + 0.4;
        gstStock = Math.round(totalStock * gstRatio);
        nonGstStock = totalStock - gstStock;
      }

      stmt.run(productName, variant, barcode, category, purchasePrice, sellingPrice, totalStock, gstStock, nonGstStock, gstRate);
    }

    stmt.finalize();

    db.run("COMMIT", (err) => {
      if (err) {
        console.error('Commit failed:', err.message);
        process.exit(1);
      } else {
        console.log(`Successfully generated and seeded 2500 unique products in SQLite!`);
        db.close();
        process.exit(0);
      }
    });
  });
};

seedThousandProducts();
