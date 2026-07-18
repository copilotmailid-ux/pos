const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

const brands = ['Amul', 'Tata', 'Dabur', 'Himalaya', 'Britannia', 'Parle', 'Nestle', 'Haldirams', 'Cadbury', 'Colgate', 'Dove', 'Vim', 'Surf Excel', 'Aashirvaad', 'Fortune', 'Pepsico', 'CocaCola', 'Loreal', 'Patanjali', 'MTR'];
const items = ['Butter', 'Milk', 'Cheese', 'Salt', 'Tea', 'Coffee', 'Honey', 'Toothpaste', 'Soap', 'Shampoo', 'Biscuit', 'Cookies', 'Noodles', 'Chips', 'Namkeen', 'Chocolate', 'Oil', 'Atta', 'Rice', 'Dishwash', 'Detergent', 'Juice', 'Soda', 'Hair Cream'];
const categories = ['Dairy', 'Beverages', 'Snacks', 'Grocery', 'Personal Care', 'Household', 'Other'];
const variants = ['10 Rs Pack', '20 Rs Pack', '50 Rs Pack', '50g', '100g', '200g', '500g', '1kg', '5kg', '250ml', '500ml', '1L', '2L'];
const gstSlabs = [0, 5, 12, 18, 28];

const seedThousandProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB to seed 1,000 products...');

    // Wipe existing products
    await Product.deleteMany({});
    console.log('Cleared existing product records.');

    const products = [];
    const createdBarcodes = new Set();

    for (let i = 1; i <= 1000; i++) {
      // Pick random combinations
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const item = items[Math.floor(Math.random() * items.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const variant = variants[Math.floor(Math.random() * variants.length)];
      const gstRate = gstSlabs[Math.floor(Math.random() * gstSlabs.length)];

      const productName = `${brand} ${item}`;
      
      // Generate EAN-13 barcode systematically to prevent duplicates
      let barcode = `890${String(i).padStart(10, '0')}`;
      createdBarcodes.add(barcode);

      // Random pricing (purchase price between ₹5 and ₹800)
      const purchasePrice = Math.floor(Math.random() * 795 + 5);
      // Selling price adds 15% - 30% profit margin
      const margin = Math.random() * 0.15 + 0.15;
      const sellingPrice = Math.floor(purchasePrice * (1 + margin));

      // Random stock quantity between 0 and 150
      const stock = Math.floor(Math.random() * 150);

      products.push({
        name: productName,
        variant: variant,
        barcode: barcode,
        category: category,
        purchasePrice: purchasePrice,
        sellingPrice: sellingPrice,
        stock: stock,
        gstRate: gstRate
      });
    }

    console.log('Generating database records...');
    const result = await Product.insertMany(products);
    console.log(`Successfully generated and seeded ${result.length} unique products in MongoDB!`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding process failed:', error.message);
    process.exit(1);
  }
};

seedThousandProducts();
