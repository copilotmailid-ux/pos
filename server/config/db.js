const mongoose = require('mongoose');

const syncInvoiceCounter = async () => {
  try {
    const Sale = require('../models/Sale');
    const Counter = require('../models/Counter');

    const latestSale = await Sale.findOne({ invoiceNo: /^INV-\d+$/ }).sort({ _id: -1 });
    if (latestSale && latestSale.invoiceNo) {
      const match = latestSale.invoiceNo.match(/^INV-(\d+)$/);
      if (match) {
        const maxSeq = parseInt(match[1], 10);
        await Counter.findOneAndUpdate(
          { id: 'invoiceNo' },
          { seq: maxSeq },
          { upsert: true }
        );
      }
    } else {
      await Counter.findOneAndUpdate(
        { id: 'invoiceNo' },
        { seq: 0 },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error('Invoice counter sync warning:', err.message);
  }
};

const connectDB = async () => {
  const options = {
    maxPoolSize: 100,            // Prevents connection pool socket exhaustion
    socketTimeoutMS: 45000,      // Closes sockets after 45 seconds of inactivity
    connectTimeoutMS: 30000,     // Time to wait for initial socket connection
    serverSelectionTimeoutMS: 5000 // Limit initial search for primary member
  };

  const connectWithRetry = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, options);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      await syncInvoiceCounter();
    } catch (error) {
      console.error(`MongoDB Connection Error: ${error.message}. Retrying connection in 5 seconds...`);
      setTimeout(connectWithRetry, 5000);
    }
  };

  await connectWithRetry();
};

module.exports = connectDB;
