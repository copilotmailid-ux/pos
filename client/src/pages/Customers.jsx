import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';


// Let's rewrite imports to use 'react-icons/hi'
import {
  HiOutlineSearch as SearchIcon,
  HiOutlineUsers as UsersIcon,
  HiOutlineCurrencyRupee as RupeeIcon,
  HiOutlineCalendar as CalendarIcon,
  HiOutlinePlus as PlusIcon,
  HiOutlinePencil as PencilIcon,
  HiOutlineTrash as TrashIcon,
  HiOutlineX as XIcon
} from 'react-icons/hi';

const emptyForm = {
  name: '',
  mobile: '',
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
    setForm({ name: c.name, mobile: c.mobile });
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

  // Aggregation Metrics
  const totalUniqueCustomers = customers.length;
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
      <div className="dashboard-stats" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><UsersIcon /></div>
          <div className="stat-info">
            <span className="stat-title">Loyal Customers</span>
            <span className="stat-value">{totalUniqueCustomers}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}><RupeeIcon /></div>
          <div className="stat-info">
            <span className="stat-title">Avg Spend / Customer</span>
            <span className="stat-value">₹{avgSpendPerCustomer.toFixed(2)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fdf2f8', color: '#db2777' }}><CalendarIcon /></div>
          <div className="stat-info">
            <span className="stat-title">Top Customer</span>
            <span className="stat-value" style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
              {topCustomer ? `${topCustomer.name} (₹${topCustomer.totalSpend.toFixed(2)})` : 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="search-bar" style={{ marginBottom: 20 }}>
        <span className="search-icon"><SearchIcon /></span>
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search by customer name or 10-digit mobile number..."
        />
      </div>

      {/* Customers Data Grid */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Mobile</th>
                <th>Customer Name</th>
                <th className="text-center">Total Visits</th>
                <th className="text-right">Total Purchased Value</th>
                <th className="text-center">Last Visit</th>
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
                customers.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <span className="mono-tag" style={{ fontSize: 13 }}>{c.mobile}</span>
                    </td>
                    <td className="font-semibold" style={{ color: 'var(--slate-800)' }}>
                      {c.name}
                    </td>
                    <td className="text-center">
                      <span className="badge badge--green" style={{ padding: '4px 10px', fontSize: 12 }}>
                        {c.totalVisits} {c.totalVisits === 1 ? 'visit' : 'visits'}
                      </span>
                    </td>
                    <td className="text-right font-semibold" style={{ color: '#2563eb' }}>
                      ₹{(c.totalSpend || 0).toFixed(2)}
                    </td>
                    <td className="text-center" style={{ fontSize: 13, color: 'var(--slate-600)' }}>
                      {c.lastVisit ? (
                        <>
                          {new Date(c.lastVisit).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                          {' '}
                          {new Date(c.lastVisit).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </>
                      ) : (
                        <em style={{ color: 'var(--slate-400)' }}>Never Shopped</em>
                      )}
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={() => openEdit(c)} className="btn--icon" title="Edit Customer Details">
                          <PencilIcon />
                        </button>
                        <button onClick={() => setDeleteModal(c)} className="btn--icon btn--icon-danger" title="Remove Customer Profile">
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
              <h3>{editId ? 'Edit Customer Profile' : 'Register New Customer'}</h3>
              <button onClick={closeModal} className="close-btn"><XIcon /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Customer Name <span className="required">*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  placeholder="e.g., Deva" 
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
                  disabled={!!editId} // Keep phone uneditable during update to maintain invoice history integrity
                  required 
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
    </div>
  );
};

export default Customers;
