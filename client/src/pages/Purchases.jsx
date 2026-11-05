import { useState, useEffect, useRef } from 'react';
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
  HiOutlineShieldCheck,
  HiOutlineUserAdd,
  HiOutlineCash,
  HiOutlineCheckCircle
} from 'react-icons/hi';

const gstSlabs = [0, 5, 12, 18, 28];

const Purchases = () => {
  const [activeTab, setActiveTab] = useState('history'); // 'history', 'new'
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [enableGst, setEnableGst] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_enable_gst');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Confirmation Modal
  const [showPurchaseConfirmModal, setShowPurchaseConfirmModal] = useState(false);

  // New Purchase Type Prompt Modal
  const [showTypeSelectModal, setShowTypeSelectModal] = useState(false);

  // Quick Supplier Modal State
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({
    name: '',
    phone: '',
    contactPerson: '',
    supplierType: 'GST',
    gstin: ''
  });
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Settle Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingPurchase, setPayingPurchase] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    paidAt: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  const [submittingPay, setSubmittingPay] = useState(false);

  // New Purchase Form States
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [purchaseTaxType, setPurchaseTaxType] = useState('GST');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [hasInitialAdvance, setHasInitialAdvance] = useState(false);
  const [initialPaidAmount, setInitialPaidAmount] = useState('');
  const [initialPaymentMethod, setInitialPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);

  // Product Search State (within New Purchase)
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const purchaseSearchListRef = useRef(null);

  // Details Modal States
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchSettings();

    const handleSettingsUpdate = () => {
      fetchSettings();
    };
    window.addEventListener('pos_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('pos_settings_updated', handleSettingsUpdate);
  }, []);

  // Auto-scroll highlighted product in search dropdown
  useEffect(() => {
    if (activeSearchIndex >= 0 && purchaseSearchListRef.current) {
      const activeElement = purchaseSearchListRef.current.children[activeSearchIndex];
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeSearchIndex]);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      if (data) {
        setSettings(data);
        const isGst = data.enableGst !== false;
        setEnableGst(isGst);
        localStorage.setItem('pos_enable_gst', String(isGst));
      }
    } catch (err) {
      console.error('Failed to load settings in Purchases', err);
    }
  };

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
    if (!enableGst) {
      selectPurchaseClassification('Non-GST');
      return;
    }
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
        setProductResults(data.slice(0, 10));
        setActiveSearchIndex(0);
      } catch {
        console.error('Failed to search products');
      }
    } else {
      setProductResults([]);
      setActiveSearchIndex(0);
    }
  };

  // Keyboard navigation for product search dropdown
  const handleSearchKeyDown = (e) => {
    if (productResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSearchIndex(prev => (prev < productResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSearchIndex(prev => (prev > 0 ? prev - 1 : productResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (productResults[activeSearchIndex]) {
        addProductToPurchase(productResults[activeSearchIndex]);
      }
    } else if (e.key === 'Escape') {
      setProductResults([]);
      setActiveSearchIndex(0);
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
    const exists = purchaseItems.some(item => item.product === prod._id || item.product === prod.id);
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
    const retail = prod.sellingPrice || prod.retailPrice || 0;
    const wholesale = prod.wholesalePrice || (Math.round(retail * 0.85 * 100) / 100) || 0;

    setPurchaseItems(prev => [
      ...prev,
      {
        product: prod._id || prod.id,
        productName: prod.name,
        variant: prod.variant || '',
        barcode: prod.barcode,
        quantity: qty,
        purchasePrice: price,
        sellingPrice: retail,
        retailPrice: retail,
        wholesalePrice: wholesale,
        productDefaultGst: prodDefaultGst,
        gstRate: initialGst,
        total: qty * price * (1 + (initialGst / 100))
      }
    ]);
    setProductSearch('');
    setProductResults([]);
    setActiveSearchIndex(0);
  };

  const removePurchaseItem = (index) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItemField = (index, field, value) => {
    setPurchaseItems(prev => {
      const updated = [...prev];
      updated[index][field] = value;

      if (field === 'retailPrice') {
        updated[index].sellingPrice = value;
      } else if (field === 'sellingPrice') {
        updated[index].retailPrice = value;
      }

      const qty = Number(updated[index].quantity) || 0;
      const price = Number(updated[index].purchasePrice) || 0;
      const gst = Number(updated[index].gstRate) || 0;
      updated[index].total = qty * price * (1 + (gst / 100));

      return updated;
    });
  };

  // Quick Add Supplier Handler
  const handleQuickSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!quickSupplierForm.name.trim() || !quickSupplierForm.phone.trim()) {
      toast.error('Supplier name and phone are required');
      return;
    }

    setSavingSupplier(true);
    try {
      const payload = {
        name: quickSupplierForm.name.trim(),
        phone: quickSupplierForm.phone.trim(),
        contactPerson: quickSupplierForm.contactPerson.trim(),
        supplierType: enableGst ? quickSupplierForm.supplierType : 'Non-GST',
        gstin: enableGst ? quickSupplierForm.gstin.trim() : ''
      };

      const { data } = await api.post('/suppliers', payload);
      toast.success(`Supplier "${data.name}" added successfully!`);

      const newSuppliers = [...suppliers, data];
      setSuppliers(newSuppliers);
      setSelectedSupplier(data._id || data.id);

      setQuickSupplierForm({ name: '', phone: '', contactPerson: '', supplierType: 'GST', gstin: '' });
      setShowQuickSupplierModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create supplier');
    } finally {
      setSavingSupplier(false);
    }
  };

  // Open Pay Modal
  const openPayModal = (purchase) => {
    const due = purchase.dueAmount !== undefined ? purchase.dueAmount : (purchase.total - (purchase.paidAmount || 0));
    setPayingPurchase(purchase);
    setPayForm({
      amount: String(Math.max(0, due)),
      paymentMethod: 'Cash',
      paidAt: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    setShowPayModal(true);
  };

  // Submit Payment / Installment
  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payingPurchase) return;

    const payAmt = Number(payForm.amount) || (payingPurchase.dueAmount ?? payingPurchase.total);
    if (payAmt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setSubmittingPay(true);
    try {
      const purchaseId = payingPurchase._id || payingPurchase.id;
      const { data } = await api.post(`/purchases/${purchaseId}/pay`, {
        amount: payAmt,
        paymentMethod: payForm.paymentMethod,
        paymentDate: payForm.paidAt,
        notes: payForm.notes
      });
      toast.success(`Payment installment of ₹${payAmt.toFixed(2)} recorded successfully!`);

      setPurchases(prev => prev.map(p => ((p._id === data._id || p.id === data.id) ? data : p)));

      if (selectedPurchase && (selectedPurchase._id === data._id || selectedPurchase.id === data.id)) {
        setSelectedPurchase(data);
      }

      setShowPayModal(false);
      setPayingPurchase(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment installment');
    } finally {
      setSubmittingPay(false);
    }
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

  // Execute actual submission
  const executePurchaseSubmit = async () => {
    if (purchaseItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    for (const item of purchaseItems) {
      if (item.quantity <= 0 || item.purchasePrice < 0 || (item.sellingPrice || item.retailPrice) < 0) {
        toast.error('Quantity and prices must be positive values');
        return;
      }
    }

    setShowPurchaseConfirmModal(false);
    try {
      const finalItems = purchaseItems.map(item => ({
        ...item,
        sellingPrice: Number(item.retailPrice !== undefined ? item.retailPrice : item.sellingPrice) || 0,
        retailPrice: Number(item.retailPrice !== undefined ? item.retailPrice : item.sellingPrice) || 0,
        wholesalePrice: Number(item.wholesalePrice) || 0
      }));

      const finalInitialPaid = (paymentMethod === 'Credit' && hasInitialAdvance)
        ? Math.min(total, Math.max(0, Number(initialPaidAmount) || 0))
        : 0;

      await api.post('/purchases', {
        supplier: selectedSupplier || null,
        purchaseTaxType: enableGst ? purchaseTaxType : 'Non-GST',
        invoiceDate,
        paymentMethod,
        notes,
        items: finalItems,
        initialPaidAmount: finalInitialPaid,
        initialPaymentMethod
      });

      toast.success(
        paymentMethod === 'Credit'
          ? (finalInitialPaid > 0 ? `Credit purchase recorded with ₹${finalInitialPaid.toFixed(2)} advance payment!` : 'Purchase recorded as Credit (Pending Payment)!')
          : 'Purchase recorded and stock & dual selling prices updated!'
      );

      // Reset form
      setSelectedSupplier('');
      setPurchaseTaxType('GST');
      setPaymentMethod('Cash');
      setHasInitialAdvance(false);
      setInitialPaidAmount('');
      setInitialPaymentMethod('Cash');
      setNotes('');
      setPurchaseItems([]);
      setActiveTab('history');
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record purchase invoice');
    }
  };

  const handlePurchaseSubmit = (e) => {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    for (const item of purchaseItems) {
      if (item.quantity <= 0 || item.purchasePrice < 0 || (item.sellingPrice || item.retailPrice) < 0) {
        toast.error('Quantity and prices must be positive values');
        return;
      }
    }
    if (settings?.confirmPurchase !== false) {
      setShowPurchaseConfirmModal(true);
      return;
    }
    executePurchaseSubmit();
  };

  // Open Details Modal
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
      await api.post(`/purchases/${selectedPurchase._id || selectedPurchase.id}/return`);
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
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>Purchases</h1>
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
            <div style={{ marginBottom: 16 }}>
              <div className="search-input-group" style={{ maxWidth: 500 }}>
                <HiOutlineSearch className="search-icon" />
                <input
                  id="purchase-search"
                  type="text"
                  className="search-input"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search past purchases by invoice, supplier, or note..."
                />
              </div>
            </div>

            <div className="card">
              <div className="table-wrapper">
                <table className="data-table data-table--bordered">
                  <thead>
                    <tr>
                      <th>Purchase Number</th>
                      <th>Supplier</th>
                      <th>Purchase Date</th>
                      <th>Payment Mode</th>
                      <th>Payment Status & Due</th>
                      <th>Stock Status</th>
                      <th>Total Amount</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>Loading purchases history...</td></tr>
                    ) : purchases.length === 0 ? (
                      <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>No purchases recorded yet</td></tr>
                    ) : (
                      purchases.map((p) => {
                        const isPaid = p.paymentStatus === 'Paid';
                        const isPartial = p.paymentStatus === 'Partial';
                        const isPending = p.paymentStatus === 'Pending' || (p.paymentMethod === 'Credit' && !p.paymentStatus);
                        const due = p.dueAmount !== undefined ? p.dueAmount : (isPending ? p.total : (isPartial ? (p.total - (p.paidAmount || 0)) : 0));
                        const paid = p.paidAmount !== undefined ? p.paidAmount : (isPaid ? p.total : 0);

                        return (
                          <tr key={p._id || p.id} onClick={() => openDetails(p._id || p.id)} style={{ cursor: 'pointer' }} className="clickable-row">
                            <td className="font-mono font-bold" style={{ color: 'var(--brand-600)' }}>{p.purchaseNumber}</td>
                            <td className="font-medium" style={{ color: 'var(--slate-700)' }}>
                              <div>{p.supplier?.name || 'Walk-in / Cash Supplier'}</div>
                              {p.supplier?.phone && <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>📞 {p.supplier.phone}</div>}
                            </td>
                            <td>{new Date(p.invoiceDate).toLocaleDateString()}</td>
                            <td style={{ fontWeight: 600 }}>{p.paymentMethod}</td>
                            <td>
                              {isPaid ? (
                                <span className="badge" style={{
                                  background: '#ecfdf5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                  fontWeight: 650,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <HiOutlineCheckCircle size={13} /> Paid in Full (₹{p.total.toFixed(2)})
                                </span>
                              ) : isPartial ? (
                                <div>
                                  <span className="badge" style={{
                                    background: '#fffbeb',
                                    color: '#b45309',
                                    border: '1px solid #fde68a',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    ⏳ Partial Payment
                                  </span>
                                  <div style={{ fontSize: 11.5, marginTop: 3, fontWeight: 600, color: '#334155' }}>
                                    <span style={{ color: '#059669' }}>Paid: ₹{Number(paid).toFixed(2)}</span>
                                    <span style={{ margin: '0 4px', color: '#94a3b8' }}>|</span>
                                    <span style={{ color: '#e11d48' }}>Due: ₹{Number(due).toFixed(2)}</span>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="badge" style={{
                                    background: '#fff1f2',
                                    color: '#e11d48',
                                    border: '1px solid #fecdd3',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    ⚠️ Due: ₹{Number(due).toFixed(2)}
                                  </span>
                                  <div style={{ fontSize: 11, color: '#9f1239', marginTop: 2, fontWeight: 500 }}>
                                    Payable to: {p.supplier?.name || 'Supplier'}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${p.status === 'Received' ? 'badge--green' : 'badge--red'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="font-semibold" style={{ color: 'var(--slate-800)' }}>₹{p.total.toFixed(2)}</td>
                            <td className="text-right">
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                {due > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openPayModal(p); }}
                                    className="btn btn--primary"
                                    style={{
                                      fontSize: 11.5,
                                      padding: '5px 10px',
                                      background: '#16a34a',
                                      borderColor: '#16a34a',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4
                                    }}
                                  >
                                    <HiOutlineCash size={14} /> Record Payment
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openDetails(p._id || p.id); }}
                                  className="btn btn--ghost"
                                  style={{ fontSize: 11.5, padding: '5px 9px', border: '1px solid var(--slate-300)' }}
                                >
                                  View Details & Steps
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
          </>
        )}

        {/* ================= NEW PURCHASE TAB ================= */}
        {activeTab === 'new' && (
          <form onSubmit={handlePurchaseSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--slate-700)' }}>
                🛒 Invoice Line Items {enableGst ? `(${purchaseTaxType === 'GST' ? 'GST Purchase - Supplier A' : 'Non-GST Purchase - Supplier B'})` : ''}
              </h3>

              {/* Product search box with Keyboard Navigation & Auto-scroll */}
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <div className="search-input-group">
                  <HiOutlineSearch className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    value={productSearch}
                    onChange={handleProductSearch}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search product by name (use ↓ ↑ arrows to navigate, Enter to select)..."
                    autoComplete="off"
                  />
                </div>

                {/* Search Results Dropdown */}
                {productResults.length > 0 && (
                  <div
                    ref={purchaseSearchListRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 30,
                      background: '#fff',
                      border: '1px solid var(--slate-200)',
                      borderRadius: '0 0 8px 8px',
                      boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
                      overflow: 'hidden',
                      maxHeight: '320px',
                      overflowY: 'auto'
                    }}
                  >
                    {productResults.map((p, idx) => {
                      const isHighlighted = idx === activeSearchIndex;
                      return (
                        <div
                          key={p._id || p.id}
                          onClick={() => addProductToPurchase(p)}
                          onMouseEnter={() => setActiveSearchIndex(idx)}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--slate-100)',
                            background: isHighlighted ? '#eff6ff' : '#fff',
                            borderLeft: isHighlighted ? '4px solid var(--brand-600)' : '4px solid transparent',
                            transition: 'background 0.1s ease'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 650, fontSize: 13, color: isHighlighted ? 'var(--brand-700)' : 'var(--slate-800)' }}>
                              {p.name} {p.variant && `(${p.variant})`}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-600)' }}>
                              Cost: ₹{p.purchasePrice}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                              {enableGst ? (
                                `Stock: GST ${p.gstStock || 0} | Non-GST ${p.nonGstStock || 0} (Total ${p.stock || 0})`
                              ) : (
                                `Available Stock: ${p.stock || 0}`
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Items Table with Dual Selling Price (Retail & Wholesale) */}
              <div className="table-wrapper">
                <table className="data-table data-table--bordered" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Product Details</th>
                      <th style={{ width: 85 }}>Quantity</th>
                      <th style={{ width: 105 }}>Purchase (₹)</th>
                      <th style={{ width: 105 }}>Retail / Home (₹)</th>
                      <th style={{ width: 110 }}>Wholesale / Shop (₹)</th>
                      {enableGst && <th style={{ width: 85 }}>GST Slab</th>}
                      <th style={{ width: 95 }}>Row Total</th>
                      <th style={{ width: 38 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan={enableGst ? 8 : 7} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
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
                              style={{ padding: '4px 8px', fontSize: 13, height: 'auto', width: '100%' }}
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
                              style={{ padding: '4px 8px', fontSize: 13, height: 'auto', width: '100%' }}
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
                              style={{ padding: '4px 8px', fontSize: 13, height: 'auto', width: '100%', borderColor: '#bfdbfe' }}
                              value={item.retailPrice !== undefined ? item.retailPrice : item.sellingPrice}
                              onChange={(e) => updateItemField(idx, 'retailPrice', e.target.value)}
                              placeholder="Retail Price"
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: 13, height: 'auto', width: '100%', borderColor: '#ddd6fe' }}
                              value={item.wholesalePrice}
                              onChange={(e) => updateItemField(idx, 'wholesalePrice', e.target.value)}
                              placeholder="Wholesale Price"
                              required
                            />
                          </td>
                          {enableGst && (
                            <td>
                              <select
                                className="form-select"
                                style={{ padding: '4px 8px', fontSize: 12, height: 'auto', width: '100%' }}
                                value={item.gstRate}
                                onChange={(e) => updateItemField(idx, 'gstRate', Number(e.target.value))}
                              >
                                {gstSlabs.map(slab => <option key={slab} value={slab}>{slab}%</option>)}
                              </select>
                            </td>
                          )}
                          <td className="font-semibold" style={{ color: 'var(--slate-800)' }}>₹{item.total.toFixed(2)}</td>
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
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📋 Invoice Summary
                </h4>

                {/* Supplier selection with Quick Add */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 650, color: 'var(--slate-700)' }}>
                      Select Supplier <span style={{ fontWeight: 400, color: 'var(--slate-400)' }}>(Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickSupplierModal(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--brand-600)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '2px 4px'
                      }}
                    >
                      <HiOutlinePlus size={13} /> New Supplier
                    </button>
                  </div>
                  <select
                    className="form-select"
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="">Walk-in / Cash Supplier (Optional)</option>
                    {suppliers.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        {s.name} {enableGst && s.supplierType ? `(${s.supplierType})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {enableGst && (
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 650, color: 'var(--slate-700)', marginBottom: 5, display: 'block' }}>
                      Purchase Tax Classification
                    </label>
                    <select
                      className="form-select"
                      value={purchaseTaxType}
                      onChange={(e) => handleTaxTypeChange(e.target.value)}
                      style={{ width: '100%', maxWidth: '100%', fontWeight: 600, fontSize: 12, borderColor: purchaseTaxType === 'GST' ? '#16a34a' : '#d97706' }}
                    >
                      <option value="GST">GST Purchase (Supplier A)</option>
                      <option value="Non-GST">Non-GST Purchase (Supplier B)</option>
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 650, color: 'var(--slate-700)', marginBottom: 5, display: 'block' }}>Invoice Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                    style={{ fontSize: 12 }}
                  />
                </div>

                {/* Payment Type & Down Payment Prompt */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 650, color: 'var(--slate-700)', marginBottom: 5, display: 'block' }}>Payment Type</label>
                  <select
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value);
                      if (e.target.value !== 'Credit') {
                        setHasInitialAdvance(false);
                        setInitialPaidAmount('');
                      }
                    }}
                    style={{ fontSize: 12, fontWeight: paymentMethod === 'Credit' ? 700 : 500, color: paymentMethod === 'Credit' ? '#e11d48' : 'inherit' }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit">Credit (Outstanding / Pending Payment)</option>
                  </select>

                  {paymentMethod === 'Credit' && (
                    <div style={{ marginTop: 10, padding: 12, background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: hasInitialAdvance ? 10 : 0 }}>
                        <input
                          type="checkbox"
                          checked={hasInitialAdvance}
                          onChange={(e) => setHasInitialAdvance(e.target.checked)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#e11d48' }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#9f1239' }}>
                          Did you pay any initial amount / advance?
                        </span>
                      </label>

                      {hasInitialAdvance && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#9f1239', display: 'block', marginBottom: 3 }}>
                              Initial Paid Amount (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={total}
                              step="0.01"
                              className="form-input"
                              placeholder="e.g. 5000"
                              value={initialPaidAmount}
                              onChange={(e) => setInitialPaidAmount(e.target.value)}
                              style={{ fontSize: 13, height: 34, background: '#ffffff', borderColor: '#f43f5e' }}
                              required
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#9f1239', display: 'block', marginBottom: 3 }}>
                              Initial Payment Mode
                            </label>
                            <select
                              className="form-select"
                              value={initialPaymentMethod}
                              onChange={(e) => setInitialPaymentMethod(e.target.value)}
                              style={{ fontSize: 12, height: 34, background: '#ffffff' }}
                            >
                              <option value="Cash">Cash</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="UPI">UPI / GPay</option>
                              <option value="Cheque">Cheque</option>
                            </select>
                          </div>

                          <div style={{ marginTop: 4, padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #fecdd3', fontSize: 11.5 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                              <span>Total Bill:</span>
                              <span>₹{total.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
                              <span>Paid Advance:</span>
                              <span>-₹{Number(initialPaidAmount || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48', fontWeight: 700, borderTop: '1px solid #fee2e2', paddingTop: 4, marginTop: 4 }}>
                              <span>Pending Due:</span>
                              <span>₹{Math.max(0, total - Number(initialPaidAmount || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {!hasInitialAdvance && (
                        <div style={{ fontSize: 11, color: '#be123c', marginTop: 4 }}>
                          Full bill amount of <strong>₹{total.toFixed(2)}</strong> will be recorded as pending credit due to supplier.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 650, color: 'var(--slate-700)', marginBottom: 5, display: 'block' }}>Notes / Remarks</label>
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
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--slate-600)' }}>
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {enableGst && (
                  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: 'var(--slate-600)' }}>
                    <span>GST Amount:</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--slate-200)', paddingTop: 10, marginBottom: 16, color: 'var(--brand-600)' }}>
                  <span>Total Amount:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>

                <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, fontWeight: 650 }}>
                  ✓ Submit Purchase
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Confirmation Before Purchase Submit Modal */}
      {showPurchaseConfirmModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-backdrop" onClick={() => setShowPurchaseConfirmModal(false)} />
          <div className="modal modal--md animate-fade-in" style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <span>📦</span> Confirm Purchase Entry
              </h3>
              <button type="button" onClick={() => setShowPurchaseConfirmModal(false)} className="close-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}><HiOutlineX /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Supplier:</span>
                  <strong style={{ color: '#1e293b' }}>
                    {selectedSupplier ? (suppliers.find(s => s._id === selectedSupplier || s.id === selectedSupplier)?.name || 'Supplier') : 'Walk-in / Cash Supplier'}
                  </strong>
                </div>
                {enableGst && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>Tax Classification:</span>
                    <strong style={{ color: purchaseTaxType === 'GST' ? '#16a34a' : '#d97706' }}>
                      {purchaseTaxType === 'GST' ? 'GST Purchase (Supplier A)' : 'Non-GST Purchase (Supplier B)'}
                    </strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Invoice Date:</span>
                  <strong style={{ color: '#1e293b' }}>{invoiceDate}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Items to Add:</span>
                  <strong style={{ color: '#1e293b' }}>{purchaseItems.length} product(s)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <strong style={{ color: paymentMethod === 'Credit' ? '#e11d48' : '#1e293b' }}>{paymentMethod}</strong>
                </div>
                {paymentMethod === 'Credit' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: '#64748b' }}>Paid Advance:</span>
                      <strong style={{ color: '#16a34a' }}>₹{Number(hasInitialAdvance ? initialPaidAmount || 0 : 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: '#64748b' }}>Remaining Credit Due:</span>
                      <strong style={{ color: '#e11d48' }}>₹{Math.max(0, total - Number(hasInitialAdvance ? initialPaidAmount || 0 : 0)).toFixed(2)}</strong>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Total Purchase Cost:</span>
                  <strong style={{ fontSize: 20, color: 'var(--brand-600)' }}>₹{total.toFixed(2)}</strong>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                Confirming will add stock quantities to inventory and update both retail and wholesale selling prices.
              </p>
            </div>
            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowPurchaseConfirmModal(false)} className="btn btn--ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={executePurchaseSubmit}
                className="btn btn--primary"
                style={{ padding: '8px 20px', fontSize: 13.5, fontWeight: 700 }}
              >
                ✓ Confirm & Record Purchase
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Settle / Installment Payment Modal */}
      {showPayModal && payingPurchase && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-backdrop" onClick={() => setShowPayModal(false)} />
          <div className="modal modal--md animate-fade-in" style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                <HiOutlineCash size={20} color="#16a34a" /> Record Supplier Payment / Installment
              </h3>
              <button onClick={() => setShowPayModal(false)} className="close-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}><HiOutlineX /></button>
            </div>
            <form onSubmit={handlePaySubmit}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--slate-500)' }}>Purchase Reference:</span>
                    <strong className="font-mono">{payingPurchase.purchaseNumber}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--slate-500)' }}>Supplier (Payable To):</span>
                    <strong>{payingPurchase.supplier?.name || 'Walk-in / Cash Supplier'}</strong>
                  </div>
                  {payingPurchase.supplier?.phone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--slate-500)' }}>Supplier Phone:</span>
                      <span>📞 {payingPurchase.supplier.phone}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>Outstanding Balance Due:</span>
                    <strong style={{ fontSize: 18, color: '#e11d48' }}>₹{(payingPurchase.dueAmount ?? payingPurchase.total)?.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                    Payment Amount to Settle (₹) <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max={payingPurchase.dueAmount ?? payingPurchase.total}
                    step="0.01"
                    className="form-input"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    required
                    style={{ fontSize: 15, fontWeight: 700 }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Full remaining balance: ₹{(payingPurchase.dueAmount ?? payingPurchase.total)?.toFixed(2)}. You can edit this for partial installment payments.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                    Payment Mode
                  </label>
                  <select
                    className="form-select"
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                    Payment Settlement Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={payForm.paidAt}
                    onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                    Reference / Transaction Notes (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., UTR / UPI Ref / Cheque No / Partial installment..."
                    value={payForm.notes}
                    onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowPayModal(false)} className="btn btn--ghost">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="btn btn--primary"
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 650 }}
                >
                  {submittingPay ? 'Recording...' : '✓ Confirm & Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Add Supplier Modal */}
      {showQuickSupplierModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowQuickSupplierModal(false)} />
          <div className="modal modal--md">
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <HiOutlineUserAdd /> Add New Supplier
              </h3>
              <button onClick={() => setShowQuickSupplierModal(false)} className="close-btn"><HiOutlineX /></button>
            </div>
            <form onSubmit={handleQuickSupplierSubmit}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                    Supplier / Company Name <span className="required" style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Wholesale Supplier / Trader Name"
                    value={quickSupplierForm.name}
                    onChange={(e) => setQuickSupplierForm({ ...quickSupplierForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                    Phone Number <span className="required" style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., 9876543210"
                    value={quickSupplierForm.phone}
                    onChange={(e) => setQuickSupplierForm({ ...quickSupplierForm, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                    Contact Person (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Rajesh Kumar"
                    value={quickSupplierForm.contactPerson}
                    onChange={(e) => setQuickSupplierForm({ ...quickSupplierForm, contactPerson: e.target.value })}
                  />
                </div>

                {enableGst && (
                  <>
                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                        Supplier Type
                      </label>
                      <select
                        className="form-select"
                        value={quickSupplierForm.supplierType}
                        onChange={(e) => setQuickSupplierForm({ ...quickSupplierForm, supplierType: e.target.value })}
                      >
                        <option value="GST">GST Registered (Supplier A)</option>
                        <option value="Non-GST">Non-GST / Unregistered (Supplier B)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 650, display: 'block', marginBottom: 4 }}>
                        GSTIN Number (Optional)
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., 33AAAAA0000A1Z5"
                        value={quickSupplierForm.gstin}
                        onChange={(e) => setQuickSupplierForm({ ...quickSupplierForm, gstin: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowQuickSupplierModal(false)} className="btn btn--ghost">
                  Cancel
                </button>
                <button type="submit" disabled={savingSupplier} className="btn btn--primary">
                  {savingSupplier ? 'Saving...' : 'Save & Select Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

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
              <div style={{ display: 'grid', gap: 14 }}>
                <div
                  onClick={() => selectPurchaseClassification('GST')}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    border: '2px solid #bbf7d0',
                    background: '#f0fdf4',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                  className="hover-card-gst"
                >
                  <HiOutlineShieldCheck size={24} color="#16a34a" />
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', display: 'block' }}>GST Purchase</span>
                    <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>Stock allocated to Supplier A (GST Eligible)</span>
                  </div>
                </div>

                <div
                  onClick={() => selectPurchaseClassification('Non-GST')}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    border: '2px solid #fef3c7',
                    background: '#fffbeb',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                  className="hover-card-nongst"
                >
                  <HiOutlineDocumentText size={24} color="#d97706" />
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#d97706', display: 'block' }}>Non-GST Purchase</span>
                    <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>Stock allocated to Supplier B (Exempt / Cash supplies)</span>
                  </div>
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

      {/* Invoice Supply Details Modal with Payment Tracking Steps */}
      {detailsOpen && selectedPurchase && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeDetails} />
          <div className="modal" style={{ maxWidth: '980px', width: '94%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--slate-800)' }}>
                Invoice Supply Details & Payment Ledger
              </h3>
              <button onClick={closeDetails} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              
              {/* PAYMENT STEPS & LEDGER TIMELINE */}
              <div style={{
                marginBottom: 22,
                padding: '18px 20px',
                background: '#ffffff',
                borderRadius: 10,
                border: selectedPurchase.dueAmount > 0 ? '1.5px solid #fecdd3' : '1.5px solid #a7f3d0',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>💳</span> Payment Tracking & Installment Ledger
                    </h4>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                      Track step-by-step advance payments and settlements for Purchase Order <strong className="font-mono" style={{ color: 'var(--brand-600)' }}>{selectedPurchase.purchaseNumber}</strong>
                    </div>
                  </div>

                  {selectedPurchase.dueAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => openPayModal(selectedPurchase)}
                      className="btn btn--primary"
                      style={{
                        background: '#16a34a',
                        borderColor: '#16a34a',
                        padding: '8px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <HiOutlineCash size={16} /> + Record Payment / Settle Balance
                    </button>
                  )}
                </div>

                {/* Progress Bar & Amount Summary */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Status: </span>
                      {selectedPurchase.paymentStatus === 'Paid' ? (
                        <span style={{ fontWeight: 700, color: '#059669' }}>✓ Paid in Full</span>
                      ) : selectedPurchase.paymentStatus === 'Partial' ? (
                        <span style={{ fontWeight: 700, color: '#b45309' }}>⏳ Partial Payment (In Progress)</span>
                      ) : (
                        <span style={{ fontWeight: 700, color: '#e11d48' }}>⚠️ Pending Payment</span>
                      )}
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Total Paid: </span>
                      <strong style={{ color: '#059669', fontSize: 14 }}>₹{(selectedPurchase.paidAmount || 0).toFixed(2)}</strong>
                      <span style={{ color: '#94a3b8', margin: '0 6px' }}>/</span>
                      <span style={{ color: '#64748b' }}>Total: </span>
                      <strong style={{ color: '#1e293b', fontSize: 14 }}>₹{selectedPurchase.total?.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Percentage Progress Bar */}
                  {(() => {
                    const pct = Math.min(100, Math.round(((selectedPurchase.paidAmount || 0) / (selectedPurchase.total || 1)) * 100));
                    return (
                      <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: pct === 100 ? '#16a34a' : '#3b82f6',
                          borderRadius: 4,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    );
                  })()}

                  {selectedPurchase.dueAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px dashed #e2e8f0' }}>
                      <div style={{ fontSize: 12.5, color: '#9f1239', fontWeight: 600 }}>
                        📍 Payable To: {selectedPurchase.supplier?.name || 'Walk-in / Cash Supplier'} {selectedPurchase.supplier?.phone && `(📞 ${selectedPurchase.supplier.phone})`}
                      </div>
                      <div style={{ fontSize: 13, color: '#9f1239' }}>
                        Remaining Balance Due: <strong style={{ fontSize: 16, color: '#e11d48' }}>₹{selectedPurchase.dueAmount?.toFixed(2)}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step-by-Step Payment Timeline List */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Payment Steps ({selectedPurchase.payments?.length || 0} transaction{selectedPurchase.payments?.length === 1 ? '' : 's'})
                  </div>

                  {(!selectedPurchase.payments || selectedPurchase.payments.length === 0) ? (
                    <div style={{ padding: 14, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12.5, color: '#64748b', textAlign: 'center' }}>
                      No payment installments recorded yet. Full invoice amount of ₹{selectedPurchase.total?.toFixed(2)} is currently pending.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedPurchase.payments.map((step, idx) => (
                        <div
                          key={step.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              fontWeight: 700,
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {idx + 1}
                            </div>
                            <div>
                              <div style={{ fontWeight: 650, fontSize: 13, color: '#1e293b' }}>
                                Step {idx + 1}: {step.notes || (idx === 0 ? 'Initial Payment' : `Installment #${idx + 1}`)}
                              </div>
                              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>📅 {new Date(step.paymentDate).toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="badge" style={{ padding: '2px 6px', fontSize: 11, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                                  {step.paymentMethod || 'Cash'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>
                              +₹{Number(step.amount).toFixed(2)}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 600 }}>
                              ✓ Settled
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                padding: '16px',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                marginBottom: 22
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>Purchase Order No:</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand-600)', fontSize: 14, marginTop: 2 }}>
                    {selectedPurchase.purchaseNumber}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>Supplier Name:</div>
                  <div style={{ fontWeight: 650, color: 'var(--slate-800)', marginTop: 2 }}>
                    {selectedPurchase.supplier?.name || 'Walk-in / Cash Supplier'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>Invoice Date:</div>
                  <div style={{ fontWeight: 600, color: 'var(--slate-700)', marginTop: 2 }}>
                    {new Date(selectedPurchase.invoiceDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>Payment Method:</div>
                  <div style={{ fontWeight: 700, color: selectedPurchase.paymentMethod === 'Credit' ? '#e11d48' : 'var(--slate-800)', marginTop: 2 }}>
                    {selectedPurchase.paymentMethod}
                  </div>
                </div>
              </div>

              {selectedPurchase.notes && (
                <div style={{ marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600, marginBottom: 2 }}>Notes / Remarks:</div>
                  <div style={{ fontSize: 13, color: 'var(--slate-700)' }}>{selectedPurchase.notes}</div>
                </div>
              )}

              {/* Supply Itemization Table */}
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-800)', margin: 0 }}>
                  Supply Itemization Breakdown
                </h4>
              </div>

              <div className="table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 13, width: '100%', minWidth: '780px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={{ minWidth: 220, padding: '10px 12px', textAlign: 'left' }}>Product Name</th>
                      <th style={{ minWidth: 70, padding: '10px 12px', textAlign: 'center' }}>Quantity</th>
                      <th style={{ minWidth: 100, padding: '10px 12px', textAlign: 'right' }}>Purchase Cost</th>
                      <th style={{ minWidth: 110, padding: '10px 12px', textAlign: 'right', color: '#2563eb' }}>Retail Selling</th>
                      <th style={{ minWidth: 115, padding: '10px 12px', textAlign: 'right', color: '#7c3aed' }}>Wholesale Selling</th>
                      {enableGst && <th style={{ minWidth: 75, padding: '10px 12px', textAlign: 'center' }}>GST Rate</th>}
                      <th style={{ minWidth: 95, padding: '10px 12px', textAlign: 'right' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.items?.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="font-medium" style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: 650, color: '#1e293b' }}>{item.productName}</span>
                          {item.variant && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>({item.variant})</span>}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 650, padding: '10px 12px' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px' }}>₹{Number(item.purchasePrice || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 650, padding: '10px 12px' }}>
                          ₹{Number(item.sellingPrice || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', color: '#7c3aed', fontWeight: 650, padding: '10px 12px' }}>
                          ₹{Number(item.wholesalePrice || 0).toFixed(2)}
                        </td>
                        {enableGst && <td style={{ textAlign: 'center', padding: '10px 12px' }}>{item.gstRate ?? 12}%</td>}
                        <td className="text-right font-semibold" style={{ textAlign: 'right', color: '#0f172a', padding: '10px 12px' }}>
                          ₹{Number(item.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary Box */}
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 260, background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--slate-600)' }}>Subtotal:</span>
                    <span>₹{selectedPurchase.subtotal?.toFixed(2)}</span>
                  </div>
                  {enableGst && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: 'var(--slate-600)' }}>GST:</span>
                      <span>₹{selectedPurchase.tax?.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 8, color: 'var(--brand-600)' }}>
                    <span>Invoice Total:</span>
                    <span>₹{selectedPurchase.total?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0' }}>
              <div>
                {selectedPurchase.status !== 'Returned' && (
                  <button
                    onClick={handleProcessReturn}
                    disabled={returning}
                    className="btn btn--danger"
                    style={{ fontSize: 12 }}
                  >
                    <HiOutlineRefresh /> {returning ? 'Returning...' : 'Process Purchase Return'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {selectedPurchase.dueAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => openPayModal(selectedPurchase)}
                    className="btn btn--primary"
                    style={{ background: '#16a34a', borderColor: '#16a34a', gap: 6, fontWeight: 650 }}
                  >
                    <HiOutlineCash size={16} /> Record Payment / Settle Balance
                  </button>
                )}
                <button onClick={closeDetails} className="btn btn--ghost">Close</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Purchases;
