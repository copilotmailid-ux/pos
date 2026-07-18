import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineCog,
  HiOutlineLockClosed
} from 'react-icons/hi';

const emptyForm = {
  name: '',
  variant: '',
  barcode: '',
  category: '',
  purchasePrice: '',
  sellingPrice: '',
  stock: '',
  gstRate: 12
};

const categories = ['Dairy', 'Beverages', 'Snacks', 'Grocery', 'Personal Care', 'Household', 'Other'];
const gstSlabs = [0, 5, 12, 18, 28];

const Products = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Password Protection States
  const [deleteInputPassword, setDeleteInputPassword] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  useEffect(() => {
    fetchProducts();

    // Hotkey handler for Ctrl + Shift + P
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, []);

  const fetchProducts = async (query = '') => {
    try {
      setLoading(true);
      const { data } = await api.get(`/products${query ? `?search=${query}` : ''}`);
      setProducts(data);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => fetchProducts(value), 300);
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); document.body.classList.add('modal-open'); };
  const openEdit = (p) => {
    setEditId(p._id);
    setForm({ 
      name: p.name, 
      variant: p.variant || '',
      barcode: p.barcode, 
      category: p.category, 
      purchasePrice: p.purchasePrice, 
      sellingPrice: p.sellingPrice, 
      stock: p.stock,
      gstRate: p.gstRate ?? 12 
    });
    setModalOpen(true);
    document.body.classList.add('modal-open');
  };
  const closeModal = () => { setModalOpen(false); setEditId(null); setForm(emptyForm); document.body.classList.remove('modal-open'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.purchasePrice || !form.sellingPrice) {
      toast.error('Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      if (editId) { await api.put(`/products/${editId}`, form); toast.success('Product updated'); }
      else { await api.post('/products', form); toast.success('Product added'); }
      closeModal(); fetchProducts(search);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save product'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    const savedPassword = localStorage.getItem('pos_admin_delete_pass') || 'admin123';
    
    if (deleteInputPassword !== savedPassword) {
      toast.error('Incorrect Admin Password! Deletion blocked.');
      return;
    }

    try {
      await api.delete(`/products/${deleteModal._id}`);
      toast.success('Product deleted successfully');
      setDeleteModal(null);
      setDeleteInputPassword('');
      document.body.classList.remove('modal-open');
      fetchProducts(search);
    } catch { 
      toast.error('Failed to delete product'); 
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    const savedPassword = localStorage.getItem('pos_admin_delete_pass') || 'admin123';

    if (currentPasswordInput !== savedPassword) {
      toast.error('Current password does not match!');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      toast.error('New passwords do not match!');
      return;
    }
    if (newPasswordInput.length < 4) {
      toast.error('Password must be at least 4 characters long');
      return;
    }

    localStorage.setItem('pos_admin_delete_pass', newPasswordInput);
    toast.success('Admin password updated successfully!');
    setSettingsOpen(false);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
  };

  const getStockClass = (stock) => {
    if (stock < 10) return 'badge badge--red';
    if (stock < 25) return 'badge badge--amber';
    return 'badge badge--green';
  };

  const closeDeleteModal = () => {
    setDeleteModal(null);
    setDeleteInputPassword('');
    document.body.classList.remove('modal-open');
  };

  return (
    <>
      <div className="animate-fade-in">
        <div className="page-header-row">
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>Products</h1>
            <p style={{ color: 'var(--slate-500)', marginTop: 4, fontSize: 14 }}>
              Manage your inventory ({products.length} products). Press <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>Ctrl + Shift + P</kbd> for settings.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setSettingsOpen(true)} className="btn btn--ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--slate-300)' }}>
              <HiOutlineCog /> Settings
            </button>
            <button id="add-product-btn" onClick={openAdd} className="btn btn--primary">
              <HiOutlinePlus /> Add Product
            </button>
          </div>
        </div>

        <div className="search-bar">
          <span className="search-icon"><HiOutlineSearch /></span>
          <input
            id="product-search"
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search products, barcode, category..."
          />
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Category</th>
                  <th>Purchase Price</th>
                  <th>Selling Price</th>
                  <th>GST Rate</th>
                  <th>Stock</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>Loading products...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>No products found</td></tr>
                ) : (
                  products.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{p.name}</div>
                        {p.variant && <div style={{ fontSize: 11, color: 'var(--slate-450)', marginTop: 2 }}>{p.variant}</div>}
                      </td>
                      <td className="font-mono" style={{ fontSize: 12, color: 'var(--slate-500)' }}>{p.barcode}</td>
                      <td><span className="badge badge--brand">{p.category}</span></td>
                      <td style={{ color: 'var(--slate-600)' }}>₹{p.purchasePrice.toFixed(2)}</td>
                      <td className="font-medium">₹{p.sellingPrice.toFixed(2)}</td>
                      <td style={{ color: 'var(--slate-650)' }}>{p.gstRate ?? 12}%</td>
                      <td><span className={getStockClass(p.stock)}>{p.stock}</span></td>
                      <td className="text-right">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <button onClick={() => openEdit(p)} className="btn--icon" title="Edit">
                            <HiOutlinePencil />
                          </button>
                          <button onClick={() => { setDeleteModal(p); document.body.classList.add('modal-open'); }} className="btn--icon btn--icon-danger" title="Delete">
                            <HiOutlineTrash />
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
      </div>

      {/* Add/Edit Modal — portaled to body to escape stacking context */}
      {modalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeModal} />
          <div className="modal modal--lg">
            <div className="modal-header">
              <h3>{editId ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={closeModal} className="close-btn"><HiOutlineX /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Product Name <span className="required">*</span></label>
                <input type="text" className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Dabur Red Paste" />
              </div>
              <div className="form-group">
                <label>Size / Variant <span className="hint">(e.g., 50g, 10 Rs, 1L)</span></label>
                <input type="text" className="form-input" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="e.g., 50g, 10 Rs" />
              </div>
              <div className="form-group">
                <label>Barcode <span className="hint">(auto-generated if empty)</span></label>
                <input type="text" className="form-input form-input--mono" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Auto-generated" />
              </div>
              <div className="form-group">
                <label>Category <span className="required">*</span></label>
                <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Purchase ₹ <span className="required">*</span></label>
                  <input type="number" min="0" step="0.01" className="form-input" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Selling ₹ <span className="required">*</span></label>
                  <input type="number" min="0" step="0.01" className="form-input" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>GST Slab (%)</label>
                  <select className="form-select" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}>
                    {gstSlabs.map((rate) => <option key={rate} value={rate}>{rate}% GST</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Stock</label>
                  <input type="number" min="0" className="form-input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" onClick={closeModal} className="btn btn--ghost">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn--primary">
                  {saving ? 'Saving...' : editId ? 'Update' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal — portaled to body */}
      {deleteModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeDeleteModal} />
          <div className="modal modal--md">
            <div className="modal-header">
              <h3>Delete Product: Authentication Required</h3>
              <button onClick={closeDeleteModal} className="close-btn"><HiOutlineX /></button>
            </div>
            <form onSubmit={handleDelete} className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <HiOutlineTrash size={24} />
                </div>
                <p style={{ fontSize: 14, color: 'var(--slate-600)' }}>
                  Are you sure you want to delete <strong>{deleteModal.name}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="form-group" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HiOutlineLockClosed /> Enter Delete-Protection Admin Password
                </label>
                <input
                  type="password"
                  value={deleteInputPassword}
                  onChange={(e) => setDeleteInputPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter admin password (Default: admin123)"
                  required
                  autoFocus
                />
              </div>
              <div className="form-actions" style={{ marginTop: 20 }}>
                <button type="button" onClick={closeDeleteModal} className="btn btn--ghost">Cancel</button>
                <button type="submit" className="btn btn--danger">Authenticate & Delete</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal — portaled to body */}
      {settingsOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setSettingsOpen(false)} />
          <div className="modal modal--md">
            <div className="modal-header">
              <h3>Settings: Admin Password Management</h3>
              <button onClick={() => setSettingsOpen(false)} className="close-btn"><HiOutlineX /></button>
            </div>
            <form onSubmit={handleSaveSettings} className="modal-body">
              <div className="form-group">
                <label>Current Admin Password</label>
                <input
                  type="password"
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  className="form-input"
                  placeholder="Enter current password (Default: admin123)"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>New Admin Password</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="form-input"
                  placeholder="Min 4 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm New Admin Password</label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="form-input"
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <div className="form-actions" style={{ marginTop: 24 }}>
                <button type="button" onClick={() => setSettingsOpen(false)} className="btn btn--ghost">Cancel</button>
                <button type="submit" className="btn btn--primary">Update Admin Password</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Products;
