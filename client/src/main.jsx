import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Globally disable accidental mouse wheel value changes on all number inputs
window.addEventListener('wheel', (e) => {
  if (
    document.activeElement &&
    document.activeElement.tagName === 'INPUT' &&
    document.activeElement.type === 'number'
  ) {
    document.activeElement.blur();
  }
}, { passive: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
