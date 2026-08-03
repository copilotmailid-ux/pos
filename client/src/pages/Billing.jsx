import { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Receipt from '../components/Receipt';
import {
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineMinus,
  HiOutlineShoppingCart,
  HiOutlineX,
  HiOutlineDeviceMobile,
  HiOutlineBookmark,
  HiOutlineInboxIn
} from 'react-icons/hi';

const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const emptyQuickForm = {
  name: '',
  variant: '',
  category: '',
  purchasePrice: '',
  sellingPrice: '',
  stock: '10',
  gstRate: 12
};

const categories = ['Dairy', 'Beverages', 'Snacks', 'Grocery', 'Personal Care', 'Household', 'Other'];
const gstSlabs = [0, 5, 12, 18, 28];

// FEATURE TOGGLE: Set to false to easily disable/remove the voice typing microphone button
const ENABLE_VOICE_TYPING = typeof navigator !== 'undefined' && !navigator.userAgent.toLowerCase().includes('electron');

const Billing = () => {
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  
  // Persistent Cart & Customer state
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('pos_active_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [receipt, setReceipt] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  
  // Quick Add Modal States
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickBarcode, setQuickBarcode] = useState('');
  const [quickForm, setQuickForm] = useState(emptyQuickForm);
  const [quickSaving, setQuickSaving] = useState(false);

  // Dropdown Product Search States
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const dropdownRef = useRef(null);

  // Customer & Payment States (Load from localStorage)
  const [customerMobile, setCustomerMobile] = useState(() => {
    return localStorage.getItem('pos_active_customer_mobile') || '';
  });
  const [customerName, setCustomerName] = useState(() => {
    return localStorage.getItem('pos_active_customer_name') || '';
  });
  const [paymentMethod, setPaymentMethod] = useState(() => {
    return localStorage.getItem('pos_active_payment_method') || 'Cash Tendered';
  });
  const [receivedAmount, setReceivedAmount] = useState(() => {
    return localStorage.getItem('pos_active_received_amount') || '';
  });
  const [changeDue, setChangeDue] = useState(0);
  
  const [settings, setSettings] = useState(null);
  const [promptProduct, setPromptProduct] = useState(null);
  const [promptQty, setPromptQty] = useState('1');
  const qtyInputRef = useRef(null);

  // Held Bills System States
  const [heldBills, setHeldBills] = useState([]);
  const [heldListOpen, setHeldListOpen] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const customerSuggestionsRef = useRef(null);
  const skipNextSuggestionFetch = useRef(false);

  // Write changes back to localStorage automatically
  useEffect(() => {
    localStorage.setItem('pos_active_cart', JSON.stringify(cart));
  }, [cart]);

  // Sync mobile state and trigger suggestions search on input
  useEffect(() => {
    localStorage.setItem('pos_active_customer_mobile', customerMobile);
    
    // Skip fetch if a suggestion was just selected
    if (skipNextSuggestionFetch.current) {
      skipNextSuggestionFetch.current = false;
      return;
    }
    
    if (customerMobile.length >= 3) {
      const searchCustomers = async () => {
        try {
          const { data } = await api.get(`/customers?search=${customerMobile}`);
          setCustomerSuggestions(data.slice(0, 5));
          setActiveSuggestionIndex(-1);
        } catch (err) {
          console.error("Failed to query customer suggestions", err);
        }
      };
      searchCustomers();
    } else {
      setCustomerSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  }, [customerMobile]);

  useEffect(() => {
    localStorage.setItem('pos_active_customer_name', customerName);
  }, [customerName]);

  useEffect(() => {
    localStorage.setItem('pos_active_payment_method', paymentMethod);
  }, [paymentMethod]);

  useEffect(() => {
    localStorage.setItem('pos_active_received_amount', receivedAmount);
  }, [receivedAmount]);

  const barcodeRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Math Calculations (CGST & SGST Split)
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const gstAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity * (item.gstRate / 100)), 0);
  const cgstAmount = Math.round((gstAmount / 2 + Number.EPSILON) * 100) / 100;
  const sgstAmount = Math.round((gstAmount - cgstAmount + Number.EPSILON) * 100) / 100;
  const grandTotal = subtotal + gstAmount;

  // Auto-update received amount and change due
  useEffect(() => {
    if (paymentMethod === 'UPI / Card' || paymentMethod === 'Digital Wallet') {
      setReceivedAmount(grandTotal.toFixed(2));
      setChangeDue(0);
    } else {
      if (!receivedAmount) {
        setChangeDue(0);
        return;
      }
      const due = Number(receivedAmount) - grandTotal;
      setChangeDue(due > 0 ? due : 0);
    }
  }, [receivedAmount, grandTotal, paymentMethod]);

  // Pre-fill received amount when grandTotal changes (only for Cash; Card auto-syncs above)
  useEffect(() => {
    if (paymentMethod === 'Cash Tendered') {
      if (grandTotal > 0) {
        setReceivedAmount(grandTotal.toFixed(2));
      } else {
        setReceivedAmount('');
      }
    }
  }, [grandTotal, paymentMethod]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleVoiceTyping = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice typing is not supported on this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.lang = 'en-IN'; 
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        toast('Speak customer name now...', { icon: '🎙️' });
      };

      recognition.onresult = (event) => {
        const resultText = event.results[0][0].transcript;
        const cleanName = resultText.replace(/\.$/, '');
        setCustomerName(cleanName);
        toast.success(`Recognized: "${cleanName}"`);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== 'aborted') {
          toast.error(`Voice typing error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      toast.error("Failed to start microphone.");
      setIsListening(false);
    }
  };

  useEffect(() => {
    // Attempt focus at multiple stages of the page transition to guarantee cursor activation
    const t1 = setTimeout(() => barcodeRef.current?.focus(), 100);
    const t2 = setTimeout(() => barcodeRef.current?.focus(), 350);
    const t3 = setTimeout(() => barcodeRef.current?.focus(), 700);
    
    // Load held bills from localstorage
    const savedHeld = localStorage.getItem('pos_held_bills');
    if (savedHeld) {
      try { setHeldBills(JSON.parse(savedHeld)); } catch (e) {}
    }



    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSearchResults([]);
      }
      if (customerSuggestionsRef.current && !customerSuggestionsRef.current.contains(event.target)) {
        setCustomerSuggestions([]);
        setActiveSuggestionIndex(-1);
      }
    };
    
    // Scanner focus auto-recovery interceptor
    const handleGlobalKeyDown = (e) => {
      const active = document.activeElement;
      if (active && (
        active.tagName === 'INPUT' || 
        active.tagName === 'SELECT' || 
        active.tagName === 'TEXTAREA'
      )) {
        return; // Ignore if focused on input/select/textarea
      }

      // If user starts typing standard alphanumeric characters (scanner output)
      if (/^[0-9a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setSettings(data))
      .catch((err) => console.error('Error fetching settings in POS:', err));
  }, []);

  const focusBarcode = () => { setTimeout(() => barcodeRef.current?.focus(), 100); };
  
  const selectCustomerSuggestion = (cust) => {
    skipNextSuggestionFetch.current = true;
    setCustomerMobile(cust.mobile);
    setCustomerName(cust.name);
    setCustomerSuggestions([]);
    setActiveSuggestionIndex(-1);
  };

  const handleCustomerMobileKeyDown = (e) => {
    if (customerSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev < customerSuggestions.length - 1 ? prev + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : customerSuggestions.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < customerSuggestions.length) {
        selectCustomerSuggestion(customerSuggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setCustomerSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  };

  const clearActiveBill = () => {
    setCart([]);
    setCustomerMobile('');
    setCustomerName('');
    setReceivedAmount('');
    setBarcode('');
    localStorage.removeItem('pos_active_cart');
    localStorage.removeItem('pos_active_customer_mobile');
    localStorage.removeItem('pos_active_customer_name');
    localStorage.removeItem('pos_active_payment_method');
    localStorage.removeItem('pos_active_received_amount');
  };

  // Held Bills Operations
  const handleHoldBill = () => {
    if (cart.length === 0) {
      toast.error("Cannot hold an empty bill");
      return;
    }
    const newHeld = {
      id: Date.now(),
      cart,
      customerMobile,
      customerName,
      date: new Date().toLocaleTimeString(),
      total: grandTotal
    };
    const updated = [...heldBills, newHeld];
    setHeldBills(updated);
    localStorage.setItem('pos_held_bills', JSON.stringify(updated));
    
    // Clear active bill cache
    clearActiveBill();
    toast.success("Bill put on hold successfully! (F3)");
  };

  const handleResumeBill = (heldBill) => {
    setCart(heldBill.cart);
    setCustomerMobile(heldBill.customerMobile || '');
    setCustomerName(heldBill.customerName || '');
    
    // Remove from held
    const updated = heldBills.filter(b => b.id !== heldBill.id);
    setHeldBills(updated);
    localStorage.setItem('pos_held_bills', JSON.stringify(updated));
    setHeldListOpen(false);
    toast.success("Bill resumed successfully!");
  };

  const handleNewBill = () => {
    clearActiveBill();
    toast.success("New bill started (F2)");
    focusBarcode();
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleNewBill();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleHoldBill();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setHeldListOpen(prev => !prev);
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'Escape') {
        setHeldListOpen(false);
        setQuickAddOpen(false);
        setReceipt(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, customerMobile, customerName, heldBills, grandTotal, checkingOut]);

  // Resuming bill focus handler is managed by hooks below

  const addProductToCart = (product, qty = 1) => {
    const cleanQty = parseInt(qty, 10);
    if (isNaN(cleanQty) || cleanQty <= 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }
    
    if (product.stock < cleanQty) {
      toast.error(`Only ${product.stock} units available in stock!`);
      return;
    }

    const cleanCode = product.barcode;
    const existingIndex = cart.findIndex((item) => item.barcode === cleanCode);
    const itemGst = product.gstRate ?? 12;
    
    if (existingIndex !== -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += cleanQty;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].price * (1 + (itemGst / 100));
      setCart(updated);
      toast.success(`${product.name} qty +${cleanQty}`);
    } else {
      setCart(prevCart => [...prevCart, {
        productId: product.id || product._id, 
        productName: product.name, 
        variant: product.variant || '',
        barcode: product.barcode,
        price: product.sellingPrice, 
        quantity: cleanQty, 
        gstRate: itemGst,
        total: product.sellingPrice * cleanQty * (1 + (itemGst / 100)), 
        maxStock: product.stock,
      }]);
      toast.success(`${product.name} added`);
    }
    setBarcode('');
    setSearchQuery('');
    setSearchResults([]);
    setActiveSearchIndex(-1);
    focusBarcode();
  };

  const handleBarcodeSubmit = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const existingIndex = cart.findIndex((item) => item.barcode === cleanCode);
    if (existingIndex !== -1 && settings?.barcodeAction !== 'prompt') {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      const itemGst = updated[existingIndex].gstRate ?? 12;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].price * (1 + (itemGst / 100));
      setCart(updated);
      setBarcode('');
      toast.success(`${updated[existingIndex].productName} qty +1`);
      focusBarcode();
      return;
    }

    try {
      const { data } = await api.get(`/products/barcode/${cleanCode}`);
      if (data.stock < 1) {
        toast.error(`${data.name} is out of stock!`);
        setBarcode('');
        focusBarcode();
        return;
      }
      
      if (settings?.barcodeAction === 'prompt') {
        setPromptProduct(data);
        setPromptQty('1');
        setBarcode('');
        setTimeout(() => qtyInputRef.current?.focus(), 150);
      } else {
        addProductToCart(data, 1);
      }
    } catch (err) {
      setQuickBarcode(cleanCode);
      setQuickForm({ ...emptyQuickForm });
      setQuickAddOpen(true);
      toast('New barcode detected! Add product details.', { icon: '✨' });
      setBarcode('');
      focusBarcode();
    }
  };

  const handleBarcodeChange = (e) => {
    setBarcode(e.target.value);
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSubmit(barcode);
    }
  };

  const handleSearchQueryChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const { data } = await api.get(`/products?search=${encodeURIComponent(query)}`);
          setSearchResults(data.slice(0, 8));
          setActiveSearchIndex(-1);
        } catch (err) {
          console.error("Dropdown search failure", err);
        }
      }, 200); // 200ms debounce to optimize network load
    } else {
      setSearchResults([]);
      setActiveSearchIndex(-1);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0 && activeSearchIndex >= 0 && activeSearchIndex < searchResults.length) {
        addProductToCart(searchResults[activeSearchIndex]);
      }
    } else if (searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSearchIndex((prevIndex) => 
          prevIndex < searchResults.length - 1 ? prevIndex + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSearchIndex((prevIndex) => 
          prevIndex > 0 ? prevIndex - 1 : searchResults.length - 1
        );
      } else if (e.key === 'Escape') {
        setSearchResults([]);
        setActiveSearchIndex(-1);
      }
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleBarcodeSubmit(barcode);
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!quickForm.name || !quickForm.category || !quickForm.purchasePrice || !quickForm.sellingPrice) {
      toast.error('Please fill in all required fields');
      return;
    }
    setQuickSaving(true);
    try {
      const { data } = await api.post('/products', {
        name: quickForm.name,
        variant: quickForm.variant,
        barcode: quickBarcode,
        category: quickForm.category,
        purchasePrice: Number(quickForm.purchasePrice),
        sellingPrice: Number(quickForm.sellingPrice),
        stock: Number(quickForm.stock),
        gstRate: Number(quickForm.gstRate)
      });

      const itemGst = data.gstRate ?? 12;
      setCart(prevCart => [...prevCart, {
        productId: data._id,
        productName: data.name,
        variant: data.variant || '',
        barcode: data.barcode,
        price: data.sellingPrice,
        quantity: 1,
        gstRate: itemGst,
        total: data.sellingPrice * (1 + (itemGst / 100)),
        maxStock: data.stock,
      }]);

      setQuickAddOpen(false);
      setBarcode('');
      toast.success(`Registered and added: ${data.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setQuickSaving(false);
      focusBarcode();
    }
  };



  const updateQuantity = (index, delta) => {
    const updated = [...cart];
    const item = updated[index];
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    if (newQty > item.maxStock) { toast.error(`Only ${item.maxStock} in stock`); return; }
    item.quantity = newQty;
    const itemGst = item.gstRate ?? 12;
    item.total = item.quantity * item.price * (1 + (itemGst / 100));
    setCart(updated);
    focusBarcode();
  };

  const removeItem = (index) => {
    const removed = cart[index];
    setCart(cart.filter((_, i) => i !== index));
    toast(`${removed.productName} removed`, { icon: '🗑️' });
    focusBarcode();
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Add items to bill first'); return; }
    if (checkingOut) return;
    setCheckingOut(true);
    try {
      const { data } = await api.post('/sales', {
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        customerMobile,
        customerName,
        paymentMethod,
        amountPaid: Number(receivedAmount),
        changeReturned: changeDue
      });
      setReceipt(data);
      clearActiveBill();
      toast.success(`Sale ${data.invoiceNo} completed!`);
      
      // Auto-print receipt if configured in settings
      if (settings?.autoPrint) {
        setTimeout(() => window.print(), 500);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Checkout failed'); }
    finally { setCheckingOut(false); }
  };

  // Render layout block

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header-row" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--slate-800)' }}>Billing POS</h1>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            type="button" 
            onClick={handleHoldBill} 
            className="btn btn--ghost" 
            style={{ border: '1px solid var(--slate-300)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <HiOutlineBookmark /> Hold Bill (F3)
          </button>
          <button 
            type="button" 
            onClick={() => setHeldListOpen(true)} 
            className="btn btn--ghost" 
            style={{ border: '1px solid var(--slate-300)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <HiOutlineInboxIn /> Resume Bill (F4) {heldBills.length > 0 ? `(${heldBills.length})` : ''}
          </button>
        </div>
      </div>

      {/* POS Billing Layout */}
      <div className="billing-grid" style={{ gridTemplateColumns: '1fr 260px', gap: 12 }}>
        {/* Left Side: Inputs & Cart list */}
        <div>
          {/* Dual Inputs: Barcode Scanner & Name Auto-Complete Search */}
          <div style={{ marginBottom: 16, position: 'relative' }} ref={dropdownRef}>
            <div style={{ display: 'flex', gap: 16, width: '100%' }}>
              
              {/* 1. Barcode Scan Input (Left side) */}
              <div style={{ flex: 1.2 }}>
                <form onSubmit={handleManualSubmit} className="search-input-group">
                  <input
                    ref={barcodeRef}
                    id="barcode-input"
                    type="text"
                    value={barcode}
                    onChange={handleBarcodeChange}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="Scan Barcode..."
                    autoComplete="off"
                    autoFocus
                  />
                  <div className="input-label">
                    Barcode
                  </div>
                </form>
              </div>

              {/* 2. Text Search Input (Right side) */}
              <div style={{ flex: 1.5, position: 'relative' }}>
                <div className="search-input-group">
                  <HiOutlineSearch className="search-icon" size={18} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchQueryChange}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search product by name..."
                    autoComplete="off"
                    style={{ paddingLeft: 10 }}
                  />
                </div>
              </div>
            </div>

            {/* Dropdown Auto-Complete Suggestions List */}
            {searchResults.length > 0 && (
              <div className="search-results-dropdown">
                {searchResults.map((product, idx) => (
                  <div
                    key={product._id}
                    onClick={() => addProductToCart(product)}
                    className={`search-result-item ${idx === activeSearchIndex ? 'active' : ''}`}
                  >
                    <div>
                      <div className="search-result-name">
                        {product.name}
                        {product.variant && (
                          <span style={{ marginLeft: 6, color: 'var(--slate-500)', fontSize: 12 }}>
                            ({product.variant})
                          </span>
                        )}
                      </div>
                      <div className="search-result-info">Code: {product.barcode} | {product.category}</div>
                    </div>
                    <div className="search-result-right">
                      <div className="search-result-price">₹{product.sellingPrice}</div>
                      <div className={`search-result-stock ${product.stock < 10 ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                        Stock: {product.stock}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Billing Cart Table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table className="data-table data-table--bordered">
                <thead>
                  <tr>
                    <th>ITEM DESCRIPTION</th>
                    <th className="text-right">PRICE</th>
                    <th className="text-center">QUANTITY</th>
                    <th className="text-center">GST %</th>
                    <th className="text-right">TOTAL</th>
                    <th className="text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="table-empty" style={{ padding: '80px 20px' }}>
                        <div className="icon"><HiOutlineShoppingCart /></div>
                        <p>No items in bill</p>
                        <p className="sub">Scan a barcode or type in search box to populate items</p>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={idx} className="animate-slide-in">
                        <td>
                          <div>
                            <p className="font-semibold" style={{ fontSize: 14, color: 'var(--slate-800)' }}>
                              {item.productName}
                              {item.variant && (
                                <span style={{ marginLeft: 6, color: 'var(--slate-500)', fontSize: 12, fontWeight: 'normal' }}>
                                  ({item.variant})
                                </span>
                              )}
                            </p>
                            <p className="sub" style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 2 }}>{item.barcode}</p>
                          </div>
                        </td>
                        <td className="text-right" style={{ fontSize: 14, color: 'var(--slate-700)' }}>
                          ₹{item.price.toFixed(2)}
                        </td>
                        <td className="text-center">
                          <div className="qty-controls" style={{ margin: '0 auto' }}>
                            <button onClick={() => updateQuantity(idx, -1)} className="qty-btn"><HiOutlineMinus /></button>
                            <span className="qty-value">{item.quantity}</span>
                            <button onClick={() => updateQuantity(idx, 1)} className="qty-btn"><HiOutlinePlus /></button>
                          </div>
                        </td>
                        <td className="text-center" style={{ fontSize: 14, color: 'var(--slate-600)' }}>
                          {item.gstRate}%
                        </td>
                        <td className="text-right font-semibold" style={{ fontSize: 14, color: 'var(--slate-850)' }}>
                          ₹{item.total.toFixed(2)}
                        </td>
                        <td className="text-center">
                          <button onClick={() => removeItem(idx)} className="btn--icon btn--icon-danger">
                            <HiOutlineTrash />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Sidebar Panel (Cashier Cockpit) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <div className="card" style={{ padding: 16, border: '1px solid var(--slate-200)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Section 1: Customer Details */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 8 }}>
                👤 Customer Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                <div style={{ position: 'relative' }} ref={customerSuggestionsRef}>
                  <input
                    type="text"
                    maxLength="10"
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={handleCustomerMobileKeyDown}
                    placeholder="Mobile (10 digits)"
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                    autoComplete="off"
                  />
                  
                  {/* Autocomplete Dropdown List */}
                  {customerSuggestions.length > 0 && (
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        left: 0, 
                        right: 0, 
                        background: 'white', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '8px', 
                        boxShadow: 'var(--shadow-lg)', 
                        zIndex: 100, 
                        maxHeight: '200px', 
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        marginTop: '4px'
                      }}
                    >
                      {customerSuggestions.map((c, idx) => (
                        <div
                          key={c._id}
                          onMouseDown={(e) => { e.preventDefault(); selectCustomerSuggestion(c); }}
                          onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          style={{ 
                            padding: '10px 14px', 
                            borderBottom: '1px solid #f1f5f9', 
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: activeSuggestionIndex === idx ? 'var(--brand-50, #ede9fe)' : 'transparent',
                            transition: 'background 0.1s ease'
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--slate-500)', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                            {c.mobile}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer Name"
                    className="form-input"
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      fontSize: 13
                    }}
                    autoComplete="off"
                  />
                  {ENABLE_VOICE_TYPING && (
                    <button
                      type="button"
                      onClick={toggleVoiceTyping}
                      className={`btn ${isListening ? 'btn--danger' : 'btn--ghost'}`}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--slate-200)',
                        background: isListening ? '#fef2f2' : 'white',
                        borderColor: isListening ? '#fca5a5' : 'var(--slate-200)',
                        cursor: 'pointer',
                        height: '35px'
                      }}
                      title={isListening ? "Stop listening" : "Type customer name with voice"}
                    >
                      {isListening ? (
                        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700 }}>
                          🛑 <span style={{ textTransform: 'uppercase' }}>Stop</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 13 }}>🎙️</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--slate-100)', margin: '4px 0' }} />

            {/* Section 2: Invoice Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--slate-500)' }}>
                <span>Subtotal</span>
                <span className="font-semibold" style={{ color: 'var(--slate-800)' }}>₹{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--slate-500)' }}>
                <span>CGST (Central Tax)</span>
                <span className="font-semibold" style={{ color: 'var(--slate-800)' }}>₹{cgstAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--slate-500)' }}>
                <span>SGST (State Tax)</span>
                <span className="font-semibold" style={{ color: 'var(--slate-800)' }}>₹{sgstAmount.toFixed(2)}</span>
              </div>
              
              {/* Massive Grand Total Block */}
              <div style={{ 
                background: 'var(--slate-800)', 
                borderRadius: '8px', 
                padding: '12px 14px', 
                color: 'white', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: 6,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-300)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--slate-100)', margin: '4px 0' }} />

            {/* Section 3: Payment & Checkout */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', display: 'block', marginBottom: 6 }}>Payment Method</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['Cash Tendered', 'UPI / Card'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: paymentMethod === method ? 'var(--brand-500)' : 'var(--slate-200)',
                        background: paymentMethod === method ? 'var(--brand-50)' : 'white',
                        color: paymentMethod === method ? 'var(--brand-700)' : 'var(--slate-600)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      {method === 'Cash Tendered' ? '💵 Cash' : '💳 UPI / Card'}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'Cash Tendered' ? (
                <div className="animate-fade-in">
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', display: 'block', marginBottom: 4 }}>Received Cash Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="0.00"
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13 }}
                  />
                  
                  {/* Change Due Box */}
                  <div style={{ 
                    background: '#f0fdf4', 
                    border: '1px solid #bbf7d0', 
                    padding: '8px 12px', 
                    borderRadius: 6, 
                    textAlign: 'center', 
                    marginTop: 10 
                  }}>
                    <p style={{ fontSize: 9.5, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Change Due Balance
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
                      ₹{changeDue.toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--slate-50)', padding: '10px 12px', borderRadius: 6, fontSize: 12, color: 'var(--slate-500)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>UPI/Card Auto-settled</span>
                  <span className="font-semibold" style={{ color: 'var(--slate-850)' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              )}

              <button 
                id="checkout-btn" 
                onClick={handleCheckout} 
                disabled={cart.length === 0 || checkingOut} 
                className="btn btn--primary"
                style={{ 
                  padding: '12px 14px', 
                  borderRadius: 8, 
                  fontSize: 14, 
                  fontWeight: 700, 
                  width: '100%', 
                  marginTop: 6,
                  background: cart.length === 0 ? 'var(--slate-100)' : 'linear-gradient(135deg, var(--emerald-600), var(--emerald-500))',
                  boxShadow: cart.length === 0 ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.25)',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {checkingOut ? (<><div className="spinner-sm"></div> Processing...</>) : '✓ Checkout & Print (F5)'}
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Held Bills Listing Modal (F4) */}
      {heldListOpen && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setHeldListOpen(false)} />
          <div className="modal modal--md animate-fade-in">
            <div className="modal-header">
              <h3>Held Bills Queue</h3>
              <button onClick={() => setHeldListOpen(false)} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '350px', overflowY: 'auto', padding: 0 }}>
              {heldBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>
                  <HiOutlineInboxIn size={36} />
                  <p style={{ marginTop: 8, fontSize: 13 }}>No held bills in the queue</p>
                </div>
              ) : (
                heldBills.map((b) => (
                  <div 
                    key={b.id} 
                    onClick={() => handleResumeBill(b)}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 20px', 
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'background 0.2s' 
                    }}
                    className="search-result-item"
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>
                        {b.customerName ? `${b.customerName} (${b.customerMobile})` : `Walk-in Customer`}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--slate-450)', marginTop: 4 }}>
                        Time: {b.date} | Items: {b.cart.length}
                      </p>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-600)' }}>₹{b.total.toFixed(2)}</p>
                      <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>Click to Resume</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {quickAddOpen && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setQuickAddOpen(false)} />
          <div className="modal modal--lg animate-fade-in">
            <div className="modal-header">
              <h3>Unrecognized Barcode: Add Product</h3>
              <button onClick={() => setQuickAddOpen(false)} className="close-btn"><HiOutlineX /></button>
            </div>
            <form onSubmit={handleQuickAddSubmit} className="modal-body">
              <div className="form-group">
                <label>Barcode</label>
                <input type="text" className="form-input form-input--mono" value={quickBarcode} readOnly disabled />
              </div>
              <div className="form-group">
                <label>Product Name <span className="required">*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={quickForm.name} 
                  onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })} 
                  placeholder="e.g., Dabur Red Paste" 
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Size / Variant <span className="hint">(e.g., 50g, 10 Rs, 1L)</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={quickForm.variant} 
                  onChange={(e) => setQuickForm({ ...quickForm, variant: e.target.value })} 
                  placeholder="e.g., 50g, 10 Rs" 
                />
              </div>
              <div className="form-group">
                <label>Category <span className="required">*</span></label>
                <select 
                  className="form-select" 
                  value={quickForm.category} 
                  onChange={(e) => setQuickForm({ ...quickForm, category: e.target.value })}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Purchase Price (₹) <span className="required">*</span></label>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    className="form-input" 
                    value={quickForm.purchasePrice} 
                    onChange={(e) => setQuickForm({ ...quickForm, purchasePrice: e.target.value })} 
                    placeholder="0.00" 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Selling Price (₹) <span className="required">*</span></label>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    className="form-input" 
                    value={quickForm.sellingPrice} 
                    onChange={(e) => setQuickForm({ ...quickForm, sellingPrice: e.target.value })} 
                    placeholder="0.00" 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>GST Slab (%)</label>
                  <select 
                    className="form-select" 
                    value={quickForm.gstRate} 
                    onChange={(e) => setQuickForm({ ...quickForm, gstRate: Number(e.target.value) })}
                  >
                    {gstSlabs.map((rate) => <option key={rate} value={rate}>{rate}% GST</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Initial Stock <span className="required">*</span></label>
                  <input 
                    type="number" 
                    min="0" 
                    className="form-input" 
                    value={quickForm.stock} 
                    onChange={(e) => setQuickForm({ ...quickForm, stock: e.target.value })} 
                    placeholder="10" 
                    required
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setQuickAddOpen(false)} className="btn btn--ghost">Cancel</button>
                <button type="submit" disabled={quickSaving} className="btn btn--primary">
                  {quickSaving ? 'Saving...' : 'Register & Add to Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {promptProduct && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-backdrop" onClick={() => { setPromptProduct(null); focusBarcode(); }} />
          <div className="modal modal--sm animate-fade-in" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 12 }}>Enter Quantity</h3>
            <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 16 }}>
              {promptProduct.name} {promptProduct.variant && `(${promptProduct.variant})`} (Stock: {promptProduct.stock})
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addProductToCart(promptProduct, promptQty);
                setPromptProduct(null);
              }}
            >
              <div className="form-group" style={{ marginBottom: 20 }}>
                <input
                  type="number"
                  ref={qtyInputRef}
                  className="form-input"
                  min="1"
                  max={promptProduct.stock}
                  value={promptQty}
                  onChange={(e) => setPromptQty(e.target.value)}
                  style={{ textAlign: 'center', fontSize: 20, height: 48, fontWeight: 700 }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="submit"
                  className="btn btn--primary"
                  style={{ flex: 1 }}
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setPromptProduct(null);
                    focusBarcode();
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {receipt && <Receipt sale={receipt} onClose={() => { setReceipt(null); focusBarcode(); }} />}
    </div>
  );
};

export default Billing;
