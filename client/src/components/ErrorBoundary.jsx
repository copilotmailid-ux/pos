import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Rendering Crash caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            padding: '24px',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%'
          }}>
            <span style={{ fontSize: '48px' }}>⚠️</span>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '16px', color: '#f8fafc' }}>
              Terminal Interface Error
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px', lineHeight: '1.5' }}>
              Something went wrong while rendering the POS user interface. Press the button below to reload and restore normal operations.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔄 Reload POS Terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
