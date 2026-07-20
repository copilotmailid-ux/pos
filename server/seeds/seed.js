const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding POS workspace data...');

    // Clear existing data
    await Product.deleteMany({});
    await Supplier.deleteMany({});
    await Customer.deleteMany({});
    await Sale.deleteMany({});
    await SaleItem.deleteMany({});

    // 1. Create Supplier A (GST) and Supplier B (Non-GST)
    const suppliers = [
      { name: 'Supplier A (GST Tax Invoices)', supplierType: 'GST', contactPerson: 'Anand Kumar', phone: '9876543210', email: 'anand@supplier-a.com', address: 'GST Trade Complex, Chennai', gstin: '33AAAAA0000A1Z5' },
      { name: 'Supplier B (Non-GST / Local Wholesale)', supplierType: 'Non-GST', contactPerson: 'Bala Subbu', phone: '9444123456', email: 'bala@supplier-b.com', address: 'Wholesale Market, Madurai', gstin: '' }
    ];
    const createdSuppliers = await Supplier.insertMany(suppliers);
    console.log(`${createdSuppliers.length} suppliers registered (Supplier A - GST & Supplier B - Non-GST)`);

    // 2. Create customer registry profiles
    const customers = [
      { name: 'Deva', mobile: '9360480902' },
      { name: 'Suresh Kumar', mobile: '9398989898' },
      { name: 'Ravi Teja', mobile: '9876543210' },
      { name: 'Ananya', mobile: '9123456789' }
    ];
    const createdCustomers = await Customer.insertMany(customers);
    console.log(`${createdCustomers.length} loyal customer profiles registered`);

    // 3. Create products with GST Stock (from Supplier A) and Non-GST Stock (from Supplier B)
    const products = [
      { name: 'Dabur Red Paste', variant: '10 Rs', barcode: '8901207010', category: 'Personal Care', purchasePrice: 8.0, sellingPrice: 10.0, gstStock: 50, nonGstStock: 50, gstRate: 18 },
      { name: 'Dabur Red Paste', variant: '20 Rs', barcode: '8901207020', category: 'Personal Care', purchasePrice: 16.0, sellingPrice: 20.0, gstStock: 25, nonGstStock: 10, gstRate: 18 },
      { name: 'Amul Milk', variant: '500ml', barcode: '8901262050', category: 'Dairy', purchasePrice: 24.0, sellingPrice: 28.0, gstStock: 40, nonGstStock: 20, gstRate: 5 },
      { name: 'Coca Cola', variant: '250ml Can', barcode: '8901764025', category: 'Beverages', purchasePrice: 28.0, sellingPrice: 35.0, gstStock: 30, nonGstStock: 10, gstRate: 28 },
      { name: 'Lays Classic', variant: '20g', barcode: '8901491020', category: 'Snacks', purchasePrice: 8.5, sellingPrice: 10.0, gstStock: 100, nonGstStock: 50, gstRate: 12 },
      { name: 'Aashirvaad Atta', variant: '5kg', barcode: '8901725181', category: 'Grocery', purchasePrice: 240.0, sellingPrice: 285.0, gstStock: 10, nonGstStock: 5, gstRate: 5 },
      { name: 'Fortune Sunflower Oil', variant: '1L Pouch', barcode: '8906007281', category: 'Grocery', purchasePrice: 130.0, sellingPrice: 155.0, gstStock: 20, nonGstStock: 5, gstRate: 5 }
    ];
    
    const createdProducts = await Product.insertMany(products);
    console.log(`${createdProducts.length} dual-stock products seeded (GST Stock + Non-GST Stock)`);

    console.log('\n--- Seeding Process Completed Successfully ---');
    console.log('Unlock Passcode: admin123');
    process.exit(0);
  } catch (error) {
    console.error('Seeding critical failure:', error.message);
    process.exit(1);
  }
};

seedData();
