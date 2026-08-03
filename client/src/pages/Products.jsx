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
  HiOutlineLockClosed,
  HiOutlineChevronLeft,
  HiOutlineChevronRight
} from 'react-icons/hi';
import { useRef } from 'react';

const emptyForm = {
  name: '',
  variant: '',
  barcode: '',
  category: '',
  purchasePrice: '',
  sellingPrice: '',
  gstStock: '',
  nonGstStock: '',
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

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Password Protection States
  const [deleteInputPassword, setDeleteInputPassword] = useState('');
  // Settings tab is now managed globally under Ctrl + Shift + S

  const searchTimeoutRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    fetchProducts('', 1);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Autofocus barcode input when modal opens
  useEffect(() => {
    if (modalOpen) {
      const timer = setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [modalOpen]);

  const fetchProducts = async (query = '', pageNum = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/products?search=${encodeURIComponent(query)}&page=${pageNum}&limit=15`);
      if (data && data.products) {
        setProducts(data.products);
        setTotalPages(data.pages || 1);
        setTotalProducts(data.total || 0);
        setPage(data.page || 1);
      } else {
        setProducts(data || []);
        setTotalPages(1);
        setTotalProducts(data ? data.length : 0);
        setPage(1);
      }
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => fetchProducts(value, 1), 300);
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
      gstStock: p.gstStock ?? p.stock,
      nonGstStock: p.nonGstStock ?? 0,
      gstRate: p.gstRate ?? 12 
    });
    setModalOpen(true);
    document.body.classList.add('modal-open');
  };
  const closeModal = () => { setModalOpen(false); setEditId(null); setForm(emptyForm); document.body.classList.remove('modal-open'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category || form.purchasePrice === '' || form.sellingPrice === '') {
      toast.error('Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        variant: form.variant,
        barcode: form.barcode || undefined,
        category: form.category,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        gstStock: Number(form.gstStock || 0),
        nonGstStock: Number(form.nonGstStock || 0),
        stock: Number(form.gstStock || 0) + Number(form.nonGstStock || 0),
        gstRate: Number(form.gstRate)
      };

      if (editId) {
        await api.put(`/products/${editId}`, payload);
        toast.success('Product updated!');
      } else {
        await api.post('/products', payload);
        toast.success('Product created!');
      }
      closeModal();
      fetchProducts(search, page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving product');
    } finally { setSaving(false); }
  };

  const closeDeleteModal = () => {
    setDeleteModal(null);
    setDeleteInputPassword('');
    document.body.classList.remove('modal-open');
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!deleteInputPassword) {
      toast.error('Admin password is required to delete product!');
      return;
    }

    try {
      const savedPassword = localStorage.getItem('pos_admin_delete_pass') || 'admin123';
      if (deleteInputPassword !== savedPassword) {
        toast.error('Incorrect Admin Password! Delete authorization rejected.');
        return;
      }

      await api.delete(`/products/${deleteModal._id}`);
      toast.success('Product deleted successfully');
      closeDeleteModal();
      fetchProducts(search, page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting product');
    }
  };

  // handleUpdatePassword has been moved to global settings page

  const getStockClass = (st) => {
    if (st <= 0) return 'badge badge--danger';
    if (st < 10) return 'badge badge--warning';
    return 'badge badge--success';
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Products</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={openAdd} className="btn btn--primary">
            <HiOutlinePlus /> Add Product
          </button>
        </div>
      </div>

      <div className="products-layout">
        <div className="search-input-group" style={{ marginBottom: 20 }}>
          <HiOutlineSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by product name, barcode, or category..."
            value={search}
            onChange={handleSearch}
            style={{ border: 'none', background: 'transparent', height: '100%', width: '100%', outline: 'none', fontSize: 14 }}
          />
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table className="data-table data-table--bordered">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Category</th>
                  <th>Purchase Price</th>
                  <th>Selling Price</th>
                  <th className="text-center">GST Rate</th>
                  <th className="text-center">GST Stock (A)</th>
                  <th className="text-center">Non-GST Stock (B)</th>
                  <th className="text-center">Total Stock</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>Loading products...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>No products found</td></tr>
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
                      <td className="text-center" style={{ color: 'var(--slate-650)' }}>{p.gstRate ?? 12}%</td>
                      <td className="text-center" style={{ fontWeight: 600, color: '#16a34a' }}>{p.gstStock || 0}</td>
                      <td className="text-center" style={{ fontWeight: 600, color: '#d97706' }}>{p.nonGstStock || 0}</td>
                      <td className="text-center"><span className={getStockClass(p.stock)}>{p.stock}</span></td>
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
          {totalPages > 1 && (
            <div className="pagination">
              <p>Page {page} of {totalPages} (Total: {totalProducts} products)</p>
              <div className="pagination-btns">
                <button type="button" onClick={() => fetchProducts(search, Math.max(1, page - 1))} disabled={page === 1} className="pagination-btn">
                  <HiOutlineChevronLeft />
                </button>
                <button type="button" onClick={() => fetchProducts(search, Math.min(totalPages, page + 1))} disabled={page === totalPages} className="pagination-btn">
                  <HiOutlineChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal — portaled to body */}
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
                <label>Barcode <span className="hint">(auto-generated if empty)</span></label>
                <input 
                  type="text" 
                  ref={barcodeInputRef} 
                  className="form-input form-input--mono" 
                  value={form.barcode} 
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })} 
                  placeholder="Scan or type barcode (Focus here to scan)" 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (nameInputRef.current) {
                        nameInputRef.current.focus();
                      }
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label>Product Name <span className="required">*</span></label>
                <input 
                  type="text" 
                  ref={nameInputRef} 
                  className="form-input" 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  placeholder="e.g., Dabur Red Paste" 
                />
              </div>
              <div className="form-group">
                <label>Size / Variant <span className="hint">(e.g., 50g, 10 Rs, 1L)</span></label>
                <input type="text" className="form-input" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="e.g., 50g, 10 Rs" />
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
              </div>
              
              <div className="form-row" style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div className="form-group">
                  <label style={{ color: '#16a34a', fontWeight: 650 }}>GST Stock (Supplier A)</label>
                  <input type="number" min="0" className="form-input" value={form.gstStock} onChange={(e) => setForm({ ...form, gstStock: e.target.value })} placeholder="0" />
                </div>
                <div className="form-group">
                  <label style={{ color: '#d97706', fontWeight: 650 }}>Non-GST Stock (Supplier B)</label>
                  <input type="number" min="0" className="form-input" value={form.nonGstStock} onChange={(e) => setForm({ ...form, nonGstStock: e.target.value })} placeholder="0" />
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 650 }}>Total Stock</label>
                  <input type="number" className="form-input" value={(Number(form.gstStock || 0) + Number(form.nonGstStock || 0))} disabled style={{ background: '#f1f5f9' }} />
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>
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

      {/* Delete Confirmation Modal */}
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

      {/* Admin settings modal removed - now managed globally via Ctrl+Shift+S */}
    </div>
  );
};

export default Products;
