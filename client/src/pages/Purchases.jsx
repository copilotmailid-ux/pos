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
  HiOutlineArrowLeft,
  HiOutlineDocumentText,
  HiOutlineShieldCheck
} from 'react-icons/hi';

const gstSlabs = [0, 5, 12, 18, 28];

const Purchases = () => {
  const [activeTab, setActiveTab] = useState('history'); // 'history', 'new'
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // New Purchase Type Prompt Modal
  const [showTypeSelectModal, setShowTypeSelectModal] = useState(false);

  // New Purchase Form States
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [purchaseTaxType, setPurchaseTaxType] = useState('GST');
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

  const handleOpenNewPurchase = () => {
    setShowTypeSelectModal(true);
    document.body.classList.add('modal-open');
  };

  const closeTypeSelectModal = () => {
    setShowTypeSelectModal(false);
    document.body.classList.remove('modal-open');
  };

  const selectPurchaseClassification = (type) => {
    handleTaxTypeChange(type);
    closeTypeSelectModal();
    setActiveTab('new');
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

  const handleTaxTypeChange = (newType) => {
    setPurchaseTaxType(newType);
    setPurchaseItems(prev => prev.map(item => {
      const newGst = newType === 'Non-GST' ? 0 : (item.productDefaultGst ?? 12);
      const qty = Number(item.quantity) || 0;
      const price = Number(item.purchasePrice) || 0;
      return {
        ...item,
        gstRate: newGst,
        total: qty * price * (1 + (newGst / 100))
      };
    }));
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

    const prodDefaultGst = prod.gstRate ?? 12;
    const initialGst = purchaseTaxType === 'Non-GST' ? 0 : prodDefaultGst;
    const qty = 10;
    const price = prod.purchasePrice || 0;

    setPurchaseItems(prev => [
      ...prev,
      {
        product: prod._id,
        productName: prod.name,
        variant: prod.variant || '',
        barcode: prod.barcode,
        quantity: qty, // default start quantity
        purchasePrice: price,
        sellingPrice: prod.sellingPrice || 0,
        productDefaultGst: prodDefaultGst,
        gstRate: initialGst,
        total: qty * price * (1 + (initialGst / 100))
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
        purchaseTaxType,
        invoiceDate,
        paymentMethod,
        notes,
        items: purchaseItems
      });

      toast.success('Purchase recorded and stock levels incremented!');

      // Reset form
      setSelectedSupplier('');
      setPurchaseTaxType('GST');
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
              <button onClick={handleOpenNewPurchase} className="btn btn--primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
            onClick={handleOpenNewPurchase}
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
                🛒 Invoice Line Items ({purchaseTaxType === 'GST' ? 'GST Purchase - Supplier A' : 'Non-GST Purchase - Supplier B'})
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

                {/* Search Results Dropdown */}
                {productResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: '#fff',
                    border: '1px solid var(--slate-200)',
                    borderRadius: '0 0 8px 8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    overflow: 'hidden'
                  }}>
                    {productResults.map(p => (
                      <div
                        key={p._id}
                        onClick={() => addProductToPurchase(p)}
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--slate-100)'
                        }}
                        className="hover-bg-slate-50"
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--slate-800)' }}>{p.name} {p.variant && `(${p.variant})`}</div>
                          <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'monospace' }}>Barcode: {p.barcode}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-600)' }}>₹{p.purchasePrice}</div>
                          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>Stock: GST {p.gstStock || 0} | Non-GST {p.nonGstStock || 0}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="table-wrapper">
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Product Details</th>
                      <th style={{ width: 90 }}>Quantity</th>
                      <th style={{ width: 110 }}>Unit Purchase Price (₹)</th>
                      <th style={{ width: 110 }}>Unit Selling Price (₹)</th>
                      <th style={{ width: 90 }}>GST Slab</th>
                      <th style={{ width: 100 }}>Row Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}><HiOutlineInboxIn /></div>
                          No products added. Search and add products above.
                        </td>
                      </tr>
                    ) : (
                      purchaseItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{item.productName}</div>
                            {item.variant && <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{item.variant}</div>}
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
                  <label style={{ fontSize: 11, fontWeight: 650 }}>Purchase Tax Classification <span className="required">*</span></label>
                  <select
                    className="form-select"
                    value={purchaseTaxType}
                    onChange={(e) => handleTaxTypeChange(e.target.value)}
                    style={{ width: '100%', maxWidth: '100%', fontWeight: 600, borderColor: purchaseTaxType === 'GST' ? '#16a34a' : '#d97706' }}
                  >
                    <option value="GST">GST Purchase (Supplier A)</option>
                    <option value="Non-GST">Non-GST Purchase (Supplier B)</option>
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

              {/* Totals & Submit */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--slate-600)' }}>
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: 'var(--slate-600)' }}>
                  <span>GST Amount:</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--slate-200)', paddingTop: 10, marginBottom: 16, color: 'var(--brand-600)' }}>
                  <span>Total Amount:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>

                <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
                  ✓ Submit Purchase
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Purchase Classification Prompt Modal */}
      {showTypeSelectModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeTypeSelectModal} />
          <div className="modal modal--md">
            <div className="modal-header">
              <h3>Select Purchase Classification</h3>
              <button onClick={closeTypeSelectModal} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 14, color: 'var(--slate-600)', marginBottom: 20 }}>
                How would you like to record this supply purchase invoice?
              </p>

              <div style={{ display: 'grid', gap: 16 }}>
                {/* GST Card Option */}
                <div
                  onClick={() => selectPurchaseClassification('GST')}
                  style={{
                    padding: 18,
                    borderRadius: 12,
                    border: '2px solid #bbf7d0',
                    background: '#f0fdf4',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  className="hover-card-gst"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: '#16a34a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <HiOutlineShieldCheck size={20} /> GST Tax Purchase (Supplier A)
                    </h4>
                    <span className="badge badge--success">GST Tax Invoice</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#15803d', margin: 0 }}>
                    Items purchased with GST input tax invoices. Stock will be added to <strong>GST Stock</strong> quota (Product's standard GST slab applied).
                  </p>
                </div>

                {/* Non-GST Card Option */}
                <div
                  onClick={() => selectPurchaseClassification('Non-GST')}
                  style={{
                    padding: 18,
                    borderRadius: 12,
                    border: '2px solid #fef3c7',
                    background: '#fffbeb',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  className="hover-card-nongst"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: '#d97706', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <HiOutlineDocumentText size={20} /> Non-GST Purchase (Supplier B)
                    </h4>
                    <span className="badge badge--warning">Non-GST Invoice</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#b45309', margin: 0 }}>
                    Items purchased without GST invoice from local/unregistered suppliers. Stock added to <strong>Non-GST Stock</strong> quota (Default GST rate set to 0%).
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button onClick={closeTypeSelectModal} className="btn btn--ghost">Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Invoice Supply Details Modal */}
      {detailsOpen && selectedPurchase && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeDetails} />
          <div className="modal modal--lg">
            <div className="modal-header">
              <h3>Invoice Supply Details</h3>
              <button onClick={closeDetails} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>Purchase Order No:</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand-600)', fontSize: 15 }}>{selectedPurchase.purchaseNumber}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>Supplier:</div>
                  <div style={{ fontWeight: 650, color: 'var(--slate-800)' }}>{selectedPurchase.supplier?.name || 'Deleted Supplier'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>Invoice Date:</div>
                  <div>{new Date(selectedPurchase.invoiceDate).toLocaleDateString()}</div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>Payment Mode:</div>
                <div style={{ fontWeight: 600 }}>{selectedPurchase.paymentMethod}</div>
              </div>

              {selectedPurchase.notes && (
                <div style={{ marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600, marginBottom: 2 }}>Notes / Remarks:</div>
                  <div style={{ fontSize: 13, color: 'var(--slate-700)' }}>{selectedPurchase.notes}</div>
                </div>
              )}

              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 10 }}>Supply Itemization</h4>
              <div className="table-wrapper">
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Barcode</th>
                      <th>Quantity</th>
                      <th>Purchase Cost</th>
                      <th>GST Rate</th>
                      <th className="text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-medium">
                          {item.productName} {item.variant && `(${item.variant})`}
                        </td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{item.barcode}</td>
                        <td className="font-semibold">{item.quantity}</td>
                        <td>₹{item.purchasePrice?.toFixed(2)}</td>
                        <td>{item.gstRate ?? 12}%</td>
                        <td className="text-right font-semibold">₹{item.total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 240 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span>Subtotal:</span>
                    <span>₹{selectedPurchase.subtotal?.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span>GST:</span>
                    <span>₹{selectedPurchase.tax?.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 6, color: 'var(--brand-600)' }}>
                    <span>Invoice Total:</span>
                    <span>₹{selectedPurchase.total?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {selectedPurchase.status !== 'Returned' && (
                  <button onClick={handleProcessReturn} disabled={returning} className="btn btn--danger" style={{ gap: 6 }}>
                    {returning ? 'Processing Return...' : '🔄 Return Purchase Order & Deduct Inventory'}
                  </button>
                )}
              </div>
              <button onClick={closeDetails} className="btn btn--ghost">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Purchases;
