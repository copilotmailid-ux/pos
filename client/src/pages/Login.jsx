import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineShoppingCart, HiOutlineLockClosed } from 'react-icons/hi';

const Login = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error('Please enter the passcode');
      return;
    }
    setLoading(true);
    try {
      await login(password);
      toast.success('System unlocked!');
      navigate('/billing');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid Passcode!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-bg-orb login-bg-orb--1"></div>
      <div className="login-bg-orb login-bg-orb--2"></div>
      <div className="login-bg-orb login-bg-orb--3"></div>

      <div className="login-container animate-fade-in">
        <div className="login-logo">
          <div className="login-logo-icon">
            <HiOutlineShoppingCart />
          </div>
          <h1>SuperMart POS</h1>
          <p>Enter passcode to unlock billing terminal</p>
        </div>

        <form onSubmit={handleSubmit} className="login-card">
          <div className="login-field">
            <label>Admin Passcode</label>
            <div className="input-wrapper">
              <span className="input-icon"><HiOutlineLockClosed /></span>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>
          </div>

          <button id="login-submit" type="submit" disabled={loading} className="login-btn">
            {loading ? (
              <>
                <div className="spinner-sm"></div>
                Unlocking...
              </>
            ) : (
              'Unlock Terminal'
            )}
          </button>

          <p className="login-hint">Default Passcode: admin123</p>
        </form>
      </div>
    </div>
  );
};

export default Login;
