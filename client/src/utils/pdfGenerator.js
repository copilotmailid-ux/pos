import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates and downloads an authentic Viswa Foods Invoice / Quotation PDF
 * matching the exact branding, typography, tables, and totals layout.
 * Supports both A4 (210×297mm) and A5 (148×210mm) paper formats.
 * 
 * @param {Object} sale - Sale or Quotation object
 * @param {Object} settings - Store settings (storeName, address, fssai, paperSize, etc.)
 * @param {boolean} returnBlob - If true, returns a Blob instead of triggering download
 */
export const generateInvoicePdf = (sale, settings = {}, returnBlob = false) => {
  if (!sale) return null;

  const paperSize = (settings?.paperSize || 'A4').toUpperCase();
  const isA5 = paperSize === 'A5';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isA5 ? 'a5' : 'a4'
  });

  const isQuotation = !!(sale.quotationNo || sale.isQuotation);
  const docNumber = isQuotation 
    ? (sale.quotationNo || 'QTN-00001')
    : (sale.invoiceNo || sale.invoiceNumber || 'INV-00001');

  const storeName = settings?.storeName || 'Store';
  const storeAddress = settings?.storeAddress || '';
  const storePhone = settings?.storePhone || '';
  const storeGstin = settings?.storeGstin || '';
  const storeFssai = settings?.fssai || '';
  const storeMsme = settings?.msme || '';
  const salesEmail = settings?.salesEmail || '';
  const termsText = settings?.terms || 'Immediate Payment. Goods once sold cannot be returned.';

  const getInitials = (name) => {
    if (!name || name === 'Store') return 'POS';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };
  const storeInitials = getInitials(storeName);

  const createdDate = new Date(sale.createdAt || Date.now());
  const dateFormatted = createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const expiryDate = sale.validUntil 
    ? new Date(sale.validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Robust calculation with item-level fallbacks
  const calculatedItemsSubtotal = (sale.items || []).reduce((sum, item) => {
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

  // Scaled coordinates based on A4 vs A5
  const leftX = isA5 ? 9 : 14;
  const rightX = isA5 ? 139 : 194;
  const dividerRightX = isA5 ? 139 : 196;

  // 1. TOP CURVED WARM-BEIGE HEADER BANNER
  doc.setFillColor(247, 244, 238); // #f7f4ee warm beige
  if (isA5) {
    doc.roundedRect(7, 6, 134, 26, 2, 2, 'F');
  } else {
    doc.roundedRect(10, 8, 190, 30, 2, 2, 'F');
  }

  // Store Circle Badge with Dynamic Initials
  doc.setFillColor(133, 45, 36); // #852d24 burgundy
  const circleX = isA5 ? 17 : 23;
  const circleY = isA5 ? 19 : 23;
  const circleR = isA5 ? 6.5 : 8.5;
  doc.circle(circleX, circleY, circleR, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(isA5 ? (storeInitials.length > 2 ? 6.5 : 8) : (storeInitials.length > 2 ? 8.5 : 10.5));
  doc.setFont('helvetica', 'bold');
  doc.text(storeInitials, circleX, isA5 ? circleY + 2.8 : circleY + 3.5, { align: 'center' });

  // Store Title & Tagline
  doc.setTextColor(133, 45, 36);
  doc.setFontSize(isA5 ? 12.5 : 15);
  doc.setFont('times', 'bold');
  doc.text(storeName, isA5 ? 27 : 35, isA5 ? 17.5 : 21.5);

  if (settings?.tagline) {
    doc.setTextColor(180, 83, 9);
    doc.setFontSize(isA5 ? 6.5 : 8);
    doc.setFont('helvetica', 'italic');
    doc.text(settings.tagline, isA5 ? 27 : 35, isA5 ? 22 : 26.5);
  }

  // Right Side Store Info
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(isA5 ? 7.5 : 9);
  doc.setFont('helvetica', 'bold');
  doc.text(storeName, rightX, isA5 ? 11.5 : 15, { align: 'right' });

  doc.setFontSize(isA5 ? 6.2 : 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  
  const splitAddress = storeAddress ? doc.splitTextToSize(storeAddress, isA5 ? 64 : 85) : [];
  const addrStartY = isA5 ? 15 : 19.5;
  if (splitAddress.length > 0) {
    doc.text(splitAddress, rightX, addrStartY, { align: 'right' });
  }

  let addrBottomY = addrStartY + (splitAddress.length * (isA5 ? 2.8 : 3.5));
  const regParts = [];
  if (storeFssai) regParts.push(`FSSAI: ${storeFssai}`);
  if (storeMsme) regParts.push(`MSME: ${storeMsme}`);
  if (regParts.length > 0) {
    doc.text(regParts.join('  |  '), rightX, addrBottomY, { align: 'right' });
    addrBottomY += (isA5 ? 3 : 3.8);
  }
  if (storeGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${storeGstin}`, rightX, addrBottomY, { align: 'right' });
  }

  // 2. DOCUMENT TITLE HEADER (Burgundy #852d24)
  doc.setTextColor(133, 45, 36);
  doc.setFontSize(isA5 ? 12 : 15);
  doc.setFont('helvetica', 'bold');
  const titleY = isA5 ? 37 : 46;
  doc.text(isQuotation ? `Quotation # ${docNumber}` : (taxAmount > 0 ? `Tax Invoice # ${docNumber}` : `Invoice # ${docNumber}`), rightX, titleY, { align: 'right' });

  // 3. CUSTOMER DETAILS (Left)
  let currY = isA5 ? 42 : 51;
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(isA5 ? 9 : 10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.customerName || 'Walk-in Customer', leftX, currY);

  doc.setFontSize(isA5 ? 7.5 : 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const stepY = isA5 ? 3.6 : 4.2;
  currY += stepY;
  if (sale.customerAddress) {
    doc.text(sale.customerAddress, leftX, currY);
    currY += stepY;
  }
  if (sale.customerMobile) {
    doc.text(`Phone No: ${sale.customerMobile}`, leftX, currY);
    currY += stepY;
  }
  if (sale.customerCityState) {
    doc.text(sale.customerCityState, leftX, currY);
    currY += stepY;
  }
  if (sale.customerGstin) {
    currY += stepY;
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${sale.customerGstin}`, leftX, currY);
    doc.setFont('helvetica', 'normal');
  }

  // 4. KEY-VALUE META BAR
  currY += (isA5 ? 4 : 6);
  doc.setDrawColor(226, 232, 240);
  doc.line(leftX, currY, dividerRightX, currY);
  currY += (isA5 ? 3.8 : 4.5);

  doc.setFontSize(isA5 ? 7 : 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(isQuotation ? 'Quotation Date' : 'Invoice Date', leftX, currY);
  doc.text(isQuotation ? 'Expiration' : 'Payment Terms', isA5 ? 80 : 110, currY);

  currY += (isA5 ? 3.5 : 4.2);
  doc.setFontSize(isA5 ? 7.5 : 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(dateFormatted, leftX, currY);
  doc.text(isQuotation ? expiryDate : (sale.paymentMethod || 'Immediate Payment'), isA5 ? 80 : 110, currY);

  currY += (isA5 ? 4 : 5);

  // 5. ITEM DATA TABLE
  const tableRows = (sale.items || []).map((item, idx) => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const total = Number(item.total ?? (qty * price));
    const unitStr = (item.unit || item.product?.unit || 'PCS').toUpperCase();
    const gst = item.gstRate !== undefined && item.gstRate !== null ? item.gstRate : 0;
    const desc = `${item.productName}${item.variant ? ` (${item.variant})` : ''}`;

    return [
      desc,
      `${qty.toFixed(2)} ${unitStr}`,
      `₹ ${price.toFixed(2)}`,
      gst > 0 ? `GST ${gst}%` : '0%',
      `₹ ${total.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: currY,
    head: [['Description', 'Quantity', 'Unit Price', 'Taxes', 'Amount']],
    body: tableRows,
    theme: 'plain',
    margin: { left: leftX, right: isA5 ? 9 : 14 },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      fontSize: isA5 ? 7 : 8.5,
      cellPadding: isA5 ? 2 : 3,
      lineWidth: { bottom: 0.5 },
      lineColor: [203, 213, 225]
    },
    bodyStyles: {
      fontSize: isA5 ? 6.8 : 8,
      cellPadding: isA5 ? 1.8 : 2.8,
      textColor: [31, 41, 55],
      lineWidth: { bottom: 0.2 },
      lineColor: [241, 245, 249]
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253]
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: isA5 ? 18 : 26, halign: 'right' },
      2: { cellWidth: isA5 ? 18 : 26, halign: 'right' },
      3: { cellWidth: isA5 ? 16 : 24, halign: 'center' },
      4: { cellWidth: isA5 ? 20 : 28, halign: 'right', fontStyle: 'bold' }
    }
  });

  let finalY = doc.lastAutoTable.finalY + (isA5 ? 4 : 6);

  // Auto-page break if space is cramped (A5 threshold is 170mm, A4 is 235mm)
  const maxY = isA5 ? 165 : 235;
  if (finalY > maxY) {
    doc.addPage();
    finalY = isA5 ? 14 : 20;
  }

  // 6. TOTALS SUMMARY BOX (Right Aligned)
  const totalsBoxX = isA5 ? 78 : 120;
  const totalsValX = dividerRightX;

  doc.setFontSize(isA5 ? 7.5 : 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);

  const subtotalLabel = taxAmount > 0 ? 'Untaxed Amount' : 'Subtotal';
  doc.text(subtotalLabel, totalsBoxX, finalY);
  doc.setFont('helvetica', 'bold');
  doc.text(`₹ ${(taxAmount > 0 ? untaxedSubtotal : grandTotal).toFixed(2)}`, totalsValX, finalY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  finalY += (isA5 ? 3.8 : 4.5);

  if (settings?.enableGst !== false && sgstAmount > 0) {
    doc.text('SGST/UTGST', totalsBoxX, finalY);
    doc.text(`₹ ${sgstAmount.toFixed(2)}`, totalsValX, finalY, { align: 'right' });
    finalY += (isA5 ? 3.8 : 4.5);
  }

  if (settings?.enableGst !== false && cgstAmount > 0) {
    doc.text('CGST', totalsBoxX, finalY);
    doc.text(`₹ ${cgstAmount.toFixed(2)}`, totalsValX, finalY, { align: 'right' });
    finalY += (isA5 ? 3.8 : 4.5);
  }

  if (settings?.enableGst !== false && taxAmount > 0 && !sgstAmount) {
    doc.text('Taxes', totalsBoxX, finalY);
    doc.text(`₹ ${taxAmount.toFixed(2)}`, totalsValX, finalY, { align: 'right' });
    finalY += (isA5 ? 3.8 : 4.5);
  }

  // Grand Total in Burgundy
  doc.setDrawColor(203, 213, 225);
  doc.line(totalsBoxX, finalY - 1, totalsValX, finalY - 1);
  finalY += (isA5 ? 3 : 3.5);

  doc.setFontSize(isA5 ? 9.5 : 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(133, 45, 36);
  doc.text('Total', totalsBoxX, finalY);
  doc.text(`₹ ${grandTotal.toFixed(2)}`, totalsValX, finalY, { align: 'right' });
  finalY += (isA5 ? 4.5 : 5.5);

  if (!isQuotation && sale.paymentMethod) {
    doc.setFillColor(236, 253, 245);
    const badgeW = isA5 ? 61 : 76;
    doc.roundedRect(totalsBoxX, finalY - (isA5 ? 3.2 : 3.8), badgeW, isA5 ? 4.8 : 5.5, 1, 1, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(isA5 ? 6.8 : 7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Paid via ${sale.paymentMethod}`, totalsBoxX + 2, finalY);
    doc.text(`₹ ${(sale.amountPaid ? Number(sale.amountPaid) : grandTotal).toFixed(2)}`, totalsValX - 2, finalY, { align: 'right' });
    finalY += (isA5 ? 5.5 : 7);
  }

  // 7. FOOTER TERMS & SIGNATURE
  const footerY = isA5 ? 194 : 272;
  doc.setDrawColor(226, 232, 240);
  doc.line(leftX, footerY, dividerRightX, footerY);

  doc.setFontSize(isA5 ? 6.5 : 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Terms & Conditions: ${termsText}`, leftX, footerY + (isA5 ? 3.8 : 4.5));

  const footerContact = [];
  if (salesEmail) footerContact.push(`For Sales: ${salesEmail}`);
  if (storePhone) footerContact.push(`Ph: ${storePhone}`);
  if (footerContact.length > 0) {
    doc.text(footerContact.join('  |  '), leftX, footerY + (isA5 ? 7.5 : 9));
  }
  doc.text('Page 1 of 1', dividerRightX, footerY + (isA5 ? 7.5 : 9), { align: 'right' });

  if (returnBlob) {
    return doc.output('blob');
  } else {
    doc.save(`${docNumber}.pdf`);
  }
};
