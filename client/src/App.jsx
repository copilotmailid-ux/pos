import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/Layout/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Billing from './pages/Billing';
import SalesHistory from './pages/SalesHistory';
import LowStock from './pages/LowStock';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Quotations from './pages/Quotations';
import api from './services/api';

const applyUiFontSize = (size) => {
  const map = {
    compact: { fontSize: '14px', zoom: '0.94' },
    standard: { fontSize: '14.5px', zoom: '1.0' },
    normal: { fontSize: '15.5px', zoom: '1.08' },
    comfortable: { fontSize: '15.5px', zoom: '1.08' },
    large: { fontSize: '16.5px', zoom: '1.16' },
    xlarge: { fontSize: '17.5px', zoom: '1.25' }
  };
  const target = map[size] || map.comfortable;
  document.documentElement.style.fontSize = target.fontSize;
  document.documentElement.style.zoom = target.zoom;
};

function App() {
  useEffect(() => {
    // 1. Apply cached UI font size immediately (default to comfortable +8% bigger)
    const cachedSize = localStorage.getItem('pos_ui_font_size') || 'comfortable';
    applyUiFontSize(cachedSize);

    // 2. Fetch fresh settings from server
    api.get('/settings')
      .then(({ data }) => {
        if (data && data.uiFontSize) {
          localStorage.setItem('pos_ui_font_size', data.uiFontSize);
          applyUiFontSize(data.uiFontSize);
        }
        if (data && data.enableGst !== undefined) {
          localStorage.setItem('pos_enable_gst', String(data.enableGst !== false));
        }
      })
      .catch(() => {
        // Silently use cached values if offline or unauthenticated
      });

    // 3. Listen for runtime settings updates
    const handleSettingsUpdated = () => {
      const updatedSize = localStorage.getItem('pos_ui_font_size') || 'normal';
      applyUiFontSize(updatedSize);
    };

    window.addEventListener('pos_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('pos_settings_updated', handleSettingsUpdated);
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '12px',
              background: '#1e293b',
              color: '#f8fafc',
              fontSize: '14px',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/billing" replace />} />
            <Route path="billing" element={<Billing />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="low-stock" element={<LowStock />} />
            <Route path="customers" element={<Customers />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/billing" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
