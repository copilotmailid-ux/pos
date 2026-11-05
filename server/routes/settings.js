const express = require('express');
const { get, run } = require('../config/db');
const { protect } = require('../middleware/auth');
const { setCachedBackupConfig, syncToGoogleDriveAsync } = require('../config/cloudBackup');

const router = express.Router();

// @route   GET /api/settings
// @desc    Get store, UI preferences, and printer settings
// @access  Public (Store profile, typography scaling & hardware settings for POS UI)
router.get('/', async (req, res) => {
  try {
    const settings = await get('SELECT * FROM settings WHERE id = 1');
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    // Map existing columns to the format frontend expects, sanitizing passwords
    const safeSettings = { ...settings };
    delete safeSettings.loginPassword;
    delete safeSettings.deletePassword;

    res.json({
      ...safeSettings,
      invoiceFooter: settings.receiptFooter || '',
      autoPrint: settings.autoPrint === 1,
      barcodeAction: settings.barcodeAutoSubmit === 1 ? 'auto-add' : 'prompt',
      backupPath: settings.backupPath || '',
      backupRetention: settings.backupRetention || 5,
      enableGst: settings.enableGst !== 0,
      receiptFontSize: settings.receiptFontSize || 'medium',
      uiFontSize: settings.uiFontSize || 'normal',
      confirmCheckout: settings.confirmCheckout !== 0,
      confirmQuotation: settings.confirmQuotation !== 0,
      confirmPurchase: settings.confirmPurchase !== 0,
      fssai: settings.fssai || '',
      msme: settings.msme || '',
      salesEmail: settings.salesEmail || '',
      terms: settings.terms || 'Immediate Payment. Goods once sold cannot be returned.',
      enableLoginPassword: settings.enableLoginPassword !== 0,
      enableDeleteBillPassword: settings.enableDeleteBillPassword !== 0,
      enableDeleteProductPassword: settings.enableDeleteProductPassword !== 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving settings', error: error.message });
  }
});

// Protect all write and update operations below
router.use(protect);

// @route   PUT /api/settings
// @desc    Update store, UI preferences, and printer settings
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
      backupRetention,
      fssai,
      msme,
      salesEmail,
      terms,
      enableGst,
      receiptFontSize,
      uiFontSize,
      confirmCheckout,
      confirmQuotation,
      confirmPurchase,
      enableLoginPassword,
      enableDeleteBillPassword,
      enableDeleteProductPassword
    } = req.body;

    const autoPrintVal = autoPrint ? 1 : 0;
    const barcodeAutoSubmitVal = barcodeAction === 'auto-add' ? 1 : 0;
    const backupRetentionVal = parseInt(backupRetention, 10) || 5;
    const enableGstVal = (enableGst === false || enableGst === 0 || enableGst === '0') ? 0 : 1;
    const confirmCheckoutVal = confirmCheckout === false ? 0 : 1;
    const confirmQuotationVal = confirmQuotation === false ? 0 : 1;
    const confirmPurchaseVal = confirmPurchase === false ? 0 : 1;
    const enableLoginPassVal = enableLoginPassword === false ? 0 : 1;
    const enableDeleteBillPassVal = enableDeleteBillPassword === false ? 0 : 1;
    const enableDeleteProdPassVal = enableDeleteProductPassword === false ? 0 : 1;

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
        backupRetention = ?,
        fssai = ?,
        msme = ?,
        salesEmail = ?,
        terms = ?,
        enableGst = ?,
        receiptFontSize = ?,
        uiFontSize = ?,
        confirmCheckout = ?,
        confirmQuotation = ?,
        confirmPurchase = ?,
        enableLoginPassword = ?,
        enableDeleteBillPassword = ?,
        enableDeleteProductPassword = ?
      WHERE id = 1
    `, [
      storeName !== undefined ? storeName : '',
      storeAddress !== undefined ? storeAddress : '',
      storePhone !== undefined ? storePhone : '',
      storeGstin !== undefined ? storeGstin : '',
      invoiceFooter !== undefined ? invoiceFooter : '',
      storeLogo !== undefined ? storeLogo : '',
      printerName !== undefined ? printerName : '',
      paperSize || 'A4',
      autoPrintVal,
      barcodeAutoSubmitVal,
      backupPath || '',
      backupRetentionVal,
      fssai !== undefined ? fssai : '',
      msme !== undefined ? msme : '',
      salesEmail !== undefined ? salesEmail : '',
      terms !== undefined ? terms : 'Immediate Payment. Goods once sold cannot be returned.',
      enableGstVal,
      receiptFontSize || 'medium',
      uiFontSize || 'normal',
      confirmCheckoutVal,
      confirmQuotationVal,
      confirmPurchaseVal,
      enableLoginPassVal,
      enableDeleteBillPassVal,
      enableDeleteProdPassVal
    ]);

    const updated = await get('SELECT * FROM settings WHERE id = 1');

    // Update in-memory cloud backup cache and trigger async sync to new target
    if (updated) {
      setCachedBackupConfig({
        backupPath: updated.backupPath,
        backupRetention: updated.backupRetention
      });
      syncToGoogleDriveAsync('SETTINGS_UPDATED').catch(console.error);
    }

    res.json({
      ...updated,
      invoiceFooter: updated.receiptFooter || '',
      autoPrint: updated.autoPrint === 1,
      barcodeAction: updated.barcodeAutoSubmit === 1 ? 'auto-add' : 'prompt',
      backupPath: updated.backupPath || '',
      backupRetention: updated.backupRetention || 5,
      enableGst: updated.enableGst !== 0,
      receiptFontSize: updated.receiptFontSize || 'medium',
      uiFontSize: updated.uiFontSize || 'normal',
      confirmCheckout: updated.confirmCheckout !== 0,
      confirmQuotation: updated.confirmQuotation !== 0,
      confirmPurchase: updated.confirmPurchase !== 0,
      enableLoginPassword: updated.enableLoginPassword !== 0,
      enableDeleteBillPassword: updated.enableDeleteBillPassword !== 0,
      enableDeleteProductPassword: updated.enableDeleteProductPassword !== 0,
      fssai: updated.fssai || '',
      msme: updated.msme || '',
      salesEmail: updated.salesEmail || '',
      terms: updated.terms || 'Immediate Payment. Goods once sold cannot be returned.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating settings', error: error.message });
  }
});

// @route   PUT /api/settings/password-toggles
// @desc    Quick toggle for enabling or disabling password protection for all things or per-feature
// @access  Private
router.put('/password-toggles', async (req, res) => {
  try {
    const { enableLoginPassword, enableDeleteBillPassword, enableDeleteProductPassword, allPasswords } = req.body;
    
    let loginVal, billVal, prodVal;
    if (allPasswords !== undefined) {
      const v = allPasswords ? 1 : 0;
      loginVal = v;
      billVal = v;
      prodVal = v;
    } else {
      const current = await get('SELECT enableLoginPassword, enableDeleteBillPassword, enableDeleteProductPassword FROM settings WHERE id = 1');
      loginVal = enableLoginPassword !== undefined ? (enableLoginPassword ? 1 : 0) : (current?.enableLoginPassword ?? 1);
      billVal = enableDeleteBillPassword !== undefined ? (enableDeleteBillPassword ? 1 : 0) : (current?.enableDeleteBillPassword ?? 1);
      prodVal = enableDeleteProductPassword !== undefined ? (enableDeleteProductPassword ? 1 : 0) : (current?.enableDeleteProductPassword ?? 1);
    }

    await run(`
      UPDATE settings 
      SET enableLoginPassword = ?, enableDeleteBillPassword = ?, enableDeleteProductPassword = ?
      WHERE id = 1
    `, [loginVal, billVal, prodVal]);

    res.json({
      success: true,
      enableLoginPassword: loginVal === 1,
      enableDeleteBillPassword: billVal === 1,
      enableDeleteProductPassword: prodVal === 1,
      allPasswords: loginVal === 1 && billVal === 1 && prodVal === 1,
      message: allPasswords !== undefined
        ? (allPasswords ? 'Password protection enabled for all operations' : 'Password protection disabled for all operations (Quick Access Mode)')
        : 'Password preferences updated'
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update password settings', error: err.message });
  }
});

// @route   POST /api/settings/backup
// @desc    Trigger an immediate on-demand backup to Google Drive & local backup folder
// @access  Private
router.post('/backup', async (req, res) => {
  try {
    const cloudDest = await syncToGoogleDriveAsync('MANUAL_USER_REQUEST');
    res.json({
      success: true,
      cloudBackup: cloudDest,
      message: cloudDest
        ? `Backup saved successfully to Google Drive: ${cloudDest}`
        : 'Backup completed locally.'
    });
  } catch (error) {
    console.error('Manual backup error:', error);
    res.status(500).json({ message: 'Backup failed', error: error.message });
  }
});

// @route   PUT /api/settings/password
// @desc    Update Login Password or Bill Deletion Password
// @access  Private
router.put('/password', async (req, res) => {
  try {
    const { target, currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: 'New password must be at least 4 characters long' });
    }

    const settings = await get('SELECT loginPassword, deletePassword FROM settings WHERE id = 1');
    const dbLoginPass = settings?.loginPassword || 'admin123';
    const dbDeletePass = settings?.deletePassword || 'admin123';

    if (target === 'login') {
      if (currentPassword !== dbLoginPass) {
        return res.status(401).json({ message: 'Current software login password is incorrect!' });
      }
      await run('UPDATE settings SET loginPassword = ? WHERE id = 1', [newPassword]);
      return res.json({ message: 'Software Login Password updated successfully!' });
    }

    if (target === 'delete') {
      if (currentPassword !== dbDeletePass) {
        return res.status(401).json({ message: 'Current bill deleting password is incorrect!' });
      }
      await run('UPDATE settings SET deletePassword = ? WHERE id = 1', [newPassword]);
      return res.json({ message: 'Bill Deletion Password updated successfully!' });
    }

    if (target === 'both') {
      if (currentPassword !== dbLoginPass && currentPassword !== dbDeletePass) {
        return res.status(401).json({ message: 'Current password is incorrect!' });
      }
      await run('UPDATE settings SET loginPassword = ?, deletePassword = ? WHERE id = 1', [newPassword, newPassword]);
      return res.json({ message: 'Both Login and Bill Deletion Passwords updated successfully!' });
    }

    return res.status(400).json({ message: 'Invalid target specified. Choose login, delete, or both.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
});

module.exports = router;
