import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineClipboardList,
  HiOutlineTruck,
  HiOutlineRefresh,
  HiOutlineInboxIn,
  HiOutlineArrowLeft
} from 'react-icons/hi';

const gstSlabs = [0, 5, 12, 18, 28];

const Purchases = () => {
  const [activeTab, setActiveTab] = useState('history'); // 'history', 'new'
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // New Purchase Form States
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);

  // Product Search State (within New Purchase)
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);

  // Details Modal States
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
  }, []);

  const fetchPurchases = async (query = '') => {
    try {
      setLoading(true);
      const { data } = await api.get(`/purchases${query ? `?search=${query}` : ''}`);
      setPurchases(data);
    } catch {
      toast.error('Failed to load purchases history');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers');
      setSuppliers(data);
    } catch {
      toast.error('Failed to load suppliers list');
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    clearTimeout(window._purchaseSearchTimeout);
    window._purchaseSearchTimeout = setTimeout(() => fetchPurchases(value), 300);
  };

  // Product Search Handler (in New Purchase)
  const handleProductSearch = async (e) => {
    const query = e.target.value;
    setProductSearch(query);
    if (query.trim().length >= 2) {
      try {
        const { data } = await api.get(`/products?search=${encodeURIComponent(query)}`);
        setProductResults(data.slice(0, 5));
      } catch {
        console.error('Failed to search products');
      }
    } else {
      setProductResults([]);
    }
  };

  const addProductToPurchase = (prod) => {
    // Check if product already exists in item list
    const exists = purchaseItems.some(item => item.product === prod._id);
    if (exists) {
      toast.error('Product already added to list');
      setProductSearch('');
      setProductResults([]);
      return;
    }

    setPurchaseItems(prev => [
      ...prev,
      {
        product: prod._id,
        productName: prod.name,
        variant: prod.variant || '',
        barcode: prod.barcode,
        quantity: 10, // default start quantity
        purchasePrice: prod.purchasePrice || 0,
        sellingPrice: prod.sellingPrice || 0,
        gstRate: prod.gstRate ?? 12,
        total: (prod.purchasePrice || 0) * 10 * (1 + ((prod.gstRate ?? 12) / 100))
      }
    ]);
    setProductSearch('');
    setProductResults([]);
  };

  const removePurchaseItem = (index) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItemField = (index, field, value) => {
    setPurchaseItems(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      
      // Calculate row total: (Quantity * PurchasePrice) * (1 + (GstRate/100))
      const qty = Number(updated[index].quantity) || 0;
      const price = Number(updated[index].purchasePrice) || 0;
      const gst = Number(updated[index].gstRate) || 0;
      updated[index].total = qty * price * (1 + (gst / 100));

      return updated;
    });
  };

  // Calculate Aggregated Invoice Totals
  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let tax = 0;
    
    purchaseItems.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.purchasePrice) || 0;
      const gst = Number(item.gstRate) || 0;
      
      const itemSubtotal = qty * price;
      const itemTax = itemSubtotal * (gst / 100);

      subtotal += itemSubtotal;
      tax += itemTax;
    });

    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const { subtotal, tax, total } = calculateInvoiceTotals();

  // Submit New Purchase Form
  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    if (purchaseItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    // Basic item validation
    for (const item of purchaseItems) {
      if (item.quantity <= 0 || item.purchasePrice < 0 || item.sellingPrice < 0) {
        toast.error('Quantity and prices must be positive values');
        return;
      }
    }

    try {
      await api.post('/purchases', {
        supplier: selectedSupplier,
        invoiceDate,
        paymentMethod,
        notes,
        items: purchaseItems
      });

      toast.success('Purchase recorded and stock levels incremented!');
      
      // Reset form
      setSelectedSupplier('');
      setNotes('');
      setPurchaseItems([]);
      setActiveTab('history');
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record purchase invoice');
    }
  };

  // Open Details Drawer
  const openDetails = async (id) => {
    try {
      const { data } = await api.get(`/purchases/${id}`);
      setSelectedPurchase(data);
      setDetailsOpen(true);
      document.body.classList.add('modal-open');
    } catch {
      toast.error('Failed to load invoice details');
    }
  };

  const closeDetails = () => {
    setSelectedPurchase(null);
    setDetailsOpen(false);
    document.body.classList.remove('modal-open');
  };

  // Process Purchase Return
  const handleProcessReturn = async () => {
    if (!selectedPurchase) return;
    if (!window.confirm('Are you sure you want to return this purchase? This will automatically decrease the product stock levels.')) return;
    
    setReturning(true);
    try {
      await api.post(`/purchases/${selectedPurchase._id}/return`);
      toast.success('Purchase items returned! Product stocks adjusted.');
      closeDetails();
      fetchPurchases(searchQuery);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process return');
    } finally {
      setReturning(false);
    }
  };

  return (
    <>
      <div className="animate-fade-in">
        <div className="page-header-row" style={{ marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>Purchases</h1>
            <p style={{ color: 'var(--slate-500)', marginTop: 4, fontSize: 14 }}>
              Buy new product stock from suppliers and record supply invoices.
            </p>
          </div>
          <div>
            {activeTab === 'history' ? (
              <button onClick={() => setActiveTab('new')} className="btn btn--primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <HiOutlinePlus /> New Purchase
              </button>
            ) : (
              <button onClick={() => setActiveTab('history')} className="btn btn--ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--slate-300)' }}>
                <HiOutlineArrowLeft /> Back to History
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--slate-200)', paddingBottom: 8 }}>
          <button 
            onClick={() => setActiveTab('history')}
            className={`btn ${activeTab === 'history' ? 'btn--primary' : 'btn--ghost'}`}
            style={{ padding: '8px 16px', fontSize: 13, border: activeTab === 'history' ? 'none' : '1px solid var(--slate-200)' }}
          >
            <HiOutlineClipboardList /> Purchase Invoices History
          </button>
          <button 
            onClick={() => setActiveTab('new')}
            className={`btn ${activeTab === 'new' ? 'btn--primary' : 'btn--ghost'}`}
            style={{ padding: '8px 16px', fontSize: 13, border: activeTab === 'new' ? 'none' : '1px solid var(--slate-200)' }}
          >
            <HiOutlineTruck /> New Purchase Order
          </button>
        </div>

        {/* ================= HISTORY TAB ================= */}
        {activeTab === 'history' && (
          <>
            <div className="search-bar">
              <span className="search-icon"><HiOutlineSearch /></span>
              <input
                id="purchase-search"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search past purchases by invoice / purchase number..."
              />
            </div>

            <div className="card">
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Purchase Number</th>
                      <th>Supplier</th>
                      <th>Purchase Date</th>
                      <th>Payment Method</th>
                      <th>Status</th>
                      <th>Total Amount</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>Loading purchases history...</td></tr>
                    ) : purchases.length === 0 ? (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>No purchases recorded yet</td></tr>
                    ) : (
                      purchases.map((p) => (
                        <tr key={p._id} onClick={() => openDetails(p._id)} style={{ cursor: 'pointer' }} className="clickable-row">
                          <td className="font-mono font-bold" style={{ color: 'var(--brand-600)' }}>{p.purchaseNumber}</td>
                          <td className="font-medium" style={{ color: 'var(--slate-700)' }}>{p.supplier?.name || 'Deleted Vendor'}</td>
                          <td>{new Date(p.invoiceDate).toLocaleDateString()}</td>
                          <td>{p.paymentMethod}</td>
                          <td>
                            <span className={`badge ${p.status === 'Received' ? 'badge--green' : 'badge--red'}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="font-semibold" style={{ color: 'var(--slate-800)' }}>₹{p.total.toFixed(2)}</td>
                          <td className="text-right">
                            <button onClick={(e) => { e.stopPropagation(); openDetails(p._id); }} className="btn btn--ghost" style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--slate-300)' }}>
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================= NEW PURCHASE TAB ================= */}
        {activeTab === 'new' && (
          <form onSubmit={handlePurchaseSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--slate-700)' }}>
                🛒 Invoice Line Items
              </h3>

              {/* Product search box */}
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <div className="search-bar" style={{ margin: 0 }}>
                  <span className="search-icon"><HiOutlineSearch /></span>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={handleProductSearch}
                    placeholder="Search product by name or barcode to add to supply bill..."
                  />
                </div>
                
                {productResults.length > 0 && (
                  <div className="search-results-dropdown" style={{ display: 'block', top: '100%', width: '100%', zIndex: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: 'var(--shadow-lg)' }}>
                    {productResults.map((p) => (
                      <div 
                        key={p._id}
                        onClick={() => addProductToPurchase(p)}
                        className="search-result-item"
                        style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name} {p.variant ? `(${p.variant})` : ''}</div>
                        <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>Barcode: {p.barcode} | Stock: {p.stock} | Selling Price: ₹{p.sellingPrice}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Purchase items list table */}
              <div className="table-wrapper" style={{ minHeight: 250, boxShadow: 'none', border: '1px solid #f1f5f9' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Details</th>
                      <th style={{ width: 100 }}>Quantity</th>
                      <th style={{ width: 120 }}>Unit Purchase Price (₹)</th>
                      <th style={{ width: 120 }}>Unit Selling Price (₹)</th>
                      <th style={{ width: 100 }}>GST Slab</th>
                      <th style={{ width: 110 }}>Row Total</th>
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
                          <HiOutlineInboxIn size={32} />
                          <p style={{ marginTop: 8, fontSize: 13 }}>No products added. Search and add products above.</p>
                        </td>
                      </tr>
                    ) : (
                      purchaseItems.map((item, idx) => (
                        <tr key={item.product}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{item.productName}</div>
                            <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{item.variant || 'No variant'} | {item.barcode}</div>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: 13, height: 'auto' }}
                              value={item.quantity}
                              onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: 13, height: 'auto' }}
                              value={item.purchasePrice}
                              onChange={(e) => updateItemField(idx, 'purchasePrice', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: 13, height: 'auto' }}
                              value={item.sellingPrice}
                              onChange={(e) => updateItemField(idx, 'sellingPrice', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <select
                              className="form-select"
                              style={{ padding: '4px 8px', fontSize: 12, height: 'auto' }}
                              value={item.gstRate}
                              onChange={(e) => updateItemField(idx, 'gstRate', Number(e.target.value))}
                            >
                              {gstSlabs.map(slab => <option key={slab} value={slab}>{slab}%</option>)}
                            </select>
                          </td>
                          <td className="font-semibold">₹{item.total.toFixed(2)}</td>
                          <td>
                            <button type="button" onClick={() => removePurchaseItem(idx)} className="btn--icon btn--icon-danger" style={{ padding: 4 }}>
                              <HiOutlineTrash />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar form checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 12 }}>📋 Invoice Summary</h4>
                
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 650 }}>Select Supplier <span className="required">*</span></label>
                  <select 
                    className="form-select"
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    required
                  >
                    <option value="">Choose Supplier</option>
                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 650 }}>Invoice Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 650 }}>Payment Type</label>
                  <select 
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit">Credit (Outstanding)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 650 }}>Notes / Remarks</label>
                  <textarea
                    className="form-input"
                    style={{ height: 60, fontSize: 12, resize: 'none' }}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Delivery notes, invoice ref..."
                  />
                </div>
              </div>

              {/* Invoice calculation values card */}
              <div className="card" style={{ padding: 14, background: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--slate-500)', marginBottom: 6 }}>
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--slate-500)', marginBottom: 10 }}>
                  <span>GST Amount:</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: 'var(--slate-800)', borderTop: '1px dashed var(--slate-300)', paddingTop: 10, marginBottom: 14 }}>
                  <span>Total Amount:</span>
                  <span style={{ color: 'var(--brand-600)' }}>₹{total.toFixed(2)}</span>
                </div>

                <button 
                  type="submit" 
                  disabled={purchaseItems.length === 0} 
                  className="btn btn--primary" 
                  style={{ width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
                >
                  ✓ Submit Purchase
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Purchase Invoice Details Modal */}
      {detailsOpen && selectedPurchase && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeDetails} />
          <div className="modal modal--lg animate-fade-in" style={{ width: '90%', maxWidth: '750px' }}>
            <div className="modal-header">
              <h3>Invoice Supply Details</h3>
              <button onClick={closeDetails} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
              
              {/* Header Info Block */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 650 }}>Purchase Order No:</span>
                  <p className="font-mono font-bold" style={{ fontSize: 15, color: 'var(--brand-600)', marginTop: 2 }}>{selectedPurchase.purchaseNumber}</p>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 650 }}>Supplier:</span>
                  <p style={{ fontWeight: 700, color: 'var(--slate-800)', marginTop: 2 }}>{selectedPurchase.supplier?.name || 'Deleted Supplier'}</p>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 650 }}>Invoice Date:</span>
                  <p style={{ fontWeight: 600, color: 'var(--slate-700)', marginTop: 2 }}>{new Date(selectedPurchase.invoiceDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 650 }}>Payment Mode:</span>
                  <p style={{ fontWeight: 600, color: 'var(--slate-700)', marginTop: 2 }}>{selectedPurchase.paymentMethod}</p>
                </div>
              </div>

              {/* Items details table */}
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 10 }}>Supply Itemization</h4>
              <div className="table-wrapper" style={{ boxShadow: 'none', border: '1px solid #f1f5f9', marginBottom: 20 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Barcode</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Purchase cost</th>
                      <th className="text-right">GST rate</th>
                      <th className="text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.items.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{item.productName}</span>
                          {item.variant && <span style={{ fontSize: 11, color: 'var(--slate-400)', marginLeft: 6 }}>({item.variant})</span>}
                        </td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{item.barcode}</td>
                        <td className="text-right font-medium">{item.quantity}</td>
                        <td className="text-right">₹{item.purchasePrice.toFixed(2)}</td>
                        <td className="text-right">{item.gstRate}%</td>
                        <td className="text-right font-semibold">₹{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals split and note */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'start' }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>Notes / Remarks:</span>
                  <p style={{ fontSize: 12, color: 'var(--slate-700)', marginTop: 4, lineHeight: '1.4' }}>{selectedPurchase.notes || 'No remarks recorded for this invoice.'}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--slate-500)' }}>
                    <span>Subtotal:</span>
                    <span>₹{selectedPurchase.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--slate-500)' }}>
                    <span>GST:</span>
                    <span>₹{selectedPurchase.tax.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: 'var(--slate-800)', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                    <span>Invoice Total:</span>
                    <span>₹{selectedPurchase.total.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>
                    <span>Status:</span>
                    <span className={`badge ${selectedPurchase.status === 'Received' ? 'badge--green' : 'badge--red'}`}>{selectedPurchase.status}</span>
                  </div>
                </div>
              </div>

              {/* Return trigger action row */}
              {selectedPurchase.status === 'Received' && (
                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 24, paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={handleProcessReturn} 
                    disabled={returning} 
                    className="btn btn--danger" 
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 12px' }}
                  >
                    <HiOutlineRefresh /> {returning ? 'Returning...' : 'Return Purchase Order & Deduct Inventory'}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Purchases;
