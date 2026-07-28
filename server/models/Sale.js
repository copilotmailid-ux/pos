const mongoose = require('mongoose');
const Counter = require('./Counter');

const saleSchema = new mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      unique: true,
    },
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SaleItem',
      },
    ],
    customerMobile: {
      type: String,
      default: '',
    },
    customerName: {
      type: String,
      default: '',
    },
    paymentMethod: {
      type: String,
      default: 'Cash Tendered',
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    changeReturned: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    gstSubtotal: {
      type: Number,
      default: 0,
    },
    nonGstSubtotal: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    cgstAmount: {
      type: Number,
      default: 0,
    },
    sgstAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    reportGstTax: {
      type: Number,
      default: 0,
    },
    reportNonGstAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Completed', 'Cancelled', 'Returned', 'Partially Returned'],
      default: 'Completed'
    },
    returnReason: {
      type: String,
      default: ''
    },
    returnedAmount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Indexes for historical querying, reports, and search optimization
saleSchema.index({ customerMobile: 1 });
saleSchema.index({ customerName: 1 });
saleSchema.index({ createdAt: -1 });

// Auto-generate invoice number before saving atomically with collision resolution
saleSchema.pre('save', async function (next) {
  if (!this.invoiceNo) {
    try {
      let isUnique = false;
      let nextInv = '';

      while (!isUnique) {
        const counter = await Counter.findOneAndUpdate(
          { id: 'invoiceNo' },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
        nextInv = `INV-${String(counter.seq).padStart(5, '0')}`;
        
        // Ensure invoiceNo is not already present in sales collection
        const exists = await mongoose.model('Sale').exists({ invoiceNo: nextInv });
        if (!exists) {
          isUnique = true;
        }
      }
      this.invoiceNo = nextInv;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
