import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  HiOutlineInboxIn,
  HiOutlineDocumentText,
  HiOutlineSwitchHorizontal,
  HiOutlineViewGrid,
  HiOutlineViewList,
  HiOutlineCheckCircle,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineUser
} from 'react-icons/hi';

const BarcodeScanIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="7" y1="7" x2="7" y2="17" />
    <line x1="10" y1="7" x2="10" y2="17" />
    <line x1="13" y1="7" x2="13" y2="17" />
    <line x1="17" y1="7" x2="17" y2="17" />
  </svg>
);

const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const categories = [
  'Flour & Mixes',
  'Chocolates & Cocoa',
  'Dairy & Fats',
  'Fillings & Glazes',
  'Essence & Flavours',
  'Colors & Sprinkles',
  'Packaging & Cake Boxes',
  'Baking Tools & Pans',
  'Fondant & Sugarcraft',
  'Dry Fruits & Nuts',
  'Leavening & Additives',
  'Other'
];
const unitsList = ['Kg', 'Gm', 'Pcs', 'Box', 'Bag', 'Liter', 'Pack', 'Tub', 'Tin'];
const gstSlabs = [0, 5, 12, 18, 28];

const categoryIcons = {
  'All': '✨',
  'Flour & Mixes': '🌾',
  'Chocolates & Cocoa': '🍫',
  'Dairy & Fats': '🧈',
  'Fillings & Glazes': '🍯',
  'Essence & Flavours': '💧',
  'Colors & Sprinkles': '🎨',
  'Packaging & Cake Boxes': '📦',
  'Baking Tools & Pans': '🥄',
  'Fondant & Sugarcraft': '🎂',
  'Dry Fruits & Nuts': '🌰',
  'Leavening & Additives': '🧪',
  'Other': '🧁'
};

// FEATURE TOGGLE: Set to false to easily disable/remove the voice typing microphone button
const ENABLE_VOICE_TYPING = typeof navigator !== 'undefined' && !navigator.userAgent.toLowerCase().includes('electron');

