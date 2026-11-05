const { db, initializeDB, run, get } = require('../config/db');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const seedBakingSupplies = async () => {
  try {
    console.log('Initializing database schema & migrations...');
    await initializeDB();

    console.log('Seeding Wholesale & Retail Baking Products...');

    const bakingProducts = [
      {
        name: 'Bakery Grade Fine Maida',
        variant: '50kg Bulk Bag',
        category: 'Flour & Mixes',
        unit: 'Bag',
        purchasePrice: 1650,
        retailPrice: 2100,
        wholesalePrice: 1850,
        minWholesaleQty: 2,
        stock: 40,
        gstRate: 0,
        barcode: '890100100001'
      },
      {
        name: 'Bakery Grade Fine Maida',
        variant: '1kg Retail Pack',
        category: 'Flour & Mixes',
        unit: 'Kg',
        purchasePrice: 36,
        retailPrice: 48,
        wholesalePrice: 40,
        minWholesaleQty: 10,
        stock: 150,
        gstRate: 0,
        barcode: '890100100002'
      },
      {
        name: 'Morde Dark Chocolate Compound Slab',
        variant: '500g Slab',
        category: 'Chocolates & Cocoa',
        unit: 'Pcs',
        purchasePrice: 110,
        retailPrice: 160,
        wholesalePrice: 130,
        minWholesaleQty: 5,
        stock: 80,
        gstRate: 18,
        barcode: '890100100003'
      },
      {
        name: 'Morde Dark Compound Master Carton',
        variant: '10kg (20 x 500g)',
        category: 'Chocolates & Cocoa',
        unit: 'Box',
        purchasePrice: 2000,
        retailPrice: 2900,
        wholesalePrice: 2350,
        minWholesaleQty: 1,
        stock: 25,
        gstRate: 18,
        barcode: '890100100004'
      },
      {
        name: 'Morde White Chocolate Compound Slab',
        variant: '500g Slab',
        category: 'Chocolates & Cocoa',
        unit: 'Pcs',
        purchasePrice: 125,
        retailPrice: 175,
        wholesalePrice: 145,
        minWholesaleQty: 5,
        stock: 65,
        gstRate: 18,
        barcode: '890100100005'
      },
      {
        name: 'Callebaut 54.5% Dark Couverture Callets',
        variant: '2.5kg Bag',
        category: 'Chocolates & Cocoa',
        unit: 'Bag',
        purchasePrice: 2600,
        retailPrice: 3400,
        wholesalePrice: 2950,
        minWholesaleQty: 2,
        stock: 18,
        gstRate: 18,
        barcode: '890100100006'
      },
      {
        name: 'Richs Non-Dairy Whipping Cream',
        variant: '1L Tetrapack',
        category: 'Dairy & Fats',
        unit: 'Liter',
        purchasePrice: 145,
        retailPrice: 210,
        wholesalePrice: 170,
        minWholesaleQty: 6,
        stock: 120,
        gstRate: 12,
        barcode: '890100100007'
      },
      {
        name: 'Richs Whipping Cream Full Case',
        variant: '12 x 1L Carton',
        category: 'Dairy & Fats',
        unit: 'Box',
        purchasePrice: 1650,
        retailPrice: 2400,
        wholesalePrice: 1950,
        minWholesaleQty: 1,
        stock: 20,
        gstRate: 12,
        barcode: '890100100008'
      },
      {
        name: 'Van Houten Professional Cocoa Powder',
        variant: '1kg Zip Pack',
        category: 'Chocolates & Cocoa',
        unit: 'Kg',
        purchasePrice: 420,
        retailPrice: 580,
        wholesalePrice: 490,
        minWholesaleQty: 3,
        stock: 45,
        gstRate: 18,
        barcode: '890100100009'
      },
      {
        name: 'Amul Unsalted Table Butter Block',
        variant: '500g Block',
        category: 'Dairy & Fats',
        unit: 'Pcs',
        purchasePrice: 240,
        retailPrice: 295,
        wholesalePrice: 265,
        minWholesaleQty: 4,
        stock: 50,
        gstRate: 12,
        barcode: '890100100010'
      },
      {
        name: 'Golden Crown Sugar Paste Fondant White',
        variant: '1kg Tub',
        category: 'Fondant & Sugarcraft',
        unit: 'Kg',
        purchasePrice: 220,
        retailPrice: 320,
        wholesalePrice: 260,
        minWholesaleQty: 3,
        stock: 35,
        gstRate: 18,
        barcode: '890100100011'
      },
      {
        name: 'Golden Crown Fondant Bulk Tub',
        variant: '5kg Commercial Tub',
        category: 'Fondant & Sugarcraft',
        unit: 'Tub',
        purchasePrice: 1000,
        retailPrice: 1450,
        wholesalePrice: 1180,
        minWholesaleQty: 1,
        stock: 15,
        gstRate: 18,
        barcode: '890100100012'
      },
      {
        name: 'Ossoro Madagascar Vanilla Extract',
        variant: '500ml Bottle',
        category: 'Essence & Flavours',
        unit: 'Pcs',
        purchasePrice: 450,
        retailPrice: 650,
        wholesalePrice: 520,
        minWholesaleQty: 2,
        stock: 28,
        gstRate: 18,
        barcode: '890100100013'
      },
      {
        name: 'D’lecta Cream Cheese Professional',
        variant: '1kg Brick',
        category: 'Dairy & Fats',
        unit: 'Kg',
        purchasePrice: 460,
        retailPrice: 620,
        wholesalePrice: 530,
        minWholesaleQty: 3,
        stock: 30,
        gstRate: 12,
        barcode: '890100100014'
      },
      {
        name: 'Clear Window Cake Boxes 8x8x5 Inch',
        variant: 'Pack of 50 Pcs',
        category: 'Packaging & Cake Boxes',
        unit: 'Pack',
        purchasePrice: 550,
        retailPrice: 850,
        wholesalePrice: 680,
        minWholesaleQty: 2,
        stock: 40,
        gstRate: 12,
        barcode: '890100100015'
      },
      {
        name: 'Clear Window Cake Boxes 10x10x5 Inch',
        variant: 'Pack of 50 Pcs',
        category: 'Packaging & Cake Boxes',
        unit: 'Pack',
        purchasePrice: 750,
        retailPrice: 1150,
        wholesalePrice: 920,
        minWholesaleQty: 2,
        stock: 35,
        gstRate: 12,
        barcode: '890100100016'
      },
      {
        name: 'MDF Golden Cake Boards 10 Inch Round',
        variant: 'Bundle of 25 Pcs',
        category: 'Packaging & Cake Boxes',
        unit: 'Pack',
        purchasePrice: 320,
        retailPrice: 500,
        wholesalePrice: 390,
        minWholesaleQty: 2,
        stock: 60,
        gstRate: 12,
        barcode: '890100100017'
      },
      {
        name: 'SAF-Instant Active Dry Yeast Red',
        variant: '500g Vacuum Pack',
        category: 'Leavening & Additives',
        unit: 'Pcs',
        purchasePrice: 180,
        retailPrice: 270,
        wholesalePrice: 215,
        minWholesaleQty: 4,
        stock: 45,
        gstRate: 12,
        barcode: '890100100018'
      },
      {
        name: 'Mawia Ultra Fine Almond Flour',
        variant: '1kg Zip Pouch',
        category: 'Dry Fruits & Nuts',
        unit: 'Kg',
        purchasePrice: 780,
        retailPrice: 1100,
        wholesalePrice: 920,
        minWholesaleQty: 2,
        stock: 22,
        gstRate: 5,
        barcode: '890100100019'
      },
      {
        name: 'Sugar Stars & Sprinkles Mix Assorted',
        variant: '500g Tub',
        category: 'Colors & Sprinkles',
        unit: 'Pcs',
        purchasePrice: 160,
        retailPrice: 250,
        wholesalePrice: 195,
        minWholesaleQty: 3,
        stock: 55,
        gstRate: 18,
        barcode: '890100100020'
      },
      {
        name: 'Magic Master Gel Food Colors Set (12 Shades)',
        variant: 'Box of 12 x 20ml',
        category: 'Colors & Sprinkles',
        unit: 'Box',
        purchasePrice: 380,
        retailPrice: 580,
        wholesalePrice: 460,
        minWholesaleQty: 2,
        stock: 30,
        gstRate: 18,
        barcode: '890100100021'
      },
      {
        name: 'Superfine Pure Icing Sugar',
        variant: '25kg Commercial Sack',
        category: 'Flour & Mixes',
        unit: 'Bag',
        purchasePrice: 1350,
        retailPrice: 1900,
        wholesalePrice: 1580,
        minWholesaleQty: 1,
        stock: 20,
        gstRate: 5,
        barcode: '890100100022'
      },
      {
        name: 'Liquid Glucose Bakery Grade',
        variant: '1kg Jar',
        category: 'Leavening & Additives',
        unit: 'Pcs',
        purchasePrice: 90,
        retailPrice: 140,
        wholesalePrice: 110,
        minWholesaleQty: 5,
        stock: 40,
        gstRate: 18,
        barcode: '890100100023'
      },
      {
        name: 'Silicone Macaron & Cookie Baking Mat',
        variant: 'Standard Half Sheet 40x30cm',
        category: 'Baking Tools & Pans',
        unit: 'Pcs',
        purchasePrice: 180,
        retailPrice: 320,
        wholesalePrice: 240,
        minWholesaleQty: 3,
        stock: 35,
        gstRate: 18,
        barcode: '890100100024'
      }
    ];

    for (const p of bakingProducts) {
      const existing = await get(`SELECT id FROM products WHERE barcode = ?`, [p.barcode]);
      const gStock = Math.floor(p.stock * 0.7);
      const nStock = p.stock - gStock;

      if (!existing) {
        await run(
          `INSERT INTO products (name, variant, barcode, category, unit, purchasePrice, sellingPrice, retailPrice, wholesalePrice, minWholesaleQty, stock, gstStock, nonGstStock, gstRate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.name,
            p.variant,
            p.barcode,
            p.category,
            p.unit,
            p.purchasePrice,
            p.retailPrice,
            p.retailPrice,
            p.wholesalePrice,
            p.minWholesaleQty,
            p.stock,
            gStock,
            nStock,
            p.gstRate
          ]
        );
      } else {
        await run(
          `UPDATE products 
           SET name = ?, variant = ?, category = ?, unit = ?, purchasePrice = ?, sellingPrice = ?, retailPrice = ?, wholesalePrice = ?, minWholesaleQty = ?, stock = ?, gstStock = ?, nonGstStock = ?, gstRate = ?
           WHERE barcode = ?`,
          [
            p.name,
            p.variant,
            p.category,
            p.unit,
            p.purchasePrice,
            p.retailPrice,
            p.retailPrice,
            p.wholesalePrice,
            p.minWholesaleQty,
            p.stock,
            gStock,
            nStock,
            p.gstRate,
            p.barcode
          ]
        );
      }
    }

    console.log(`✔ Successfully seeded ${bakingProducts.length} wholesale baking products.`);

    // Seed Sample Customers (Home Bakers & Commercial Bakery Shops)
    const sampleCustomers = [
      { name: 'Crust & Crumbs Bakehouse', mobile: '9876500001', customerType: 'Shop', address: '42 Baker Street, Central Market', gstin: '33AABCC1234F1Z5' },
      { name: 'The Velvet Pastry Studio', mobile: '9876500002', customerType: 'Shop', address: 'Shop 12, Food Galleria, South Ext', gstin: '33AAAPL9876K1Z9' },
      { name: 'Priya Sharma (Home Baker)', mobile: '9876500003', customerType: 'Home', address: 'Flat 402, Green Valley Apartments', gstin: '' },
      { name: 'Anjali Sweets & Treats', mobile: '9876500004', customerType: 'Home', address: '14/B Lakeview Colony', gstin: '' },
      { name: 'Sugar Rush Cake Lab', mobile: '9876500005', customerType: 'Shop', address: 'Plot 88, Sector 15 Industrial Estate', gstin: '33BBXPP4567M1ZX' }
    ];

    for (const c of sampleCustomers) {
      const existing = await get(`SELECT id FROM customers WHERE mobile = ?`, [c.mobile]);
      if (!existing) {
        await run(
          `INSERT INTO customers (name, mobile, customerType, address, gstin) VALUES (?, ?, ?, ?, ?)`,
          [c.name, c.mobile, c.customerType, c.address, c.gstin]
        );
      }
    }
    console.log(`✔ Successfully seeded sample Shop & Home Baker customers.`);

    // Seed an initial sample Quotation for testing
    const existingQtn = await get(`SELECT id FROM quotations LIMIT 1`);
    if (!existingQtn) {
      const qtnNo = 'QTN-00001';
      const nowStr = new Date().toISOString();
      const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const { id: qId } = await run(
        `INSERT INTO quotations (quotationNo, customerMobile, customerName, customerType, subtotal, taxAmount, grandTotal, status, validUntil, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          qtnNo,
          '9876500001',
          'Crust & Crumbs Bakehouse',
          'Shop',
          6150,
          1047,
          7197,
          'Draft',
          validUntil,
          'Special wholesale quotation for monthly bakery ingredients order. Prices valid for 7 days.',
          nowStr,
          nowStr
        ]
      );

      // Add quotation items
      await run(
        `INSERT INTO quotation_items (quotationId, productId, productName, variant, unit, barcode, quantity, priceType, price, gstRate, taxAmount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [qId, 1, 'Bakery Grade Fine Maida', '50kg Bulk Bag', 'Bag', '890100100001', 2, 'Shop', 1850, 0, 0, 3700]
      );
      await run(
        `INSERT INTO quotation_items (quotationId, productId, productName, variant, unit, barcode, quantity, priceType, price, gstRate, taxAmount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [qId, 4, 'Morde Dark Compound Master Carton', '10kg (20 x 500g)', 'Box', '890100100004', 1, 'Shop', 2350, 18, 423, 2773]
      );
      await run(
        `INSERT INTO quotation_items (quotationId, productId, productName, variant, unit, barcode, quantity, priceType, price, gstRate, taxAmount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [qId, 7, 'Richs Non-Dairy Whipping Cream', '1L Tetrapack', 'Liter', '890100100007', 4, 'Shop', 170, 12, 81.6, 761.6]
      );

      await run(`UPDATE counters SET seq = 1 WHERE id = 'quotationNo'`);
      console.log(`✔ Successfully created sample quotation QTN-00001 for Crust & Crumbs Bakehouse.`);
    }

    console.log('Seeding complete! You can now start the POS.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedBakingSupplies();
