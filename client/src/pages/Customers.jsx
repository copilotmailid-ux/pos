import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import Receipt from '../components/Receipt';

// Icons from 'react-icons/hi'
import {
  HiOutlineSearch as SearchIcon,
  HiOutlineUsers as UsersIcon,
  HiOutlineCurrencyRupee as RupeeIcon,
  HiOutlineCalendar as CalendarIcon,
  HiOutlinePlus as PlusIcon,
  HiOutlinePencil as PencilIcon,
  HiOutlineTrash as TrashIcon,
  HiOutlineX as XIcon,
  HiOutlineDocumentText,
  HiOutlinePrinter
} from 'react-icons/hi';

const emptyForm = {
  name: '',
  mobile: '',
  customerType: 'Home',
  address: '',
  gstin: ''
};

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // CRUD Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Customer Ledger & Purchase History states
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerDateFilter, setLedgerDateFilter] = useState('');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [selectedReceiptSale, setSelectedReceiptSale] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (query = '') => {
    try {
      setLoading(true);
      const { data } = await api.get(`/customers${query ? `?search=${query}` : ''}`);
      setCustomers(data);
    } catch {
      toast.error('Failed to load customer details');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(window._customerSearchTimeout);
    window._customerSearchTimeout = setTimeout(() => fetchCustomers(value), 300);
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c) => {
    setEditId(c._id);
    setForm({ 
      name: c.name, 
      mobile: c.mobile,
      customerType: c.customerType || 'Home',
      address: c.address || '',
      gstin: c.gstin || ''
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditId(null); setForm(emptyForm); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.mobile) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (form.mobile.length !== 10) {
      toast.error('Mobile number must be exactly 10 digits');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await api.put(`/customers/${editId}`, form);
        toast.success('Customer updated successfully');
      } else {
        await api.post('/customers', form);
        toast.success('Customer registered successfully');
      }
      closeModal();
      fetchCustomers(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/customers/${deleteModal._id}`);
      toast.success('Customer deleted successfully');
      setDeleteModal(null);
      fetchCustomers(search);
    } catch {
      toast.error('Failed to delete customer');
    }
  };

  const openCustomerLedger = async (customer) => {
    setLedgerCustomer(customer);
    setLedgerDateFilter('');
    setLedgerSearchQuery('');
    setLedgerLoading(true);
    document.body.classList.add('modal-open');
    try {
      const { data } = await api.get(`/customers/${customer._id}/ledger`);
      setLedgerData(data);
    } catch {
      toast.error('Failed to load customer purchase ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const closeCustomerLedger = () => {
    setLedgerCustomer(null);
    setLedgerData(null);
    setLedgerDateFilter('');
    setLedgerSearchQuery('');
    document.body.classList.remove('modal-open');
  };

  const filteredLedgerSales = (ledgerData?.sales || []).filter(sale => {
    if (ledgerDateFilter) {
      const saleDate = new Date(sale.createdAt || sale.date).toISOString().slice(0, 10);
      if (saleDate !== ledgerDateFilter) return false;
    }
    if (ledgerSearchQuery.trim()) {
      const q = ledgerSearchQuery.toLowerCase().trim();
      const invNo = String(sale.invoiceNumber || sale.invoiceNo || sale.id).toLowerCase();
      const itemsMatch = (sale.items || []).some(item => (item.productName || item.name || '').toLowerCase().includes(q));
      const payMatch = String(sale.paymentMethod || '').toLowerCase().includes(q);
      if (!invNo.includes(q) && !itemsMatch && !payMatch) return false;
    }
    return true;
  });

  // Aggregation Metrics
  const totalUniqueCustomers = customers.length;
  const shopCount = customers.filter(c => c.customerType === 'Shop').length;
  const homeCount = customers.filter(c => c.customerType !== 'Shop').length;
  const totalStoreSpend = customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0);
  const avgSpendPerCustomer = totalUniqueCustomers > 0 ? (totalStoreSpend / totalUniqueCustomers) : 0;
  const topCustomer = customers.filter(c => (c.totalSpend || 0) > 0)[0];

  return (
    <div className="animate-fade-in">
      <div className="page-header-row">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>Customer Management</h1>
          <p style={{ color: 'var(--slate-500)', marginTop: 4, fontSize: 14 }}>
            Track and manage customer profiles, loyalty metrics, and transaction values.
          </p>
        </div>
        <button id="add-customer-btn" onClick={openAdd} className="btn btn--primary">
          <PlusIcon /> Add Customer
        </button>
      </div>

      {/* Summary KPI Widgets */}
      <div className="stats-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card-body">
            <div>
              <p className="stat-card-label">Total Accounts</p>
              <p className="stat-card-value">{totalUniqueCustomers}</p>
            </div>
            <div className="stat-card-icon stat-card-icon--blue">
              <UsersIcon />
            </div>
          </div>
          <div className="stat-card-bar stat-card-bar--blue"></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-body">
            <div>
              <p className="stat-card-label">🏠 Home Bakers (Retail)</p>
              <p className="stat-card-value" style={{ color: '#0369a1' }}>{homeCount}</p>
            </div>
            <div className="stat-card-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
              <UsersIcon />
            </div>
          </div>
          <div className="stat-card-bar" style={{ background: '#0284c7' }}></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-body">
            <div>
              <p className="stat-card-label">🏢 Bakeries / Shops (Wholesale)</p>
              <p className="stat-card-value" style={{ color: '#7c3aed' }}>{shopCount}</p>
            </div>
            <div className="stat-card-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}>
              <UsersIcon />
            </div>
          </div>
          <div className="stat-card-bar" style={{ background: '#7c3aed' }}></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-body">
            <div>
              <p className="stat-card-label">Total Revenue</p>
              <p className="stat-card-value">₹{totalStoreSpend.toFixed(2)}</p>
            </div>
            <div className="stat-card-icon stat-card-icon--green">
              <RupeeIcon />
            </div>
          </div>
          <div className="stat-card-bar stat-card-bar--green"></div>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 20 }}>
        <div className="search-input-group" style={{ maxWidth: 450 }}>
          <SearchIcon className="search-icon" />
          <input
            type="text"
            placeholder="Search by customer name, mobile, or bakery name..."
            value={search}
            onChange={handleSearch}
            className="search-input"
          />
        </div>
      </div>

      {/* Customers Data Grid */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table data-table--bordered">
            <thead>
              <tr>
                <th>Customer Mobile</th>
                <th>Name & Type</th>
                <th>GSTIN / Location</th>
                <th className="text-center">Total Visits</th>
                <th className="text-right">Total Purchased Value</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-loading">
                    <div className="spinner"></div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    <p>No customers recorded</p>
                    <p className="sub">Register customers manually or enter their details during checkout</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isShop = c.customerType === 'Shop';
                  return (
                    <tr key={c._id}>
                      <td>
                        <span className="mono-tag" style={{ fontSize: 13 }}>{c.mobile}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-semibold" style={{ color: 'var(--slate-800)' }}>
                            {c.name}
                          </span>
                          <span 
                            className="badge" 
                            style={{ 
                              background: isShop ? '#ede9fe' : '#e0f2fe',
                              color: isShop ? '#6d28d9' : '#0369a1',
                              fontWeight: 700,
                              fontSize: 11
                            }}
                          >
                            {isShop ? '🏢 Shop / Wholesale' : '🏠 Home / Retail'}
                          </span>
                        </div>
                      </td>
                      <td>
                        {c.gstin && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>GST: {c.gstin}</div>}
                        {c.address ? (
                          <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>{c.address}</div>
                        ) : (
                          <em style={{ fontSize: 11, color: 'var(--slate-400)' }}>—</em>
                        )}
                      </td>
                      <td className="text-center">
                        <span className="badge badge--green" style={{ padding: '4px 10px', fontSize: 12 }}>
                          {c.totalVisits} {c.totalVisits === 1 ? 'visit' : 'visits'}
                        </span>
                      </td>
                      <td className="text-right font-semibold" style={{ color: '#2563eb' }}>
                        ₹{(c.totalSpend || 0).toFixed(2)}
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <button 
                            onClick={() => openCustomerLedger(c)} 
                            className="btn--icon" 
                            title="View Customer Purchase Ledger & Bills" 
                            style={{ color: '#4f46e5', background: '#ede9fe' }}
                          >
                            <HiOutlineDocumentText size={18} />
                          </button>
                          <button onClick={() => openEdit(c)} className="btn--icon" title="Edit Customer Details">
                            <PencilIcon />
                          </button>
                          <button onClick={() => setDeleteModal(c)} className="btn--icon btn--icon-danger" title="Remove Customer Profile">
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeModal} />
          <div className="modal modal--md animate-fade-in">
            <div className="modal-header">
              <h3>{editId ? 'Edit Customer Profile' : 'Register Wholesale / Retail Customer'}</h3>
              <button onClick={closeModal} className="close-btn"><XIcon /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {/* Customer Type Toggle */}
              <div className="form-group">
                <label>Billing Tier & Account Type <span className="required">*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, customerType: 'Home' })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: form.customerType === 'Home' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: form.customerType === 'Home' ? '#f0f9ff' : '#fff',
                      color: form.customerType === 'Home' ? '#0369a1' : '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    🏠 Home Baker / Retail
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, customerType: 'Shop' })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: form.customerType === 'Shop' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      background: form.customerType === 'Shop' ? '#f5f3ff' : '#fff',
                      color: form.customerType === 'Shop' ? '#6d28d9' : '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    🏢 Bakery / Wholesale Shop
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Customer / Bakery Name <span className="required">*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  placeholder={form.customerType === 'Shop' ? 'e.g., Royal Bakers' : 'e.g., Priya Sharma'} 
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Mobile Number (10 digits) <span className="required">*</span></label>
                <input 
                  type="text" 
                  maxLength="10"
                  className="form-input form-input--mono" 
                  value={form.mobile} 
                  onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })} 
                  placeholder="e.g., 9398989898" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>GSTIN {form.customerType === 'Shop' ? <span className="hint">(Recommended for Wholesale)</span> : <span className="hint">(Optional)</span>}</label>
                <input 
                  type="text" 
                  className="form-input form-input--mono" 
                  value={form.gstin} 
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} 
                  placeholder="e.g., 36AAACG1234A1Z5" 
                />
              </div>
              <div className="form-group">
                <label>Address / Shop Location</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={form.address} 
                  onChange={(e) => setForm({ ...form, address: e.target.value })} 
                  placeholder="e.g., Shop #12, Bakery Lane, Market Road" 
                />
              </div>
              <div className="form-actions" style={{ marginTop: 24 }}>
                <button type="button" onClick={closeModal} className="btn btn--ghost">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn--primary">
                  {saving ? 'Saving...' : editId ? 'Update Profile' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteModal(null)} />
          <div className="modal modal--sm animate-fade-in">
            <div className="modal-body">
              <div className="delete-modal-content">
                <div className="delete-modal-icon"><TrashIcon /></div>
                <h3>Delete Customer</h3>
                <p>Are you sure you want to remove <strong>{deleteModal.name}</strong> from customer records? This will not delete their sales receipts history.</p>
                <div className="delete-modal-actions" style={{ marginTop: 20 }}>
                  <button onClick={() => setDeleteModal(null)} className="btn btn--ghost">Cancel</button>
                  <button onClick={handleDelete} className="btn btn--danger">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Ledger & Bills History Modal */}
      {ledgerCustomer && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeCustomerLedger} />
          <div className="modal modal--lg animate-fade-in" style={{ maxWidth: 880, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HiOutlineDocumentText size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, color: 'var(--slate-850)' }}>{ledgerCustomer.name}</h3>
                    <span 
                      className="badge" 
                      style={{ 
                        background: ledgerCustomer.customerType === 'Shop' ? '#ede9fe' : '#e0f2fe',
                        color: ledgerCustomer.customerType === 'Shop' ? '#6d28d9' : '#0369a1',
                        fontWeight: 700,
                        fontSize: 11
                      }}
                    >
                      {ledgerCustomer.customerType === 'Shop' ? '🏢 Commercial Bakery (Wholesale)' : '🏠 Home Baker (Retail)'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>📱 <strong>{ledgerCustomer.mobile}</strong></span>
                    {ledgerCustomer.gstin && <span>GST: <strong>{ledgerCustomer.gstin}</strong></span>}
                    {ledgerCustomer.address && <span>📍 {ledgerCustomer.address}</span>}
                  </div>
                </div>
              </div>
              <button onClick={closeCustomerLedger} className="close-btn"><XIcon /></button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
              {/* Ledger Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Total Purchased</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
                    ₹{(ledgerData?.summary?.totalSpend || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Total Invoices / Visits</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                    {ledgerData?.summary?.totalVisits || 0} Bills
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Average Order Value</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>
                    ₹{(ledgerData?.summary?.avgOrderValue || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Last Bill Date</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)', marginTop: 8 }}>
                    {ledgerData?.summary?.lastVisit 
                      ? new Date(ledgerData.summary.lastVisit).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'No bills yet'}
                  </div>
                </div>
              </div>

              {/* Invoices List Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    📜 Purchase Bills & Invoice Ledger ({filteredLedgerSales.length}{filteredLedgerSales.length !== (ledgerData?.sales?.length || 0) ? ` of ${ledgerData?.sales?.length || 0}` : ''})
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 8px' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>📅 Date:</span>
                      <input 
                        type="date"
                        value={ledgerDateFilter}
                        onChange={(e) => setLedgerDateFilter(e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: '#1e293b' }}
                      />
                      {ledgerDateFilter && (
                        <button 
                          type="button" 
                          onClick={() => setLedgerDateFilter('')}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: '0 2px' }}
                          title="Clear date filter"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={ledgerSearchQuery}
                        onChange={(e) => setLedgerSearchQuery(e.target.value)}
                        placeholder="Search invoice or item..."
                        style={{
                          padding: '4px 24px 4px 10px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          outline: 'none',
                          width: 170
                        }}
                      />
                      {ledgerSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setLedgerSearchQuery('')}
                          style={{ position: 'absolute', right: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 12 }}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {ledgerLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>
                    Loading purchase history...
                  </div>
                ) : !ledgerData?.sales || ledgerData.sales.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>
                    No bills recorded yet for this customer.
                  </div>
                ) : filteredLedgerSales.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--slate-400)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-600)' }}>No matching bills found</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Try clearing the date or search filter above.</p>
                  </div>
                ) : (
                  <div className="table-wrapper" style={{ maxHeight: 340, overflowY: 'auto' }}>
                    <table className="data-table data-table--bordered" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Date & Time</th>
                          <th>Items Purchased</th>
                          <th>Payment</th>
                          <th className="text-right">Bill Total</th>
                          <th className="text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLedgerSales.map((sale) => (
                          <tr key={sale._id || sale.id}>
                            <td className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>
                              {sale.invoiceNumber || sale.invoiceNo || `#${sale.id}`}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--slate-600)', whiteSpace: 'nowrap' }}>
                              {new Date(sale.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              <div style={{ fontSize: 10, color: 'var(--slate-400)' }}>
                                {new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: 12, color: 'var(--slate-700)', maxWidth: 300 }}>
                                {sale.items && sale.items.length > 0 ? (
                                  sale.items.map((it, idx) => (
                                    <span key={idx} style={{ display: 'inline-block', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', margin: '2px 3px 2px 0', fontSize: 11 }}>
                                      {it.productName} <strong>x{it.quantity}</strong>
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ color: 'var(--slate-400)' }}>—</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge--neutral" style={{ fontSize: 11 }}>
                                {sale.paymentMethod || 'Cash'}
                              </span>
                            </td>
                            <td className="text-right font-semibold" style={{ fontSize: 13, color: '#16a34a' }}>
                              ₹{Number(sale.grandTotal || 0).toFixed(2)}
                            </td>
                            <td className="text-center">
                              <button
                                onClick={() => setSelectedReceiptSale(sale)}
                                className="btn btn--secondary btn--sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11 }}
                                title="View & Print Bill Receipt"
                              >
                                <HiOutlinePrinter size={14} /> View Bill
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={closeCustomerLedger} className="btn btn--secondary">
                Close Ledger
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Selected Receipt View/Reprint Modal */}
      {selectedReceiptSale && (
        <Receipt 
          sale={selectedReceiptSale} 
          onClose={() => setSelectedReceiptSale(null)} 
        />
      )}
    </div>
  );
};

export default Customers;
