const { db, initializeDB } = require('../config/db');

const seedData = async () => {
  try {
    console.log('Initializing SQLite Database Tables...');
    await initializeDB();

    console.log('Generating seed data in memory...');
    
    // 1. Generate 100 products
    const categories = ['Grocery', 'Snacks', 'Beverages', 'Dairy', 'Personal Care', 'Household'];
    const gstSlabs = [0, 5, 12, 18, 28];
    const products = [];
    
    for (let i = 1; i <= 100; i++) {
      const category = categories[i % categories.length];
      const gstRate = gstSlabs[i % gstSlabs.length];
      const purchasePrice = parseFloat((5 + (i % 250) + Math.random()).toFixed(2));
      const sellingPrice = parseFloat((purchasePrice * 1.2).toFixed(2));
      
      products.push({
        id: i, // SQLite AUTOINCREMENT will match this sequential ID starting at 1
        name: `Product ${i}`,
        variant: `${(i % 5 + 1) * 100}g`,
        barcode: `890` + String(10000000 + i).padStart(10, '0'),
        category,
        purchasePrice,
        sellingPrice,
        stock: 200,
        gstStock: 100,
        nonGstStock: 100,
        gstRate
      });
    }

    // 2. Generate 1,000 sales
    const customers = [
      { name: 'Deva', mobile: '9360480902' },
      { name: 'Suresh Kumar', mobile: '9398989898' },
      { name: 'Ravi Teja', mobile: '9876543210' },
      { name: 'Ananya', mobile: '9123456789' }
    ];
    
    const paymentMethods = ['Cash Tendered', 'UPI / Card'];
    const sales = [];
    const allSaleItems = [];
    
    let saleItemIdCounter = 1;
    
    for (let j = 1; j <= 1000; j++) {
      // 1 to 3 items per sale
      const itemsCount = 1 + (j % 3);
      const saleItems = [];
      let subtotal = 0;
      let taxAmount = 0;
      let gstSubtotal = 0;
      let nonGstSubtotal = 0;
      let reportGstTaxSum = 0;
      let reportNonGstAmountSum = 0;
      
      for (let k = 0; k < itemsCount; k++) {
        // Pick a product deterministically to avoid pure random overhead
        const prodIndex = (j * 17 + k * 103) % products.length;
        const prod = products[prodIndex];
        const quantity = 1 + ((j + k) % 4);
        
        // 70% GST, 30% Non-GST item type classification
        const isGst = (j + k) % 10 < 7;
        
        let gstQuantity = 0;
        let nonGstQuantity = 0;
        let reportGstTax = 0;
        let reportNonGstAmount = 0;
        
        const price = prod.sellingPrice;
        const totalExcl = parseFloat((price * quantity).toFixed(2));
        const itemTax = parseFloat((totalExcl * (prod.gstRate / 100)).toFixed(2));
        
        if (isGst) {
          gstQuantity = quantity;
          reportGstTax = itemTax;
          gstSubtotal = parseFloat((gstSubtotal + totalExcl).toFixed(2));
        } else {
          nonGstQuantity = quantity;
          reportNonGstAmount = parseFloat((totalExcl + itemTax).toFixed(2));
          nonGstSubtotal = parseFloat((nonGstSubtotal + totalExcl).toFixed(2));
        }
        
        const itemTotal = parseFloat((totalExcl + itemTax).toFixed(2));
        subtotal = parseFloat((subtotal + totalExcl).toFixed(2));
        taxAmount = parseFloat((taxAmount + itemTax).toFixed(2));
        reportGstTaxSum = parseFloat((reportGstTaxSum + reportGstTax).toFixed(2));
        reportNonGstAmountSum = parseFloat((reportNonGstAmountSum + reportNonGstAmount).toFixed(2));
        
        saleItems.push({
          productId: prod.id,
          productName: prod.name,
          variant: prod.variant,
          barcode: prod.barcode,
          quantity,
          gstQuantity,
          nonGstQuantity,
          price,
          purchasePrice: prod.purchasePrice,
          total: itemTotal,
          gstRate: prod.gstRate,
          taxAmount: itemTax,
          reportGstTax,
          reportNonGstAmount
        });
      }
      
      const grandTotal = parseFloat((subtotal + taxAmount).toFixed(2));
      const cgstAmount = parseFloat((taxAmount / 2).toFixed(2));
      const sgstAmount = parseFloat((taxAmount - cgstAmount).toFixed(2));
      
      // Customer
      const isWalkin = j % 5 === 0;
      const cust = isWalkin ? { name: 'Walk-in Customer', mobile: '' } : customers[j % customers.length];
      
      // Payment & Dates
      const paymentMethod = paymentMethods[j % paymentMethods.length];
      const amountPaid = paymentMethod === 'UPI / Card' ? grandTotal : Math.ceil(grandTotal / 10) * 10;
      const changeReturned = parseFloat((amountPaid - grandTotal).toFixed(2));
      
      // Date spread: spread over the last 180 days using ISO format
      const daysAgo = Math.floor((j / 1000) * 180);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(8 + (j % 12), (j * 7) % 60, (j * 13) % 60, 0);
      const createdAt = date.toISOString();
      
      sales.push({
        id: j, // SQLite AUTOINCREMENT will match this sequential ID
        invoiceNo: `INV-${String(j).padStart(7, '0')}`,
        customerMobile: cust.mobile,
        customerName: cust.name,
        paymentMethod,
        amountPaid,
        changeReturned,
        subtotal: parseFloat(subtotal.toFixed(2)),
        gstSubtotal: parseFloat(gstSubtotal.toFixed(2)),
        nonGstSubtotal: parseFloat(nonGstSubtotal.toFixed(2)),
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        cgstAmount,
        sgstAmount,
        grandTotal,
        reportGstTax: parseFloat(reportGstTaxSum.toFixed(2)),
        reportNonGstAmount: parseFloat(reportNonGstAmountSum.toFixed(2)),
        status: 'Completed',
        createdAt,
        updatedAt: createdAt,
        items: saleItems
      });
    }

    console.log('Writing to database...');
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
      db.run(`INSERT INTO counters (id, seq) VALUES ('invoiceNo', 10000)`);

      // 1. Seed Suppliers
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

      // 2. Seed Customers
      const customerStmt = db.prepare(`
        INSERT INTO customers (name, mobile)
        VALUES (?, ?)
      `);
      for (const cust of customers) {
        customerStmt.run([cust.name, cust.mobile]);
      }
      customerStmt.finalize();

      // 3. Seed Products (7,000 rows)
      const productStmt = db.prepare(`
        INSERT INTO products (id, name, variant, barcode, category, purchasePrice, sellingPrice, stock, gstStock, nonGstStock, gstRate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of products) {
        productStmt.run([p.id, p.name, p.variant, p.barcode, p.category, p.purchasePrice, p.sellingPrice, p.stock, p.gstStock, p.nonGstStock, p.gstRate]);
      }
      productStmt.finalize();
      console.log('100 Products registered successfully.');

      // 4. Seed Sales & Sale Items (1,000 sales + items)
      const saleStmt = db.prepare(`
        INSERT INTO sales (id, invoiceNo, customerMobile, customerName, paymentMethod, amountPaid, changeReturned, subtotal, gstSubtotal, nonGstSubtotal, taxAmount, cgstAmount, sgstAmount, grandTotal, reportGstTax, reportNonGstAmount, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const itemStmt = db.prepare(`
        INSERT INTO sale_items (saleId, productId, productName, variant, barcode, quantity, gstQuantity, nonGstQuantity, price, purchasePrice, total, gstRate, taxAmount, reportGstTax, reportNonGstAmount, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of sales) {
        saleStmt.run([
          s.id, s.invoiceNo, s.customerMobile, s.customerName, s.paymentMethod,
          s.amountPaid, s.changeReturned, s.subtotal, s.gstSubtotal, s.nonGstSubtotal,
          s.taxAmount, s.cgstAmount, s.sgstAmount, s.grandTotal, s.reportGstTax,
          s.reportNonGstAmount, s.status, s.createdAt, s.updatedAt
        ]);
        
        for (const item of s.items) {
          itemStmt.run([
            s.id, item.productId, item.productName, item.variant, item.barcode,
            item.quantity, item.gstQuantity, item.nonGstQuantity, item.price,
            item.purchasePrice, item.total, item.gstRate, item.taxAmount,
            item.reportGstTax, item.reportNonGstAmount, s.createdAt, s.updatedAt
          ]);
        }
      }
      
      saleStmt.finalize();
      itemStmt.finalize();
      console.log('1,000 Sales with items registered successfully.');

      db.run("COMMIT", (err) => {
        if (err) {
          console.error('Commit failed:', err.message);
          process.exit(1);
        } else {
          console.log('\n--- Seeding Process Completed Successfully ---');
          console.log('Products seeded: 100');
          console.log('Sales transactions seeded: 1,000');
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
