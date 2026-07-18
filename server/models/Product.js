const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    variant: {
      type: String,
      trim: true,
      default: '',
    },
    barcode: {
      type: String,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    gstRate: {
      type: Number,
      enum: [0, 5, 12, 18, 28],
      default: 12,
    },
  },
  { timestamps: true }
);

// Auto-generate barcode before validation if not provided
productSchema.pre('validate', function (next) {
  if (!this.barcode) {
    // Generate a 13-digit EAN-style barcode
    const prefix = '200'; // Internal use prefix
    const timestamp = Date.now().toString().slice(-7);
    const random = Math.floor(Math.random() * 900 + 100).toString();
    this.barcode = prefix + timestamp + random;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
