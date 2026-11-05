import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  HiOutlineCube,
  HiOutlineArchive,
  HiOutlineCurrencyRupee,
  HiOutlineExclamationCircle,
  HiOutlineTrendingUp,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineDocumentText
} from 'react-icons/hi';

const getLocalDateString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());

  // Pagination states
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);

  const isToday = selectedDate === getLocalDateString();

  useEffect(() => {
    fetchDashboard(selectedDate, 1, true);
  }, []);

  const fetchDashboard = async (dateVal, pageNum = 1, isInitial = false) => {
    try {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setFiltering(true);
      }
      const { data } = await api.get(`/dashboard?date=${dateVal}&page=${pageNum}&limit=15`);
      setStats(data);
      setSalesPage(data.page || 1);
      setSalesTotalPages(data.totalPages || 1);
      setSalesTotal(data.totalSales || 0);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setInitialLoading(false);
      setFiltering(false);
    }
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    setSelectedDate(val);
    setSalesPage(1);
    fetchDashboard(val, 1, false);
  };

  const handlePageChange = (newPage) => {
    setSalesPage(newPage);
    fetchDashboard(selectedDate, newPage, false);
  };

  if (initialLoading) {
    return (
      <div className="table-loading" style={{ height: 256 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: isToday ? "Today's Sales" : "Sales (Chosen Day)",
      value: `₹${(stats?.todaySales || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`,
      subtitle: `${stats?.todaySalesCount || 0} transactions`,
      icon: HiOutlineCurrencyRupee,
      colorKey: 'violet',
    },
    {
      title: isToday ? "Today's Profit" : "Profit (Chosen Day)",
      value: `₹${(stats?.todayProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`,
      subtitle: 'Net earnings',
      icon: HiOutlineTrendingUp,
      colorKey: 'green',
    },
    {
      title: 'Active Quotations',
      value: stats?.pendingQuotationsCount || 0,
      subtitle: 'Click to view & convert',
      icon: HiOutlineDocumentText,
      colorKey: 'violet',
      link: '/quotations'
    },
    {
      title: 'Total Products',
      value: stats?.totalProducts || 0,
      icon: HiOutlineCube,
      colorKey: 'blue',
    },
    {
      title: 'Total Stock',
      value: stats?.totalStock || 0,
      icon: HiOutlineArchive,
      colorKey: 'green',
    },
    {
      title: 'Low Stock',
      value: stats?.lowStockCount || 0,
      icon: HiOutlineExclamationCircle,
      colorKey: 'amber',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0 0' }}>Welcome back! Here's your store overview.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-500)' }}>Filter Date:</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={handleDateChange} 
              className="form-input" 
              style={{ width: 'auto', padding: '8px 12px', fontSize: 13, height: '38px' }}
            />
            {!isToday && (
              <button
                onClick={() => {
                  const todayStr = getLocalDateString();
                  setSelectedDate(todayStr);
                  setSalesPage(1);
                  fetchDashboard(todayStr, 1, false);
                }}
                className="btn btn--secondary"
                style={{
                  padding: '8px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  height: '38px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                📅 Today
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ opacity: filtering ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
        {statCards.map((card, idx) => (
          <div 
            key={idx} 
            className="stat-card"
            onClick={card.link ? () => navigate(card.link) : undefined}
            style={{ cursor: card.link ? 'pointer' : 'default' }}
          >
            <div className="stat-card-body">
              <div>
                <p className="stat-card-label">{card.title}</p>
                <p className="stat-card-value">{card.value}</p>
                {card.subtitle && <p className="stat-card-sub">{card.subtitle}</p>}
              </div>
              <div className={`stat-card-icon stat-card-icon--${card.colorKey}`}>
                <card.icon />
              </div>
            </div>
            <div className={`stat-card-bar stat-card-bar--${card.colorKey}`}></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ opacity: filtering ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
        <div className="card-header">
          <div className="card-header-left">
            <div className="card-header-icon"><HiOutlineTrendingUp /></div>
            <h2>{isToday ? "Sales Done Today" : `Sales Done on ${new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}</h2>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table data-table--bordered">
            <thead>
              <tr>
                <th>Invoice</th>
                <th className="text-center">Items</th>
                <th className="text-right">Total</th>
                <th className="text-center">Date</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentSales?.length > 0 ? (
                stats.recentSales.map((sale) => (
                  <tr key={sale._id}>
                    <td><span className="mono-tag mono-tag--brand">{sale.invoiceNo}</span></td>
                    <td className="text-center" style={{ color: 'var(--slate-600)' }}>{sale.items?.length || 0} items</td>
                    <td className="text-right font-semibold">₹{sale.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-center" style={{ color: 'var(--slate-500)' }}>
                      {new Date(sale.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="table-empty">
                    <p>{isToday ? "No sales yet today. Start billing to see data here." : `No sales recorded on ${new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {salesTotalPages > 1 && (
          <div className="pagination" style={{ padding: '12px 24px', borderTop: '1px solid var(--slate-150)' }}>
            <p>Page {salesPage} of {salesTotalPages} (Total: {salesTotal} sales)</p>
            <div className="pagination-btns">
              <button type="button" onClick={() => handlePageChange(Math.max(1, salesPage - 1))} disabled={salesPage === 1} className="pagination-btn">
                <HiOutlineChevronLeft />
              </button>
              <button type="button" onClick={() => handlePageChange(Math.min(salesTotalPages, salesPage + 1))} disabled={salesPage === salesTotalPages} className="pagination-btn">
                <HiOutlineChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
