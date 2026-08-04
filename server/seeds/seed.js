const { db, initializeDB } = require('../config/db');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const seedData = async () => {
  try {
    console.log('Initializing SQLite Database Tables...');
    await initializeDB();

    console.log('Generating seed data in memory...');
    
    // 1. Generate 2,000 real products
    const productTemplates = [
      { name: 'Basmati Premium Rice', category: 'Grocery', variants: ['1kg', '5kg', '10kg'], basePrice: 90, brand: 'Aashirvaad' },
      { name: 'Toor Dal Premium', category: 'Grocery', variants: ['500g', '1kg'], basePrice: 120, brand: 'Tata Sampann' },
      { name: 'Refined Sunflower Oil', category: 'Grocery', variants: ['1L', '5L'], basePrice: 140, brand: 'Fortune' },
      { name: 'Chakki Fresh Atta', category: 'Grocery', variants: ['1kg', '5kg', '10kg'], basePrice: 45, brand: 'Aashirvaad' },
      { name: 'Refined Sugar', category: 'Grocery', variants: ['1kg', '2kg'], basePrice: 42, brand: 'Madhur' },
      { name: 'Iodized Crystal Salt', category: 'Grocery', variants: ['1kg'], basePrice: 22, brand: 'Tata' },
      { name: 'Classic Potato Chips', category: 'Snacks', variants: ['50g', '100g'], basePrice: 20, brand: 'Lays' },
      { name: 'Good Day Cashew Cookies', category: 'Snacks', variants: ['120g', '250g'], basePrice: 35, brand: 'Britannia' },
      { name: 'Salted Kaju', category: 'Snacks', variants: ['100g', '200g'], basePrice: 160, brand: 'Haldiram\'s' },
      { name: 'Moong Dal Namkeen', category: 'Snacks', variants: ['150g', '350g'], basePrice: 30, brand: 'Haldiram\'s' },
      { name: 'Real Orange Juice', category: 'Beverages', variants: ['200ml', '1L'], basePrice: 25, brand: 'Real' },
      { name: 'Green Tea Leaves', category: 'Beverages', variants: ['25 bags', '50 bags'], basePrice: 110, brand: 'Lipton' },
      { name: 'Classic Blend Coffee', category: 'Beverages', variants: ['50g', '100g'], basePrice: 165, brand: 'Nescafe' },
      { name: 'Taaza Tea Powder', category: 'Beverages', variants: ['250g', '500g'], basePrice: 90, brand: 'Brooke Bond' },
      { name: 'Fresh Pasteurised Milk', category: 'Dairy', variants: ['500ml', '1L'], basePrice: 28, brand: 'Amul Taaza' },
      { name: 'Malai Paneer Block', category: 'Dairy', variants: ['200g', '500g'], basePrice: 85, brand: 'Amul' },
      { name: 'Pasteurised Salted Butter', category: 'Dairy', variants: ['100g', '500g'], basePrice: 56, brand: 'Amul' },
      { name: 'Cheese Slices Premium', category: 'Dairy', variants: ['100g', '200g'], basePrice: 95, brand: 'Amul' },
      { name: 'Original Aloe Vera Soap', category: 'Personal Care', variants: ['125g', '3x125g'], basePrice: 42, brand: 'Dettol' },
      { name: 'Anti-Hairfall Shampoo', category: 'Personal Care', variants: ['180ml', '360ml'], basePrice: 145, brand: 'Clinic Plus' },
      { name: 'MaxFresh Toothpaste', category: 'Personal Care', variants: ['150g', '300g'], basePrice: 90, brand: 'Colgate' },
      { name: 'Original Liquid Handwash', category: 'Personal Care', variants: ['200ml', '750ml Refill'], basePrice: 89, brand: 'Dettol' },
      { name: 'Vim Dishwash Gel', category: 'Household', variants: ['250ml', '750ml'], basePrice: 55, brand: 'Vim' },
      { name: 'Surf Excel Easy Wash', category: 'Household', variants: ['1kg', '3kg'], basePrice: 135, brand: 'Surf Excel' },
      { name: 'Harpic Toilet Cleaner', category: 'Household', variants: ['500ml', '1L'], basePrice: 86, brand: 'Harpic' },
      { name: 'Colin Glass Cleaner', category: 'Household', variants: ['500ml'], basePrice: 95, brand: 'Colin' },
      { name: 'Premium Garbage Bags', category: 'Household', variants: ['30 bags', '60 bags'], basePrice: 120, brand: 'Shine' }
    ];
    const gstSlabs = [0, 5, 12, 18, 28];
    const products = [];
    
    for (let i = 1; i <= 2000; i++) {
      const template = productTemplates[i % productTemplates.length];
      const gstRate = gstSlabs[i % gstSlabs.length];
      const variantIdx = i % template.variants.length;
      const variant = template.variants[variantIdx];
      const batchNum = Math.floor(i / productTemplates.length) + 1;
      const basePriceFactor = 1 + (batchNum * 0.02) + (Math.random() * 0.05);
      const purchasePrice = round2(template.basePrice * (variantIdx + 1) * basePriceFactor);
      const sellingPrice = round2(purchasePrice * 1.15);
      
      products.push({
        id: i,
        name: `${template.brand} ${template.name} - Batch ${batchNum}`,
        variant,
        barcode: `890` + String(10000000 + i).padStart(10, '0'),
        category: template.category,
        purchasePrice,
        sellingPrice,
        stock: 300,
        gstStock: 150,
        nonGstStock: 150,
        gstRate
      });
    }

    // 2. Generate 30,000 sales
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
    
    for (let j = 1; j <= 30000; j++) {
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
        const totalExcl = round2(price * quantity);
        const itemTax = round2(totalExcl * (prod.gstRate / 100));
        
        if (isGst) {
          gstQuantity = quantity;
          reportGstTax = itemTax;
          gstSubtotal = round2(gstSubtotal + totalExcl);
        } else {
          nonGstQuantity = quantity;
          reportNonGstAmount = round2(totalExcl + itemTax);
          nonGstSubtotal = round2(nonGstSubtotal + totalExcl);
        }
        
        const itemTotal = round2(totalExcl + itemTax);
        subtotal = round2(subtotal + totalExcl);
        taxAmount = round2(taxAmount + itemTax);
        reportGstTaxSum = round2(reportGstTaxSum + reportGstTax);
        reportNonGstAmountSum = round2(reportNonGstAmountSum + reportNonGstAmount);
        
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
      
      const grandTotal = round2(subtotal + taxAmount);
      const cgstAmount = round2(taxAmount / 2);
      const sgstAmount = round2(taxAmount - cgstAmount);
      
      // Customer
      const isWalkin = j % 5 === 0;
      const cust = isWalkin ? { name: 'Walk-in Customer', mobile: '' } : customers[j % customers.length];
      
      // Payment & Dates
      const paymentMethod = paymentMethods[j % paymentMethods.length];
      const amountPaid = paymentMethod === 'UPI / Card' ? grandTotal : Math.ceil(grandTotal / 10) * 10;
      const changeReturned = round2(amountPaid - grandTotal);
      
      // Date spread: spread over the last 180 days using ISO format
      const daysAgo = Math.floor((j / 30000) * 180);
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
        subtotal: round2(subtotal),
        gstSubtotal: round2(gstSubtotal),
        nonGstSubtotal: round2(nonGstSubtotal),
        taxAmount: round2(taxAmount),
        cgstAmount,
        sgstAmount,
        grandTotal,
        reportGstTax: round2(reportGstTaxSum),
        reportNonGstAmount: round2(reportNonGstAmountSum),
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
      console.log('2,000 Products registered successfully.');

      // 4. Seed Sales & Sale Items (30,000 sales + items)
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
      console.log('30,000 Sales with items registered successfully.');

      db.run("COMMIT", (err) => {
        if (err) {
          console.error('Commit failed:', err.message);
          process.exit(1);
        } else {
          console.log('\n--- Seeding Process Completed Successfully ---');
          console.log('Products seeded: 2,000');
          console.log('Sales transactions seeded: 30,000');
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
