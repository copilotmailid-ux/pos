import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HiOutlineViewGrid,
  HiOutlineCube,
  HiOutlineShoppingCart,
  HiOutlineClipboardList,
  HiOutlineExclamationCircle,
  HiOutlineLogout,
  HiOutlineX,
  HiOutlineUsers,
  HiOutlineTruck,
  HiOutlineBriefcase,
  HiOutlineTrendingUp,
  HiOutlineCog
} from 'react-icons/hi';

const navItems = [
  { to: '/billing', icon: HiOutlineShoppingCart, label: 'Billing (POS)' },
  { to: '/', icon: HiOutlineViewGrid, label: 'Dashboard' },
  { to: '/products', icon: HiOutlineCube, label: 'Products' },
  { to: '/sales', icon: HiOutlineClipboardList, label: 'Sales History' },
  { to: '/customers', icon: HiOutlineUsers, label: 'Customers' },
  { to: '/suppliers', icon: HiOutlineBriefcase, label: 'Suppliers' },
  { to: '/purchases', icon: HiOutlineTruck, label: 'Purchases' },
  { to: '/reports', icon: HiOutlineTrendingUp, label: 'Reports & Export' },
  { to: '/low-stock', icon: HiOutlineExclamationCircle, label: 'Low Stock' },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = dateTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const formattedDate = dateTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? '' : 'sidebar--closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <HiOutlineShoppingCart />
            </div>
            <div className="sidebar-brand-text">
              <h1>SuperMart</h1>
              <p>POS System</p>
            </div>
          </div>
          <button onClick={onClose} className="sidebar-close">
            <HiOutlineX />
          </button>
        </div>

        <div className="sidebar-clock">
          <div className="sidebar-clock-time">{formattedTime}</div>
          <div className="sidebar-clock-date">{formattedDate}</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="icon"><item.icon /></span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="sidebar-user-info">
              <p>{user?.name || 'Admin'}</p>
              <span>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Administrator'}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-logout">
            <span className="icon"><HiOutlineLogout /></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
