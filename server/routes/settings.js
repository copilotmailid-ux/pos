const express = require('express');
const { get, run } = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// @route   GET /api/settings
// @desc    Get store and printer settings
// @access  Private
router.get('/', async (req, res) => {
  try {
    const settings = await get('SELECT * FROM settings WHERE id = 1');
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    // Map existing columns to the format frontend expects
    res.json({
      ...settings,
      invoiceFooter: settings.receiptFooter || '',
      autoPrint: settings.autoPrint === 1,
      barcodeAction: settings.barcodeAutoSubmit === 1 ? 'auto-add' : 'prompt',
      backupPath: settings.backupPath || '',
      backupRetention: settings.backupRetention || 5
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving settings', error: error.message });
  }
});

// @route   PUT /api/settings
// @desc    Update store and printer settings
// @access  Private
router.put('/', async (req, res) => {
  try {
    const {
      storeName,
      storeAddress,
      storePhone,
      storeGstin,
      invoiceFooter,
      storeLogo,
      printerName,
      paperSize,
      autoPrint,
      barcodeAction,
      backupPath,
      backupRetention
    } = req.body;

    const autoPrintVal = autoPrint ? 1 : 0;
    const barcodeAutoSubmitVal = barcodeAction === 'auto-add' ? 1 : 0;
    const backupRetentionVal = parseInt(backupRetention, 10) || 5;

    await run(`
      UPDATE settings 
      SET 
        storeName = ?, 
        storeAddress = ?, 
        storePhone = ?, 
        storeGstin = ?, 
        receiptFooter = ?, 
        storeLogo = ?, 
        printerName = ?, 
        paperSize = ?, 
        autoPrint = ?, 
        barcodeAutoSubmit = ?,
        backupPath = ?,
        backupRetention = ?
      WHERE id = 1
    `, [
      storeName || 'SuperMart',
      storeAddress || '',
      storePhone || '',
      storeGstin || '',
      invoiceFooter || '',
      storeLogo || '',
      printerName || '',
      paperSize || '80mm',
      autoPrintVal,
      barcodeAutoSubmitVal,
      backupPath || '',
      backupRetentionVal
    ]);

    const updated = await get('SELECT * FROM settings WHERE id = 1');
    res.json({
      ...updated,
      invoiceFooter: updated.receiptFooter || '',
      autoPrint: updated.autoPrint === 1,
      barcodeAction: updated.barcodeAutoSubmit === 1 ? 'auto-add' : 'prompt',
      backupPath: updated.backupPath || '',
      backupRetention: updated.backupRetention || 5
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating settings', error: error.message });
  }
});

module.exports = router;
