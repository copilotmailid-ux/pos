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
  unit: 'Pcs',
  purchasePrice: '',
  sellingPrice: '',
  retailPrice: '',
  wholesalePrice: '',
  minWholesaleQty: 1,
  stock: '',
  gstStock: '',
  nonGstStock: '',
  gstRate: 0
};

const categories = [
  'Flour & Mixes',
  'Chocolates & Cocoa',
  'Dairy & Fats',
  'Fillings & Glazes',
  'Colors & Flavors',
  'Decorations & Sprinkles',
  'Packaging & Boxes',
  'Tools & Moulds',
  'Bakery Raw Materials',
  'Other'
];
const unitsList = ['Kg', 'Gm', 'Pcs', 'Box', 'Bag', 'Liter', 'Pack', 'Tub', 'Tin', 'Bucket'];

const Products = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [enableGst, setEnableGst] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_enable_gst');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Password Protection States
  const [deleteInputPassword, setDeleteInputPassword] = useState('');
  const [enableDeleteProductPassword, setEnableDeleteProductPassword] = useState(true);
  // Settings tab is now managed globally under Ctrl + Shift + S

  const searchTimeoutRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    fetchProducts('', 1);
    fetchSettings();

    const handleSettingsUpdate = () => {
      fetchSettings();
    };
    window.addEventListener('pos_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('pos_settings_updated', handleSettingsUpdate);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      if (data) {
        const isGst = data.enableGst !== false;
        setEnableGst(isGst);
        localStorage.setItem('pos_enable_gst', String(isGst));
        if (data.enableDeleteProductPassword !== undefined) {
          setEnableDeleteProductPassword(data.enableDeleteProductPassword !== false);
        }
      }
    } catch (err) {
      console.error('Failed to load settings in Products', err);
    }
  };

  // Autofocus name input when modal opens
  useEffect(() => {
    if (modalOpen) {
      const timer = setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
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
    const rPrice = p.retailPrice ?? p.sellingPrice ?? '';
    const wPrice = p.wholesalePrice ?? p.sellingPrice ?? '';
    const currentStock = p.stock ?? ((p.gstStock || 0) + (p.nonGstStock || 0));
    setForm({ 
      name: p.name, 
      variant: p.variant || '',
      barcode: p.barcode || '', 
      category: p.category, 
      unit: p.unit || 'Pcs',
      purchasePrice: p.purchasePrice, 
      sellingPrice: rPrice, 
      retailPrice: rPrice,
      wholesalePrice: wPrice,
      minWholesaleQty: p.minWholesaleQty ?? 1,
      stock: currentStock,
      gstStock: currentStock,
      nonGstStock: 0,
      gstRate: p.gstRate !== undefined ? p.gstRate : 0
    });
    setModalOpen(true);
    document.body.classList.add('modal-open');
  };
  const closeModal = () => { setModalOpen(false); setEditId(null); setForm(emptyForm); document.body.classList.remove('modal-open'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category || form.purchasePrice === '' || (form.sellingPrice === '' && form.retailPrice === '')) {
      toast.error('Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      const effRetail = Number(form.retailPrice || form.sellingPrice || 0);
      const effWholesale = Number(form.wholesalePrice || effRetail);
      const totalStock = Number(form.stock !== '' ? form.stock : (form.gstStock || 0));
      const payload = {
        name: form.name,
        variant: form.variant,
        barcode: form.barcode || undefined,
        category: form.category,
        unit: form.unit || 'Pcs',
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: effRetail,
        retailPrice: effRetail,
        wholesalePrice: effWholesale,
        minWholesaleQty: Number(form.minWholesaleQty || 1),
        gstStock: totalStock,
        nonGstStock: 0,
        stock: totalStock,
        gstRate: enableGst ? Number(form.gstRate || 0) : 0
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
    if (enableDeleteProductPassword) {
      if (!deleteInputPassword) {
        toast.error('Admin password is required to delete product!');
        return;
      }

      const savedPassword = localStorage.getItem('pos_admin_delete_pass') || 'admin123';
      if (deleteInputPassword !== savedPassword) {
        toast.error('Incorrect Admin Password! Delete authorization rejected.');
        return;
      }
    }

    try {
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
            placeholder="Search by product name or category..."
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
                  <th>Product & Variant</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Purchase</th>
                  <th>Home / Retail</th>
                  <th>Shop / Wholesale</th>
                  {enableGst && <th className="text-center" style={{ width: 95 }}>GST Rate</th>}
                  <th className="text-center">Total Stock</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={enableGst ? 9 : 8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>Loading products...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={enableGst ? 9 : 8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>No products found</td></tr>
                ) : (
                  products.map((p) => {
                    const rPrice = p.retailPrice ?? p.sellingPrice ?? 0;
                    const wPrice = p.wholesalePrice ?? p.sellingPrice ?? 0;
                    return (
                      <tr key={p._id}>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: 13.5 }}>{p.name}</div>
                            {p.variant && <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2 }}>{p.variant}</div>}
                          </div>
                        </td>
                        <td><span className="badge badge--brand">{p.category}</span></td>
                        <td><span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{p.unit || 'Pcs'}</span></td>
                        <td style={{ color: 'var(--slate-600)' }}>₹{p.purchasePrice ? p.purchasePrice.toFixed(2) : '0.00'}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>
                            ₹{rPrice.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#7c3aed' }}>
                            ₹{wPrice.toFixed(2)}
                          </span>
                          {p.minWholesaleQty > 1 && (
                            <div style={{ fontSize: 10, color: '#6d28d9' }}>Min: {p.minWholesaleQty} {p.unit || 'Pcs'}</div>
                          )}
                        </td>
                        {enableGst && (
                          <td className="text-center">
                            <span className="badge" style={{
                              background: (p.gstRate > 0) ? '#ecfdf5' : '#f8fafc',
                              color: (p.gstRate > 0) ? '#047857' : '#64748b',
                              border: `1px solid ${(p.gstRate > 0) ? '#a7f3d0' : '#e2e8f0'}`,
                              fontWeight: 700,
                              padding: '4px 8px',
                              borderRadius: 6
                            }}>
                              {p.gstRate ?? 0}%
                            </span>
                          </td>
                        )}
                        <td className="text-center">
                          <span className={getStockClass(p.stock)}>
                            {p.stock} {p.unit || 'Pcs'}
                          </span>
                        </td>
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
                    );
                  })
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
              <h3>{editId ? 'Edit Bakery Product' : 'Add Wholesale / Retail Product'}</h3>
              <button onClick={closeModal} className="close-btn"><HiOutlineX /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Product Name <span className="required">*</span></label>
                <input 
                  type="text" 
                  ref={nameInputRef} 
                  className="form-input" 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  placeholder="e.g., Maida Superior Baking Grade" 
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1.5 }}>
                  <label>Category <span className="required">*</span></label>
                  <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Unit of Measure (UOM) <span className="required">*</span></label>
                  <select className="form-select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {unitsList.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Size / Variant <span className="hint">(e.g., 500g, 1kg, 50kg Bag)</span></label>
                <input type="text" className="form-input" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="e.g., 50kg Bag" />
              </div>
              
              {/* GST Rate Section (if GST enabled) */}
              {enableGst && (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <label style={{ fontWeight: 650, color: '#166534', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13 }}>
                    <span>🏷️ Applicable GST Rate (%)</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: '#15803d' }}>(Select slab or enter custom rate)</span>
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <select
                      className="form-select"
                      style={{ width: 150, background: '#fff', fontWeight: 600 }}
                      value={[0, 5, 12, 18, 28].includes(Number(form.gstRate)) ? Number(form.gstRate) : 'custom'}
                      onChange={(e) => {
                        if (e.target.value !== 'custom') {
                          setForm({ ...form, gstRate: Number(e.target.value) });
                        }
                      }}
                    >
                      <option value={0}>0% (Exempt)</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST</option>
                      <option value={28}>28% GST</option>
                      <option value="custom">Custom Rate...</option>
                    </select>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="form-input"
                        placeholder="e.g. 18"
                        value={form.gstRate}
                        onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
                        style={{ width: '100%', background: '#fff' }}
                      />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748b', fontSize: 13, pointerEvents: 'none' }}>%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Dual Pricing Section */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>💰 Pricing Tiers & Purchase Cost</span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Purchase Cost ₹ <span className="required">*</span></label>
                    <input type="number" min="0" step="0.01" className="form-input" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="0.00" required />
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#0369a1', fontWeight: 600 }}>🏠 Home / Retail ₹ <span className="required">*</span></label>
                    <input type="number" min="0" step="0.01" className="form-input" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value, sellingPrice: e.target.value })} placeholder="0.00" required />
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#7c3aed', fontWeight: 600 }}>🏢 Shop / Wholesale ₹ <span className="required">*</span></label>
                    <input type="number" min="0" step="0.01" className="form-input" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} placeholder="0.00" required />
                  </div>
                  <div className="form-group" style={{ maxWidth: 120 }}>
                    <label>Min Shop Qty</label>
                    <input type="number" min="1" step="1" className="form-input" value={form.minWholesaleQty} onChange={(e) => setForm({ ...form, minWholesaleQty: e.target.value })} placeholder="1" />
                  </div>
                </div>
              </div>
              
              <div className="form-group" style={{ marginTop: 14 }}>
                <label style={{ fontWeight: 650, color: '#334155' }}>
                  Available Stock Quantity ({form.unit || 'Pcs'}) <span className="required">*</span>
                </label>
                <input 
                  type="number" 
                  min="0" 
                  className="form-input" 
                  value={form.stock} 
                  onChange={(e) => setForm({ ...form, stock: e.target.value, gstStock: e.target.value, nonGstStock: 0 })} 
                  placeholder="0" 
                  required 
                />
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
              {enableDeleteProductPassword ? (
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
              ) : (
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 6,
                  padding: '10px 14px',
                  color: '#065f46',
                  fontSize: 12.5,
                  textAlign: 'center',
                  marginTop: 12
                }}>
                  ⚡ Password check is disabled in Settings. Click below to delete.
                </div>
              )}
              <div className="form-actions" style={{ marginTop: 20 }}>
                <button type="button" onClick={closeDeleteModal} className="btn btn--ghost">Cancel</button>
                <button type="submit" className="btn btn--danger">{enableDeleteProductPassword ? 'Authenticate & Delete' : 'Confirm Delete'}</button>
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
