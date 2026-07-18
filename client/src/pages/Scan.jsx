import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { 
  HiOutlineCamera, 
  HiOutlineCheckCircle, 
  HiOutlineExclamation, 
  HiOutlinePaperAirplane, 
  HiOutlineShoppingCart, 
  HiOutlineDatabase,
  HiOutlinePlusCircle 
} from 'react-icons/hi';

const Scan = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const initialMode = searchParams.get('mode') || 'sales'; // Default mode: sales (POS)
  
  const [mode, setMode] = useState(initialMode); // 'sales' or 'stock'
  const [cameraActive, setCameraActive] = useState(false);
  const [lastScanned, setLastScanned] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [sslWarning, setSslWarning] = useState(false);

  // Stock-In workflow states
  const [stockProduct, setStockProduct] = useState(null);
  const [stockToAdd, setStockToAdd] = useState('10');
  
  const qrCodeInstanceRef = useRef(null);
  const scanLockRef = useRef(false);

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setSslWarning(true);
    }
  }, []);

  const sendBarcodeToLaptop = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    
    setLoading(true);
    try {
      await axios.post('/api/products/remote-scan', {
        barcode: cleanCode,
        sessionId: sessionId
      });
      setLastScanned(cleanCode);
      toast.success(`Sent: ${cleanCode}`);
    } catch (err) {
      toast.error("Failed to sync barcode to laptop");
    } finally {
      setLoading(false);
    }
  };

  // Look up product for Stock replenishment
  const fetchProductForStock = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setLoading(true);
    try {
      const { data } = await axios.get(`/api/products/public-barcode/${cleanCode}`);
      setStockProduct(data);
      setLastScanned(cleanCode);
    } catch (err) {
      toast.error("Product not registered in database");
      setStockProduct(null);
    } finally {
      setLoading(false);
    }
  };

  // Submit stock addition
  const handleStockUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!stockProduct || !stockToAdd) return;
    
    setLoading(true);
    try {
      const { data } = await axios.post('/api/products/remote-stock-in', {
        barcode: stockProduct.barcode,
        quantity: Number(stockToAdd),
        sessionId: sessionId // Send session ID to signal the laptop to refresh
      });
      toast.success(`Added stock! New level: ${data.stock}`);
      setStockProduct(null);
      setStockToAdd('10');
      
      // Automatically restart camera scanner if it was active
      if (cameraActive) {
        startScanner();
      }
    } catch (err) {
      toast.error("Failed to update stock");
    } finally {
      setLoading(false);
    }
  };

  const handleScanResult = (decodedText) => {
    if (scanLockRef.current) return;
    
    // Lock scanner to prevent continuous spamming of the same barcode
    scanLockRef.current = true;
    
    if (navigator.vibrate) navigator.vibrate(100);
    
    if (mode === 'sales') {
      sendBarcodeToLaptop(decodedText);
      // Re-enable scanning after 1.5 seconds cooldown
      setTimeout(() => {
        scanLockRef.current = false;
      }, 1500);
    } else {
      // Stock Mode -> Fetch details first and pause scanner to show edit form
      fetchProductForStock(decodedText);
      stopScanner();
      scanLockRef.current = false;
    }
  };

  const startScanner = async () => {
    if (!sessionId && mode === 'sales') return;
    if (sslWarning) {
      toast.error("Camera blocked. Please use the Manual Input below or run Vite on HTTPS.");
      return;
    }
    
    try {
      setLoading(true);
      const html5QrCode = new Html5Qrcode("mobile-reader");
      qrCodeInstanceRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 22,
          qrbox: { width: 280, height: 160 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128
          ]
        },
        handleScanResult,
        (error) => {}
      );
      setCameraActive(true);
    } catch (err) {
      toast.error("Could not start camera. Grant permissions or verify HTTPS connection.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stopScanner = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      await qrCodeInstanceRef.current.stop();
      qrCodeInstanceRef.current = null;
    }
    setCameraActive(false);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    
    if (mode === 'sales') {
      sendBarcodeToLaptop(manualCode);
    } else {
      fetchProductForStock(manualCode);
    }
    setManualCode('');
  };

  useEffect(() => {
    if ((sessionId || mode === 'stock') && !sslWarning) {
      startScanner();
    }
    return () => {
      if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
        qrCodeInstanceRef.current.stop().catch(e => console.error(e));
      }
    };
  }, [sessionId, sslWarning, mode]);

  if (!sessionId && mode === 'sales') {
    return (
      <div className="loading-screen text-center p-6">
        <HiOutlineExclamation className="text-red-500" size={48} />
        <h2 className="font-bold text-lg mt-4">Invalid Session Link</h2>
        <p className="text-sm text-slate-500 mt-1">Please scan the QR code from the laptop's billing page.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Toaster position="top-center" />
      
      {/* Mode Toggle Bar */}
      <div style={{ display: 'flex', width: '100%', maxWidth: 400, background: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 20, border: '1px solid #334155' }}>
        <button 
          onClick={() => { setMode('sales'); setStockProduct(null); }} 
          style={{ 
            flex: 1, padding: '10px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, border: 'none',
            background: mode === 'sales' ? 'var(--brand-600)' : 'transparent',
            color: mode === 'sales' ? 'white' : '#94a3b8',
            transition: 'all 0.2s ease'
          }}
        >
          <HiOutlineShoppingCart size={16} /> POS Billing
        </button>
        <button 
          onClick={() => { setMode('stock'); }} 
          style={{ 
            flex: 1, padding: '10px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, border: 'none',
            background: mode === 'stock' ? 'var(--brand-600)' : 'transparent',
            color: mode === 'stock' ? 'white' : '#94a3b8',
            transition: 'all 0.2s ease'
          }}
        >
          <HiOutlineDatabase size={16} /> Add Stock
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>POS Mobile Scanner</h2>
        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
          {mode === 'sales' ? (
            <>Syncing to session: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{sessionId}</span></>
          ) : (
            'Inventory Stock Replenishment Mode'
          )}
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* SSL Warning Box */}
        {sslWarning && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: 12, borderRadius: 12, fontSize: 12, color: '#fca5a5' }}>
            <p className="font-semibold">⚠️ Camera Blocked by Browser</p>
            <p style={{ marginTop: 4 }}>
              Your browser blocks camera access on unencrypted connections (http). To scan via camera, access the site over <strong>https://</strong>.
            </p>
          </div>
        )}

        {/* Stock Form (shown when product scanned in Stock Mode) */}
        {mode === 'stock' && stockProduct && (
          <div style={{ background: '#1e293b', padding: 20, borderRadius: 16, border: '2px solid var(--brand-500)', className: 'animate-fade-in' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-300)', marginBottom: 12 }}>Stock replenishment</h3>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>Product Name</p>
              <p style={{ fontSize: 16, fontWeight: 600 }}>{stockProduct.name}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>Barcode</p>
                <p style={{ fontSize: 14, fontFamily: 'monospace' }}>{stockProduct.barcode}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>Current Stock</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: stockProduct.stock < 10 ? '#ef4444' : '#10b981' }}>{stockProduct.stock}</p>
              </div>
            </div>

            <form onSubmit={handleStockUpdateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Quantity to Add</label>
                <input 
                  type="number"
                  min="1"
                  value={stockToAdd}
                  onChange={(e) => setStockToAdd(e.target.value)}
                  style={{ width: '100%', padding: 12, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: 'white', outline: 'none', fontSize: 16, fontWeight: 700 }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button 
                  type="button" 
                  onClick={() => { setStockProduct(null); startScanner(); }} 
                  className="btn btn--ghost" 
                  style={{ flex: 1, padding: 12 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn--primary" 
                  style={{ flex: 1, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <HiOutlinePlusCircle size={20} /> Update Stock
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Camera Target box */}
        {(!stockProduct || mode === 'sales') && (
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 16, border: '1px solid #334155', position: 'relative' }}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
              <div 
                id="mobile-reader" 
                style={{ 
                  width: '100%', 
                  minHeight: cameraActive ? 250 : 100, 
                  background: '#000', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'min-height 0.3s ease'
                }}
              >
                {!cameraActive && (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>Camera scanner is offline</p>
                    <button onClick={startScanner} className="btn btn--primary" disabled={sslWarning}>
                      <HiOutlineCamera size={20} /> Open Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Absolute loading overlay so React does not touch the camera video stream element */}
              {loading && (
                <div style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  background: 'rgba(15, 23, 42, 0.65)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  zIndex: 99
                }}>
                  <div className="spinner"></div>
                </div>
              )}
            </div>

            {cameraActive && (
              <button 
                onClick={stopScanner} 
                className="btn btn--danger btn--full" 
                style={{ marginTop: 16 }}
              >
                Stop Scanner
              </button>
            )}
          </div>
        )}

        {/* Keyboard Input Fallback */}
        {(!stockProduct || mode === 'sales') && (
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 16, border: '1px solid #334155' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Keyboard / Typing Fallback</h3>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 10 }}>
              <input 
                type="text" 
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Type barcode digits..."
                style={{ 
                  flex: 1, 
                  padding: '10px 14px', 
                  background: '#0f172a', 
                  border: '1px solid #334155', 
                  borderRadius: 10,
                  color: 'white',
                  fontSize: 14,
                  outline: 'none'
                }}
              />
              <button type="submit" className="btn btn--primary" style={{ padding: '10px 16px' }}>
                <HiOutlinePaperAirplane size={16} />
              </button>
            </form>
          </div>
        )}
      </div>

      {lastScanned && mode === 'sales' && (
        <div style={{ marginTop: 24, background: '#1e293b', padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <HiOutlineCheckCircle size={22} className="text-green-500" />
          <div>
            <p style={{ fontSize: 11, color: '#94a3b8' }}>Last Synced Code</p>
            <p style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>{lastScanned}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scan;
