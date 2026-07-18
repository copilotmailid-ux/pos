const mongoose = require('mongoose');

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

// Auto-generate invoice number before saving
saleSchema.pre('save', async function (next) {
  if (!this.invoiceNo) {
    const count = await mongoose.model('Sale').countDocuments();
    this.invoiceNo = `INV-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
