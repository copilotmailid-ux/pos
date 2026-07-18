import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineExclamationCircle, HiOutlineDownload } from 'react-icons/hi';

const LowStock = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLowStock(); }, []);

  const fetchLowStock = async () => {
    try { const { data } = await api.get('/products/low-stock'); setProducts(data); }
    catch { toast.error('Failed to load low stock products'); }
    finally { setLoading(false); }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const getStockLevel = (stock) => {
    if (stock === 0) return { label: 'Out of Stock', badgeClass: 'badge badge--red', barClass: 'stock-bar-fill--red' };
    if (stock <= 3) return { label: 'Critical', badgeClass: 'badge badge--red', barClass: 'stock-bar-fill--red' };
    if (stock <= 5) return { label: 'Very Low', badgeClass: 'badge badge--amber', barClass: 'stock-bar-fill--orange' };
    return { label: 'Low', badgeClass: 'badge badge--amber', barClass: 'stock-bar-fill--amber' };
  };

  return (
    <div className="animate-fade-in print-container">
      {/* Printable Report Header (Visible only when printing) */}
      <div className="print-only-header" style={{ marginBottom: 24, borderBottom: '2px solid #334155', paddingBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase' }}>
          Low Stock Inventory Report
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="low-stock-header page-header-row no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="low-stock-header-icon"><HiOutlineExclamationCircle /></div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>Low Stock Alerts</h1>
            <p style={{ color: 'var(--slate-500)', marginTop: 2, fontSize: 14 }}>Products with stock below 10 units</p>
          </div>
        </div>
        <button 
          onClick={handleExportPdf} 
          disabled={products.length === 0}
          className="btn btn--primary no-print" 
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <HiOutlineDownload /> Export PDF
        </button>
      </div>

      {!loading && (
        <div className="low-stock-banner no-print" style={{ marginBottom: 20 }}>
          <div className="low-stock-banner-text">
            <p>Total Low Stock Items</p>
            <p>{products.length}</p>
          </div>
          <div className="low-stock-banner-icon"><HiOutlineExclamationCircle /></div>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th>Category</th>
                <th>Selling Price</th>
                <th>Stock</th>
                <th className="no-print">Status</th>
                <th className="print-only">Qty to Buy</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="table-loading"><div className="spinner"></div></td></tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    <div style={{ color: 'var(--green-500)', marginBottom: 8, fontSize: 24 }}>✅</div>
                    <p className="font-medium">All products are well stocked!</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const level = getStockLevel(p.stock);
                  return (
                    <tr key={p._id}>
                      <td className="font-medium">{p.name}</td>
                      <td><span className="mono-tag">{p.barcode}</span></td>
                      <td><span className="badge badge--brand">{p.category}</span></td>
                      <td style={{ color: 'var(--slate-600)', fontSize: 14 }}>₹{p.sellingPrice.toFixed(2)}</td>
                      <td>
                        <div className="stock-indicator">
                          <span className="stock-value">{p.stock}</span>
                          <div className="stock-bar no-print">
                            <div className={`stock-bar-fill ${level.barClass}`} style={{ width: `${(p.stock / 10) * 100}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="no-print"><span className={level.badgeClass}>{level.label}</span></td>
                      <td className="print-only">
                        <div style={{ border: '1px solid #94a3b8', borderRadius: '4px', width: '80px', height: '24px', background: 'white' }}></div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LowStock;
