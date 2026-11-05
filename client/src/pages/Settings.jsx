import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineShoppingCart,
  HiOutlinePrinter,
  HiOutlineLockClosed,
  HiOutlineSave,
  HiOutlineAdjustments,
  HiOutlineCloudUpload,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineLockOpen,
  HiOutlineKey,
  HiOutlineTrash,
  HiOutlineRefresh,
  HiOutlineEye,
  HiOutlineEyeOff
} from 'react-icons/hi';

const applyUiFontSize = (size) => {
  const map = {
    compact: { fontSize: '14px', zoom: '0.94' },
    standard: { fontSize: '14.5px', zoom: '1.0' },
    normal: { fontSize: '15.5px', zoom: '1.08' },
    comfortable: { fontSize: '15.5px', zoom: '1.08' },
    large: { fontSize: '16.5px', zoom: '1.16' },
    xlarge: { fontSize: '17.5px', zoom: '1.25' }
  };
  const target = map[size] || map.comfortable;
  document.documentElement.style.fontSize = target.fontSize;
  document.documentElement.style.zoom = target.zoom;
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState('branding');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  
  // Store, Preferences, Hardware & Backup Settings form
  const [form, setForm] = useState({
    storeName: '',
    storeAddress: '',
    storePhone: '',
    storeGstin: '',
    fssai: '',
    msme: '',
    salesEmail: '',
    invoiceFooter: 'Thank you for shopping with us! Visit again.',
    terms: 'Immediate Payment. Goods once sold cannot be returned.',
    storeLogo: '',
    
    // UI & Confirmation Preferences
    uiFontSize: 'comfortable',
    receiptFontSize: 'medium',
    confirmCheckout: true,
    confirmQuotation: true,
    confirmPurchase: true,
    
    // Hardware & Printer
    printerName: '',
    paperSize: 'A5',
    autoPrint: false,
    barcodeAction: 'auto-add',
    
    // Backup & GST
    backupPath: '',
    backupRetention: 5,
    enableGst: true,

    // Password Security Toggles
    enableLoginPassword: true,
    enableDeleteBillPassword: true,
    enableDeleteProductPassword: true
  });

  // Password / Security form states
  const [passwordTarget, setPasswordTarget] = useState('login'); // 'login' | 'delete' | 'both'
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          fssai: data.fssai || '',
          msme: data.msme || '',
          salesEmail: data.salesEmail || '',
          invoiceFooter: data.invoiceFooter || data.receiptFooter || 'Thank you for shopping with us! Visit again.',
          terms: data.terms || 'Immediate Payment. Goods once sold cannot be returned.',
          storeLogo: data.storeLogo || '',
          
          uiFontSize: data.uiFontSize || 'comfortable',
          receiptFontSize: data.receiptFontSize || 'medium',
          confirmCheckout: data.confirmCheckout !== false,
          confirmQuotation: data.confirmQuotation !== false,
          confirmPurchase: data.confirmPurchase !== false,

          printerName: data.printerName || '',
          paperSize: data.paperSize || 'A5',
          autoPrint: !!data.autoPrint,
          barcodeAction: data.barcodeAction || 'auto-add',
          backupPath: data.backupPath || '',
          backupRetention: data.backupRetention || 5,
          enableGst: data.enableGst !== false,

          enableLoginPassword: data.enableLoginPassword !== false,
          enableDeleteBillPassword: data.enableDeleteBillPassword !== false,
          enableDeleteProductPassword: data.enableDeleteProductPassword !== false
        });

        localStorage.setItem('pos_enable_gst', data.enableGst !== false ? 'true' : 'false');
        if (data.uiFontSize) {
          localStorage.setItem('pos_ui_font_size', data.uiFontSize);
          applyUiFontSize(data.uiFontSize);
        }
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
      localStorage.setItem('pos_enable_gst', form.enableGst ? 'true' : 'false');
      localStorage.setItem('pos_ui_font_size', form.uiFontSize);
      localStorage.setItem('pos_receipt_font_size', form.receiptFontSize);
      localStorage.setItem('pos_paper_size', form.paperSize);
      applyUiFontSize(form.uiFontSize);
      window.dispatchEvent(new Event('pos_settings_updated'));
      toast.success('Software settings saved & applied successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualBackup = async () => {
    setBackingUp(true);
    try {
      const { data } = await api.post('/settings/backup');
      toast.success(data.message || 'Backup snapshot completed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger backup');
    } finally {
      setBackingUp(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    if (!currentPassword) {
      toast.error('Please enter current password');
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

    setUpdatingPassword(true);
    try {
      const { data } = await api.put('/settings/password', {
        target: passwordTarget,
        currentPassword,
        newPassword
      });

      if (passwordTarget === 'delete' || passwordTarget === 'both') {
        localStorage.setItem('pos_admin_delete_pass', newPassword);
      }
      if (passwordTarget === 'login' || passwordTarget === 'both') {
        localStorage.setItem('pos_login_pass', newPassword);
      }

      toast.success(data.message || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleTogglePasswordSetting = async (key, val) => {
    const updatedForm = { ...form, [key]: val };
    setForm(updatedForm);
    try {
      await api.put('/settings/password-toggles', {
        [key]: val
      });
      window.dispatchEvent(new Event('pos_settings_updated'));
      toast.success('Password security preference updated!');
    } catch (err) {
      toast.error('Failed to update password preference');
    }
  };

  const handleToggleAllPasswords = async (enableAll) => {
    const updatedForm = {
      ...form,
      enableLoginPassword: enableAll,
      enableDeleteBillPassword: enableAll,
      enableDeleteProductPassword: enableAll
    };
    setForm(updatedForm);
    try {
      const { data } = await api.put('/settings/password-toggles', {
        allPasswords: enableAll
      });
      window.dispatchEvent(new Event('pos_settings_updated'));
      toast.success(data.message || (enableAll ? 'Password protection enabled for all operations' : 'All passwords disabled'));
    } catch (err) {
      toast.error('Failed to toggle all passwords');
    }
  };

  if (loading) {
    return (
      <div className="table-loading" style={{ height: 256 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 40 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>System Settings & Customization</h1>
        <p style={{ color: 'var(--slate-500)', fontSize: 13.5 }}>
          Customize interface font sizes, print styles, A5/A4 paper, confirmation alerts, store branding, and cloud backups.
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        
        {/* Navigation Tabs Bar — Clean, Responsive, Zero Overflow */}
        <div
          className="tabs-header no-scrollbar"
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--slate-200)',
            background: 'var(--slate-50)',
            width: '100%',
            overflowX: 'hidden'
          }}
        >
          {[
            { id: 'branding', label: 'Store Profile', icon: HiOutlineShoppingCart },
            { id: 'preferences', label: 'Display & Safeguards', icon: HiOutlineAdjustments },
            { id: 'hardware', label: 'Printer & Hardware', icon: HiOutlinePrinter },
            { id: 'backup', label: 'Database & Backups', icon: HiOutlineCloudUpload },
            { id: 'security', label: 'Security & Password', icon: HiOutlineLockClosed }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '14px 10px',
                  background: isActive ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--brand-600)' : '3px solid transparent',
                  color: isActive ? 'var(--brand-700)' : 'var(--slate-600)',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon style={{ fontSize: 17, flexShrink: 0 }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab !== 'security' ? (
          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            
            {/* TAB 1: STORE PROFILE & BRANDING */}
            {activeTab === 'branding' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 16, color: 'var(--slate-800)', fontSize: 17, fontWeight: 700 }}>
                  Store Profile & Invoice Identity
                </h3>
                
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Store / Company Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.storeName}
                    onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                    placeholder="e.g. My Store / SuperMart"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Store Address (Prints on Invoices)
                  </label>
                  <textarea
                    className="form-input"
                    rows="2"
                    value={form.storeAddress}
                    onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
                    placeholder="Street Address, Area, City, State, PIN"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                      Official Phone / WhatsApp Number
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.storePhone}
                      onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                      GSTIN Number
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.storeGstin}
                      onChange={(e) => setForm({ ...form, storeGstin: e.target.value.toUpperCase() })}
                      placeholder="e.g. 33AAAAA0000A1Z5 (Optional)"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                      FSSAI License No.
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.fssai}
                      onChange={(e) => setForm({ ...form, fssai: e.target.value })}
                      placeholder="e.g. 12415022000193 (Optional)"
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                      MSME Registration No.
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.msme}
                      onChange={(e) => setForm({ ...form, msme: e.target.value })}
                      placeholder="e.g. UDYAM-XX-00-0000000 (Optional)"
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                      Sales / Support Email
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={form.salesEmail}
                      onChange={(e) => setForm({ ...form, salesEmail: e.target.value })}
                      placeholder="e.g. sales@yourstore.com (Optional)"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Invoice Terms & Conditions
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.terms}
                    onChange={(e) => setForm({ ...form, terms: e.target.value })}
                    placeholder="e.g. Immediate Payment. Goods once sold cannot be returned."
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Invoice Footer Message
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.invoiceFooter}
                    onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
                    placeholder="e.g. Thank you for shopping with us! Visit again."
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Store Logo URL / Path
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.storeLogo}
                    onChange={(e) => setForm({ ...form, storeLogo: e.target.value })}
                    placeholder="e.g. /images/logo.png"
                  />
                </div>

                {/* GST System Toggle */}
                <div style={{
                  padding: '16px 20px',
                  borderRadius: 10,
                  background: form.enableGst ? '#f0fdf4' : '#f8fafc',
                  border: form.enableGst ? '1.5px solid #86efac' : '1.5px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: form.enableGst ? '#16a34a' : '#94a3b8'
                      }} />
                      <span style={{ fontWeight: 700, fontSize: 15, color: form.enableGst ? '#15803d' : '#334155' }}>
                        GST Tax System: {form.enableGst ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: form.enableGst ? '#166534' : '#64748b' }}>
                      {form.enableGst
                        ? 'GST is enabled: Product forms include GST rates, purchases prompt for GST / Non-GST classification, and tax ledgers are active.'
                        : 'GST is disabled: All GST options, rates, and tax columns are hidden across the application for pure non-GST operation.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, enableGst: !prev.enableGst }))}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 20,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      border: 'none',
                      background: form.enableGst ? '#16a34a' : '#64748b',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {form.enableGst ? '✓ Enabled' : '✕ Disabled'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: DISPLAY SCALING & ACTION SAFEGUARDS */}
            {activeTab === 'preferences' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 16, color: 'var(--slate-800)', fontSize: 17, fontWeight: 700 }}>
                  Display Scaling & Action Safeguards
                </h3>

                {/* 1. Software Font Size & Interface Scaling Control */}
                <div className="card" style={{ padding: 20, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🔤</span> Software Font Size & Screen Scaling
                      </h4>
                      <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0 0' }}>
                        Increase or decrease text and interface size across the Billing POS terminal, catalog, and menus.
                      </p>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#eff6ff',
                      color: 'var(--brand-700)',
                      border: '1px solid #bfdbfe'
                    }}>
                      Active: {form.uiFontSize === 'compact' ? 'Compact (94%)' : (form.uiFontSize === 'standard' ? 'Standard (100%)' : (form.uiFontSize === 'large' ? 'Large (+16%)' : (form.uiFontSize === 'xlarge' ? 'Extra Large (+25%)' : 'Comfortable (+8% Bigger)')))}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 14 }}>
                    {[
                      { id: 'standard', name: 'Standard', scale: '100%', desc: 'Default base size' },
                      { id: 'comfortable', name: 'Comfortable', scale: '+8% Bigger', desc: 'Recommended (Little bit bigger)' },
                      { id: 'large', name: 'Large', scale: '+16% Bigger', desc: 'Easier reading from distance' },
                      { id: 'xlarge', name: 'Extra Large', scale: '+25% Bigger', desc: 'Maximum touch/display size' }
                    ].map((opt) => {
                      const isSelected = form.uiFontSize === opt.id || (opt.id === 'comfortable' && form.uiFontSize === 'normal');
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, uiFontSize: opt.id }));
                            localStorage.setItem('pos_ui_font_size', opt.id);
                            applyUiFontSize(opt.id);
                            window.dispatchEvent(new Event('pos_settings_updated'));
                          }}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            border: isSelected ? '2px solid var(--brand-600)' : '1px solid #cbd5e1',
                            background: isSelected ? '#eff6ff' : '#f8fafc',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                            boxShadow: isSelected ? '0 2px 6px rgba(79, 70, 229, 0.15)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 13.5, color: isSelected ? 'var(--brand-700)' : '#1e293b' }}>
                              {opt.name}
                            </span>
                            {isSelected && <span style={{ color: 'var(--brand-600)', fontSize: 14 }}>✓</span>}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--brand-600)' : '#64748b' }}>
                            {opt.scale}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Confirmation Safeguards */}
                <div className="card" style={{ padding: 18, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--slate-800)', marginBottom: 4 }}>
                    🛡️ Action Confirmation Safeguards
                  </label>
                  <p style={{ fontSize: 12.5, color: 'var(--slate-500)', marginBottom: 16 }}>
                    Enable confirmation popups before completing major actions to prevent accidental clicks.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.confirmCheckout}
                        onChange={(e) => setForm({ ...form, confirmCheckout: e.target.checked })}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-600)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 650, fontSize: 13.5, color: 'var(--slate-800)' }}>
                          Ask confirmation before Checkout (Billing POS)
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                          Shows an order summary popup before completing the sale transaction and generating the invoice.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.confirmQuotation}
                        onChange={(e) => setForm({ ...form, confirmQuotation: e.target.checked })}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-600)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 650, fontSize: 13.5, color: 'var(--slate-800)' }}>
                          Ask confirmation before Saving Quotations
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                          Displays a confirmation modal with customer details before saving the items as an estimate quotation.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.confirmPurchase}
                        onChange={(e) => setForm({ ...form, confirmPurchase: e.target.checked })}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-600)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 650, fontSize: 13.5, color: 'var(--slate-800)' }}>
                          Ask confirmation before Submitting Purchase Orders
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                          Confirms supplier, total cost, payment terms, and initial payment before recording the inward purchase.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PRINTER & HARDWARE (With A5 and Paper Size Examples) */}
            {activeTab === 'hardware' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 16, color: 'var(--slate-800)', fontSize: 17, fontWeight: 700 }}>
                  Printer & Scanner Configuration
                </h3>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Thermal Printer Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.printerName}
                    onChange={(e) => setForm({ ...form, printerName: e.target.value })}
                    placeholder="e.g. POS-80C or leave blank for default system printer"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Receipt & Invoice Paper Size
                  </label>
                  <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 10 }}>
                    Choose your default paper sheet format. Select <strong>A5</strong> to print compact half-sheet invoices (saves 50% paper) or <strong>A4</strong> for full-page sheets.
                  </p>
                  
                  {/* Paper Size Selection Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {[
                      { id: 'A5', label: 'Half Sheet A5 (148 × 210mm)', desc: 'Compact half-sheet, 2 bills per A4, saves 50% paper' },
                      { id: 'A4', label: 'Standard A4 Full Sheet (210 × 297mm)', desc: 'Official full-page corporate invoice document' },
                      { id: '80mm', label: '3" (80mm) Thermal Roll', desc: 'Standard high-speed POS receipt printer' },
                      { id: '58mm', label: '2" (58mm) Thermal Roll', desc: 'Mini compact POS receipt printer' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setForm({ ...form, paperSize: item.id })}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: '1.5px solid',
                          borderColor: form.paperSize === item.id ? 'var(--brand-500)' : 'var(--slate-200)',
                          background: form.paperSize === item.id ? 'var(--brand-50)' : 'var(--surface-card)',
                          color: form.paperSize === item.id ? 'var(--brand-700)' : 'var(--slate-600)',
                          fontWeight: 650,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: form.paperSize === item.id ? 'var(--brand-700)' : '#1e293b' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 11, color: form.paperSize === item.id ? 'var(--brand-600)' : '#64748b', marginTop: 3 }}>
                          {item.desc}
                        </div>
                        {form.paperSize === item.id && (
                          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: 'var(--brand-700)' }}>
                            ✓ Active
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* VISUAL PAPER SIZE COMPARISON & EXAMPLE DIAGRAM */}
                  <div style={{
                    marginTop: 16,
                    padding: 16,
                    background: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📐 Visual Paper Format Comparison & Guidelines
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      {/* A5 Card */}
                      <div style={{
                        padding: 12,
                        borderRadius: 6,
                        background: form.paperSize === 'A5' ? '#f0fdf4' : '#f8fafc',
                        border: form.paperSize === 'A5' ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          width: 44,
                          height: 62,
                          margin: '0 auto 8px',
                          background: '#ffffff',
                          border: '2px solid #16a34a',
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#16a34a'
                        }}>
                          A5
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#15803d' }}>A5 Half Sheet</div>
                        <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>148 × 210 mm</div>
                        <div style={{ fontSize: 10, color: '#166534', marginTop: 4, fontWeight: 600 }}>
                          🌟 2 bills per A4 sheet. Saves 50% paper!
                        </div>
                      </div>

                      {/* A4 Card */}
                      <div style={{
                        padding: 12,
                        borderRadius: 6,
                        background: form.paperSize === 'A4' ? '#eff6ff' : '#f8fafc',
                        border: form.paperSize === 'A4' ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          width: 54,
                          height: 76,
                          margin: '0 auto 8px',
                          background: '#ffffff',
                          border: '2px solid #2563eb',
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#2563eb'
                        }}>
                          A4
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#1d4ed8' }}>A4 Full Sheet</div>
                        <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>210 × 297 mm</div>
                        <div style={{ fontSize: 10, color: '#1e40af', marginTop: 4 }}>
                          Official full-page corporate invoices & quotes
                        </div>
                      </div>

                      {/* 80mm Card */}
                      <div style={{
                        padding: 12,
                        borderRadius: 6,
                        background: form.paperSize === '80mm' ? '#faf5ff' : '#f8fafc',
                        border: form.paperSize === '80mm' ? '1.5px solid #d8b4fe' : '1px solid #e2e8f0',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          width: 32,
                          height: 70,
                          margin: '0 auto 8px',
                          background: '#ffffff',
                          border: '2px dashed #9333ea',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 800,
                          color: '#9333ea'
                        }}>
                          80mm
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#7e22ce' }}>3" Thermal Roll</div>
                        <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>80 mm Roll</div>
                        <div style={{ fontSize: 10, color: '#6b21a8', marginTop: 4 }}>
                          High-speed POS thermal docket rolls
                        </div>
                      </div>

                      {/* 58mm Card */}
                      <div style={{
                        padding: 12,
                        borderRadius: 6,
                        background: form.paperSize === '58mm' ? '#fff7ed' : '#f8fafc',
                        border: form.paperSize === '58mm' ? '1.5px solid #fed7aa' : '1px solid #e2e8f0',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          width: 24,
                          height: 70,
                          margin: '0 auto 8px',
                          background: '#ffffff',
                          border: '2px dashed #ea580c',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 8.5,
                          fontWeight: 800,
                          color: '#ea580c'
                        }}>
                          58mm
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#c2410c' }}>2" Mini Roll</div>
                        <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>58 mm Roll</div>
                        <div style={{ fontSize: 10, color: '#9a3412', marginTop: 4 }}>
                          Pocket & handheld compact thermal printers
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Barcode Scanner Scan Action
                  </label>
                  <select
                    className="form-input"
                    value={form.barcodeAction}
                    onChange={(e) => setForm({ ...form, barcodeAction: e.target.value })}
                    style={{ width: '100%', height: 40 }}
                  >
                    <option value="auto-add">Auto-Add Item (+1 Quantity)</option>
                    <option value="prompt">Prompt for Quantity First</option>
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--slate-100)', paddingTop: 16 }}>
                  <input
                    type="checkbox"
                    id="autoPrint"
                    checked={form.autoPrint}
                    onChange={(e) => setForm({ ...form, autoPrint: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-600)' }}
                  />
                  <div>
                    <label htmlFor="autoPrint" style={{ fontWeight: 650, color: 'var(--slate-800)', cursor: 'pointer', fontSize: 13.5 }}>
                      Auto-Print Receipts
                    </label>
                    <p style={{ fontSize: 12, color: 'var(--slate-400)' }}>
                      Automatically trigger the print dialog immediately when a sale transaction is completed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: DATABASE & BACKUPS */}
            {activeTab === 'backup' && (
              <div className="animate-fade-in">
                <h3 style={{ marginBottom: 16, color: 'var(--slate-800)', fontSize: 17, fontWeight: 700 }}>
                  Automated Database Backups & Cloud Sync
                </h3>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Auto-Backup Destination Folder (e.g., Google Drive / External Disk)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.backupPath}
                    onChange={(e) => setForm({ ...form, backupPath: e.target.value })}
                    placeholder="e.g. G:\My Drive\SuperMart_Backups"
                  />
                  <p style={{ fontSize: 11.5, color: 'var(--slate-500)', marginTop: 4 }}>
                    Specify any folder path (such as a local Google Drive or OneDrive sync folder) to back up the SQLite database automatically.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                    Backup Retention Limit (files to keep)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    value={form.backupRetention}
                    onChange={(e) => setForm({ ...form, backupRetention: e.target.value })}
                    placeholder="5"
                  />
                  <p style={{ fontSize: 11.5, color: 'var(--slate-500)', marginTop: 4 }}>
                    The maximum number of historic timestamped backup snapshots to retain in the destination folder.
                  </p>
                </div>

                <div style={{
                  padding: 16,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>☁️</span>
                      <span>Instant Database Snapshot</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Create a point-in-time SQLite snapshot to your local storage and Google Drive folder right now.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualBackup}
                    disabled={backingUp}
                    className="btn btn--primary"
                    style={{
                      padding: '9px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      background: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: backingUp ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {backingUp ? 'Backing Up...' : 'Backup Database Now'}
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Save Settings button */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--slate-200)', paddingTop: 20 }}>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn--primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700 }}
              >
                <HiOutlineSave style={{ fontSize: 18 }} />
                {submitting ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        ) : (
          /* TAB 5: SECURITY & PASSWORD */
          <div style={{ padding: 24 }} className="animate-fade-in">
            {/* SECTION 1: ENABLE / DISABLE PASSWORDS (MASTER & FEATURE TOGGLES) */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--slate-800)', fontSize: 18, fontWeight: 700 }}>
                    Password Security Controls (Enable / Disable)
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4, marginBottom: 0 }}>
                    Enable or disable password protection across the entire application or per specific operation.
                  </p>
                </div>

                {/* Master All Passwords Quick Action Buttons */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleAllPasswords(true)}
                    className="btn btn--secondary btn--sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 650,
                      background: form.enableLoginPassword && form.enableDeleteBillPassword && form.enableDeleteProductPassword ? '#ecfdf5' : '#ffffff',
                      color: form.enableLoginPassword && form.enableDeleteBillPassword && form.enableDeleteProductPassword ? '#065f46' : '#334155',
                      borderColor: form.enableLoginPassword && form.enableDeleteBillPassword && form.enableDeleteProductPassword ? '#a7f3d0' : '#cbd5e1'
                    }}
                  >
                    <HiOutlineLockClosed style={{ fontSize: 15, color: '#059669' }} />
                    Enable All Passwords
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleAllPasswords(false)}
                    className="btn btn--secondary btn--sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 650,
                      background: !form.enableLoginPassword && !form.enableDeleteBillPassword && !form.enableDeleteProductPassword ? '#fef2f2' : '#ffffff',
                      color: !form.enableLoginPassword && !form.enableDeleteBillPassword && !form.enableDeleteProductPassword ? '#991b1b' : '#334155',
                      borderColor: !form.enableLoginPassword && !form.enableDeleteBillPassword && !form.enableDeleteProductPassword ? '#fecaca' : '#cbd5e1'
                    }}
                  >
                    <HiOutlineLockOpen style={{ fontSize: 15, color: '#dc2626' }} />
                    Disable All Passwords (Quick Access Mode)
                  </button>
                </div>
              </div>

              {/* Master Status Summary Banner */}
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: (form.enableLoginPassword && form.enableDeleteBillPassword && form.enableDeleteProductPassword)
                  ? '#f0fdf4'
                  : (!form.enableLoginPassword && !form.enableDeleteBillPassword && !form.enableDeleteProductPassword)
                    ? '#fff7ed'
                    : '#f8fafc',
                border: `1px solid ${(form.enableLoginPassword && form.enableDeleteBillPassword && form.enableDeleteProductPassword) ? '#bbf7d0' : (!form.enableLoginPassword && !form.enableDeleteBillPassword && !form.enableDeleteProductPassword) ? '#fed7aa' : '#e2e8f0'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>
                    {(form.enableLoginPassword && form.enableDeleteBillPassword && form.enableDeleteProductPassword) ? '🛡️' : (!form.enableLoginPassword && !form.enableDeleteBillPassword && !form.enableDeleteProductPassword) ? '⚡' : '⚙️'}
                  </span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>
                      {(form.enableLoginPassword && form.enableDeleteBillPassword && form.enableDeleteProductPassword)
                        ? 'Full Password Security Active'
                        : (!form.enableLoginPassword && !form.enableDeleteBillPassword && !form.enableDeleteProductPassword)
                          ? 'Quick Access Mode: All Passwords Disabled'
                          : 'Custom Security Mode: Partial Passwords Active'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {(form.enableLoginPassword && form.enableDeleteBillPassword && form.enableDeleteProductPassword)
                        ? 'All operations (Login, Bill Cancellation, Product Catalog Deletion) strictly require password authorization.'
                        : (!form.enableLoginPassword && !form.enableDeleteBillPassword && !form.enableDeleteProductPassword)
                          ? 'Zero passwords required. Cashiers can log in directly and void bills / items with simple 1-click confirmation.'
                          : 'Specific operations require password as configured below.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Granular Individual Feature Toggles Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. Software Startup Login Toggle */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: form.enableLoginPassword ? '#ffffff' : '#f8fafc',
                  border: `1px solid ${form.enableLoginPassword ? '#93c5fd' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  boxShadow: form.enableLoginPassword ? '0 1px 3px rgba(37,99,235,0.06)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: form.enableLoginPassword ? '#dbeafe' : '#f1f5f9',
                      color: form.enableLoginPassword ? '#1d4ed8' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18
                    }}>
                      <HiOutlineKey />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                        Require Password on Software Startup (Login Screen)
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        When OFF: The POS software opens directly to the Billing terminal without showing a login passcode prompt.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: form.enableLoginPassword ? '#ecfdf5' : '#f1f5f9',
                      color: form.enableLoginPassword ? '#059669' : '#64748b'
                    }}>
                      {form.enableLoginPassword ? '🔒 Required' : '🔓 Disabled'}
                    </span>
                    <input
                      type="checkbox"
                      checked={form.enableLoginPassword}
                      onChange={(e) => handleTogglePasswordSetting('enableLoginPassword', e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                    />
                  </div>
                </label>

                {/* 2. Void / Cancel Bill Toggle */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: form.enableDeleteBillPassword ? '#ffffff' : '#f8fafc',
                  border: `1px solid ${form.enableDeleteBillPassword ? '#fca5a5' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  boxShadow: form.enableDeleteBillPassword ? '0 1px 3px rgba(220,38,38,0.06)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: form.enableDeleteBillPassword ? '#fee2e2' : '#f1f5f9',
                      color: form.enableDeleteBillPassword ? '#b91c1c' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18
                    }}>
                      <HiOutlineTrash />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                        Require Password to Void / Cancel Completed Bills
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        When OFF: Cashiers can void sales invoices and restore inventory stock with simple 1-click confirmation.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: form.enableDeleteBillPassword ? '#ecfdf5' : '#f1f5f9',
                      color: form.enableDeleteBillPassword ? '#059669' : '#64748b'
                    }}>
                      {form.enableDeleteBillPassword ? '🔒 Required' : '🔓 Disabled'}
                    </span>
                    <input
                      type="checkbox"
                      checked={form.enableDeleteBillPassword}
                      onChange={(e) => handleTogglePasswordSetting('enableDeleteBillPassword', e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#dc2626' }}
                    />
                  </div>
                </label>

                {/* 3. Delete Products Toggle */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: form.enableDeleteProductPassword ? '#ffffff' : '#f8fafc',
                  border: `1px solid ${form.enableDeleteProductPassword ? '#c4b5fd' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  boxShadow: form.enableDeleteProductPassword ? '0 1px 3px rgba(124,58,237,0.06)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: form.enableDeleteProductPassword ? '#ede9fe' : '#f1f5f9',
                      color: form.enableDeleteProductPassword ? '#6d28d9' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18
                    }}>
                      <HiOutlineShoppingCart />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                        Require Password to Delete Products from Catalog
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        When OFF: Stock items can be removed from inventory catalog directly with 1-click confirmation.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: form.enableDeleteProductPassword ? '#ecfdf5' : '#f1f5f9',
                      color: form.enableDeleteProductPassword ? '#059669' : '#64748b'
                    }}>
                      {form.enableDeleteProductPassword ? '🔒 Required' : '🔓 Disabled'}
                    </span>
                    <input
                      type="checkbox"
                      checked={form.enableDeleteProductPassword}
                      onChange={(e) => handleTogglePasswordSetting('enableDeleteProductPassword', e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#7c3aed' }}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* SEPARATOR */}
            <div style={{ borderTop: '2px dashed #e2e8f0', margin: '28px 0 24px' }} />

            {/* SECTION 2: EDIT & CUSTOMIZE PASSWORDS */}
            <form onSubmit={handleUpdatePassword}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--slate-800)', fontSize: 18, fontWeight: 700 }}>
                    Change & Customize Passwords
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4, marginBottom: 0 }}>
                    Set custom passcodes for Login and Bill Deleting operations (used when password protection is enabled above).
                  </p>
                </div>
              </div>

            {/* Password Target Mode Selector Tabs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 10,
              margin: '20px 0 20px',
              background: '#f1f5f9',
              padding: 6,
              borderRadius: 12
            }}>
              <button
                type="button"
                onClick={() => { setPasswordTarget('login'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s ease',
                  background: passwordTarget === 'login' ? '#ffffff' : 'transparent',
                  color: passwordTarget === 'login' ? '#2563eb' : '#64748b',
                  boxShadow: passwordTarget === 'login' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <HiOutlineKey style={{ fontSize: 16 }} />
                <span>1. Software Login Password</span>
              </button>

              <button
                type="button"
                onClick={() => { setPasswordTarget('delete'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s ease',
                  background: passwordTarget === 'delete' ? '#ffffff' : 'transparent',
                  color: passwordTarget === 'delete' ? '#dc2626' : '#64748b',
                  boxShadow: passwordTarget === 'delete' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <HiOutlineTrash style={{ fontSize: 16 }} />
                <span>2. Bill Deletion Password</span>
              </button>

              <button
                type="button"
                onClick={() => { setPasswordTarget('both'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s ease',
                  background: passwordTarget === 'both' ? '#ffffff' : 'transparent',
                  color: passwordTarget === 'both' ? '#4f46e5' : '#64748b',
                  boxShadow: passwordTarget === 'both' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <HiOutlineRefresh style={{ fontSize: 16 }} />
                <span>3. Set Same for Both (Sync)</span>
              </button>
            </div>

            {/* Context Badge Card */}
            <div style={{
              padding: '14px 18px',
              borderRadius: 10,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              background: passwordTarget === 'login' ? '#eff6ff' : (passwordTarget === 'delete' ? '#fef2f2' : '#f5f3ff'),
              border: `1px solid ${passwordTarget === 'login' ? '#bfdbfe' : (passwordTarget === 'delete' ? '#fecaca' : '#ddd6fe')}`
            }}>
              <div style={{
                fontSize: 20,
                marginTop: 1,
                color: passwordTarget === 'login' ? '#2563eb' : (passwordTarget === 'delete' ? '#dc2626' : '#4f46e5')
              }}>
                {passwordTarget === 'login' && <HiOutlineKey />}
                {passwordTarget === 'delete' && <HiOutlineTrash />}
                {passwordTarget === 'both' && <HiOutlineRefresh />}
              </div>
              <div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: passwordTarget === 'login' ? '#1e40af' : (passwordTarget === 'delete' ? '#991b1b' : '#3730a3'),
                  marginBottom: 3
                }}>
                  {passwordTarget === 'login' && 'Editing: Software Startup Login Password'}
                  {passwordTarget === 'delete' && 'Editing: Bill Deletion & Item Removal Authorization Password'}
                  {passwordTarget === 'both' && 'Editing: Unified Master Password (Both Login & Deleting)'}
                </div>
                <div style={{
                  fontSize: 12.5,
                  color: passwordTarget === 'login' ? '#1e3a8a' : (passwordTarget === 'delete' ? '#7f1d1d' : '#312e81'),
                  lineHeight: 1.4
                }}>
                  {passwordTarget === 'login' && 'This passcode is required to log into the SuperMart POS desktop software at the login screen. It protects all system operations.'}
                  {passwordTarget === 'delete' && 'This administrative password protects cashiers from accidentally or maliciously cancelling completed customer bills or removing stock items from inventory.'}
                  {passwordTarget === 'both' && 'This will update both your Software Login passcode AND your Bill Deletion / Item Removal authorization to the exact same password in one click.'}
                </div>
              </div>
            </div>

            {/* Input 1: Current Password */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                {passwordTarget === 'login' && 'Current Software Login Password'}
                {passwordTarget === 'delete' && 'Current Bill Deleting Password'}
                {passwordTarget === 'both' && 'Current Password (Login or Delete Password)'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password (Default: admin123)"
                required
              />
            </div>

            {/* Input 2: New Password */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                {passwordTarget === 'login' && 'New Software Login Password'}
                {passwordTarget === 'delete' && 'New Bill Deleting Password'}
                {passwordTarget === 'both' && 'New Master Password (for Both)'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (Min 4 characters)"
                required
              />
            </div>

            {/* Input 3: Confirm New Password */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--slate-700)', fontSize: 13 }}>
                {passwordTarget === 'login' && 'Confirm New Login Password'}
                {passwordTarget === 'delete' && 'Confirm New Bill Deleting Password'}
                {passwordTarget === 'both' && 'Confirm New Master Password'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>

            {/* Toggle Show Password */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                {showPassword ? <HiOutlineEyeOff style={{ fontSize: 15 }} /> : <HiOutlineEye style={{ fontSize: 15 }} />}
                Show Passwords
              </label>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--slate-200)', paddingTop: 20 }}>
              <button
                type="submit"
                disabled={updatingPassword}
                className="btn btn--primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 700,
                  background: passwordTarget === 'delete' ? '#dc2626' : (passwordTarget === 'both' ? '#4f46e5' : 'var(--primary)')
                }}
              >
                <HiOutlineSave style={{ fontSize: 18 }} />
                {updatingPassword ? 'Updating...' : (
                  passwordTarget === 'login' ? 'Update Login Password' : (
                    passwordTarget === 'delete' ? 'Update Bill Deletion Password' : 'Update Both Passwords'
                  )
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      </div>

      {/* DEVELOPER & LICENSE ATTRIBUTION CARD */}
      <div style={{
        marginTop: 24,
        padding: '16px 22px',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }}>
            📜
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>
              SuperMart POS • Commercial Store License
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              Authorized for Single-Store Commercial Billing, Stock Ledger & Tax Compliance.
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
          <div>
            Developed by <strong style={{ color: '#0f172a' }}>devmoi</strong>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Release v2.0 • Perpetual Commercial License
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
