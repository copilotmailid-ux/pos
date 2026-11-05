import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  HiOutlineDocumentReport,
  HiOutlineDownload,
  HiOutlineCalendar,
  HiOutlineTruck,
  HiOutlineUser,
  HiOutlineDatabase,
  HiOutlineTag,
  HiOutlineCheckCircle
} from 'react-icons/hi';

const reportTypes = [
  { id: 'sales', name: 'Sales Report (All Sales)', icon: HiOutlineDocumentReport, desc: 'Detailed register of all customer invoices with bill type breakdown' },
  { id: 'gst', name: 'GST Tax Report (Supplier A Stock)', icon: HiOutlineDocumentReport, desc: 'B2B/B2C GST tax audit records for legal tax filing' },
  { id: 'gst-summary', name: 'GST Tax Rate & Type Summary', icon: HiOutlineDocumentReport, desc: 'Slab-wise breakdown of taxable revenue, CGST, and SGST' },
  { id: 'non-gst', name: 'Non-GST Sales Report (Supplier B Stock)', icon: HiOutlineDocumentReport, desc: 'Ledger of tax-exempt and non-GST stock transactions' },
  { id: 'purchases', name: 'Purchase Report', icon: HiOutlineTruck, desc: 'Purchase orders, incoming supplies, and vendor expense history' },
  { id: 'stock', name: 'Stock Inventory Breakdown', icon: HiOutlineDatabase, desc: 'Current valuation, quantities, and dual-stock allocation' },
  { id: 'supplier-ledger', name: 'Supplier Ledger', icon: HiOutlineUser, desc: 'Account statement and transaction history for a specific vendor' },
  { id: 'customer-ledger', name: 'Customer Ledger', icon: HiOutlineUser, desc: 'Purchase ledger and credit records for a specific customer' }
];