const Billing = () => {
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  
  // Persistent Cart & Customer state
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_active_cart');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(item => {
        const price = Number(item.price ?? item.sellingPrice ?? item.retailPrice ?? 0);
        const qty = Number(item.quantity ?? 1);
        const total = Number(item.total ?? (price * qty));
        return {
          ...item,
          price: isNaN(price) ? 0 : price,
          quantity: isNaN(qty) ? 1 : qty,
          gstRate: 0,
          total: isNaN(total) ? 0 : total,
          unit: item.unit || 'Pcs'
        };
      });
    } catch {
      return [];
    }
  });
  const [receipt, setReceipt] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showCheckoutConfirmModal, setShowCheckoutConfirmModal] = useState(false);
  const [showQuotationConfirmModal, setShowQuotationConfirmModal] = useState(false);

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

  // Dual Pricing Tier State: 'Home' (Retail) vs 'Shop' (Wholesale)
  const [priceTier, setPriceTier] = useState(() => {
    return localStorage.getItem('pos_active_price_tier') || 'Home';
  });

  // Quotation System States
  const [loadedQuotation, setLoadedQuotation] = useState(() => {
    const saved = localStorage.getItem('pos_loaded_quotation');
    return saved ? JSON.parse(saved) : null;
  });
  const [pendingQuotations, setPendingQuotations] = useState([]);
  const [quotationsDrawerOpen, setQuotationsDrawerOpen] = useState(false);

  // Held Bills System States
  const [heldBills, setHeldBills] = useState([]);
  const [heldListOpen, setHeldListOpen] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const customerSuggestionsRef = useRef(null);
  const skipNextSuggestionFetch = useRef(false);

  // Sync price tier to localStorage
  useEffect(() => {
    localStorage.setItem('pos_active_price_tier', priceTier);
  }, [priceTier]);

  // Bulk Custom Rate Override and Full Bill Modal States
  const [editingPriceIndex, setEditingPriceIndex] = useState(null);
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [fullBillModalOpen, setFullBillModalOpen] = useState(false);

  // Resizable Right Panel & Arrow Collapse States (Adjustable Splitter)
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_right_panel_width');
      const parsed = parseInt(saved, 10);
      return !isNaN(parsed) && parsed >= 300 && parsed <= 650 ? parsed : 420;
    } catch {
      return 420;
    }
  });

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(() => {
    try {
      return localStorage.getItem('pos_right_panel_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(420);

  const togglePanelCollapse = () => {
    setIsPanelCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pos_right_panel_collapsed', String(next));
      return next;
    });
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0 || isPanelCollapsed) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = rightPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(Math.max(dragStartWidth.current + delta, 300), 620);
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('pos_right_panel_width', String(rightPanelWidth));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, rightPanelWidth]);

  // Visual Product Catalog States
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'cart'

  // Fetch pending quotations for fast resume
  const fetchPendingQuotations = async () => {
    try {
      const { data } = await api.get('/quotations?status=Pending&limit=30');
      if (data && data.quotations) {
        setPendingQuotations(data.quotations);
      } else if (Array.isArray(data)) {
        setPendingQuotations(data);
      }
    } catch (err) {
      console.error('Failed to load pending quotations:', err);
    }
  };

  // Fetch catalog products on load for fast visual picking
  const fetchCatalogProducts = async () => {
    try {
      setCatalogLoading(true);
      const { data } = await api.get('/products');
      if (data && data.products) {
        setCatalogProducts(data.products);
      } else if (Array.isArray(data)) {
        setCatalogProducts(data);
      }
    } catch (err) {
      console.error('Failed to load visual catalog products', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingQuotations();
    fetchCatalogProducts();
  }, []);

  // Write changes back to localStorage automatically
  useEffect(() => {
    localStorage.setItem('pos_active_cart', JSON.stringify(cart));
  }, [cart]);

  // Sync mobile & name state and trigger suggestions search on input (by Name OR Mobile)
  useEffect(() => {
    localStorage.setItem('pos_active_customer_mobile', customerMobile);
    localStorage.setItem('pos_active_customer_name', customerName);
    
    // Skip fetch if a suggestion was just selected
    if (skipNextSuggestionFetch.current) {
      skipNextSuggestionFetch.current = false;
      return;
    }
    
    const query = customerMobile.trim() || (customerName.trim().length >= 2 ? customerName.trim() : '');
    if (query.length >= 2) {
      const searchCustomers = async () => {
        try {
          const { data } = await api.get(`/customers?search=${encodeURIComponent(query)}`);
          setCustomerSuggestions(data.slice(0, 6));
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
  }, [customerMobile, customerName]);

  useEffect(() => {
    localStorage.setItem('pos_active_payment_method', paymentMethod);
  }, [paymentMethod]);

  useEffect(() => {
    localStorage.setItem('pos_active_received_amount', receivedAmount);
  }, [receivedAmount]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSearchResults([]);
        setActiveSearchIndex(-1);
      }
      if (customerSuggestionsRef.current && !customerSuggestionsRef.current.contains(e.target)) {
        setCustomerSuggestions([]);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const barcodeRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const categoryBarRef = useRef(null);
  const searchListRef = useRef(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    if (activeSearchIndex >= 0 && searchListRef.current) {
      const activeElement = searchListRef.current.children[activeSearchIndex];
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeSearchIndex]);

  const scrollCategories = (direction) => {
    if (categoryBarRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      categoryBarRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Math Calculations (CGST & SGST Split)
  const subtotal = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  const gstAmount = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1) * ((Number(item.gstRate) || 0) / 100)), 0);
  const cgstAmount = Math.round((gstAmount / 2 + Number.EPSILON) * 100) / 100;
  const sgstAmount = Math.round((gstAmount - cgstAmount + Number.EPSILON) * 100) / 100;
  const grandTotal = subtotal + gstAmount;

  // Bulk Quantity / Tier Savings calculation
  const totalSavings = cart.reduce((sum, item) => {
    const retail = Number(item.retailPrice || (item.price && priceTier === 'Shop' ? Math.round(item.price / 0.85 * 100) / 100 : item.price) || 0);
    const current = Number(item.price || 0);
    const qty = Number(item.quantity || 1);
    return sum + (retail > current ? (retail - current) * qty : 0);
  }, 0);


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
    // Only focus search bar on initial mount if the user hasn't already clicked another input
    const focusIfIdle = () => {
      const active = document.activeElement;
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
        searchInputRef.current?.focus();
      }
    };
    const t1 = setTimeout(focusIfIdle, 120);
    
    // Load held bills from localstorage
    const savedHeld = localStorage.getItem('pos_held_bills');
    if (savedHeld) {
      try { setHeldBills(JSON.parse(savedHeld)); } catch (e) {}
    }
    
    // Search focus auto-recovery interceptor
    const handleGlobalKeyDown = (e) => {
      if (showCheckoutConfirmModal || showQuotationConfirmModal || receipt || document.querySelector('.modal-overlay')) {
        return;
      }
      const active = document.activeElement;
      if (active && (
        active.tagName === 'INPUT' || 
        active.tagName === 'SELECT' || 
        active.tagName === 'TEXTAREA'
      )) {
        return; // Ignore if focused on input/select/textarea
      }

      // If user starts typing standard alphanumeric characters
      if (/^[0-9a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      clearTimeout(t1);
    };
  }, [showCheckoutConfirmModal, showQuotationConfirmModal, receipt]);

  useEffect(() => {
    const loadSettings = () => {
      api.get('/settings')
        .then(({ data }) => setSettings(data))
        .catch((err) => console.error('Error fetching settings in POS:', err));
    };
    loadSettings();
    window.addEventListener('pos_settings_updated', loadSettings);
    return () => window.removeEventListener('pos_settings_updated', loadSettings);
  }, []);

  // Auto-scroll the active product card into view when navigating via arrow keys
  useEffect(() => {
    if (activeSearchIndex >= 0) {
      const el = document.getElementById(`catalog-card-${activeSearchIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSearchIndex]);

  const focusSearch = () => { setTimeout(() => searchInputRef.current?.focus(), 100); };
  const focusBarcode = () => focusSearch();
  
  const switchPriceTier = (newTier) => {
    setPriceTier(newTier);
    if (cart.length > 0) {
      const updated = cart.map(item => {
        const newPrice = Number(newTier === 'Shop'
          ? (item.wholesalePrice !== undefined ? item.wholesalePrice : item.price)
          : (item.retailPrice !== undefined ? item.retailPrice : item.price)) || 0;
        const qty = Number(item.quantity || 1);
        return {
          ...item,
          price: newPrice,
          priceType: newTier,
          gstRate: 0,
          total: qty * newPrice
        };
      });
      setCart(updated);
      toast.success(`Switched to ${newTier === 'Shop' ? '🏢 Shop (Wholesale)' : '🏠 Home (Retail)'} prices!`);
    }
  };

  const selectCustomerSuggestion = (cust) => {
    skipNextSuggestionFetch.current = true;
    setCustomerMobile(cust.mobile);
    setCustomerName(cust.name);
    setCustomerSuggestions([]);
    setActiveSuggestionIndex(-1);

    // Auto-detect Customer Type and apply appropriate pricing
    if (cust.customerType === 'Shop' && priceTier !== 'Shop') {
      switchPriceTier('Shop');
      toast.success('🏢 Commercial Bakery: Applied Wholesale Pricing!');
    } else if (cust.customerType === 'Home' && priceTier !== 'Home') {
      switchPriceTier('Home');
      toast.success('🏠 Home Baker: Applied Retail Pricing!');
    }
  };

  const handleCustomerMobileKeyDown = (e) => {
    if (customerSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev < customerSuggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : customerSuggestions.length - 1));
        return;
      }
      if (e.key === 'Enter') {
        if (activeSuggestionIndex >= 0 && customerSuggestions[activeSuggestionIndex]) {
          e.preventDefault();
          selectCustomerSuggestion(customerSuggestions[activeSuggestionIndex]);
          return;
        }
      }
      if (e.key === 'Escape') {
        setCustomerSuggestions([]);
        setActiveSuggestionIndex(-1);
        return;
      }
    }

    if (e.key === 'Enter') {
      focusBarcode();
    }
  };

  const clearActiveBill = () => {
    setCart([]);
    setCustomerMobile('');
    setCustomerName('');
    setReceivedAmount('');
    setBarcode('');
    setLoadedQuotation(null);
    localStorage.removeItem('pos_active_cart');
    localStorage.removeItem('pos_active_customer_mobile');
    localStorage.removeItem('pos_active_customer_name');
    localStorage.removeItem('pos_active_payment_method');
    localStorage.removeItem('pos_active_received_amount');
    localStorage.removeItem('pos_loaded_quotation');
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
    const cleanCart = (heldBill.cart || []).map(item => {
      const price = Number(item.price ?? item.sellingPrice ?? 0);
      const qty = Number(item.quantity ?? 1);
      const gst = Number(item.gstRate ?? 0);
      const total = Number(item.total ?? (price * qty * (1 + gst / 100)));
      return {
        ...item,
        price: isNaN(price) ? 0 : price,
        quantity: isNaN(qty) ? 1 : qty,
        gstRate: isNaN(gst) ? 0 : gst,
        total: isNaN(total) ? 0 : total,
        unit: item.unit || 'Pcs'
      };
    });
    setCart(cleanCart);
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
        setReceipt(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, customerMobile, customerName, heldBills, grandTotal, checkingOut]);

  // Resuming bill focus handler is managed by hooks below

  const addProductToCart = (product, qty = 1) => {
    const cleanQty = parseFloat(qty);
    if (isNaN(cleanQty) || cleanQty <= 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }
    
    if (product.stock < cleanQty) {
      toast.error(`Only ${product.stock} units available in stock!`);
      return;
    }

    const prodId = product.id || product._id;
    const cleanCode = product.barcode;
    const existingIndex = cart.findIndex((item) => (item.productId && item.productId === prodId) || (cleanCode && item.barcode === cleanCode));

    const retailPrice = Number(product.retailPrice || product.sellingPrice || 0);
    const wholesalePrice = Number(product.wholesalePrice || (retailPrice ? Math.round(retailPrice * 0.85 * 100) / 100 : 0));
    const appliedPrice = priceTier === 'Shop' ? wholesalePrice : retailPrice;
    
    if (existingIndex !== -1) {
      const updated = [...cart];
      updated[existingIndex].quantity = Math.round((updated[existingIndex].quantity + cleanQty) * 100) / 100;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].price;
      setCart(updated);
      toast.success(`${product.name} qty +${cleanQty}`);
    } else {
      setCart(prevCart => [...prevCart, {
        productId: prodId, 
        productName: product.name, 
        variant: product.variant || '',
        barcode: product.barcode || '',
        category: product.category || '',
        unit: product.unit || 'Pcs',
        retailPrice: retailPrice,
        wholesalePrice: wholesalePrice,
        price: appliedPrice,
        priceType: priceTier,
        quantity: cleanQty, 
        gstRate: 0,
        total: appliedPrice * cleanQty, 
        maxStock: product.stock,
        minWholesaleQty: product.minWholesaleQty || 1
      }]);
      toast.success(`${product.name} added (${priceTier === 'Shop' ? 'Wholesale' : 'Retail'})`);
    }
    setBarcode('');
    setSearchResults([]);
    setActiveSearchIndex(-1);

    // Auto-focus and select search input text so typing immediately searches the next item
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }, 50);
  };

  const handleBarcodeSubmit = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const existingIndex = cart.findIndex((item) => item.barcode === cleanCode);
    if (existingIndex !== -1 && settings?.barcodeAction !== 'prompt') {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      const itemGst = updated[existingIndex].gstRate ?? 0;
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
      toast.error(`Product not found for barcode: ${cleanCode}`);
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
    const val = e.target.value;
    setSearchQuery(val);
    const q = val.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setActiveSearchIndex(-1);
    } else {
      const matches = catalogProducts.filter(p => {
        return (
          p.name?.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.variant && p.variant.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
        );
      }).slice(0, 10);
      setSearchResults(matches);
      setActiveSearchIndex(matches.length > 0 ? 0 : -1);
    }
  };

  const handleSearchKeyDown = async (e) => {
    // Arrow Down navigation in dropdown
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setActiveSearchIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
      }
      return;
    }

    // Arrow Up navigation in dropdown
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setActiveSearchIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
      }
      return;
    }

    if (e.key === 'Escape') {
      setSearchQuery('');
      setActiveSearchIndex(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      // 1. If dropdown results are present: pick highlighted or first item
      if (searchResults.length > 0) {
        const target = (activeSearchIndex >= 0 && activeSearchIndex < searchResults.length)
          ? searchResults[activeSearchIndex]
          : searchResults[0];
        addProductToCart(target);
        setSearchQuery('');
        setActiveSearchIndex(-1);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }

      // 2. Barcode exact match in memory
      const barcodeMatch = catalogProducts.find(p => p.barcode === trimmed);
      if (barcodeMatch) {
        addProductToCart(barcodeMatch);
        setSearchQuery('');
        setActiveSearchIndex(-1);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }

      // 3. Barcode API lookup (if numeric or scanned)
      try {
        const { data } = await api.get(`/products/barcode/${encodeURIComponent(trimmed)}`);
        if (data && data.name) {
          addProductToCart(data);
          setSearchQuery('');
          setActiveSearchIndex(-1);
          setTimeout(() => searchInputRef.current?.focus(), 50);
          return;
        }
      } catch (err) {
        toast.error(`No product found matching "${trimmed}"`);
        setSearchQuery('');
        setActiveSearchIndex(-1);
      }
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleBarcodeSubmit(barcode);
  };

  const updateQuantity = (index, delta) => {
    const updated = [...cart];
    const item = updated[index];
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    if (newQty > item.maxStock) { toast.error(`Only ${item.maxStock} in stock`); return; }
    item.quantity = newQty;
    item.total = item.quantity * item.price;
    setCart(updated);
    focusSearch();
  };

  const removeItem = (index) => {
    const removed = cart[index];
    setCart(cart.filter((_, i) => i !== index));
    toast(`${removed.productName} removed`, { icon: '🗑️' });
    focusSearch();
  };

  const startEditingPrice = (index, currentPrice) => {
    setEditingPriceIndex(index);
    setCustomPriceInput(currentPrice !== undefined && currentPrice !== null ? currentPrice.toString() : '');
  };

  const applyCustomPrice = (index) => {
    const parsed = parseFloat(customPriceInput);
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Please enter a valid price amount');
      return;
    }
    const updated = [...cart];
    updated[index].price = Math.round(parsed * 100) / 100;
    updated[index].customPriceApplied = true;
    updated[index].total = updated[index].quantity * updated[index].price;
    setCart(updated);
    setEditingPriceIndex(null);
    setCustomPriceInput('');
    toast.success(`Updated ${updated[index].productName} rate to ₹${parsed.toFixed(2)}`);
  };

  const applyQuickDiscount = (index, percent) => {
    const updated = [...cart];
    const item = updated[index];
    const base = Number(item.retailPrice || item.price || 0);
    const discounted = Math.round(base * (1 - percent / 100) * 100) / 100;
    item.price = discounted;
    item.customPriceApplied = true;
    item.appliedTierDiscount = percent;
    item.total = item.quantity * item.price;
    setCart(updated);
    setEditingPriceIndex(null);
    toast.success(`Applied ${percent}% bulk discount: ₹${discounted.toFixed(2)}/ea`);
  };

  const resetItemPrice = (index) => {
    const updated = [...cart];
    const item = updated[index];
    const normalPrice = priceTier === 'Shop' ? Number(item.wholesalePrice || item.retailPrice || item.price || 0) : Number(item.retailPrice || item.price || 0);
    item.price = normalPrice;
    item.customPriceApplied = false;
    item.appliedTierDiscount = null;
    item.total = item.quantity * item.price;
    setCart(updated);
    setEditingPriceIndex(null);
    toast.success(`Reset ${item.productName} to standard rate ₹${normalPrice.toFixed(2)}`);
  };

  const executeCheckout = async () => {
    if (cart.length === 0) { toast.error('Add items to bill first'); return; }
    if (checkingOut) return;
    setCheckingOut(true);
    setShowCheckoutConfirmModal(false);
    try {
      const { data } = await api.post('/sales', {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit,
          priceType: item.priceType || priceTier
        })),
        customerMobile,
        customerName,
        paymentMethod,
        priceTier,
        quotationId: loadedQuotation?.id || null,
        quotationNo: loadedQuotation?.quotationNo || '',
        amountPaid: Number(receivedAmount),
        changeReturned: changeDue
      });
      setReceipt(data);
      clearActiveBill();
      toast.success(`Sale ${data.invoiceNo} completed!`);
      fetchPendingQuotations();
      
      // Auto-print receipt if configured in settings
      if (settings?.autoPrint) {
        setTimeout(() => window.print(), 500);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Checkout failed'); }
    finally { setCheckingOut(false); }
  };

  const handleCheckout = () => {
    if (cart.length === 0) { toast.error('Add items to bill first'); return; }
    if (checkingOut) return;
    if (settings?.confirmCheckout !== false) {
      setShowCheckoutConfirmModal(true);
      return;
    }
    executeCheckout();
  };

  const executeSaveAsQuotation = async () => {
    if (cart.length === 0) {
      toast.error('Add items to quotation first');
      return;
    }
    setShowQuotationConfirmModal(false);
    try {
      const { data } = await api.post('/quotations', {
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          variant: item.variant,
          unit: item.unit,
          barcode: item.barcode,
          quantity: item.quantity,
          price: item.price,
          priceType: priceTier,
          gstRate: item.gstRate
        })),
        customerMobile,
        customerName,
        customerType: priceTier,
        notes: loadedQuotation ? `Updated from ${loadedQuotation.quotationNo}` : 'Created at billing terminal'
      });
      setReceipt({ ...data, isQuotation: true });
      toast.success(`Quotation ${data.quotationNo} generated!`);
      fetchPendingQuotations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save quotation');
    }
  };

  const handleSaveAsQuotation = () => {
    if (cart.length === 0) {
      toast.error('Add items to quotation first');
      return;
    }
    if (settings?.confirmQuotation !== false) {
      setShowQuotationConfirmModal(true);
      return;
    }
    executeSaveAsQuotation();
  };

  const handleResumeQuotation = (qtn) => {
    const qtnCart = (qtn.items || []).map(item => {
      const price = Number(item.price ?? item.product?.retailPrice ?? 0);
      const qty = Number(item.quantity || 1);
      const gst = Number(item.gstRate !== undefined ? item.gstRate : (item.product?.gstRate ?? 0));
      const total = Number(item.total ?? (price * qty * (1 + gst / 100)));
      return {
        productId: item.productId?._id || item.productId?.id || item.productId || item.id,
        productName: item.productName || item.product?.name || 'Product',
        variant: item.variant || item.product?.variant || '',
        barcode: item.barcode || item.product?.barcode || '',
        unit: item.unit || item.product?.unit || 'Pcs',
        category: item.category || item.product?.category || '',
        price,
        retailPrice: Number(item.product?.retailPrice || price),
        wholesalePrice: Number(item.product?.wholesalePrice || price),
        gstRate: gst,
        quantity: qty,
        priceType: item.priceType || qtn.customerType || 'Shop',
        total: isNaN(total) ? 0 : total,
        maxStock: item.product?.stock !== undefined ? item.product.stock : 999
      };
    });

    setCart(qtnCart);
    setCustomerMobile(qtn.customerMobile || '');
    setCustomerName(qtn.customerName || '');
    setPriceTier(qtn.customerType === 'Shop' ? 'Shop' : 'Home');
    setLoadedQuotation({
      id: qtn.id,
      quotationNo: qtn.quotationNo,
      customerName: qtn.customerName
    });
    localStorage.setItem('pos_loaded_quotation', JSON.stringify({
      id: qtn.id,
      quotationNo: qtn.quotationNo,
      customerName: qtn.customerName
    }));
    setQuotationsDrawerOpen(false);
    toast.success(`Loaded ${qtn.quotationNo}! Edit items freely and checkout.`);
  };

  // Enter key confirms checkout, Escape cancels
  useEffect(() => {
    if (!showCheckoutConfirmModal) return;
    const handleConfirmKeys = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!checkingOut) {
          executeCheckout();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowCheckoutConfirmModal(false);
      }
    };
    window.addEventListener('keydown', handleConfirmKeys);
    return () => window.removeEventListener('keydown', handleConfirmKeys);
  }, [showCheckoutConfirmModal, checkingOut, cart, customerMobile, customerName, paymentMethod, priceTier, receivedAmount, changeDue]);

  // Enter key confirms quotation save, Escape cancels
  useEffect(() => {
    if (!showQuotationConfirmModal) return;
    const handleQuotationKeys = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        executeSaveAsQuotation();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowQuotationConfirmModal(false);
      }
    };
    window.addEventListener('keydown', handleQuotationKeys);
    return () => window.removeEventListener('keydown', handleQuotationKeys);
  }, [showQuotationConfirmModal, cart, customerMobile, customerName, priceTier]);

  // Render layout block

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottom: '1px solid #e2e8f0'
      }}>
        {/* Left Side: Title & Segmented Pricing Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                Billing POS
              </h1>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#059669',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '2px 8px',
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                Ready
              </span>
            </div>
          </div>

          {/* Dual Pricing Tier Segmented Switch */}
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <button
              type="button"
              onClick={() => switchPriceTier('Home')}
              style={{
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: priceTier === 'Home' ? 700 : 500,
                borderRadius: '8px',
                border: 'none',
                background: priceTier === 'Home' ? '#ffffff' : 'transparent',
                color: priceTier === 'Home' ? '#0f172a' : '#64748b',
                boxShadow: priceTier === 'Home' ? '0 2px 5px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <span>🏠</span>
              <span>Home / Retail</span>
              {priceTier === 'Home' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4f46e5' }} />
              )}
            </button>
            <button
              type="button"
              onClick={() => switchPriceTier('Shop')}
              style={{
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: priceTier === 'Shop' ? 700 : 500,
                borderRadius: '8px',
                border: 'none',
                background: priceTier === 'Shop' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'transparent',
                color: priceTier === 'Shop' ? '#ffffff' : '#64748b',
                boxShadow: priceTier === 'Shop' ? '0 2px 8px rgba(124, 58, 237, 0.35)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <span>🏢</span>
              <span>Shop / Wholesale</span>
              {priceTier === 'Shop' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} />
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Quick POS Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Saved Quotations Button */}
          <button 
            type="button" 
            onClick={() => {
              fetchPendingQuotations();
              setQuotationsDrawerOpen(true);
            }} 
            className="btn btn--sm" 
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              border: pendingQuotations.length > 0 ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: pendingQuotations.length > 0 ? '#eff6ff' : '#ffffff',
              color: pendingQuotations.length > 0 ? '#1d4ed8' : '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <HiOutlineDocumentText size={16} />
            <span>Quotations</span>
            {pendingQuotations.length > 0 && (
              <span style={{
                background: '#2563eb',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 700,
                borderRadius: 10,
                padding: '1px 6px'
              }}>
                {pendingQuotations.length}
              </span>
            )}
          </button>

          <button 
            type="button" 
            onClick={handleHoldBill} 
            className="btn btn--sm" 
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#ffffff',
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <HiOutlineBookmark size={16} />
            <span>Hold Bill</span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>F3</span>
          </button>

          <button 
            type="button" 
            onClick={() => setHeldListOpen(true)} 
            className="btn btn--sm" 
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              border: heldBills.length > 0 ? '1px solid #fdba74' : '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: heldBills.length > 0 ? '#fff7ed' : '#ffffff',
              color: heldBills.length > 0 ? '#c2410c' : '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <HiOutlineInboxIn size={16} />
            <span>Resume Bill</span>
            {heldBills.length > 0 && (
              <span style={{
                background: '#ea580c',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 700,
                borderRadius: 10,
                padding: '1px 6px'
              }}>
                {heldBills.length}
              </span>
            )}
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>F4</span>
          </button>
        </div>
      </div>

      {/* Active Quotation Banner */}
      {loadedQuotation && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontSize: '13px', fontWeight: 600 }}>
            <span style={{ fontSize: '16px' }}>📋</span>
            <span>
              Loaded from Quotation <strong>{loadedQuotation.quotationNo}</strong> for <strong>{loadedQuotation.customerName || 'Customer'}</strong>.
              Add or remove items, edit quantities, and click Checkout to generate Bill!
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoadedQuotation(null);
              localStorage.removeItem('pos_loaded_quotation');
              toast('Quotation link removed. Items remain in cart.');
            }}
            className="btn btn--sm"
            style={{ background: '#fde68a', color: '#78350f', border: 'none', padding: '4px 10px', fontSize: '12px' }}
          >
            Unlink Quotation
          </button>
        </div>
      )}

      {/* POS Billing Layout (Spacious Multi-Column Architecture) */}
      <div 
        className="billing-layout-container" 
        style={{ 
          display: 'flex', 
          gap: 0, 
          alignItems: 'start', 
          position: 'relative',
          userSelect: isDragging ? 'none' : 'auto'
        }}
      >
        {/* Left Column: Product Search, Category Pills, Cart Table */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: isPanelCollapsed ? 8 : 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

          
          {/* Top Search Bar (F2 barcode scanner input) */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div 
              className={`billing-search-container ${isSearchFocused ? 'is-focused' : ''}`}
              onClick={() => searchInputRef.current?.focus()}
              style={{ cursor: 'text' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <BarcodeScanIcon size={22} color={isSearchFocused ? "#0d9488" : "#64748b"} />
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isSearchFocused ? '#10b981' : '#94a3b8',
                  boxShadow: isSearchFocused ? '0 0 6px #10b981' : 'none',
                  transition: 'all 0.2s ease'
                }} title="Barcode Scanner Ready" />
              </div>
              <input
                ref={searchInputRef}
                id="billing-product-search"
                className="billing-search-input"
                type="text"
                value={searchQuery}
                onChange={handleSearchQueryChange}
                onKeyDown={handleSearchKeyDown}
                onFocus={(e) => {
                  setIsSearchFocused(true);
                  if (searchQuery) {
                    e.target.select();
                  }
                }}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Search products by name or category..."
                autoComplete="off"
                autoFocus
              />
              <span style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 11,
                color: '#475569',
                fontWeight: 700,
                letterSpacing: '0.5px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                userSelect: 'none',
                flexShrink: 0
              }}>
                F2
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); focusSearch(); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', flexShrink: 0 }}
                  title="Clear search query"
                >
                  <HiOutlineX size={16} />
                </button>
              )}
            </div>

            {/* Dropdown Auto-Complete Suggestions List */}
            {searchResults.length > 0 && (
              <div className="search-results-dropdown" ref={searchListRef} style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#ffffff',
                border: '1.5px solid #0d9488',
                borderRadius: 12,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                maxHeight: 340,
                overflowY: 'auto',
                zIndex: 1000,
                marginTop: 6
              }}>
                {searchResults.map((product, idx) => {
                  const retailPrice = Number(product.retailPrice || product.sellingPrice || 0);
                  const wholesalePrice = Number(product.wholesalePrice || (retailPrice ? Math.round(retailPrice * 0.85 * 100) / 100 : 0));
                  const appliedPrice = priceTier === 'Shop' ? wholesalePrice : retailPrice;
                  const isSelected = idx === (activeSearchIndex >= 0 ? activeSearchIndex : 0);

                  return (
                    <div
                      key={product._id || product.id}
                      onClick={() => {
                        addProductToCart(product);
                        setSearchQuery('');
                        setActiveSearchIndex(-1);
                        setTimeout(() => searchInputRef.current?.focus(), 50);
                      }}
                      onMouseEnter={() => setActiveSearchIndex(idx)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: '1px solid #f1f5f9',
                        background: isSelected ? '#ecfdf5' : '#ffffff',
                        borderLeft: isSelected ? '4px solid #0d9488' : '4px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                            {product.name}
                          </span>
                          {product.variant && (
                            <span style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              fontSize: 11,
                              padding: '2px 7px',
                              borderRadius: 5,
                              fontWeight: 600
                            }}>
                              {product.variant}
                            </span>
                          )}
                          {product.category && (
                            <span style={{
                              background: '#f8fafc',
                              color: '#64748b',
                              fontSize: 10.5,
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid #e2e8f0'
                            }}>
                              {product.category}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, display: 'flex', gap: 10 }}>
                          <span>Unit: {product.unit || 'Pcs'}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: priceTier === 'Shop' ? '#0d9488' : '#0f172a'
                        }}>
                          ₹{appliedPrice.toFixed(2)}
                          {priceTier === 'Shop' && retailPrice > appliedPrice && (
                            <span style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'line-through', marginLeft: 6 }}>
                              ₹{retailPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: product.stock > 10 ? '#10b981' : product.stock > 0 ? '#d97706' : '#ef4444' }}>
                          {product.stock > 0 ? `${product.stock} ${product.unit || 'Pcs'} in stock` : 'Out of stock'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* Main Billing Cart Table (Hero Centerpiece) */}
          <div className="card" style={{ padding: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🛒</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                  Bill Items ({cart.length})
                </span>
                {cart.length > 0 && (
                  <span style={{
                    background: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12
                  }}>
                    {cart.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} Total Units
                  </span>
                )}
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear all items from current bill?')) {
                      clearActiveBill();
                      toast('Bill cleared');
                    }
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Bill
                </button>
              )}
            </div>

            <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 270px)', overflowY: 'auto' }}>
              <table className="data-table data-table--bordered" style={{ margin: 0, width: '100%', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                  <tr>
                    <th>ITEM DESCRIPTION</th>
                    <th style={{ width: 55, textAlign: 'center' }}>UNIT</th>
                    <th style={{ width: 110, textAlign: 'center' }}>QUANTITY</th>
                    <th style={{ width: 165, textAlign: 'left' }}>UNIT RATE (₹)</th>
                    <th style={{ width: 105, textAlign: 'right' }}>LINE TOTAL (₹)</th>
                    <th style={{ width: 45, textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '75px 20px', textAlign: 'center' }}>
                        <div style={{ width: 64, height: 64, margin: '0 auto 12px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#64748b' }}>
                          🛒
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                          Bill is Empty
                        </p>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20 }}>
                          Search and add products from the catalog above [F2]
                        </p>
                        <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                          <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontSize: 11.5, padding: '4px 10px', borderRadius: 6, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <strong style={{ color: '#4f46e5' }}>[F2]</strong> Search Item
                          </span>
                          <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontSize: 11.5, padding: '4px 10px', borderRadius: 6, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <strong style={{ color: '#4f46e5' }}>[Enter]</strong> Add to Bill
                          </span>
                          <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontSize: 11.5, padding: '4px 10px', borderRadius: 6, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <strong style={{ color: '#4f46e5' }}>[F3]</strong> Hold
                          </span>
                          <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontSize: 11.5, padding: '4px 10px', borderRadius: 6, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <strong style={{ color: '#4f46e5' }}>[F4]</strong> Resume
                          </span>
                          <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontSize: 11.5, padding: '4px 10px', borderRadius: 6, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <strong style={{ color: '#0d9488' }}>[F5]</strong> Checkout
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => {
                      const lineTotal = Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 1)));
                      const isCustom = !!item.customPriceApplied;

                      return (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          {/* ITEM DESCRIPTION */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 15,
                                flexShrink: 0
                              }}>
                                {categoryIcons[item.category] || '🧁'}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', lineHeight: 1.25 }}>
                                  {item.productName}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                  {item.variant && (
                                    <span style={{ fontSize: 11, color: '#64748b' }}>
                                      ({item.variant})
                                    </span>
                                  )}
                                  {item.priceType === 'Shop' && (
                                    <span style={{
                                      background: '#ede9fe',
                                      color: '#6d28d9',
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 4
                                    }}>
                                      Wholesale
                                    </span>
                                  )}
                                  {isCustom && (
                                    <span style={{
                                      background: '#ecfdf5',
                                      color: '#059669',
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 4
                                    }}>
                                      {item.appliedTierDiscount ? `-${item.appliedTierDiscount}% Off` : 'Custom Rate'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* UNIT */}
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge--neutral" style={{ fontSize: 11, padding: '2px 6px' }}>
                              {item.unit || 'Pcs'}
                            </span>
                          </td>

                          {/* QUANTITY */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="qty-controls" style={{ margin: '0 auto', display: 'inline-flex' }}>
                              <button 
                                type="button"
                                onClick={() => updateQuantity(idx, -1)} 
                                className="qty-btn"
                                title="Decrease quantity"
                              >
                                <HiOutlineMinus size={12} />
                              </button>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                defaultValue={item.quantity}
                                key={`qty-${item.productId || item.id}-${item.quantity}`}
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (isNaN(val) || val <= 0) {
                                    e.target.value = item.quantity;
                                    return;
                                  }
                                  if (item.maxStock && val > item.maxStock) {
                                    toast.error(`Only ${item.maxStock} units available in stock!`);
                                    e.target.value = item.quantity;
                                    return;
                                  }
                                  if (val !== item.quantity) {
                                    const updated = [...cart];
                                    updated[idx].quantity = val;
                                    updated[idx].total = val * updated[idx].price;
                                    setCart(updated);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.target.blur();
                                }}
                                style={{
                                  width: 48,
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  borderRadius: 6,
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#0f172a',
                                  padding: '2px 4px',
                                  outline: 'none',
                                  margin: '0 4px'
                                }}
                              />
                              <button 
                                type="button"
                                onClick={() => updateQuantity(idx, 1)} 
                                className="qty-btn"
                                title="Increase quantity"
                              >
                                <HiOutlinePlus size={12} />
                              </button>
                            </div>
                          </td>

                          {/* UNIT RATE (₹) with Editable Input and Quick Discount Buttons */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={item.price}
                                  key={`rate-${item.productId}-${item.price}`}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val >= 0 && val !== item.price) {
                                      const updated = [...cart];
                                      updated[idx].price = Math.round(val * 100) / 100;
                                      updated[idx].customPriceApplied = true;
                                      updated[idx].appliedTierDiscount = null;
                                      updated[idx].total = updated[idx].quantity * updated[idx].price;
                                      setCart(updated);
                                      toast.success(`Updated rate to ₹${val.toFixed(2)}`);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                  }}
                                  style={{
                                    width: 76,
                                    padding: '3px 6px',
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    border: isCustom ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                                    outline: 'none',
                                    color: isCustom ? '#059669' : '#0f172a',
                                    background: isCustom ? '#f0fdf4' : '#ffffff'
                                  }}
                                />
                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => resetItemPrice(idx)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#dc2626',
                                      fontSize: 10,
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      padding: '2px 4px'
                                    }}
                                    title="Reset to default rate"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              {/* Quick discount pills [-5%] [-10%] [-15%] [-20%] */}
                              <div style={{ display: 'flex', gap: 3 }}>
                                {[5, 10, 15, 20].map(pct => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => applyQuickDiscount(idx, pct)}
                                    style={{
                                      fontSize: 9.5,
                                      padding: '2px 5px',
                                      borderRadius: 4,
                                      border: '1px solid #cbd5e1',
                                      background: item.appliedTierDiscount === pct ? '#0d9488' : '#f8fafc',
                                      color: item.appliedTierDiscount === pct ? '#ffffff' : '#475569',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      lineHeight: 1
                                    }}
                                    title={`Apply ${pct}% discount`}
                                  >
                                    -{pct}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          </td>

                          {/* LINE TOTAL (₹) */}
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                            ₹{lineTotal.toFixed(2)}
                          </td>

                          {/* ACTION */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="btn--icon btn--icon-danger"
                              style={{ width: 28, height: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Delete item"
                            >
                              <HiOutlineTrash size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        
        </div>
        </div>

        {/* Resizable Splitter Divider with Arrow Button (Matching Image 2) */}
        <div
          className={`billing-splitter ${isDragging ? 'is-dragging' : ''}`}
          onMouseDown={handleMouseDown}
          title="Drag to resize panel, or click arrow to toggle collapse"
        >
          <div className="billing-splitter-line" />
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePanelCollapse();
            }}
            className="billing-splitter-btn"
            title={isPanelCollapsed ? "Expand Checkout & Customer Details" : "Collapse Right Panel"}
          >
            {isPanelCollapsed ? <HiOutlineChevronLeft size={14} /> : <HiOutlineChevronRight size={14} />}
          </button>
        </div>

        {/* Right Column: Order Cockpit & Checkout */}
        {!isPanelCollapsed ? (
          <div style={{
            width: rightPanelWidth,
            flexShrink: 0,
            minWidth: 300,
            maxWidth: 620,
            paddingLeft: 4
          }}>
            <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          height: 'calc(100vh - 120px)',
          position: 'sticky',
          top: 16
        }}>
          
          {/* 1. Customer Details (Compact 2-Column Grid) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                <span>👤</span>
                <span>Customer Details</span>
              </div>
            </div>
            
            <div style={{ position: 'relative' }} ref={customerSuggestionsRef}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  maxLength="10"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={handleCustomerMobileKeyDown}
                  placeholder="Mobile Number (e.g. 98450 12844)"
                  className="pos-input"
                  autoComplete="off"
                />

                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="pos-input"
                  autoComplete="off"
                />
              </div>

              {/* Customer Autocomplete Dropdown */}
              {customerSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '80px',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  zIndex: 110,
                  maxHeight: 180,
                  overflowY: 'auto'
                }}>
                  {customerSuggestions.map((c, idx) => (
                    <div
                      key={c._id || c.id}
                      onMouseDown={(e) => { e.preventDefault(); selectCustomerSuggestion(c); }}
                      onMouseEnter={() => setActiveSuggestionIndex(idx)}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: activeSuggestionIndex === idx ? '#f0fdfa' : 'transparent'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{c.mobile}</div>
                      </div>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: c.customerType === 'Shop' ? '#ede9fe' : '#e0f2fe',
                        color: c.customerType === 'Shop' ? '#6d28d9' : '#0369a1'
                      }}>
                        {c.customerType === 'Shop' ? '🏢 Wholesale' : '🏠 Retail'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Pricing Tier Segmented Pill Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                padding: '4px',
                borderRadius: 10,
                border: '1px solid #f1f5f9'
              }}>
                <div style={{ display: 'flex', width: '100%', background: '#e2e8f0', padding: 2, borderRadius: 8 }}>
                  <button
                    type="button"
                    onClick={() => switchPriceTier('Home')}
                    style={{
                      flex: 1,
                      padding: '5px 12px',
                      fontSize: 11.5,
                      fontWeight: 750,
                      borderRadius: 6,
                      border: 'none',
                      background: priceTier === 'Home' ? '#ffffff' : 'transparent',
                      color: priceTier === 'Home' ? '#0f172a' : '#64748b',
                      boxShadow: priceTier === 'Home' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      letterSpacing: '0.4px',
                      textAlign: 'center'
                    }}
                  >
                    🏠 RETAIL
                  </button>
                  <button
                    type="button"
                    onClick={() => switchPriceTier('Shop')}
                    style={{
                      flex: 1,
                      padding: '5px 12px',
                      fontSize: 11.5,
                      fontWeight: 750,
                      borderRadius: 6,
                      border: 'none',
                      background: priceTier === 'Shop' ? '#0d9488' : 'transparent',
                      color: priceTier === 'Shop' ? '#ffffff' : '#64748b',
                      boxShadow: priceTier === 'Shop' ? '0 1px 3px rgba(13,148,136,0.25)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      letterSpacing: '0.4px',
                      textAlign: 'center'
                    }}
                  >
                    <span>🏢</span> BULK / WHOLESALE
                  </button>
                </div>
              </div>

              {/* 5. Subtotal & Savings rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569' }}>
                  <span>Subtotal ({cart.length} items)</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{subtotal.toFixed(2)}</span>
                </div>
                {totalSavings > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#059669', fontWeight: 600 }}>
                    <span>🏷️ Bulk Quantity Savings</span>
                    <span>-₹{totalSavings.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* 6. Dark Grand Total Banner */}
              <div style={{
                background: '#0f172a',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 10px rgba(15, 23, 42, 0.15)'
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    GRAND TOTAL
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {priceTier === 'Shop' ? 'Bulk wholesale rate applied' : 'Standard retail rate applied'}
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#2dd4bf', letterSpacing: '-0.5px' }}>
                  ₹{grandTotal.toFixed(2)}
                </div>
              </div>

              {/* 7. Payment Method (Compact) */}
              <div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash Tendered')}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: paymentMethod === 'Cash Tendered' ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
                  background: paymentMethod === 'Cash Tendered' ? '#f0fdfa' : '#ffffff',
                  color: paymentMethod === 'Cash Tendered' ? '#0f766e' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>💵</span> Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI / Card')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: paymentMethod === 'UPI / Card' ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
                  background: paymentMethod === 'UPI / Card' ? '#f0fdfa' : '#ffffff',
                  color: paymentMethod === 'UPI / Card' ? '#0f766e' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>💳</span> UPI / Card
              </button>
            </div>
          </div>

          {/* 8. Received Cash Amount & Compact Mint Change Due (Saves 45px vertical space) */}
          {paymentMethod === 'Cash Tendered' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder={`Cash Received (${grandTotal.toFixed(2)})`}
                  className="pos-input"
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 600
                  }}
                />
              </div>

              {/* Compact Horizontal Change Due Banner */}
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 8,
                padding: '7px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#059669', letterSpacing: '0.5px' }}>
                  CHANGE DUE BALANCE
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>
                  ₹{changeDue.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* 9. Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <button
              id="checkout-btn"
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingOut}
              style={{
                width: '100%',
                padding: '11px 16px',
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 10,
                border: 'none',
                background: cart.length === 0 ? '#94a3b8' : '#0d9488',
                color: '#ffffff',
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: cart.length === 0 ? 'none' : '0 4px 12px rgba(13, 148, 136, 0.28)',
                transition: 'all 0.15s ease'
              }}
            >
              <HiOutlineCheckCircle size={18} />
              <span>{checkingOut ? 'Processing...' : 'Checkout & Print (F5)'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAsQuotation}
              disabled={cart.length === 0}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <HiOutlineDocumentText size={15} />
              <span>Save as Quotation / Estimate</span>
            </button>
          </div>

        </div>
          </div>
        ) : (
          <div 
            onClick={togglePanelCollapse}
            title="Click to expand Checkout panel"
            style={{
              width: 44,
              flexShrink: 0,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '16px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              height: 'calc(100vh - 120px)',
              position: 'sticky',
              top: 16,
              marginLeft: 4,
              transition: 'background 0.2s ease'
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}>
              <HiOutlineChevronLeft size={16} />
            </div>
            <div style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontSize: 12,
              fontWeight: 700,
              color: '#334155',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10
            }}>
              <span>Checkout</span>
              <span style={{ color: '#0d9488', fontWeight: 800 }}>• ₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* FULL-SCREEN EXPANDED BILL AUDIT MODAL (For large bulk purchases & wholesale orders) */}
      {fullBillModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 120 }}>
          <div className="modal-backdrop" onClick={() => setFullBillModalOpen(false)} />
          <div className="modal modal--lg animate-fade-in" style={{ maxWidth: 920, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  📋 Full Bill Review & Bulk Rate Manager ({cart.length} items)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                  Customer: <strong>{customerName || 'Walk-in'}</strong> {customerMobile ? `(${customerMobile})` : ''} • Pricing Tier: <strong>{priceTier}</strong>
                </p>
              </div>
              <button onClick={() => setFullBillModalOpen(false)} className="close-btn"><HiOutlineX size={20} /></button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <table className="data-table data-table--bordered" style={{ fontSize: 13, width: '100%' }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Unit</th>
                    <th className="text-center" style={{ width: 140 }}>Quantity</th>
                    <th style={{ width: 190 }}>Unit Rate (₹)</th>
                    <th className="text-right">Line Total (₹)</th>
                    <th className="text-center" style={{ width: 60 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => {
                    const lineTotal = Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 1)));
                    const origRate = Number(item.retailPrice || item.price || 0);
                    const isCustom = !!item.customPriceApplied;

                    return (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                              flexShrink: 0
                            }}>
                              {categoryIcons[item.category] || '🧁'}
                            </div>
                            <div>
                              <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{item.productName}</strong>
                              {item.variant && <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b' }}>({item.variant})</span>}
                              {isCustom && (
                                <span style={{ marginLeft: 6, fontSize: 10, background: '#ecfdf5', color: '#059669', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                  Custom Bulk Rate
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge--neutral" style={{ fontSize: 11 }}>{item.unit || 'Pcs'}</span>
                        </td>
                        <td className="text-center">
                          <div className="qty-controls" style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center' }}>
                            <button type="button" onClick={() => updateQuantity(idx, -1)} className="qty-btn" title="Decrease quantity"><HiOutlineMinus size={12} /></button>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              defaultValue={item.quantity}
                              key={`qty-col-${item.productId || item.id}-${item.quantity}`}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (isNaN(val) || val <= 0) {
                                  e.target.value = item.quantity;
                                  return;
                                }
                                if (item.maxStock && val > item.maxStock) {
                                  toast.error(`Only ${item.maxStock} units available in stock!`);
                                  e.target.value = item.quantity;
                                  return;
                                }
                                if (val !== item.quantity) {
                                  const updated = [...cart];
                                  updated[idx].quantity = val;
                                  updated[idx].total = val * updated[idx].price;
                                  setCart(updated);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                              }}
                              style={{
                                width: 48,
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: 13,
                                borderRadius: 6,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#0f172a',
                                padding: '2px 4px',
                                outline: 'none',
                                margin: '0 4px'
                              }}
                            />
                            <button type="button" onClick={() => updateQuantity(idx, 1)} className="qty-btn" title="Increase quantity"><HiOutlinePlus size={12} /></button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>₹</span>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={item.price}
                                key={item.price}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0 && val !== item.price) {
                                    const updated = [...cart];
                                    updated[idx].price = Math.round(val * 100) / 100;
                                    updated[idx].customPriceApplied = true;
                                    updated[idx].total = updated[idx].quantity * updated[idx].price;
                                    setCart(updated);
                                    toast.success(`Updated rate to ₹${val.toFixed(2)}`);
                                  }
                                }}
                                style={{
                                  width: 85,
                                  padding: '4px 6px',
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  borderRadius: 6,
                                  border: isCustom ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                                  outline: 'none',
                                  color: isCustom ? '#059669' : '#0f172a'
                                }}
                              />
                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={() => resetItemPrice(idx)}
                                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}
                                  title="Reset to standard rate"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            {/* Quick discount pills */}
                            <div style={{ display: 'flex', gap: 3 }}>
                              {[5, 10, 15, 20].map(pct => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => applyQuickDiscount(idx, pct)}
                                  style={{
                                    fontSize: 9.5,
                                    padding: '1px 4px',
                                    borderRadius: 3,
                                    border: '1px solid #cbd5e1',
                                    background: item.appliedTierDiscount === pct ? '#0d9488' : '#f8fafc',
                                    color: item.appliedTierDiscount === pct ? '#ffffff' : '#475569',
                                    cursor: 'pointer'
                                  }}
                                >
                                  -{pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="text-right" style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                          ₹{lineTotal.toFixed(2)}
                        </td>
                        <td className="text-center">
                          <button onClick={() => removeItem(idx)} className="btn--icon btn--icon-danger" style={{ padding: 4 }}>
                            <HiOutlineTrash size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  Total Items: <strong>{cart.reduce((s, i) => s + (Number(i.quantity) || 1), 0)}</strong> • Subtotal: <strong>₹{subtotal.toFixed(2)}</strong>
                </div>
                {totalSavings > 0 && (
                  <div style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
                    Bulk Savings: -₹{totalSavings.toFixed(2)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>GRAND TOTAL</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0d9488' }}>₹{grandTotal.toFixed(2)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setFullBillModalOpen(false); handleCheckout(); }}
                  disabled={cart.length === 0 || checkingOut}
                  style={{
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 8,
                    background: '#0d9488',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(13, 148, 136, 0.25)'
                  }}
                >
                  {checkingOut ? 'Processing...' : 'Checkout (F5)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Quotations Drawer Modal */}
      {quotationsDrawerOpen && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setQuotationsDrawerOpen(false)} />
          <div className="modal modal--md animate-fade-in" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Saved Quotations & Estimates</h3>
                <p className="modal-subtitle">Select any quotation to load into Billing, edit items, and bill</p>
              </div>
              <button onClick={() => setQuotationsDrawerOpen(false)} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto', padding: 0 }}>
              {pendingQuotations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>
                  <HiOutlineDocumentText size={36} />
                  <p style={{ marginTop: 8, fontSize: 13 }}>No pending quotations found</p>
                  <p style={{ fontSize: 11, color: '#94a3b8' }}>Create one anytime with "Save as Quotation"</p>
                </div>
              ) : (
                pendingQuotations.map((q) => (
                  <div 
                    key={q.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 18px', 
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.2s' 
                    }}
                    className="search-result-item"
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#4f46e5', fontSize: 13 }}>{q.quotationNo}</span>
                        <span 
                          className="badge" 
                          style={{ 
                            fontSize: 10,
                            fontWeight: 700,
                            background: q.customerType === 'Shop' ? '#ede9fe' : '#e0f2fe',
                            color: q.customerType === 'Shop' ? '#6d28d9' : '#0369a1'
                          }}
                        >
                          {q.customerType === 'Shop' ? '🏢 Wholesale' : '🏠 Retail'}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-800)', marginTop: 2 }}>
                        {q.customerName || 'Walk-in Customer'} {q.customerMobile ? `(${q.customerMobile})` : ''}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--slate-450)', marginTop: 2 }}>
                        Items: {q.items?.length || 0} | {new Date(q.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>₹{q.grandTotal?.toFixed(2)}</p>
                      <button
                        onClick={() => handleResumeQuotation(q)}
                        className="btn btn--primary btn--sm"
                        style={{ padding: '5px 12px', fontSize: 11.5 }}
                      >
                        Load into Bill
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-600)' }}>₹{Number(b.total || 0).toFixed(2)}</p>
                      <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>Click to Resume</span>
                    </div>
                  </div>
                ))
              )}
            </div>
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

      {/* Checkout Confirmation Modal */}
      {showCheckoutConfirmModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-backdrop" onClick={() => setShowCheckoutConfirmModal(false)} />
          <div className="modal modal--md animate-fade-in" style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <span>🛒</span> Confirm Checkout & Print
              </h3>
              <button type="button" onClick={() => setShowCheckoutConfirmModal(false)} className="close-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}><HiOutlineX /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Customer:</span>
                  <strong style={{ color: '#1e293b' }}>{customerName || 'Walk-in Customer'} {customerMobile ? `(${customerMobile})` : ''}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Rate Mode:</span>
                  <strong style={{ color: priceTier === 'Shop' ? '#7c3aed' : '#2563eb' }}>
                    {priceTier === 'Shop' ? 'Shop / Wholesale' : 'Home / Retail'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Total Items:</span>
                  <strong style={{ color: '#1e293b' }}>{cart.length} item(s) ({cart.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} units)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <strong style={{ color: '#1e293b' }}>{paymentMethod}</strong>
                </div>
                {paymentMethod === 'Cash' && Number(receivedAmount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>Tendered / Change:</span>
                    <span style={{ color: '#059669', fontWeight: 600 }}>Paid ₹{Number(receivedAmount).toFixed(2)} | Change ₹{changeDue.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Grand Total to Collect:</span>
                  <strong style={{ fontSize: 20, color: '#0d9488' }}>₹{grandTotal.toFixed(2)}</strong>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                Proceed to complete sale, deduct product stock levels, and generate invoice receipt?
              </p>
            </div>
            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowCheckoutConfirmModal(false)} className="btn btn--ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={executeCheckout}
                disabled={checkingOut}
                className="btn btn--primary"
                style={{ padding: '8px 20px', fontSize: 13.5, fontWeight: 700, background: '#0d9488', borderColor: '#0d9488' }}
              >
                {checkingOut ? 'Completing Sale...' : '✓ Confirm & Complete Sale (Enter)'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Save as Quotation Confirmation Modal */}
      {showQuotationConfirmModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-backdrop" onClick={() => setShowQuotationConfirmModal(false)} />
          <div className="modal modal--md animate-fade-in" style={{ maxWidth: 460, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <span>📄</span> Confirm Save Quotation
              </h3>
              <button type="button" onClick={() => setShowQuotationConfirmModal(false)} className="close-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}><HiOutlineX /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Customer:</span>
                  <strong style={{ color: '#1e293b' }}>{customerName || 'Walk-in Customer'} {customerMobile ? `(${customerMobile})` : ''}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Rate Mode:</span>
                  <strong style={{ color: priceTier === 'Shop' ? '#7c3aed' : '#2563eb' }}>
                    {priceTier === 'Shop' ? 'Shop / Wholesale' : 'Home / Retail'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Item Count:</span>
                  <strong style={{ color: '#1e293b' }}>{cart.length} item(s) ({cart.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} units)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Estimated Quotation Total:</span>
                  <strong style={{ fontSize: 20, color: '#4f46e5' }}>₹{grandTotal.toFixed(2)}</strong>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                This creates a valid quotation estimate without deducting any current inventory stock.
              </p>
            </div>
            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowQuotationConfirmModal(false)} className="btn btn--ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSaveAsQuotation}
                className="btn btn--primary"
                style={{ padding: '8px 20px', fontSize: 13.5, fontWeight: 700 }}
              >
                ✓ Confirm & Save Quotation
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {receipt && <Receipt sale={receipt} onClose={() => { setReceipt(null); focusBarcode(); }} />}
    </div>
  );
};

export default Billing;
