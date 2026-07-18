import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  HiOutlineCube,
  HiOutlineArchive,
  HiOutlineCurrencyRupee,
  HiOutlineExclamationCircle,
  HiOutlineTrendingUp,
} from 'react-icons/hi';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data } = await api.get('/dashboard');
      setStats(data);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="table-loading" style={{ height: 256 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const statCards = [
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
      title: "Today's Sales",
      value: `₹${(stats?.todaySales || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`,
      subtitle: `${stats?.todaySalesCount || 0} transactions`,
      icon: HiOutlineCurrencyRupee,
      colorKey: 'violet',
    },
    {
      title: "Today's Profit",
      value: `₹${(stats?.todayProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`,
      subtitle: 'Net earnings',
      icon: HiOutlineTrendingUp,
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
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here's your store overview.</p>
      </div>

      <div className="stats-grid">
        {statCards.map((card, idx) => (
          <div key={idx} className="stat-card">
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

      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <div className="card-header-icon"><HiOutlineTrendingUp /></div>
            <h2>Recent Sales</h2>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Items</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentSales?.length > 0 ? (
                stats.recentSales.map((sale) => (
                  <tr key={sale._id}>
                    <td><span className="mono-tag mono-tag--brand">{sale.invoiceNo}</span></td>
                    <td className="text-sm" style={{ color: 'var(--slate-600)' }}>{sale.items?.length || 0} items</td>
                    <td className="font-semibold">₹{sale.grandTotal?.toLocaleString()}</td>
                    <td className="text-sm" style={{ color: 'var(--slate-500)' }}>
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
                    <p>No sales yet. Start billing to see data here.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
