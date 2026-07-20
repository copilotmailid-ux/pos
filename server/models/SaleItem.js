const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    variant: {
      type: String,
      default: '',
    },
    barcode: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    gstQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    nonGstQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    purchasePrice: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true,
    },
    gstRate: {
      type: Number,
      default: 12
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    reportGstTax: {
      type: Number,
      default: 0
    },
    reportNonGstAmount: {
      type: Number,
      default: 0
    },
    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SaleItem', saleItemSchema);
