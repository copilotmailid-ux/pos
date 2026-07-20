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
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    gstStock: {
      type: Number,
      min: [0, 'GST Stock cannot be negative'],
      default: 0,
    },
    nonGstStock: {
      type: Number,
      min: [0, 'Non-GST Stock cannot be negative'],
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

// Keep total stock in sync with gstStock + nonGstStock before validation
productSchema.pre('validate', function (next) {
  if (this.isNew && (this.stock > 0) && (!this.gstStock && !this.nonGstStock)) {
    // Default legacy/initial stock to gstStock if unspecified
    this.gstStock = this.stock;
  }
  this.gstStock = Math.max(0, this.gstStock || 0);
  this.nonGstStock = Math.max(0, this.nonGstStock || 0);
  this.stock = this.gstStock + this.nonGstStock;

  if (!this.barcode) {
    const prefix = '200';
    const timestamp = Date.now().toString().slice(-7);
    const random = Math.floor(Math.random() * 900 + 100).toString();
    this.barcode = prefix + timestamp + random;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
