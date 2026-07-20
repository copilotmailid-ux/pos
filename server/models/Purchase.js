const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    purchaseTaxType: {
      type: String,
      enum: ['GST', 'Non-GST'],
      default: 'GST',
    },
    items: [
      {
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
          min: 1,
        },
        purchasePrice: {
          type: Number,
          required: true,
          min: 0,
        },
        sellingPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        gstRate: {
          type: Number,
          default: 12,
        },
        total: {
          type: Number,
          required: true,
        },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'UPI', 'Credit'],
      default: 'Cash',
    },
    status: {
      type: String,
      enum: ['Received', 'Returned', 'Partially Returned'],
      default: 'Received',
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Purchase', purchaseSchema);
