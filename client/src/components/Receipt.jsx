const Receipt = ({ sale, onClose, inline = false }) => {
  const handlePrint = () => { window.print(); };
  if (!sale) return null;

  const receiptContent = (
    <div className="print-area receipt">
      <div className="receipt-header">
        <h2>SUPERMART</h2>
        <p>123, Main Street, City</p>
        <p>Ph: +91 9876543210</p>
        <p>GSTIN: 00AAAAA0000A0Z0</p>
      </div>

      <div className="receipt-info">
        <span>{sale.invoiceNo}</span>
        <span>
          {new Date(sale.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {' '}
          {new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {sale.customerName && (
        <div className="receipt-info" style={{ marginTop: 2, paddingBottom: 4 }}>
          <span>Cust: {sale.customerName}</span>
          {sale.customerMobile && <span>Mob: {sale.customerMobile}</span>}
        </div>
      )}

      <hr className="receipt-divider" />

      <div className="receipt-items-header">
        <span>Item</span>
        <span>Qty</span>
        <span>Price</span>
        <span>Total</span>
      </div>
      <hr className="receipt-divider" />

      {sale.items?.map((item, idx) => (
        <div key={idx} className="receipt-item">
          <span>
            {item.productName}
            {item.variant && ` (${item.variant})`}
          </span>
          <span>{item.quantity}</span>
          <span>₹{item.price}</span>
          <span>₹{item.total}</span>
        </div>
      ))}

      <hr className="receipt-divider" />

      <div className="receipt-totals">
        <div className="receipt-total-row">
          <span>Subtotal</span>
          <span>₹{sale.subtotal?.toFixed(2)}</span>
        </div>
        {sale.cgstAmount > 0 && (
          <div className="receipt-total-row">
            <span>CGST</span>
            <span>₹{sale.cgstAmount.toFixed(2)}</span>
          </div>
        )}
        {sale.sgstAmount > 0 && (
          <div className="receipt-total-row">
            <span>SGST</span>
            <span>₹{sale.sgstAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="receipt-grand-total">
          <span>GRAND TOTAL</span>
          <span>₹{sale.grandTotal?.toFixed(2)}</span>
        </div>
      </div>

      <div className="receipt-footer">
        <p>Thank you for shopping!</p>
        <p>Visit us again</p>
      </div>
    </div>
  );

  if (inline) {
    return receiptContent;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal modal--md animate-fade-in">
        <div className="receipt-modal-actions no-print">
          <h3>Receipt Preview</h3>
          <div className="receipt-modal-btns">
            <button onClick={handlePrint} className="btn btn--primary btn--sm">🖨️ Print</button>
            <button onClick={onClose} className="btn btn--ghost btn--sm">Close</button>
          </div>
        </div>
        {receiptContent}
      </div>
    </div>
  );
};

export default Receipt;
