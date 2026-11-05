import React from 'react';

// Buffer to store recent console errors/warnings for diagnostics
const consoleErrorBuffer = [];
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    try {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ');
      consoleErrorBuffer.push(`[${new Date().toLocaleTimeString('en-IN')}] ${msg}`);
      if (consoleErrorBuffer.length > 25) consoleErrorBuffer.shift();
    } catch {
      // Safe fallback
    }
    originalConsoleError.apply(console, args);
  };
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('React Crash caught by ErrorBoundary:', error, errorInfo);
  }

  componentDidMount() {
    // Catch global unhandled promise rejections and script errors
    this.unhandledRejectionHandler = (event) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      if (!this.state.hasError) {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled Promise Rejection'));
        this.setState({ hasError: true, error });
      }
    };

    this.globalErrorHandler = (event) => {
      console.error('Global Window Error:', event.error || event.message);
      if (!this.state.hasError) {
        const error = event.error instanceof Error ? event.error : new Error(event.message || 'Global Window Error');
        this.setState({ hasError: true, error });
      }
    };

    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
    window.addEventListener('error', this.globalErrorHandler);
  }

  componentWillUnmount() {
    if (this.unhandledRejectionHandler) {
      window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
    }
    if (this.globalErrorHandler) {
      window.removeEventListener('error', this.globalErrorHandler);
    }
  }

  handleReload = () => {
    window.location.href = '/';
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('pos_active_cart');
      localStorage.removeItem('pos_loaded_quotation');
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
    
    const diagnostics = [
      '================== SUPERMART POS ERROR REPORT ==================',
      `Support Helpline  : 9360480902`,
      `Date & Time       : ${new Date().toLocaleString('en-IN')}`,
      `Environment       : ${isElectron ? 'Electron Desktop Shell' : 'Web Browser'}`,
      `Current Route     : ${window.location.href}`,
      `User Agent        : ${navigator.userAgent}`,
      '----------------------------------------------------------------',
      'ERROR DETAILS:',
      `Name    : ${error?.name || 'Unknown Error'}`,
      `Message : ${error?.message || String(error)}`,
      '',
      'STACK TRACE:',
      error?.stack || 'No stack trace available',
      '',
      'COMPONENT HIERARCHY:',
      errorInfo?.componentStack || 'No component stack available',
      '',
      'RECENT CONSOLE LOGS (LAST 25):',
      consoleErrorBuffer.length > 0 ? consoleErrorBuffer.join('\n') : 'No captured console errors',
      '================================================================'
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(diagnostics)
        .then(() => this.triggerCopiedState())
        .catch(() => this.fallbackCopy(diagnostics));
    } else {
      this.fallbackCopy(diagnostics);
    }
  };

  fallbackCopy = (text) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.triggerCopiedState();
    } catch (e) {
      alert('Could not auto-copy. Please select and copy the technical details manually below.');
    }
  };

  triggerCopiedState = () => {
    this.setState({ copied: true });
    setTimeout(() => {
      this.setState({ copied: false });
    }, 3000);
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, copied, showDetails } = this.state;
      const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b1329 0%, #0f172a 100%)',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            backdropFilter: 'blur(16px)',
            padding: '32px 28px',
            borderRadius: '20px',
            maxWidth: '620px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15)',
            textAlign: 'center'
          }}>
            {/* Warning Icon Badge */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 16px'
            }}>
              ⚠️
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#ffffff', letterSpacing: '-0.02em' }}>
              Terminal Interface Error
            </h2>

            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
              An unexpected issue occurred while rendering the POS terminal interface.
              {isElectron && ' (Running in Electron Desktop Mode)'}
            </p>

            {/* Support Helpline Box */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '13px', color: '#c7d2fe', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Need Immediate Help? Contact Support
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <a
                  href="tel:9360480902"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#38bdf8',
                    textDecoration: 'none',
                    background: 'rgba(15, 23, 42, 0.7)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    letterSpacing: '0.04em'
                  }}
                >
                  📞 9360480902
                </a>
                <a
                  href="https://wa.me/919360480902?text=Hello%20SuperMart%20Support,%20my%20POS%20encountered%20an%20error."
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#4ade80',
                    textDecoration: 'none',
                    background: 'rgba(15, 23, 42, 0.7)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(74, 222, 128, 0.3)'
                  }}
                >
                  💬 WhatsApp
                </a>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '11px 22px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                  transition: 'transform 0.1s ease, background 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
              >
                🔄 Reload Terminal
              </button>

              <button
                onClick={this.handleCopyError}
                style={{
                  padding: '11px 20px',
                  background: copied ? '#059669' : '#334155',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s ease'
                }}
              >
                {copied ? '✔ Error Copied to Clipboard!' : '📋 Copy Error Details'}
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                title="Clears cached cart in browser and reloads fresh"
                style={{
                  padding: '11px 18px',
                  background: 'transparent',
                  color: '#cbd5e1',
                  border: '1px solid #475569',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                🧹 Reset Cart & Reload
              </button>
            </div>

            {/* Toggle Technical Console Details Accordion */}
            <div style={{ marginTop: '16px', textAlign: 'left' }}>
              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '4px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {showDetails ? '▼ Hide Console Error Details' : '▶ View Console Error Details'}
              </button>

              {showDetails && (
                <div style={{
                  marginTop: '10px',
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: '10px',
                  padding: '14px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  fontSize: '11.5px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  color: '#f87171',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.6)'
                }}>
                  <div style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '6px' }}>
                    Error: {error?.name || 'Error'}: {error?.message}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    {error?.stack}
                  </div>
                  {errorInfo?.componentStack && (
                    <div style={{ color: '#fbbf24', marginTop: '8px' }}>
                      <strong>Component Stack:</strong>
                      {errorInfo.componentStack}
                    </div>
                  )}
                  {consoleErrorBuffer.length > 0 && (
                    <div style={{ color: '#cbd5e1', marginTop: '10px', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
                      <strong style={{ color: '#94a3b8' }}>Recent Console Logs:</strong>
                      <br />
                      {consoleErrorBuffer.join('\n')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
