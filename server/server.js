const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeDB } = require('./config/db');

// Crash protection: Exit Node on critical errors so Electron auto-healing can spawn a clean process
process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT EXCEPTION:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL UNHANDLED REJECTION:', reason);
});

// Load env vars
const path = require('path');
const fs = require('fs');

// Check if an external .env file exists next to the SuperMart POS.exe file
const externalEnvPath = path.join(path.dirname(process.execPath), '.env');

if (fs.existsSync(externalEnvPath)) {
  dotenv.config({ path: externalEnvPath });
  console.log('Using external configuration:', externalEnvPath);
} else {
  // Fall back to the internal default one inside the package
  dotenv.config({ path: path.join(__dirname, '.env') });
}

// Connect and initialize database
initializeDB()
  .then(() => {
    console.log('SQLite Database Initialized and Connected Successfully');
  })
  .catch((err) => {
    console.error('SQLite Database Initialization Error:', err);
    process.exit(1);
  });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/reports', require('./routes/reports'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static build files
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
