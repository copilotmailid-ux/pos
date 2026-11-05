import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import {
  HiOutlinePrinter,
  HiOutlineDownload,
  HiOutlineX,
  HiOutlineShare
} from 'react-icons/hi';

const Receipt = ({ sale, onClose, inline = false }) => {
  const [settings, setSettings] = useState(null);
  const [targetPhone, setTargetPhone] = useState(sale?.customerMobile || '');
  const printRef = useRef(null);

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setSettings(data))
      .catch((err) => console.error('Error fetching settings for receipt:', err));
  }, []);

  useEffect(() => {
    if (sale?.customerMobile) {
      setTargetPhone(sale.customerMobile);
    }
  }, [sale?.customerMobile]);

  if (!sale) return null;

  const isQuotation = !!(sale.quotationNo || sale.isQuotation);
  const docNumber = isQuotation 
    ? (sale.quotationNo || 'QTN-00001')
    : (sale.invoiceNo || sale.invoiceNumber || 'INV-00001');

  const paperSize = (settings?.paperSize || 'A4').toUpperCase();
  const isA5 = paperSize === 'A5';
  const isA4 = paperSize === 'A4';
  const paperLabel = isA5 ? 'A5' : (isA4 ? 'A4' : paperSize);

  // Store Branding Defaults
  const storeName = settings?.storeName || 'Store';
  const storeAddress = settings?.storeAddress || '';
  const storePhone = settings?.storePhone || '';
  const storeGstin = settings?.storeGstin || '';
  const storeFssai = settings?.fssai || '';
  const storeMsme = settings?.msme || '';
  const salesEmail = settings?.salesEmail || '';
  const termsText = settings?.terms || 'Immediate Payment. Goods once sold cannot be returned.';

  const storeInitials = (() => {
    if (!storeName || storeName === 'Store') return 'POS';
    const words = storeName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  })();

  // Dates formatting
  const createdDate = new Date(sale.createdAt || Date.now());
  const dateFormatted = createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  const expiryDate = sale.validUntil 
    ? new Date(sale.validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });


  // Items list
  const items = sale.items || [];

  // Robust Tax and Calculation breakdown with fallbacks
  const calculatedItemsSubtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    return sum + (Number(item.total ?? (qty * price)));
  }, 0);

  const grandTotal = Number(
    sale.grandTotal !== undefined && sale.grandTotal !== null && Number(sale.grandTotal) > 0
      ? sale.grandTotal
      : (sale.total !== undefined && sale.total !== null && Number(sale.total) > 0
          ? sale.total
          : calculatedItemsSubtotal)
  );

  const taxAmount = Number(sale.taxAmount || 0);
  const rawSubtotal = Number(
    sale.subtotal !== undefined && sale.subtotal !== null && Number(sale.subtotal) > 0
      ? sale.subtotal
      : (grandTotal - taxAmount)
  );
  const cgstAmount = Number(sale.cgstAmount || (taxAmount > 0 ? taxAmount / 2 : 0));
  const sgstAmount = Number(sale.sgstAmount || (taxAmount > 0 ? taxAmount / 2 : 0));
  const untaxedSubtotal = rawSubtotal > 0 ? rawSubtotal : (grandTotal - taxAmount);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    try {
      generateInvoicePdf(sale, settings);
      toast.success(`Downloaded ${docNumber}.pdf`);
    } catch (err) {
      console.error('Download PDF error:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const handleWhatsAppShare = async () => {
    let cleanDigits = String(targetPhone || sale.customerMobile || '').replace(/\D/g, '');
    if (!cleanDigits) {
      toast.error('Please enter a valid mobile number');
      return;
    }
    if (cleanDigits.length === 10) {
      cleanDigits = `91${cleanDigits}`;
    } else if (cleanDigits.startsWith('0') && cleanDigits.length === 11) {
      cleanDigits = `91${cleanDigits.substring(1)}`;
    }

    try {
      // Generate the official PDF blob
      const pdfBlob = generateInvoicePdf(sale, settings, true);
      const pdfFile = new File([pdfBlob], `${docNumber}.pdf`, { type: 'application/pdf' });

      // 1. Try Native Direct File Share API (Sends PDF file directly via WhatsApp on Windows / Mobile)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `${docNumber}.pdf`,
          text: `${isQuotation ? 'Quotation' : 'Invoice'} #${docNumber} - ${storeName}`
        });
        toast.success(`PDF shared directly to WhatsApp!`);
        return;
      }
    } catch (shareErr) {
      // User cancelled share dialog or native share not completed
      if (shareErr.name === 'AbortError') return;
      console.log('Native file share failed, falling back to download & WhatsApp Web chat', shareErr);
    }

    // 2. Direct File Download & Open WhatsApp Chat (without text wall)
    try {
      generateInvoicePdf(sale, settings, false);
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr);
    }

    // Open WhatsApp Web directly to customer's chat with minimal reference
    const simpleText = `Please find attached ${isQuotation ? 'Quotation' : 'Invoice'} #${docNumber} from ${storeName} (Total: ₹${grandTotal.toFixed(2)})`;
    const targetUrl = `https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encodeURIComponent(simpleText)}`;
    window.open(targetUrl, '_blank');
    toast.success(`PDF downloaded (${docNumber}.pdf)! Drag & drop it into the opened WhatsApp chat.`, {
      duration: 6000,
      icon: '📄'
    });
  };

  // The Document Layout Supporting A4 (210mm) and A5 (148mm) Matching Reference Image
  const a4DocumentContent = (
    <div 
      ref={printRef}
      className={`a4-print-document print-area print-container ${isA5 ? 'is-a5-document' : 'is-a4-document'}`}
      style={{
        width: '100%',
        maxWidth: isA5 ? '148mm' : '210mm',
        minHeight: 'auto',
        margin: '0 auto',
        background: '#ffffff',
        color: '#1f2937',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        lineHeight: 1.35,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      <style>{`
        @media print {
          @page {
            size: ${isA5 ? 'A5 portrait' : (isA4 ? 'A4 portrait' : 'auto')} !important;
            margin: ${isA5 ? '4mm 6mm 4mm 6mm' : '6mm 10mm 6mm 10mm'} !important;
          }
          .a4-print-document.is-a5-document {
            max-width: 148mm !important;
            font-size: 9.5pt !important;
          }
        }
      `}</style>
      {/* 1. TOP CURVED WARM-BEIGE HEADER BANNER */}
      <div style={{
        background: '#f7f4ee',
        padding: isA5 ? '10px 16px 8px' : '16px 28px 12px',
        borderBottomLeftRadius: isA5 ? '16px' : '24px',
        borderBottomRightRadius: '0px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid #ebd9c8'
      }}>
        {/* Left Side: Brand Logo / Mascot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {settings?.storeLogo ? (
            <img 
              src={settings.storeLogo} 
              alt={storeName} 
              style={{ maxHeight: 58, maxWidth: 160, objectFit: 'contain' }} 
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: '#852d24',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 800,
                boxShadow: '0 2px 6px rgba(133, 45, 36, 0.25)'
              }}>
                {storeInitials}
              </div>
              <div>
                <div style={{
                  fontSize: 21,
                  fontWeight: 900,
                  color: '#852d24',
                  fontFamily: 'serif',
                  letterSpacing: '0.5px',
                  lineHeight: 1
                }}>
                  {storeName}
                </div>
                {settings?.tagline && (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#b45309',
                    fontStyle: 'italic',
                    marginTop: 2,
                    letterSpacing: '0.3px'
                  }}>
                    {settings.tagline}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Store Company Details */}
        <div style={{ textAlign: 'right', maxWidth: '380px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {storeName}
          </div>
          {storeAddress && (
            <div style={{ fontSize: 10, color: '#374151', marginTop: 2, lineHeight: 1.3 }}>
              {storeAddress}
            </div>
          )}
          {(storeFssai || storeMsme) && (
            <div style={{ fontSize: 9.5, color: '#4b5563', marginTop: 2 }}>
              {storeFssai && <span>FSSAI : <strong>{storeFssai}</strong></span>}
              {storeFssai && storeMsme && <span style={{ margin: '0 4px' }}>|</span>}
              {storeMsme && <span>MSME : <strong>{storeMsme}</strong></span>}
            </div>
          )}
          {storeGstin && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#111827', marginTop: 2 }}>
              GSTIN: {storeGstin}
            </div>
          )}
        </div>
      </div>

      {/* 2. DOCUMENT TITLE HEADER (Exact Burgundy Shade #852d24) */}
      <div style={{ textAlign: 'right', padding: isA5 ? '6px 16px 2px' : '10px 28px 4px' }}>
        <h1 style={{
          color: '#852d24',
          fontSize: isA5 ? 17 : 21,
          fontWeight: 800,
          margin: 0,
          letterSpacing: '-0.3px',
          textTransform: 'none'
        }}>
          {isQuotation ? `Quotation # ${docNumber}` : (taxAmount > 0 ? `Tax Invoice # ${docNumber}` : `Invoice # ${docNumber}`)}
        </h1>
      </div>

      {/* 3. CUSTOMER DETAILS (Bill To on Left) */}
      <div style={{ padding: isA5 ? '4px 16px 6px' : '4px 28px 8px' }}>
        <div style={{ maxWidth: '380px', fontSize: 11.5, color: '#374151', lineHeight: 1.35 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 2 }}>
            {sale.customerName || 'Walk-in Customer'}
          </div>
          {sale.customerAddress && <div>{sale.customerAddress}</div>}
          <div>Phone No: {targetPhone || sale.customerMobile || 'N/A'}</div>
          {sale.customerCityState && <div>{sale.customerCityState}</div>}
          {sale.customerGstin && (
            <div style={{ fontWeight: 700, color: '#111827', marginTop: 2 }}>
              GSTIN: {sale.customerGstin}
            </div>
          )}
        </div>
      </div>

      {/* 4. KEY-VALUE META BAR (2-Column Layout) */}
      <div style={{
        padding: isA5 ? '4px 16px 8px' : '6px 28px 10px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>
            {isQuotation ? 'Quotation Date' : 'Invoice Date'}
          </div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
            {dateFormatted}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>
            {isQuotation ? 'Expiration' : 'Payment Terms'}
          </div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
            {isQuotation ? expiryDate : (sale.paymentMethod || 'Immediate Payment')}
          </div>
        </div>
      </div>

      {/* 5. ITEM DATA TABLE (Clean Alternate Zebra Striping) */}
      <div style={{ padding: isA5 ? '0 16px' : '0 28px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#111827' }}>Description</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#111827', width: '90px' }}>Quantity</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#111827', width: '90px' }}>Unit Price</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, color: '#111827', width: '80px' }}>Taxes</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#111827', width: '95px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const qty = Number(item.quantity || 1);
              const price = Number(item.price || 0);
              const total = Number(item.total ?? (qty * price));
              const unitStr = (item.unit || item.product?.unit || 'PCS').toUpperCase();
              const gst = item.gstRate !== undefined && item.gstRate !== null ? item.gstRate : 0;

              return (
                <tr 
                  key={idx} 
                  style={{ 
                    background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <td style={{ padding: '6px 8px', color: '#1f2937' }}>
                    <span style={{ fontWeight: 600 }}>{item.productName}</span>
                    {item.variant ? <span style={{ color: '#4b5563' }}> ({item.variant})</span> : ''}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: '#1f2937', whiteSpace: 'nowrap' }}>
                    {qty.toFixed(2)} {unitStr}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: '#1f2937', whiteSpace: 'nowrap' }}>
                    ₹ {price.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 8px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                    {gst > 0 ? `GST ${gst}%` : '0%'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                    ₹ {total.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 6. TOTALS SUMMARY BOX (Right Aligned Professional Invoice Format) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: isA5 ? '6px 16px 8px' : '10px 28px 10px' }}>
        <div style={{ width: isA5 ? '230px' : '270px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: isA5 ? 10.5 : 11.5 }}>
          {taxAmount > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
              <span>Untaxed Amount</span>
              <span style={{ fontWeight: 600, color: '#111827' }}>₹ {untaxedSubtotal.toFixed(2)}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600, color: '#111827' }}>₹ {grandTotal.toFixed(2)}</span>
            </div>
          )}

          {settings?.enableGst !== false && sgstAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
              <span>SGST/UTGST</span>
              <span>₹ {sgstAmount.toFixed(2)}</span>
            </div>
          )}

          {settings?.enableGst !== false && cgstAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
              <span>CGST</span>
              <span>₹ {cgstAmount.toFixed(2)}</span>
            </div>
          )}

          {settings?.enableGst !== false && taxAmount > 0 && !sgstAmount && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
              <span>Taxes</span>
              <span>₹ {taxAmount.toFixed(2)}</span>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 14.5,
            fontWeight: 800,
            color: '#852d24',
            borderTop: '2px solid #cbd5e1',
            paddingTop: 6,
            marginTop: 3
          }}>
            <span>Total</span>
            <span style={{ fontSize: 16 }}>₹ {grandTotal.toFixed(2)}</span>
          </div>

          {/* Payment receipt breakdown if sale is completed */}
          {!isQuotation && sale.paymentMethod && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#065f46',
              background: '#ecfdf5',
              padding: '3px 8px',
              borderRadius: 5,
              marginTop: 3,
              fontWeight: 700,
              border: '1px solid #a7f3d0'
            }}>
              <span>Paid via {sale.paymentMethod}</span>
              <span>₹ {(sale.amountPaid ? Number(sale.amountPaid) : grandTotal).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 7. FOOTER TERMS & CONTACT DETAILS */}
      <div style={{ padding: isA5 ? '0 16px 10px' : '0 28px 16px', marginTop: isA5 ? 6 : 10, fontSize: isA5 ? 9.5 : 10.5, color: '#4b5563' }}>
        <div style={{ marginBottom: 3 }}>
          <strong>Terms & Conditions:</strong> {termsText}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Payment terms:</strong> Immediate Payment
        </div>

        {(salesEmail || storePhone) && (
          <div style={{
            borderTop: '1px solid #cbd5e1',
            paddingTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10.5
          }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {salesEmail && (
                <div>
                  <strong>For Sales: </strong>
                  <span style={{ color: '#1d4ed8' }}>{salesEmail}</span>
                </div>
              )}
              {storePhone && (
                <div>
                  <strong>Ph No : </strong>
                  <span>{storePhone}</span>
                </div>
              )}
            </div>
            <div style={{ color: '#64748b' }}>
              Page 1 / 1
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // If used inline in a drawer/side-panel
  if (inline) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="no-print" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button 
            type="button" 
            onClick={handleDownloadPdf}
            className="btn btn--secondary btn--sm" 
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Download PDF document"
          >
            <HiOutlineDownload /> PDF
          </button>
          <button 
            type="button" 
            onClick={handlePrint} 
            className="btn btn--primary btn--sm" 
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#852d24', borderColor: '#852d24' }}
          >
            <HiOutlinePrinter /> Print {paperLabel}
          </button>
          <button 
            type="button" 
            onClick={handleWhatsAppShare} 
            className="btn btn--secondary btn--sm" 
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#25D366', color: '#ffffff', borderColor: '#25D366' }}
            title="Send PDF and bill details directly to WhatsApp"
          >
            <HiOutlineShare /> WhatsApp
          </button>
        </div>
        <div style={{
          background: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          {a4DocumentContent}
        </div>
      </div>
    );
  }

  // Full Screen Pop-up Preview Modal
  const modalMarkup = (
    <div className="modal-overlay receipt-modal-overlay" style={{ zIndex: 120 }}>
      <div className="modal-backdrop" onClick={onClose} />
      
      <div 
        className="modal animate-fade-in" 
        style={{ 
          maxWidth: '890px', 
          width: '95%',
          maxHeight: '94vh', 
          display: 'flex', 
          flexDirection: 'column',
          padding: 0,
          background: '#f1f5f9',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Top Control Bar (Screen Only - Hidden when printing) */}
        <div 
          className="no-print" 
          style={{
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1e293b',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {isQuotation ? `${paperLabel} Quotation Preview` : `${paperLabel} Tax Invoice Preview`}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {docNumber} • {storeName} Format
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Direct Mobile Number Editor */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#1e293b',
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid #334155'
            }}>
              <span style={{ fontSize: 12, marginRight: 5, color: '#94a3b8' }}>📱</span>
              <input
                type="text"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Mobile #"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  outline: 'none',
                  width: 105
                }}
                title="Edit mobile number to send WhatsApp directly"
              />
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              style={{
                background: '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
              title="Download official A4 PDF document"
            >
              <HiOutlineDownload size={15} />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              style={{
                background: '#25D366',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.35)'
              }}
              title="Download PDF and send directly to customer's WhatsApp"
            >
              <HiOutlineShare size={15} />
              <span>WhatsApp (PDF)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: '#852d24',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(133, 45, 36, 0.4)'
              }}
            >
              <HiOutlinePrinter size={16} />
              <span>Print {paperLabel}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <HiOutlineX size={16} />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Scrollable A4 Document Paper Container */}
        <div 
          className="modal-body-preview"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 16px',
            display: 'flex',
            justifyContent: 'center',
            background: '#e2e8f0'
          }}
        >
          <div 
            className="a4-paper-sheet"
            style={{
              background: '#ffffff',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
              borderRadius: 4,
              overflow: 'hidden',
              width: '100%',
              maxWidth: isA5 ? '148mm' : '210mm'
            }}
          >
            {a4DocumentContent}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalMarkup, document.body) : modalMarkup;
};

export default Receipt;