const Reports = () => {
  const [enableGst, setEnableGst] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_enable_gst');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [selectedReport, setSelectedReport] = useState('sales');
  const [billTypeFilter, setBillTypeFilter] = useState('all'); // 'all', 'Home', 'Shop'
  const [activeDatePreset, setActiveDatePreset] = useState('30days');

  // Dates
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Specific filters
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customers, setCustomers] = useState([]);

  // Preview & export states
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);

  useEffect(() => {
    fetchFilterData();
    fetchSettings();

    const handleSettingsUpdate = () => {
      fetchSettings();
    };
    window.addEventListener('pos_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('pos_settings_updated', handleSettingsUpdate);
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      if (data) {
        const isGst = data.enableGst !== false;
        setEnableGst(isGst);
        localStorage.setItem('pos_enable_gst', String(isGst));
        if (!isGst && ['gst', 'gst-summary', 'non-gst'].includes(selectedReport)) {
          setSelectedReport('sales');
        }
      }
    } catch (err) {
      console.error('Failed to load settings in Reports', err);
    }
  };

  const fetchFilterData = async () => {
    try {
      const [suppliersRes, customersRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/customers')
      ]);
      setSuppliers(suppliersRes.data);
      setCustomers(customersRes.data);
    } catch {
      toast.error('Failed to load filter metadata');
    }
  };

  const applyDatePreset = (preset) => {
    setActiveDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'thisweek') {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      setStartDate(monday.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'thismonth') {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    }
  };

  const handleGenerateReport = async () => {
    if (selectedReport === 'supplier-ledger' && !selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    if (selectedReport === 'customer-ledger' && !customerMobile) {
      toast.error('Please enter a customer mobile number');
      return;
    }

    setLoading(true);
    setReportData(null);
    setPreviewColumns([]);
    setPreviewRows([]);

    try {
      let endpoint = `/reports/${selectedReport}?`;
      const params = new URLSearchParams();
      if (selectedReport !== 'stock') {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      }

      if (selectedReport === 'sales') {
        if (billTypeFilter && billTypeFilter !== 'all') {
          params.append('priceTier', billTypeFilter);
        }
      } else if (selectedReport === 'supplier-ledger') {
        params.append('supplierId', selectedSupplier);
      } else if (selectedReport === 'customer-ledger') {
        params.append('mobile', customerMobile);
      }

      const { data } = await api.get(endpoint + params.toString());
      setReportData(data);
      compilePreviewData(selectedReport, data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error generating report data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
  };

  // Process data for visual presentation in the preview grid table
  const compilePreviewData = (type, data) => {
    let cols = [];
    let rows = [];

    switch (type) {
      case 'sales':
        cols = enableGst
          ? ['Invoice No', 'Date & Time', 'Bill Type', 'Mobile / Customer', 'Items', 'Subtotal (₹)', 'GST (₹)', 'Total (₹)', 'Status']
          : ['Invoice No', 'Date & Time', 'Bill Type', 'Mobile / Customer', 'Items', 'Subtotal (₹)', 'Total (₹)', 'Status'];
        rows = data.map(s => {
          const isWholesale = s.priceTier === 'Shop';
          const tierText = isWholesale ? 'Wholesale (Shop)' : 'Retail (Home)';
          const baseRow = [
            s.invoiceNo,
            formatDateTime(s.createdAt),
            tierText,
            s.customerMobile || (s.customerName ? `${s.customerName}` : 'Walk-in'),
            s.items?.length || 0,
            (Number(s.subtotal) || 0).toFixed(2),
          ];
          if (enableGst) {
            baseRow.push((Number(s.taxAmount) || 0).toFixed(2));
          }
          baseRow.push(
            (Number(s.grandTotal) || 0).toFixed(2),
            s.status
          );
          return baseRow;
        });
        break;

      case 'gst':
        cols = ['Invoice No', 'Date', 'Customer', 'Product', 'GST Qty (A)', 'Price (₹)', 'GST %', 'Subtotal (₹)', 'GST Tax (₹)', 'Total (₹)'];
        rows = (data.gstSaleLines || []).map(l => [
          l.invoiceNo,
          formatDate(l.date),
          l.customerName,
          `${l.productName} ${l.variant || ''}`.trim(),
          l.gstQuantity,
          (Number(l.price) || 0).toFixed(2),
          `${l.gstRate}%`,
          (Number(l.subtotal) || 0).toFixed(2),
          (Number(l.taxAmount) || 0).toFixed(2),
          (Number(l.total) || 0).toFixed(2)
        ]);
        break;

      case 'gst-summary':
        cols = ['GST Rate', 'Taxable Sales (₹)', 'GST Amount (₹)'];
        rows = (data.slabBreakdown || []).map(s => [
          s.gstRate,
          (Number(s.taxableSales) || 0).toFixed(2),
          (Number(s.gstAmount) || 0).toFixed(2)
        ]);
        rows.push([
          'TOTAL',
          (Number(data.totals?.totalTaxable) || 0).toFixed(2),
          (Number(data.totals?.totalGst) || 0).toFixed(2)
        ]);
        break;

      case 'non-gst':
        cols = ['Invoice No', 'Date', 'Customer', 'Product', 'Non-GST Qty (B)', 'Price (₹)', 'Subtotal (₹)', 'Collected Tax (₹)', 'Total Billed (₹)'];
        rows = (data || []).map(l => [
          l.invoiceNo,
          formatDate(l.date),
          l.customerName,
          `${l.productName} ${l.variant || ''}`.trim(),
          l.nonGstQuantity,
          (Number(l.price) || 0).toFixed(2),
          (Number(l.subtotal) || 0).toFixed(2),
          (Number(l.collectedTax) || 0).toFixed(2),
          (Number(l.total) || 0).toFixed(2)
        ]);
        break;

      case 'purchases':
        cols = ['Purchase No', 'Supplier', 'Type', 'Invoice Date', 'Payment', 'Subtotal (₹)', 'GST (₹)', 'Total (₹)', 'Status'];
        rows = data.map(p => [
          p.purchaseNumber,
          p.supplier?.name || 'Walk-in / Cash Supplier',
          p.supplier?.supplierType || (p.supplier?.gstin ? 'GST' : 'Non-GST'),
          formatDate(p.invoiceDate),
          p.paymentMethod,
          (Number(p.subtotal) || 0).toFixed(2),
          (Number(p.tax) || 0).toFixed(2),
          (Number(p.total) || 0).toFixed(2),
          p.status
        ]);
        break;

      case 'stock':
        cols = enableGst
          ? ['Product Name', 'Variant', 'Category', 'GST Stock (A)', 'Non-GST Stock (B)', 'Total Stock', 'Retail Price (₹)', 'Wholesale Price (₹)', 'Purchase Cost (₹)']
          : ['Product Name', 'Variant', 'Category', 'Total Stock', 'Retail Price (₹)', 'Wholesale Price (₹)', 'Purchase Cost (₹)'];
        rows = data.map(p => {
          const retail = Number(p.sellingPrice || p.retailPrice || 0).toFixed(2);
          const wholesale = Number(p.wholesalePrice || 0).toFixed(2);
          const purchase = Number(p.purchasePrice || 0).toFixed(2);
          
          if (enableGst) {
            return [
              p.name,
              p.variant || '-',
              p.category,
              p.gstStock || 0,
              p.nonGstStock || 0,
              p.stock,
              retail,
              wholesale,
              purchase
            ];
          }

          return [
            p.name,
            p.variant || '-',
            p.category,
            p.stock,
            retail,
            wholesale,
            purchase
          ];
        });
        break;

      case 'supplier-ledger':
        cols = ['Order No', 'Invoice Date', 'Payment Type', 'Status', 'Subtotal (₹)', 'GST (₹)', 'Total Amount (₹)'];
        rows = (data.transactions || []).map(t => [
          t.purchaseNumber,
          formatDate(t.invoiceDate),
          t.paymentMethod,
          t.status,
          (Number(t.subtotal) || 0).toFixed(2),
          (Number(t.tax) || 0).toFixed(2),
          (Number(t.total) || 0).toFixed(2)
        ]);
        break;

      case 'customer-ledger':
        cols = ['Invoice No', 'Sale Date', 'Bill Type', 'Payment Method', 'Status', 'Subtotal (₹)', 'GST (₹)', 'Grand Total (₹)'];
        rows = (data.transactions || []).map(t => [
          t.invoiceNo,
          formatDate(t.createdAt),
          t.priceTier === 'Shop' ? 'Wholesale (Shop)' : 'Retail (Home)',
          t.paymentMethod,
          t.status,
          (Number(t.subtotal) || 0).toFixed(2),
          (Number(t.taxAmount) || 0).toFixed(2),
          (Number(t.grandTotal) || 0).toFixed(2)
        ]);
        break;
    }

    setPreviewColumns(cols);
    setPreviewRows(rows);
  };

  // EXPORT EXCEL
  const exportToExcel = () => {
    if (!reportData) return;

    if (selectedReport === 'gst-summary') {
      const slabHeader = ['GST Rate', 'Taxable Sales (₹)', 'GST Amount (₹)'];
      const slabRows = (reportData.slabBreakdown || []).map(s => [
        s.gstRate,
        (Number(s.taxableSales) || 0).toFixed(2),
        (Number(s.gstAmount) || 0).toFixed(2)
      ]);
      slabRows.push(['TOTAL', (Number(reportData.totals?.totalTaxable) || 0).toFixed(2), (Number(reportData.totals?.totalGst) || 0).toFixed(2)]);

      const typeHeader = ['GST Type', 'Amount (₹)'];
      const typeRows = (reportData.typeSummary || []).map(t => [
        t.gstType,
        (Number(t.amount) || 0).toFixed(2)
      ]);
      typeRows.push(['TOTAL GST', (Number(reportData.totals?.totalGst) || 0).toFixed(2)]);

      const worksheet = XLSX.utils.aoa_to_sheet([
        [`SuperMart POS - GST Tax Rate & Type Summary`],
        [`Date Range: ${startDate} to ${endDate}`],
        [],
        ['GST RATE WISE SUMMARY'],
        slabHeader,
        ...slabRows,
        [],
        ['GST TYPE SUMMARY'],
        typeHeader,
        ...typeRows
      ]);

      worksheet['!cols'] = [
        { wch: 28 },
        { wch: 24 },
        { wch: 24 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'GST Summary');
      const fileName = `SuperMart_GST_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('GST Summary Excel spreadsheet downloaded!');
      return;
    }

    if (previewRows.length === 0) return;

    // Create sheet data
    const headerRow = [...previewColumns];
    const dataRows = [...previewRows];

    // Auto-calculate final column sum totals if applicable
    if (['sales', 'gst', 'non-gst', 'purchases', 'supplier-ledger', 'customer-ledger'].includes(selectedReport)) {
      const totalRow = new Array(headerRow.length).fill('');
      totalRow[0] = 'TOTAL';

      headerRow.forEach((col, idx) => {
        if (col.includes('₹') || col.includes('Amount') || col.includes('Qty') || col.includes('Stock')) {
          let sum = 0;
          for (const row of dataRows) {
            sum = Math.round((sum + (Number(String(row[idx]).replace(/[^0-9.-]/g, '')) || 0)) * 100) / 100;
          }
          totalRow[idx] = sum.toFixed(2);
        }
      });
      dataRows.push(totalRow);
    }

    const typeDesc = selectedReport === 'sales' && billTypeFilter !== 'all' 
      ? `Sales Report (${billTypeFilter === 'Shop' ? 'Wholesale / Shop Bills' : 'Retail / Home Bills'})`
      : reportTypes.find(r => r.id === selectedReport)?.name || 'Report';

    const worksheet = XLSX.utils.aoa_to_sheet([
      [`SuperMart POS - ${typeDesc}`],
      [`Date Range: ${selectedReport !== 'stock' ? `${startDate} to ${endDate}` : 'All Time Inventory'}`],
      [],
      headerRow,
      ...dataRows
    ]);

    const colWidths = headerRow.map((col, colIdx) => {
      let maxLen = col ? col.toString().length : 10;
      dataRows.forEach(row => {
        const val = row[colIdx];
        if (val !== undefined && val !== null) {
          const len = val.toString().length;
          if (len > maxLen) {
            maxLen = len;
          }
        }
      });
      return { wch: Math.max(maxLen + 4, 14) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const fileName = `SuperMart_${selectedReport}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success('Excel spreadsheet downloaded!');
  };

  // EXPORT PDF
  const exportToPDF = () => {
    if (!reportData) return;

    if (selectedReport === 'gst-summary') {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text('SUPERMART POS SYSTEM', 14, 18);
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105);
      doc.text('Report: GST Tax Rate & Type Summary', 14, 25);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()} | Period: ${startDate} to ${endDate}`, 14, 31);
      doc.setLineWidth(0.5);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 35, 196, 35);

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('GST Rate Wise Summary', 14, 42);

      const slabBody = [
        ...(reportData.slabBreakdown || []).map(s => [s.gstRate, `₹${(Number(s.taxableSales) || 0).toFixed(2)}`, `₹${(Number(s.gstAmount) || 0).toFixed(2)}`]),
        ['TOTAL', `₹${(Number(reportData.totals?.totalTaxable) || 0).toFixed(2)}`, `₹${(Number(reportData.totals?.totalGst) || 0).toFixed(2)}`]
      ];

      autoTable(doc, {
        startY: 46,
        head: [['GST Rate', 'Taxable Sales (₹)', 'GST Amount (₹)']],
        body: slabBody,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' }
      });

      const nextY = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text('GST Type Summary', 14, nextY);

      const typeBody = [
        ...(reportData.typeSummary || []).map(t => [t.gstType, `₹${(Number(t.amount) || 0).toFixed(2)}`]),
        ['TOTAL GST', `₹${(Number(reportData.totals?.totalGst) || 0).toFixed(2)}`]
      ];

      autoTable(doc, {
        startY: nextY + 4,
        head: [['GST Type', 'Amount (₹)']],
        body: typeBody,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' }
      });

      const fileName = `SuperMart_GST_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      toast.success('GST Summary PDF document downloaded!');
      return;
    }

    if (previewRows.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const reportName = selectedReport === 'sales' && billTypeFilter !== 'all'
      ? `Sales Report (${billTypeFilter === 'Shop' ? 'Wholesale / Shop Bills' : 'Retail / Home Bills'})`
      : reportTypes.find(r => r.id === selectedReport)?.name || 'Report';

    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('SUPERMART POS SYSTEM', 14, 16);

    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(`Report: ${reportName}`, 14, 23);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()} | Period: ${selectedReport !== 'stock' ? `${startDate} to ${endDate}` : 'All Time Inventory'}`, 14, 29);

    doc.setLineWidth(0.5);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 32, 283, 32);

    autoTable(doc, {
      startY: 36,
      head: [previewColumns],
      body: previewRows,
      styles: { fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 36, right: 14, bottom: 16, left: 14 }
    });

    const fileName = `SuperMart_${selectedReport}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    toast.success('PDF document downloaded!');
  };

  const currentReportObj = reportTypes.find(r => r.id === selectedReport);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--slate-800)' }}>Reports & Exports</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 2 }}>
            Comprehensive bookkeeping, sales revenue, dual-tier pricing breakdown, and GST compliance audit.
          </p>
        </div>
      </div>

      <div className="reports-layout" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '22px', alignItems: 'start' }}>
        {/* Left Filter Parameters Panel */}
        <div className="card" style={{ padding: '22px', border: '1px solid var(--slate-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--slate-100)' }}>
            <HiOutlineDocumentReport size={20} color="var(--brand-600)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--slate-800)', margin: 0 }}>
              Report Parameters
            </h3>
          </div>

          {/* Report Type Selector with visual description */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, color: 'var(--slate-700)', marginBottom: '6px' }}>
              Select Report Type
            </label>
            <select
              value={selectedReport}
              onChange={(e) => {
                setSelectedReport(e.target.value);
                setReportData(null);
                setPreviewRows([]);
              }}
              className="form-select"
              style={{ width: '100%', fontWeight: 600, fontSize: '13px', padding: '9px 12px', borderColor: 'var(--slate-300)' }}
            >
              {reportTypes.filter(r => enableGst || !['gst', 'gst-summary', 'non-gst'].includes(r.id)).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {currentReportObj && (
              <p style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '5px', lineHeight: 1.4 }}>
                {currentReportObj.desc}
              </p>
            )}
          </div>

          {/* Sales Report: Bill Type (Retail vs Wholesale) Filter */}
          {selectedReport === 'sales' && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--slate-700)', marginBottom: '8px' }}>
                <HiOutlineTag size={15} color="var(--brand-600)" /> Bill Type / Customer Tier
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setBillTypeFilter('all')}
                  style={{
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: billTypeFilter === 'all' ? '2px solid var(--brand-600)' : '1px solid #cbd5e1',
                    background: billTypeFilter === 'all' ? '#eef2ff' : '#fff',
                    color: billTypeFilter === 'all' ? 'var(--brand-700)' : 'var(--slate-600)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All Bills
                </button>
                <button
                  type="button"
                  onClick={() => setBillTypeFilter('Home')}
                  style={{
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: billTypeFilter === 'Home' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: billTypeFilter === 'Home' ? '#eff6ff' : '#fff',
                    color: billTypeFilter === 'Home' ? '#1d4ed8' : 'var(--slate-600)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🏠 Retail
                </button>
                <button
                  type="button"
                  onClick={() => setBillTypeFilter('Shop')}
                  style={{
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: billTypeFilter === 'Shop' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                    background: billTypeFilter === 'Shop' ? '#f5f3ff' : '#fff',
                    color: billTypeFilter === 'Shop' ? '#6d28d9' : 'var(--slate-600)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🏢 Wholesale
                </button>
              </div>
            </div>
          )}

          {/* Date Range Selection & Quick Presets */}
          {selectedReport !== 'stock' && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 650, color: 'var(--slate-700)', margin: 0 }}>
                  <HiOutlineCalendar size={15} /> Date Range
                </label>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'thisweek', label: 'This Week' },
                  { id: 'thismonth', label: 'This Month' },
                  { id: '30days', label: '30 Days' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyDatePreset(p.id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '5px',
                      border: activeDatePreset === p.id ? '1px solid var(--brand-600)' : '1px solid var(--slate-200)',
                      background: activeDatePreset === p.id ? 'var(--brand-50)' : '#f8fafc',
                      color: activeDatePreset === p.id ? 'var(--brand-700)' : 'var(--slate-600)',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--slate-500)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setActiveDatePreset('');
                    }}
                    className="form-input"
                    style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--slate-500)', fontWeight: 600, display: 'block', marginBottom: 3 }}>End Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setActiveDatePreset('');
                    }}
                    className="form-input"
                    style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional supplier selector */}
          {selectedReport === 'supplier-ledger' && (
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, color: 'var(--slate-700)', marginBottom: '6px' }}>
                Select Supplier
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="form-select"
                style={{ width: '100%', fontSize: '13px' }}
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.supplierType || 'GST'})</option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional customer mobile selector */}
          {selectedReport === 'customer-ledger' && (
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, color: 'var(--slate-700)', marginBottom: '6px' }}>
                Customer Mobile Number
              </label>
              <input
                type="text"
                placeholder="Search or enter mobile number..."
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '13px' }}
                list="customers-list"
              />
              <datalist id="customers-list">
                {customers.map(c => (
                  <option key={c._id} value={c.mobile}>{c.name}</option>
                ))}
              </datalist>
            </div>
          )}

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="btn btn--primary"
            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '11px', marginTop: '6px', fontSize: '14px', fontWeight: 650 }}
          >
            {loading ? <div className="spinner-sm"></div> : <HiOutlineDocumentReport size={18} />}
            {loading ? 'Compiling Report...' : 'Generate Report'}
          </button>
        </div>

        {/* Right Data Grid & Actions Display */}
        <div className="card" style={{ padding: '22px', minHeight: '440px', display: 'flex', flexDirection: 'column', border: '1px solid var(--slate-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          {reportData ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--slate-200)' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--slate-800)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {currentReportObj?.name} Preview
                    {selectedReport === 'sales' && billTypeFilter !== 'all' && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: billTypeFilter === 'Shop' ? '#f5f3ff' : '#eff6ff',
                        color: billTypeFilter === 'Shop' ? '#7c3aed' : '#2563eb',
                        border: billTypeFilter === 'Shop' ? '1px solid #ddd6fe' : '1px solid #bfdbfe'
                      }}>
                        {billTypeFilter === 'Shop' ? '🏢 Wholesale Bills Only' : '🏠 Retail Bills Only'}
                      </span>
                    )}
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: 3 }}>
                    {selectedReport === 'gst-summary' ? 'GST Rate Slabs & Tax Type Breakdown' : `Found ${previewRows.length} record entries`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={exportToExcel} className="btn btn--outline" style={{ gap: '6px', color: '#16a34a', borderColor: '#bbf7d0', fontSize: '13px' }}>
                    <HiOutlineDownload /> Export Excel (.xlsx)
                  </button>
                  <button onClick={exportToPDF} className="btn btn--primary" style={{ gap: '6px', fontSize: '13px' }}>
                    <HiOutlineDownload /> Export PDF Document
                  </button>
                </div>
              </div>

              {/* GST Summary Stat Cards */}
              {selectedReport === 'gst-summary' && reportData?.totals && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                  <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>Total Taxable Sales</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate-800)' }}>₹{(Number(reportData.totals.totalTaxable) || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                    <div style={{ fontSize: 11, color: 'var(--brand-600)', fontWeight: 600 }}>Total GST Tax Collected</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-700)' }}>₹{(Number(reportData.totals.totalGst) || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>CGST / SGST Split</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#065f46' }}>₹{(Number(reportData.totals.cgst) || 0).toFixed(2)} each</div>
                  </div>
                </div>
              )}

              {/* Main Table */}
              <div className="table-wrapper" style={{ flex: 1, maxHeight: '600px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table className="data-table" style={{ fontSize: '13px', width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {previewColumns.map((col, i) => {
                        const isRight = col.includes('₹') || col.includes('Amount') || col.includes('Price') || col.includes('Cost') || col.includes('Total') || col.includes('Subtotal') || col.includes('Sales');
                        const isCenter = col.includes('Count') || col.includes('Qty') || col.includes('Status') || col.includes('Bill Type') || col.includes('Items') || col.includes('Stock');
                        return (
                          <th 
                            key={i}
                            style={{
                              padding: '10px 14px',
                              whiteSpace: 'nowrap',
                              textAlign: isRight ? 'right' : (isCenter ? 'center' : 'left'),
                              fontWeight: 700,
                              color: '#334155',
                              fontSize: '12px',
                              letterSpacing: '0.3px',
                              textTransform: 'uppercase'
                            }}
                          >
                            {col}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={previewColumns.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--slate-400)' }}>
                          No records found for the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row, rIdx) => {
                        const isTotalRow = row[0] === 'TOTAL';
                        return (
                          <tr 
                            key={rIdx} 
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isTotalRow ? '#f8fafc' : (rIdx % 2 === 0 ? '#ffffff' : '#fafafa'),
                              fontWeight: isTotalRow ? 700 : 'normal',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            {row.map((cell, cIdx) => {
                              const colName = previewColumns[cIdx];
                              const isRight = colName.includes('₹') || colName.includes('Amount') || colName.includes('Price') || colName.includes('Cost') || colName.includes('Total') || colName.includes('Subtotal') || colName.includes('Sales');
                              const isCenter = colName.includes('Count') || colName.includes('Qty') || colName.includes('Status') || colName.includes('Bill Type') || colName.includes('Items') || colName.includes('Stock');
                              const isInvoice = colName.includes('Invoice') || colName.includes('No') || colName.includes('Order');

                              // Format Bill Type with modern pill badges
                              if (colName === 'Bill Type') {
                                const isShop = String(cell).includes('Wholesale');
                                return (
                                  <td key={cIdx} style={{ padding: '8px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: isShop ? '#f5f3ff' : '#eff6ff',
                                      color: isShop ? '#7c3aed' : '#2563eb',
                                      border: isShop ? '1px solid #ddd6fe' : '1px solid #bfdbfe'
                                    }}>
                                      {isShop ? '🏢 Wholesale' : '🏠 Retail'}
                                    </span>
                                  </td>
                                );
                              }

                              // Format Status with color badge
                              if (colName === 'Status') {
                                const isComp = cell === 'Completed' || cell === 'Received';
                                return (
                                  <td key={cIdx} style={{ padding: '8px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 650,
                                      background: isComp ? '#ecfdf5' : '#fff1f2',
                                      color: isComp ? '#059669' : '#e11d48',
                                      border: isComp ? '1px solid #a7f3d0' : '1px solid #fecdd3'
                                    }}>
                                      {isComp && <HiOutlineCheckCircle size={13} />}
                                      {cell}
                                    </span>
                                  </td>
                                );
                              }

                              return (
                                <td 
                                  key={cIdx}
                                  style={{
                                    padding: '8px 14px',
                                    whiteSpace: 'nowrap',
                                    textAlign: isRight ? 'right' : (isCenter ? 'center' : 'left'),
                                    fontFamily: isInvoice ? 'monospace' : 'inherit',
                                    fontWeight: isInvoice ? 650 : (isTotalRow ? 700 : 'normal'),
                                    color: isInvoice ? '#0f172a' : (isRight && !isTotalRow ? '#1e293b' : 'inherit'),
                                    fontVariantNumeric: 'tabular-nums'
                                  }}
                                >
                                  {cell}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Second Table for GST Summary (Type Breakdown) */}
              {selectedReport === 'gst-summary' && reportData?.typeSummary && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 12 }}>
                    GST Type Breakdown
                  </h3>
                  <div className="table-wrapper">
                    <table className="data-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>GST Type</th>
                          <th className="text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.typeSummary.map((t, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold">{t.gstType}</td>
                            <td className="text-right font-medium">₹{(Number(t.amount) || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--slate-50)', fontWeight: 700 }}>
                          <td>TOTAL GST</td>
                          <td className="text-right" style={{ color: 'var(--brand-600)' }}>
                            ₹{(Number(reportData.totals?.totalGst) || 0).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '60px 20px', textAlign: 'center', color: 'var(--slate-400)' }}>
              <HiOutlineDocumentReport style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.4 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 650, color: 'var(--slate-700)', marginBottom: '4px' }}>
                No report generated yet
              </h3>
              <p style={{ fontSize: '13px', maxWidth: '380px', color: 'var(--slate-500)', lineHeight: 1.5 }}>
                Choose your report type and date filters on the left panel, then click <strong>"Generate Report"</strong> to preview data and export.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
