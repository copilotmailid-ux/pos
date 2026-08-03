import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineShoppingCart,
  HiOutlinePrinter,
  HiOutlineLockClosed,
  HiOutlineSave
} from 'react-icons/hi';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('branding');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // General Store and Hardware settings form
  const [form, setForm] = useState({
    storeName: 'SuperMart',
    storeAddress: '123, Main Street, City',
    storePhone: '+91 9876543210',
    storeGstin: '00AAAAA0000A0Z0',
    invoiceFooter: 'Thank you for shopping! Visit us again.',
    storeLogo: '',
    printerName: '',
    paperSize: '80mm',
    autoPrint: false,
    barcodeAction: 'auto-add',
    backupPath: '',
    backupRetention: 5
  });

  // Password / Security form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      if (data) {
        setForm({
          storeName: data.storeName || '',
          storeAddress: data.storeAddress || '',
          storePhone: data.storePhone || '',
          storeGstin: data.storeGstin || '',
          invoiceFooter: data.invoiceFooter || '',
          storeLogo: data.storeLogo || '',
          printerName: data.printerName || '',
          paperSize: data.paperSize || '80mm',
          autoPrint: !!data.autoPrint,
          barcodeAction: data.barcodeAction || 'auto-add',
          backupPath: data.backupPath || '',
          backupRetention: data.backupRetention || 5
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put('/settings', form);
      toast.success('Branding & Printer settings updated successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = (e) => {
    e.preventDefault();
    const savedPassword = localStorage.getItem('pos_admin_delete_pass') || 'admin123';
    
    if (currentPassword !== savedPassword) {
      toast.error('Current admin password is incorrect!');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      toast.error('New password must be at least 4 characters long!');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match!');
      return;
    }

    localStorage.setItem('pos_admin_delete_pass', newPassword);
    toast.success('Admin security password updated successfully!');
    
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <div className="table-loading" style={{ height: 256 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your supermarket store branding, checkout printer, and admin security password.</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tabs-header" style={{ display: 'flex', borderBottom: '1px solid var(--slate-200)', background: 'var(--slate-50)' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'branding' ? 'active' : ''}`}
            onClick={() => setActiveTab('branding')}
            style={{
              padding: '16px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'branding' ? '2px solid var(--brand-600)' : '2px solid transparent',
              color: activeTab === 'branding' ? 'var(--brand-700)' : 'var(--slate-600)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <HiOutlineShoppingCart style={{ fontSize: 18 }} />
            Store Branding
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'hardware' ? 'active' : ''}`}
            onClick={() => setActiveTab('hardware')}
            style={{
              padding: '16px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'hardware' ? '2px solid var(--brand-600)' : '2px solid transparent',
              color: activeTab === 'hardware' ? 'var(--brand-700)' : 'var(--slate-600)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <HiOutlinePrinter style={{ fontSize: 18 }} />
            Printer & Hardware
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
            style={{
              padding: '16px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'security' ? '2px solid var(--brand-600)' : '2px solid transparent',
              color: activeTab === 'security' ? 'var(--brand-700)' : 'var(--slate-600)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <HiOutlineLockClosed style={{ fontSize: 18 }} />
            Security & Password
          </button>
        </div>

        {activeTab !== 'security' ? (
          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            {activeTab === 'branding' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 16, color: 'var(--slate-800)' }}>Invoice & Branding Settings</h3>
                
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Store Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.storeName}
                    onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                    placeholder="e.g. Metro Bazar"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Store Address</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={form.storeAddress}
                    onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
                    placeholder="Street Address, City, State, ZIP"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.storePhone}
                      onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
                      placeholder="+91 99999 99999"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>GSTIN Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.storeGstin}
                      onChange={(e) => setForm({ ...form, storeGstin: e.target.value })}
                      placeholder="e.g. 29AAAAA1111A1Z1"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Invoice Footer Message</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.invoiceFooter}
                    onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
                    placeholder="e.g. Thank you for shopping with us!"
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Store Logo URL / Path</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.storeLogo}
                    onChange={(e) => setForm({ ...form, storeLogo: e.target.value })}
                    placeholder="e.g. /images/logo.png"
                  />
                </div>
              </div>
            )}

            {activeTab === 'hardware' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 16, color: 'var(--slate-800)' }}>Printer & Scanner Settings</h3>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Thermal Printer Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.printerName}
                    onChange={(e) => setForm({ ...form, printerName: e.target.value })}
                    placeholder="e.g. POS-80C or leave empty for default system printer"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Receipt Paper Size</label>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    {['80mm', '58mm', 'A4'].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setForm({ ...form, paperSize: size })}
                        style={{
                          padding: '10px 20px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid',
                          borderColor: form.paperSize === size ? 'var(--brand-500)' : 'var(--slate-200)',
                          background: form.paperSize === size ? 'var(--brand-50)' : 'var(--surface-card)',
                          color: form.paperSize === size ? 'var(--brand-700)' : 'var(--slate-600)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {size === '80mm' ? '3" (80mm) Thermal' : size === '58mm' ? '2" (58mm) Thermal' : 'Standard A4'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Barcode Scanner Action</label>
                  <select
                    className="form-input"
                    value={form.barcodeAction}
                    onChange={(e) => setForm({ ...form, barcodeAction: e.target.value })}
                    style={{ width: '100%', height: 40 }}
                  >
                    <option value="auto-add">Auto-Add Item (+1 Quantity)</option>
                    <option value="prompt">Prompt for Quantity</option>
                  </select>
                  <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 4 }}>
                    {form.barcodeAction === 'auto-add' 
                      ? 'Scanning a product adds it to the cart immediately with 1 quantity.' 
                      : 'Scanning opens a quantity selection prompt first.'}
                  </p>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--slate-100)', paddingTop: 16 }}>
                  <input
                    type="checkbox"
                    id="autoPrint"
                    checked={form.autoPrint}
                    onChange={(e) => setForm({ ...form, autoPrint: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <div>
                    <label htmlFor="autoPrint" style={{ fontWeight: 600, color: 'var(--slate-800)', cursor: 'pointer' }}>Auto-Print Receipts</label>
                    <p style={{ fontSize: 12, color: 'var(--slate-400)' }}>Immediately open the print dialog when a sale transaction is successfully completed.</p>
                  </div>
                </div>

                <div style={{ marginTop: 20, borderTop: '1px solid var(--slate-100)', paddingTop: 16 }}>
                  <h4 style={{ marginBottom: 12, color: 'var(--slate-800)' }}>Automated Database Backups</h4>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Auto-Backup Destination Folder (e.g. Google Drive)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.backupPath}
                      onChange={(e) => setForm({ ...form, backupPath: e.target.value })}
                      placeholder="e.g. G:\My Drive\SuperMart_Backups"
                    />
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>
                      Provide the absolute folder path to automatically copy your database when closing the app. Leave empty to disable.
                    </p>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Backup Retention Limit (files to keep)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="form-input"
                      value={form.backupRetention}
                      onChange={(e) => setForm({ ...form, backupRetention: e.target.value })}
                      placeholder="5"
                    />
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>
                      The maximum number of historic timestamped backup files to keep in your backup folder.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--slate-200)', paddingTop: 20 }}>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn--primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <HiOutlineSave style={{ fontSize: 18 }} />
                {submitting ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleUpdatePassword} style={{ padding: 24 }} className="animate-fade-in">
            <h3 style={{ marginBottom: 16, color: 'var(--slate-800)' }}>Admin Security Password</h3>
            <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 20 }}>
              This password protects sensitive cashier operations, such as deleting inventory items and cancelling completed bills.
            </p>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Current Admin Password</label>
              <input
                type="password"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password (Default: admin123)"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>New Admin Password</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (Min 4 characters)"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: 'var(--slate-700)' }}>Confirm New Admin Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--slate-200)', paddingTop: 20 }}>
              <button
                type="submit"
                className="btn btn--primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <HiOutlineSave style={{ fontSize: 18 }} />
                Update Password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Settings;
