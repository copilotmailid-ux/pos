import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { HiOutlineMenu } from 'react-icons/hi';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Scope collapsible layout ONLY on the Billing page
  const isBillingPage = location.pathname === '/billing';

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ctrl + Shift + S to trigger hidden Settings navigation
      if (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        navigate('/settings');
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [navigate]);

  return (
    <div className={`layout ${isBillingPage ? 'layout--billing-focus' : ''}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="layout-main">
        <header className="mobile-header">
          <button onClick={() => setSidebarOpen(true)}>
            <HiOutlineMenu />
          </button>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
