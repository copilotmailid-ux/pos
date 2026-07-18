const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');

const customersList = [
  { name: 'Deva', mobile: '9360480902' },
  { name: 'Suresh Kumar', mobile: '9398989898' },
  { name: 'Ravi Teja', mobile: '9876543210' },
  { name: 'Ananya', mobile: '9123456789' },
  { name: 'Vijay', mobile: '9444123456' },
  { name: 'Karthik', mobile: '9840123456' },
  { name: 'Priya', mobile: '9962123456' },
  { name: 'Sandhya', mobile: '9884123456' },
  { name: '', mobile: '' } // Walk-ins
];

const paymentMethods = ['Cash Tendered', 'UPI / Card', 'Cash Tendered', 'UPI / Card'];

const seedHeavySales = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB. Fetching products to build sales history...');

    // Fetch existing products to link sales items
    const products = await Product.find().lean();
    if (products.length === 0) {
      console.error('No products found in the database. Please seed products first using seed_thousand.js!');
      process.exit(1);
    }
    console.log(`Loaded ${products.length} products to choose from.`);

    // Wipe existing sales database tables
    console.log('Clearing existing sales history...');
    await Sale.deleteMany({});
    await SaleItem.deleteMany({});

    const salesList = [];
    const saleItemsList = [];
    const totalSalesToSeed = 10000;
    const batchSize = 2500; // Insert in batches to optimize memory usage

    console.log(`Generating ${totalSalesToSeed} sales records in-memory...`);

    // Helper to generate dates distributed over the last 30 days
    const now = new Date();

    for (let i = 1; i <= totalSalesToSeed; i++) {
      // 1. Pick a random customer profile
      const cust = customersList[Math.floor(Math.random() * customersList.length)];
      
      // 2. Select number of items (1 to 4)
      const numItems = Math.floor(Math.random() * 4) + 1;
      const saleId = new mongoose.Types.ObjectId();
      
      let subtotal = 0;
      let taxAmount = 0;
      const saleItemIds = [];

      for (let j = 0; j < numItems; j++) {
        // Pick a random product
        const product = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 3) + 1; // Quantity 1 to 3
        const itemGst = product.gstRate ?? 12;
        
        const itemSubtotal = product.sellingPrice * qty;
        const itemTax = itemSubtotal * (itemGst / 100);
        
        subtotal += itemSubtotal;
        taxAmount += itemTax;

        const saleItemId = new mongoose.Types.ObjectId();
        saleItemIds.push(saleItemId);

        saleItemsList.push({
          _id: saleItemId,
          sale: saleId,
          product: product._id,
          productName: product.name,
          variant: product.variant || '',
          barcode: product.barcode,
          quantity: qty,
          price: product.sellingPrice,
          purchasePrice: product.purchasePrice || 0,
          gstRate: itemGst,
          taxAmount: itemTax,
          total: itemSubtotal + itemTax
        });
      }

      const grandTotal = subtotal + taxAmount;
      const cgstAmount = taxAmount / 2;
      const sgstAmount = taxAmount / 2;

      // Random amount paid and change due
      const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      let amountPaid = grandTotal;
      let changeReturned = 0;
      if (method === 'Cash Tendered') {
        const nextHundred = Math.ceil(grandTotal / 100) * 100;
        amountPaid = nextHundred;
        changeReturned = nextHundred - grandTotal;
      }

      // Distribute sales dates randomly over the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const hour = Math.floor(Math.random() * 12) + 9; // 9 AM to 9 PM
      const minute = Math.floor(Math.random() * 60);
      const saleDate = new Date(now);
      saleDate.setDate(saleDate.getDate() - daysAgo);
      saleDate.setHours(hour, minute, 0, 0);

      salesList.push({
        _id: saleId,
        invoiceNo: `INV-${String(i).padStart(5, '0')}`,
        items: saleItemIds,
        customerMobile: cust.mobile,
        customerName: cust.name,
        paymentMethod: method,
        amountPaid: Number(amountPaid.toFixed(2)),
        changeReturned: Number(changeReturned.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        cgstAmount: Number(cgstAmount.toFixed(2)),
        sgstAmount: Number(sgstAmount.toFixed(2)),
        grandTotal: Number(grandTotal.toFixed(2)),
        createdAt: saleDate,
        updatedAt: saleDate
      });
    }

    // 5. Bulk Insert operations
    console.log('Sales structures generated in-memory. Starting fast database bulk inserts...');
    
    // Insert SaleItems first
    for (let offset = 0; offset < saleItemsList.length; offset += batchSize) {
      const batch = saleItemsList.slice(offset, offset + batchSize);
      await SaleItem.insertMany(batch);
      console.log(`Inserted SaleItems: ${offset + batch.length} / ${saleItemsList.length}...`);
    }

    // Insert Sales
    for (let offset = 0; offset < salesList.length; offset += batchSize) {
      const batch = salesList.slice(offset, offset + batchSize);
      await Sale.insertMany(batch);
      console.log(`Inserted Sales: ${offset + batch.length} / ${salesList.length}...`);
    }

    console.log('\n--- Seeding Process Completed Successfully ---');
    console.log(`Seeded exactly ${salesList.length} sales receipts and ${saleItemsList.length} checkout items!`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding process crashed:', error.message);
    process.exit(1);
  }
};

seedHeavySales();
