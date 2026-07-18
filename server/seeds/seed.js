const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding POS workspace data...');

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});
    await Sale.deleteMany({});
    await SaleItem.deleteMany({});

    // 1. Create admin login user
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@supermart.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log(`Admin created: ${admin.email} / admin123`);

    // 2. Create customer registry profiles (for testing POS autocomplete)
    const customers = [
      { name: 'Deva', mobile: '9360480902' },
      { name: 'Suresh Kumar', mobile: '9398989898' },
      { name: 'Ravi Teja', mobile: '9876543210' },
      { name: 'Ananya', mobile: '9123456789' }
    ];
    const createdCustomers = await Customer.insertMany(customers);
    console.log(`${createdCustomers.length} loyal customer profiles registered`);

    // 3. Create products with size/volume variants & varying stock counts
    const products = [
      // Multiple Size variants for Dabur Red Paste
      { name: 'Dabur Red Paste', variant: '10 Rs', barcode: '8901207010', category: 'Personal Care', purchasePrice: 8.0, sellingPrice: 10.0, stock: 45, gstRate: 18 },
      { name: 'Dabur Red Paste', variant: '20 Rs', barcode: '8901207020', category: 'Personal Care', purchasePrice: 16.0, sellingPrice: 20.0, stock: 35, gstRate: 18 },
      { name: 'Dabur Red Paste', variant: '50 Rs', barcode: '8901207050', category: 'Personal Care', purchasePrice: 40.0, sellingPrice: 50.0, stock: 6, gstRate: 18 }, // Low Stock Alert

      // Dairy variants
      { name: 'Amul Milk', variant: '500ml', barcode: '8901262050', category: 'Dairy', purchasePrice: 24.0, sellingPrice: 28.0, stock: 60, gstRate: 5 },
      { name: 'Amul Milk', variant: '1L', barcode: '8901262100', category: 'Dairy', purchasePrice: 48.0, sellingPrice: 56.0, stock: 4, gstRate: 5 }, // Out of Stock Alert

      // Beverages variants
      { name: 'Coca Cola', variant: '250ml Can', barcode: '8901764025', category: 'Beverages', purchasePrice: 28.0, sellingPrice: 35.0, stock: 40, gstRate: 28 },
      { name: 'Coca Cola', variant: '1L Bottle', barcode: '8901764100', category: 'Beverages', purchasePrice: 48.0, sellingPrice: 60.0, stock: 2, gstRate: 28 }, // Low Stock Alert

      // Snacks variants
      { name: 'Lays Classic', variant: '20g', barcode: '8901491020', category: 'Snacks', purchasePrice: 8.5, sellingPrice: 10.0, stock: 150, gstRate: 12 },
      { name: 'Lays Classic', variant: '50g', barcode: '8901491050', category: 'Snacks', purchasePrice: 16.5, sellingPrice: 20.0, stock: 90, gstRate: 12 },

      // Groceries
      { name: 'Aashirvaad Atta', variant: '5kg', barcode: '8901725181', category: 'Grocery', purchasePrice: 240.0, sellingPrice: 285.0, stock: 15, gstRate: 5 },
      { name: 'Aashirvaad Atta', variant: '10kg', barcode: '8901725182', category: 'Grocery', purchasePrice: 440.0, sellingPrice: 520.0, stock: 8, gstRate: 5 }, // Low Stock Alert
      { name: 'Fortune Sunflower Oil', variant: '1L Pouch', barcode: '8906007281', category: 'Grocery', purchasePrice: 130.0, sellingPrice: 155.0, stock: 25, gstRate: 5 },
      { name: 'Tata Salt', variant: '1kg Pack', barcode: '8901058002', category: 'Grocery', purchasePrice: 19.5, sellingPrice: 24.0, stock: 75, gstRate: 0 }
    ];
    
    const createdProducts = await Product.insertMany(products);
    console.log(`${createdProducts.length} variant products seeded`);

    // 4. Create historic sales records for Today to calculate profit
    // Let's create a couple of sales receipts completed today
    const p1 = createdProducts.find(p => p.barcode === '8901207020'); // Dabur Red Paste 20 Rs (cost: 16, sell: 20)
    const p2 = createdProducts.find(p => p.barcode === '8901262050'); // Amul Milk 500ml (cost: 24, sell: 28)
    const p3 = createdProducts.find(p => p.barcode === '8906007281'); // Fortune Sunflower Oil (cost: 130, sell: 155)

    // Sale 1: customer Deva (9360480902)
    const sale1 = await Sale.create({
      invoiceNo: 'INV-00001',
      customerMobile: '9360480902',
      customerName: 'Deva',
      paymentMethod: 'Cash Tendered',
      amountPaid: 200,
      changeReturned: 17,
      subtotal: 175.0, // (20 * 1) + (155 * 1)
      taxAmount: 8.0, // GST splits: Red Paste: 3.6 (18% of 20), Fortune Oil: 7.75 (5% of 155). Let's approximate tax
      cgstAmount: 4.0,
      sgstAmount: 4.0,
      grandTotal: 183.0,
      createdAt: new Date()
    });

    await SaleItem.create([
      {
        sale: sale1._id,
        product: p1._id,
        productName: p1.name,
        variant: p1.variant,
        barcode: p1.barcode,
        quantity: 1,
        price: p1.sellingPrice,
        purchasePrice: p1.purchasePrice,
        gstRate: p1.gstRate,
        taxAmount: 3.6,
        total: 23.6
      },
      {
        sale: sale1._id,
        product: p3._id,
        productName: p3.name,
        variant: p3.variant,
        barcode: p3.barcode,
        quantity: 1,
        price: p3.sellingPrice,
        purchasePrice: p3.purchasePrice,
        gstRate: p3.gstRate,
        taxAmount: 7.75,
        total: 162.75
      }
    ]);

    // Link items back to sale
    const s1Items = await SaleItem.find({ sale: sale1._id });
    sale1.items = s1Items.map(item => item._id);
    await sale1.save();

    // Sale 2: customer Suresh Kumar (9398989898)
    const sale2 = await Sale.create({
      invoiceNo: 'INV-00002',
      customerMobile: '9398989898',
      customerName: 'Suresh Kumar',
      paymentMethod: 'UPI / Card',
      amountPaid: 100,
      changeReturned: 0,
      subtotal: 76.0, // (28 * 2) + (20 * 1)
      taxAmount: 6.4,
      cgstAmount: 3.2,
      sgstAmount: 3.2,
      grandTotal: 82.4,
      createdAt: new Date()
    });

    await SaleItem.create([
      {
        sale: sale2._id,
        product: p2._id,
        productName: p2.name,
        variant: p2.variant,
        barcode: p2.barcode,
        quantity: 2,
        price: p2.sellingPrice,
        purchasePrice: p2.purchasePrice,
        gstRate: p2.gstRate,
        taxAmount: 2.8,
        total: 58.8
      },
      {
        sale: sale2._id,
        product: p1._id,
        productName: p1.name,
        variant: p1.variant,
        barcode: p1.barcode,
        quantity: 1,
        price: p1.sellingPrice,
        purchasePrice: p1.purchasePrice,
        gstRate: p1.gstRate,
        taxAmount: 3.6,
        total: 23.6
      }
    ]);

    // Link items back to sale2
    const s2Items = await SaleItem.find({ sale: sale2._id });
    sale2.items = s2Items.map(item => item._id);
    await sale2.save();

    console.log(`2 test sales invoices successfully generated today.`);

    console.log('\n--- Seeding Process Completed Successfully ---');
    console.log('Credentials: admin@supermart.com / admin123');
    process.exit(0);
  } catch (error) {
    console.error('Seeding critical failure:', error.message);
    process.exit(1);
  }
};

seedData();
