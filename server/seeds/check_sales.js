const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const sales = await Sale.find().populate('items');

    let sumSalesTax = 0;
    let sumGstReportTax = 0;
    let sumNonGstReportTax = 0;

    for (const s of sales) {
      sumSalesTax += s.taxAmount;
      for (const item of s.items) {
        // GST report tax calculation logic:
        const effectiveGstQty = Math.max(0, (item.gstQuantity !== undefined ? item.gstQuantity : item.quantity) - (item.returnedQuantity || 0));
        if (effectiveGstQty > 0) {
          const itemSub = item.price * effectiveGstQty;
          const rate = item.gstRate !== undefined ? Number(item.gstRate) : 12;
          sumGstReportTax += itemSub * (rate / 100);
        }

        // Non-GST report tax calculation logic:
        const returnedNonGstQty = Math.max(0, (item.returnedQuantity || 0) - (item.gstQuantity || 0));
        const effectiveNonGstQty = Math.max(0, (item.nonGstQuantity || 0) - returnedNonGstQty);
        if (effectiveNonGstQty > 0) {
          const itemSub = item.price * effectiveNonGstQty;
          const rate = item.gstRate !== undefined ? Number(item.gstRate) : 12;
          sumNonGstReportTax += itemSub * (rate / 100);
        }
      }
    }

    console.log('Sum of s.taxAmount (Sales Report):', sumSalesTax);
    console.log('Sum of GST Report Tax:', sumGstReportTax);
    console.log('Sum of Non-GST Report Tax:', sumNonGstReportTax);
    console.log('Sum of GST + Non-GST:', sumGstReportTax + sumNonGstReportTax);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

check();
