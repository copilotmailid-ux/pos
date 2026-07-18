import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineShoppingCart, HiOutlineMail, HiOutlineLockClosed } from 'react-icons/hi';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/billing');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-bg-orb login-bg-orb--1"></div>
      <div className="login-bg-orb login-bg-orb--2"></div>
      <div className="login-bg-orb login-bg-orb--3"></div>

      <div className="login-container">
        <div className="login-logo">
          <div className="login-logo-icon">
            <HiOutlineShoppingCart />
          </div>
          <h1>SuperMart POS</h1>
          <p>Sign in to your admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-card">
          <div className="login-field">
            <label>Email Address</label>
            <div className="input-wrapper">
              <span className="input-icon"><HiOutlineMail /></span>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@supermart.com"
              />
            </div>
          </div>

          <div className="login-field">
            <label>Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><HiOutlineLockClosed /></span>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button id="login-submit" type="submit" disabled={loading} className="login-btn">
            {loading ? (
              <>
                <div className="spinner-sm"></div>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <p className="login-hint">Default: admin@supermart.com / admin123</p>
        </form>
      </div>
    </div>
  );
};

export default Login;
