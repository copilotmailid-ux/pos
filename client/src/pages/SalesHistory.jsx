import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import Receipt from '../components/Receipt';
import {
  HiOutlineSearch,
  HiOutlineCalendar,
  HiOutlineEye,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineX,
  HiOutlineLockClosed,
  HiOutlineRefresh,
  HiOutlineBan,
  HiOutlinePrinter
} from 'react-icons/hi';

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Custom details & actions panel states
  const [selectedSale, setSelectedSale] = useState(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  
  // Sales Return states
  const [showReturnPanel, setShowReturnPanel] = useState(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState({}); // { itemId: true/false }
  const [returnQuantities, setReturnQuantities] = useState({}); // { itemId: qty }
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [cancellingSale, setCancellingSale] = useState(false);

  useEffect(() => { fetchSales(); }, [page]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.append('search', search);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const { data } = await api.get(`/sales?${params}`);
      setSales(data.sales);
      setTotalPages(data.pages);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  };

  const handleSearch = () => { setPage(1); fetchSales(); };
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };

  const viewSale = async (id) => {
    try { 
      const { data } = await api.get(`/sales/${id}`); 
      setSelectedSale(data);
      setShowActionsModal(true);
      
      // Initialize return selectors
      const initialItems = {};
      const initialQty = {};
      data.items?.forEach(item => {
        initialItems[item._id] = false;
        initialQty[item._id] = 1;
      });
      setSelectedReturnItems(initialItems);
      setReturnQuantities(initialQty);
      setReturnReason('');
      setShowReturnPanel(false);
      setShowCancelPrompt(false);
      setAdminPasswordInput('');
      
      document.body.classList.add('modal-open');
    } catch { toast.error('Failed to load sale details'); }
  };

  const closeActionsModal = () => {
    setShowActionsModal(false);
    setSelectedSale(null);
    document.body.classList.remove('modal-open');
  };

  // Submit Sales Return
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    const itemsToReturn = Object.keys(selectedReturnItems)
      .filter(itemId => selectedReturnItems[itemId])
      .map(itemId => ({
        saleItemId: itemId,
        returnedQty: Number(returnQuantities[itemId]) || 0
      }));

    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    setSubmittingReturn(true);
    try {
      await api.post(`/sales/${selectedSale._id}/return`, {
        items: itemsToReturn,
        reason: returnReason || 'Returned'
      });
      toast.success('Return processed successfully! Stock levels updated.');
      closeActionsModal();
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Submit Sales Cancellation
  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    const savedPassword = localStorage.getItem('pos_admin_delete_pass') || 'admin123';
    
    if (adminPasswordInput !== savedPassword) {
      toast.error('Incorrect Admin Password! Cancellation blocked.');
      return;
    }

    setCancellingSale(true);
    try {
      await api.post(`/sales/${selectedSale._id}/cancel`, {
        password: adminPasswordInput,
        savedPassword: localStorage.getItem('pos_admin_delete_pass') || 'admin123'
      });
      toast.success('Invoice cancelled! Restored inventory stock.');
      closeActionsModal();
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setCancellingSale(false);
    }
  };

  const isSaleFresh = (createdAt) => {
    const saleDate = new Date(createdAt).toDateString();
    const todayDate = new Date().toDateString();
    return saleDate === todayDate;
  };

  return (
    <>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1>Sales History</h1>
          <p>View, cancel, or process customer product returns on previous sales invoices</p>
        </div>

        <div className="filters-bar">
          <div className="filters-row">
            <div className="filter-input-wrapper" style={{ flex: 1 }}>
              <span className="filter-icon"><HiOutlineSearch /></span>
              <input
                id="sale-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by Invoice / Customer / Mobile..."
                className="filter-input"
              />
            </div>
            <div className="filter-input-wrapper">
              <span className="filter-icon"><HiOutlineCalendar /></span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="filter-input" />
            </div>
            <div className="filter-input-wrapper">
              <span className="filter-icon"><HiOutlineCalendar /></span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="filter-input" />
            </div>
            <button onClick={handleSearch} className="btn btn--primary">Search</button>
          </div>
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Items</th>
                  <th>Subtotal</th>
                  <th>GST</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="table-loading"><div className="spinner"></div></td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan="8" className="table-empty"><p>No sales found</p></td></tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale._id}>
                      <td><span className="mono-tag mono-tag--brand">{sale.invoiceNo}</span></td>
                      <td style={{ color: 'var(--slate-600)', fontSize: 14 }}>{sale.items?.length || 0} items</td>
                      <td style={{ color: 'var(--slate-600)', fontSize: 14 }}>₹{sale.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ color: 'var(--slate-600)', fontSize: 14 }}>₹{sale.taxAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="font-semibold">₹{sale.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>
                        <span className={`badge ${
                          sale.status === 'Completed' ? 'badge--green' : 
                          sale.status === 'Cancelled' ? 'badge--red' : 
                          sale.status === 'Returned' ? 'badge--red' : 'badge--amber'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--slate-500)', fontSize: 14 }}>
                        {new Date(sale.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                        {new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="text-right">
                        <button onClick={() => viewSale(sale._id)} className="btn--brand-text">
                          <HiOutlineEye /> View & Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <p>Page {page} of {totalPages}</p>
              <div className="pagination-btns">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="pagination-btn">
                  <HiOutlineChevronLeft />
                </button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="pagination-btn">
                  <HiOutlineChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sale Details and Actions Control Modal */}
      {showActionsModal && selectedSale && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeActionsModal} />
          <div className="modal modal--lg animate-fade-in" style={{ width: '92%', maxWidth: '850px' }}>
            <div className="modal-header">
              <h3>Invoice Management</h3>
              <button onClick={closeActionsModal} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
              
              {/* Left Column: Printable Receipt Area */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <Receipt sale={selectedSale} onClose={null} inline={true} />
              </div>

              {/* Right Column: Actions Control Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                {/* Status card */}
                <div className="card" style={{ padding: 12 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 8 }}>Invoice Information</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--slate-400)' }}>Status:</span>
                      <span className={`badge ${
                        selectedSale.status === 'Completed' ? 'badge--green' : 
                        selectedSale.status === 'Cancelled' ? 'badge--red' : 
                        selectedSale.status === 'Returned' ? 'badge--red' : 'badge--amber'
                      }`}>{selectedSale.status}</span>
                    </div>
                    {selectedSale.returnedAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontWeight: 600 }}>
                        <span>Returned Refund:</span>
                        <span>₹{selectedSale.returnedAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedSale.returnReason && (
                      <div style={{ fontSize: 12, background: '#fef2f2', padding: 6, borderRadius: 4, border: '1px solid #fee2e2', color: '#991b1b', marginTop: 4 }}>
                        <strong>Reason:</strong> {selectedSale.returnReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary management buttons */}
                <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 4 }}>Operations</h4>
                  
                  {/* Print Invoice */}
                  <button 
                    onClick={() => window.print()}
                    className="btn btn--primary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}
                  >
                    <HiOutlinePrinter /> Print Invoice
                  </button>

                  {selectedSale.status !== 'Cancelled' && (
                    <>
                      {/* Return items toggle */}
                      <button 
                        onClick={() => { setShowReturnPanel(!showReturnPanel); setShowCancelPrompt(false); }}
                        className="btn btn--ghost"
                        style={{ border: '1px solid var(--slate-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}
                      >
                        <HiOutlineRefresh /> Return Items
                      </button>

                      {/* Cancel invoice admin check */}
                      <button 
                        onClick={() => { setShowCancelPrompt(!showCancelPrompt); setShowReturnPanel(false); }}
                        className="btn btn--danger"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}
                      >
                        <HiOutlineBan /> Cancel Invoice (Admin)
                      </button>
                      
                      {!isSaleFresh(selectedSale.createdAt) && (
                        <p style={{ fontSize: 10.5, color: 'var(--amber-600)', textAlign: 'center', margin: 0, fontWeight: 500 }}>
                          ⚠️ Non-fresh invoice override. Stock levels will be adjusted.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Return Items Panel Drawer */}
                {showReturnPanel && (
                  <form onSubmit={handleReturnSubmit} className="card animate-fade-in" style={{ padding: 12, border: '1px solid var(--brand-200)', background: '#fefefe' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-600)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ↩ Process Sales Return
                    </h4>
                    
                    {/* Checkbox itemized list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
                      {selectedSale.items?.map((item) => {
                        const maxReturnable = item.quantity - (item.returnedQuantity || 0);
                        if (maxReturnable <= 0) return null; // fully returned

                        return (
                          <div key={item._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', border: '1px solid #f1f5f9', borderRadius: 6, background: '#fff' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--slate-700)', flex: 1, margin: 0 }}>
                              <input 
                                type="checkbox"
                                checked={selectedReturnItems[item._id] || false}
                                onChange={(e) => setSelectedReturnItems(prev => ({ ...prev, [item._id]: e.target.checked }))}
                              />
                              <div>
                                <span>{item.productName}</span>
                                <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 'normal' }}>Buy: {item.quantity} | Ret: {item.returnedQuantity || 0}</div>
                              </div>
                            </label>
                            
                            {selectedReturnItems[item._id] && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 10, color: 'var(--slate-450)' }}>Qty:</span>
                                <select
                                  style={{ padding: '2px 4px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1' }}
                                  value={returnQuantities[item._id] || 1}
                                  onChange={(e) => setReturnQuantities(prev => ({ ...prev, [item._id]: Number(e.target.value) }))}
                                >
                                  {[...Array(maxReturnable)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {selectedSale.items?.every(item => (item.returnedQuantity || 0) >= item.quantity) && (
                        <p style={{ fontSize: 12, color: 'var(--slate-400)', textAlign: 'center', margin: '10px 0' }}>All items in this invoice have been fully returned.</p>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, fontWeight: 650 }}>Reason for Return</label>
                      <input 
                        type="text"
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: 12, height: 'auto' }}
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        placeholder="e.g., Damaged, Wrong Item"
                        required
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={submittingReturn}
                      className="btn btn--primary"
                      style={{ width: '100%', padding: '8px 10px', fontSize: 12, fontWeight: 700 }}
                    >
                      {submittingReturn ? 'Processing...' : '✓ Submit Return'}
                    </button>
                  </form>
                )}

                {/* Cancel Invoice Auth Prompt Panel */}
                {showCancelPrompt && (
                  <form onSubmit={handleCancelSubmit} className="card animate-fade-in" style={{ padding: 12, border: '1px solid var(--red-200)', background: '#fffef9' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--red-600)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ⚠️ Authorize Invoice Cancellation
                    </h4>
                    <p style={{ fontSize: 11, color: 'var(--slate-500)', lineHeight: '1.4', marginBottom: 12 }}>
                      This will void the transaction, reset transaction amounts, and **restore stock** of all non-returned items to the inventory.
                    </p>

                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <HiOutlineLockClosed /> Enter Admin Password
                      </label>
                      <input 
                        type="password"
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: 12, height: 'auto' }}
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        placeholder="Admin password (Default: admin123)"
                        required
                        autoFocus
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        type="button" 
                        onClick={() => setShowCancelPrompt(false)}
                        className="btn btn--ghost"
                        style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid var(--slate-300)' }}
                      >
                        Back
                      </button>
                      <button 
                        type="submit"
                        disabled={cancellingSale}
                        className="btn btn--danger"
                        style={{ flex: 1, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}
                      >
                        {cancellingSale ? 'Processing...' : 'Confirm Void'}
                      </button>
                    </div>
                  </form>
                )}

              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SalesHistory;
