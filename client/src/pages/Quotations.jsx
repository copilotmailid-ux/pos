import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import Receipt from '../components/Receipt';
import {
  HiOutlineDocumentText,
  HiOutlineSearch,
  HiOutlineShoppingCart,
  HiOutlinePrinter,
  HiOutlineTrash,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineX,
  HiOutlineChevronLeft,
  HiOutlineChevronRight
} from 'react-icons/hi';

const Quotations = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // A4 Document Preview & WhatsApp Modal
  const [previewQuotation, setPreviewQuotation] = useState(null);

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    fetchQuotations(search, statusFilter, page);
  }, [page, statusFilter]);

  const fetchQuotations = async (query = search, status = statusFilter, pageNum = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum,
        limit: 15,
        status: status
      });
      if (query.trim()) params.append('search', query.trim());

      const { data } = await api.get(`/quotations?${params}`);
      setQuotations(data.quotations || []);
      setTotalPages(data.pages || 1);
      setTotalCount(data.total || 0);
    } catch {
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchQuotations(val, statusFilter, 1);
    }, 250);
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    fetchQuotations('', statusFilter, 1);
  };

  const handleStatusFilter = (st) => {
    setStatusFilter(st);
    setPage(1);
  };

  const handleDelete = async (id, quotationNo) => {
    if (!window.confirm(`Are you sure you want to delete quotation ${quotationNo}?`)) return;
    try {
      await api.delete(`/quotations/${id}`);
      toast.success(`Quotation ${quotationNo} deleted`);
      fetchQuotations(search, statusFilter, page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete quotation');
    }
  };

  // Convert/Load Quotation into Billing
  const handleLoadToBilling = (qtn) => {
    const qtnCart = (qtn.items || []).map(item => ({
      _id: item.productId?._id || item.productId?.id || item.productId || item.id,
      id: item.productId?.id || item.productId || item.id,
      productId: item.productId?._id || item.productId?.id || item.productId || item.id,
      name: item.productName,
      productName: item.productName,
      variant: item.variant || '',
      barcode: item.barcode || '',
      unit: item.unit || 'Pcs',
      price: Number(item.price || 0),
      retailPrice: Number(item.product?.retailPrice || item.price || 0),
      wholesalePrice: Number(item.product?.wholesalePrice || item.price || 0),
      gstRate: item.gstRate !== undefined ? Number(item.gstRate) : 0,
      quantity: Number(item.quantity || 1),
      priceType: item.priceType || qtn.customerType || 'Shop',
      total: Number(item.total || (Number(item.price) * Number(item.quantity))),
      stock: item.product?.stock !== undefined ? item.product.stock : 999,
      maxStock: item.product?.stock !== undefined ? item.product.stock : 999
    }));

    localStorage.setItem('pos_active_cart', JSON.stringify(qtnCart));
    localStorage.setItem('pos_active_customer_mobile', qtn.customerMobile || '');
    localStorage.setItem('pos_active_customer_name', qtn.customerName || '');
    localStorage.setItem('pos_active_payment_method', 'Cash Tendered');
    localStorage.setItem('pos_active_price_tier', qtn.customerType === 'Home' ? 'Home' : 'Shop');
    localStorage.setItem('pos_loaded_quotation', JSON.stringify({
      id: qtn.id,
      quotationNo: qtn.quotationNo,
      customerName: qtn.customerName
    }));

    toast.success(`Loaded ${qtn.quotationNo} into Billing! Edit items and checkout.`);
    navigate('/billing');
  };

  const draftCount = quotations.filter(q => q.status === 'Draft').length;
  const convertedCount = quotations.filter(q => q.status === 'Converted').length;

  return (
    <div className="animate-fade-in" style={{ padding: '4px 0 24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.4px' }}>
            Quotations & Estimates
          </h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13.5 }}>
            Create wholesale estimates for bakeries & shops, export A4 PDFs, send via WhatsApp, and convert to bills.
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('pos_loaded_quotation');
            navigate('/billing');
          }}
          className="btn btn--primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            fontSize: 13.5,
            fontWeight: 700,
            borderRadius: 10,
            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
          }}
        >
          <HiOutlinePlus size={18} />
          <span>Create New Quotation</span>
        </button>
      </div>

      {/* KPI Stat Cards — Polished Modern Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Total Quotations */}
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '18px 22px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Quotations
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
              {totalCount}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
              All estimates created
            </div>
          </div>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24
          }}>
            <HiOutlineDocumentText />
          </div>
        </div>

        {/* Pending (Draft) */}
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '18px 22px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pending / Active
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706', marginTop: 4 }}>
              {draftCount}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
              Awaiting customer purchase
            </div>
          </div>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#fffbeb',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24
          }}>
            <HiOutlineClock />
          </div>
        </div>

        {/* Converted to Invoices */}
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '18px 22px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Converted to Bills
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', marginTop: 4 }}>
              {convertedCount}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
              Completed store sales
            </div>
          </div>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24
          }}>
            <HiOutlineCheckCircle />
          </div>
        </div>
      </div>

      {/* Search Bar & Filter Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <div className="search-input-group" style={{ maxWidth: 450 }}>
          <HiOutlineSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by customer name, mobile, or QTN #..."
            value={search}
            onChange={handleSearch}
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="search-clear-btn"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 14px', color: 'var(--slate-400)', display: 'flex', alignItems: 'center' }}
            >
              <HiOutlineX size={16} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'All', label: 'All' },
            { id: 'Draft', label: 'Pending (Draft)' },
            { id: 'Converted', label: 'Converted' },
            { id: 'Expired', label: 'Expired' }
          ].map(st => {
            const isActive = statusFilter === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleStatusFilter(st.id)}
                style={{
                  borderRadius: 20,
                  padding: '7px 16px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: isActive ? 'none' : '1px solid #e2e8f0',
                  background: isActive ? '#852d24' : '#ffffff',
                  color: isActive ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 6px rgba(133, 45, 36, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {st.label}
              </button>
            );
          })}
          <button
            onClick={() => fetchQuotations(search, statusFilter, page)}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 20,
              padding: '7px 10px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Refresh Quotations"
          >
            <HiOutlineRefresh size={16} />
          </button>
        </div>
      </div>

      {/* Quotations Data Grid */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div className="table-wrapper">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Quotation No
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Date & Time
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Customer & Mobile
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Pricing Tier
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center' }}>
                  Items
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'right' }}>
                  Estimated Total
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center' }}>
                  Status
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ height: 180, textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '56px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, color: '#cbd5e1', marginBottom: 10 }}>
                      <HiOutlineDocumentText />
                    </div>
                    <p style={{ fontWeight: 700, color: '#334155', margin: '0 0 6px', fontSize: 15 }}>No Quotations Found</p>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                      {search ? 'No quotation matched your search query.' : 'Create a wholesale quotation from the Billing terminal using "Save as Quotation".'}
                    </p>
                  </td>
                </tr>
              ) : (
                quotations.map(qtn => {
                  const isShop = qtn.customerType === 'Shop';
                  const isConverted = qtn.status === 'Converted';
                  const total = Number(qtn.grandTotal || qtn.total || 0);

                  return (
                    <tr key={qtn.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Quotation No */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 800, color: '#4f46e5', letterSpacing: '0.3px', fontFamily: 'monospace', fontSize: 13.5 }}>
                          {qtn.quotationNo}
                        </span>
                        {qtn.convertedInvoiceNo && (
                          <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                            ↳ Bill: {qtn.convertedInvoiceNo}
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#475569' }}>
                        <div style={{ fontWeight: 600 }}>{new Date(qtn.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {new Date(qtn.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Customer Name & Mobile */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                          {qtn.customerName || 'Walk-in Customer'}
                        </div>
                        {qtn.customerMobile ? (
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: '#475569',
                            background: '#f1f5f9',
                            padding: '1px 6px',
                            borderRadius: 4,
                            marginTop: 2,
                            display: 'inline-block'
                          }}>
                            {qtn.customerMobile}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>No Mobile</span>
                        )}
                      </td>

                      {/* Pricing Tier */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            background: isShop ? '#ede9fe' : '#e0f2fe',
                            color: isShop ? '#6d28d9' : '#0369a1',
                            fontWeight: 700,
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 6,
                            display: 'inline-block'
                          }}
                        >
                          {isShop ? '🏢 Wholesale' : '🏠 Retail'}
                        </span>
                      </td>

                      {/* Items */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          fontWeight: 700,
                          fontSize: 11.5,
                          padding: '3px 8px',
                          borderRadius: 6
                        }}>
                          {qtn.items?.length || 0} items
                        </span>
                      </td>

                      {/* Estimated Total */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14.5, color: '#0f172a' }}>
                        ₹{total.toFixed(2)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: isConverted ? '#ecfdf5' : (qtn.status === 'Draft' ? '#fffbeb' : '#f1f5f9'),
                          color: isConverted ? '#059669' : (qtn.status === 'Draft' ? '#d97706' : '#64748b')
                        }}>
                          {qtn.status === 'Draft' ? 'Pending' : qtn.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          {/* Bill Now */}
                          {!isConverted ? (
                            <button
                              onClick={() => handleLoadToBilling(qtn)}
                              style={{
                                background: '#0d9488',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)'
                              }}
                              title="Convert quotation to Bill and edit in POS"
                            >
                              <HiOutlineShoppingCart size={15} />
                              <span>Bill Now</span>
                            </button>
                          ) : (
                            <span style={{
                              fontSize: 11,
                              color: '#059669',
                              fontWeight: 700,
                              background: '#ecfdf5',
                              padding: '5px 9px',
                              borderRadius: 6
                            }}>
                              ✓ Invoiced
                            </span>
                          )}

                          {/* View & Print A4 */}
                          <button
                            onClick={() => setPreviewQuotation(qtn)}
                            style={{
                              background: '#f8fafc',
                              color: '#1e293b',
                              border: '1px solid #cbd5e1',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                            title="View official Viswa Foods A4 Document, PDF & WhatsApp"
                          >
                            <HiOutlinePrinter size={15} />
                            <span>View / A4</span>
                          </button>

                          {/* Delete */}
                          {!isConverted && (
                            <button
                              onClick={() => handleDelete(qtn.id, qtn.quotationNo)}
                              style={{
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fee2e2',
                                borderRadius: 8,
                                padding: '6px 8px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Delete Quotation"
                            >
                              <HiOutlineTrash size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #f1f5f9',
            padding: '12px 18px',
            fontSize: 13,
            color: '#64748b',
            background: '#ffffff'
          }}>
            <div>Page {page} of {totalPages} (Total: {totalCount} quotations)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '5px 10px',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <HiOutlineChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '5px 10px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <HiOutlineChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Viswa Foods Official A4 Preview, PDF & WhatsApp Modal */}
      {previewQuotation && (
        <Receipt
          sale={previewQuotation}
          onClose={() => setPreviewQuotation(null)}
        />
      )}
    </div>
  );
};

export default Quotations;
