import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineLockClosed,
  HiOutlineLockOpen,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineArrowRight
} from 'react-icons/hi';

const Login = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordEnabled, setPasswordEnabled] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/billing', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    // Check if login password protection is disabled in settings
    api.get('/auth/config').then(({ data }) => {
      if (data && data.enableLoginPassword === false) {
        setPasswordEnabled(false);
      }
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (passwordEnabled && !password) {
      toast.error('Please enter your pin or passcode');
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      await login(passwordEnabled ? password : '');
      toast.success('System unlocked!');
      navigate('/billing');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect passcode!');
      setPassword('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = () => {
    if (passwordEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Determine number of PIN slots (minimum 6 like the reference design)
  const numSlots = Math.max(6, password.length);
  const slots = Array.from({ length: numSlots });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#202c39',
      backgroundImage: 'radial-gradient(circle at 50% 35%, #2c3e50 0%, #151e27 100%)',
      padding: '24px 16px',
      position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Floating Center Split Card matching reference design */}
      <div 
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '840px',
          minHeight: '440px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08)'
        }}
      >
        {/* LEFT PANEL: Flowing Organic Abstract Wave Art */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(145deg, #a4baa0 0%, #688e86 45%, #365b6c 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 36px',
          color: '#ffffff',
          overflow: 'hidden',
          minHeight: '380px'
        }}>
          {/* Organic Wave Curves SVG */}
          <svg 
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: 0.85
            }} 
            viewBox="0 0 400 500" 
            preserveAspectRatio="none"
          >
            <path 
              d="M0,0 C120,60 220,30 400,100 L400,0 Z" 
              fill="rgba(240, 248, 240, 0.22)"
            />
            <path 
              d="M0,160 C140,110 210,260 400,180 L400,500 L0,500 Z" 
              fill="rgba(42, 82, 92, 0.45)"
            />
            <path 
              d="M0,280 C160,220 220,380 400,310 L400,500 L0,500 Z" 
              fill="rgba(25, 52, 65, 0.65)"
            />
          </svg>

          {/* Central Title */}
          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <h1 style={{
              fontSize: '44px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              margin: 0,
              color: '#ffffff',
              textShadow: '0 2px 10px rgba(0,0,0,0.18)'
            }}>
              Billing
            </h1>
            <p style={{
              fontSize: '13.5px',
              letterSpacing: '0.5px',
              margin: '8px 0 0',
              color: 'rgba(255, 255, 255, 0.85)',
              fontWeight: 500
            }}>
              SuperMart POS • Retail & Wholesale Terminal
            </p>
          </div>
        </div>

        {/* RIGHT PANEL: Minimalist Light PIN / Password Authentication Form */}
        <div 
          onClick={handleCardClick}
          style={{
            position: 'relative',
            backgroundColor: '#eef2f6',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 36px',
            cursor: passwordEnabled ? 'text' : 'default'
          }}
        >
          {/* Subtle Watermark Plant/Leaf Motif in background */}
          <svg
            style={{
              position: 'absolute',
              right: '12px',
              bottom: '12px',
              width: '180px',
              height: '180px',
              opacity: 0.05,
              pointerEvents: 'none'
            }}
            viewBox="0 0 200 200"
            fill="#1e293b"
          >
            <path d="M100 20 C120 70 170 120 170 150 C170 180 140 190 100 190 C60 190 30 180 30 150 C30 120 80 70 100 20 Z" />
          </svg>

          {/* Form Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#1e293b',
              margin: 0,
              letterSpacing: '1.5px',
              textTransform: 'uppercase'
            }}>
              Admin Account
            </h2>

            {passwordEnabled ? (
              <div style={{ marginTop: 12 }}>
                <span style={{
                  display: 'inline-block',
                  backgroundColor: '#e2e8f0',
                  color: '#475569',
                  padding: '4px 14px',
                  borderRadius: '16px',
                  fontSize: '11.5px',
                  fontWeight: 650
                }}>
                  Enter your Pin Code
                </span>
                <p style={{
                  fontSize: '11px',
                  color: '#64748b',
                  margin: '6px 0 0',
                  lineHeight: 1.3
                }}>
                  Enter your 4-digit or custom passcode to access your terminal
                </p>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <span style={{
                  display: 'inline-block',
                  backgroundColor: '#ecfdf5',
                  color: '#065f46',
                  padding: '4px 14px',
                  borderRadius: '16px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  border: '1px solid #a7f3d0'
                }}>
                  Quick Access Mode Active
                </span>
                <p style={{
                  fontSize: '11px',
                  color: '#059669',
                  margin: '6px 0 0',
                  lineHeight: 1.3
                }}>
                  Password security is disabled in Settings. Instant access ready.
                </p>
              </div>
            )}
          </div>

          {/* Password Input / PIN Boxes */}
          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '340px', textAlign: 'center' }}>
            {passwordEnabled ? (
              <div style={{ marginBottom: 24, position: 'relative' }}>
                {/* Hidden Native Input capturing typing */}
                <input
                  ref={inputRef}
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  autoFocus
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer'
                  }}
                />

                {/* Styled PIN Boxes matching reference image */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                  flexWrap: 'nowrap'
                }}>
                  {slots.map((_, idx) => {
                    const char = password[idx];
                    const isCurrentSlot = isFocused && idx === password.length;
                    const hasValue = char !== undefined;

                    return (
                      <div
                        key={idx}
                        style={{
                          width: '42px',
                          height: '46px',
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: isCurrentSlot
                            ? '2px solid #3b82f6'
                            : (hasValue ? '1px solid #94a3b8' : '1px solid #cbd5e1'),
                          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: showPassword ? '16px' : '22px',
                          fontWeight: 700,
                          color: '#1e293b',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {hasValue ? (showPassword ? char : '●') : (isCurrentSlot ? '|' : '')}
                      </div>
                    );
                  })}
                </div>

                {/* Show/Hide PIN Toggle */}
                {password.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowPassword(!showPassword); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '11px',
                      marginTop: '10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600
                    }}
                  >
                    {showPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                    {showPassword ? 'Hide Digits' : 'Show Digits'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                color: '#334155',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <HiOutlineLockOpen style={{ fontSize: '18px', color: '#059669' }} />
                <span>Ready to start billing</span>
              </div>
            )}

            {/* Dark Rounded Action Button matching reference design */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: 'auto',
                minWidth: '130px',
                backgroundColor: '#1e293b',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 650,
                padding: '10px 28px',
                borderRadius: '8px',
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(30, 41, 59, 0.25)',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f172a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            >
              {loading ? (
                <>
                  <span className="spinner-sm" style={{ width: 14, height: 14 }}></span>
                  <span>Verifying...</span>
                </>
              ) : (
                passwordEnabled ? (
                  'Proceed'
                ) : (
                  <>
                    <span>Proceed</span>
                    <HiOutlineArrowRight style={{ fontSize: 14 }} />
                  </>
                )
              )}
            </button>
          </form>
        </div>
      </div>

      {/* DEVELOPER & LICENSE ATTRIBUTION FOOTER matching user instructions */}
      <div style={{
        marginTop: '24px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '12px',
        lineHeight: 1.5,
        letterSpacing: '0.2px'
      }}>
        <div>
          Developed with precision by <strong style={{ color: '#f1f5f9' }}>devmoi</strong> • Commercial POS License
        </div>
        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
          Licensed for Single Store Operation • SuperMart POS v2.0 • All Rights Reserved © 2026
        </div>
      </div>
    </div>
  );
};

export default Login;
