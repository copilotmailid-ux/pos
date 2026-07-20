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
  HiOutlineDatabase
} from 'react-icons/hi';

const reportTypes = [
  { id: 'sales', name: 'Sales Report (All Sales)', icon: HiOutlineDocumentReport },
  { id: 'gst', name: 'GST Tax Report (Supplier A Stock)', icon: HiOutlineDocumentReport },
  { id: 'non-gst', name: 'Non-GST Sales Report (Supplier B Stock)', icon: HiOutlineDocumentReport },
  { id: 'purchases', name: 'Purchase Report', icon: HiOutlineTruck },
  { id: 'stock', name: 'Stock Inventory Breakdown', icon: HiOutlineDatabase },
  { id: 'supplier-ledger', name: 'Supplier Ledger', icon: HiOutlineUser },
  { id: 'customer-ledger', name: 'Customer Ledger', icon: HiOutlineUser }
];

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState('sales');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)); // default 30 days ago
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

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
  }, []);

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

  const handleGenerateReport = async () => {
    // Validations
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

      if (selectedReport === 'supplier-ledger') {
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

  // Process data for visual presentation in the preview grid table
  const compilePreviewData = (type, data) => {
    let cols = [];
    let rows = [];

    switch (type) {
      case 'sales':
        cols = ['Invoice No', 'Date & Time', 'Mobile', 'Items Count', 'Subtotal (₹)', 'GST (₹)', 'Total (₹)', 'Status'];
        rows = data.map(s => [
          s.invoiceNo,
          new Date(s.createdAt).toLocaleString(),
          s.customerMobile || 'Walk-in',
          s.items?.length || 0,
          s.subtotal.toFixed(2),
          s.taxAmount.toFixed(2),
          s.grandTotal.toFixed(2),
          s.status
        ]);
        break;

      case 'gst':
        cols = ['Invoice No', 'Date', 'Customer', 'Product', 'GST Qty (A)', 'Price (₹)', 'GST %', 'Subtotal (₹)', 'GST Tax (₹)', 'Total (₹)'];
        rows = (data.gstSaleLines || []).map(l => [
          l.invoiceNo,
          new Date(l.date).toLocaleDateString(),
          l.customerName,
          `${l.productName} ${l.variant || ''}`.trim(),
          l.gstQuantity,
          l.price.toFixed(2),
          `${l.gstRate}%`,
          l.subtotal.toFixed(2),
          l.taxAmount.toFixed(2),
          l.total.toFixed(2)
        ]);
        break;

      case 'non-gst':
        cols = ['Invoice No', 'Date', 'Customer', 'Product', 'Non-GST Qty (B)', 'Price (₹)', 'Subtotal (₹)', 'Collected Tax (₹)', 'Total Billed (₹)'];
        rows = (data || []).map(l => [
          l.invoiceNo,
          new Date(l.date).toLocaleDateString(),
          l.customerName,
          `${l.productName} ${l.variant || ''}`.trim(),
          l.nonGstQuantity,
          l.price.toFixed(2),
          l.subtotal ? l.subtotal.toFixed(2) : (l.price * l.nonGstQuantity).toFixed(2),
          l.collectedTax ? l.collectedTax.toFixed(2) : ((l.price * l.nonGstQuantity) * 0.12).toFixed(2),
          l.total ? l.total.toFixed(2) : ((l.price * l.nonGstQuantity) * 1.12).toFixed(2)
        ]);
        break;

      case 'purchases':
        cols = ['Purchase No', 'Supplier', 'Type', 'Invoice Date', 'Payment', 'Subtotal (₹)', 'GST (₹)', 'Total (₹)', 'Status'];
        rows = data.map(p => [
          p.purchaseNumber,
          p.supplier?.name || 'Deleted Supplier',
          p.supplier?.supplierType || (p.supplier?.gstin ? 'GST' : 'Non-GST'),
          new Date(p.invoiceDate).toLocaleDateString(),
          p.paymentMethod,
          p.subtotal.toFixed(2),
          p.tax.toFixed(2),
          p.total.toFixed(2),
          p.status
        ]);
        break;

      case 'stock':
        cols = ['Product Name', 'Variant', 'Barcode', 'Category', 'GST Stock (A)', 'Non-GST Stock (B)', 'Total Stock', 'Value at Cost', 'Value at Retail'];
        rows = data.map(p => [
          p.name,
          p.variant || '-',
          p.barcode,
          p.category,
          p.gstStock || 0,
          p.nonGstStock || 0,
          p.stock,
          (p.purchasePrice * p.stock).toFixed(2),
          (p.sellingPrice * p.stock).toFixed(2)
        ]);
        break;

      case 'supplier-ledger':
        cols = ['Order No', 'Invoice Date', 'Payment Type', 'Status', 'Subtotal (₹)', 'GST (₹)', 'Total Amount (₹)'];
        rows = data.transactions.map(t => [
          t.purchaseNumber,
          new Date(t.invoiceDate).toLocaleDateString(),
          t.paymentMethod,
          t.status,
          t.subtotal.toFixed(2),
          t.tax.toFixed(2),
          t.total.toFixed(2)
        ]);
        break;

      case 'customer-ledger':
        cols = ['Invoice No', 'Sale Date', 'Payment Method', 'Status', 'Subtotal (₹)', 'GST (₹)', 'Grand Total (₹)'];
        rows = data.transactions.map(t => [
          t.invoiceNo,
          new Date(t.createdAt).toLocaleDateString(),
          t.paymentMethod,
          t.status,
          t.subtotal.toFixed(2),
          t.taxAmount.toFixed(2),
          t.grandTotal.toFixed(2)
        ]);
        break;
    }

    setPreviewColumns(cols);
    setPreviewRows(rows);
  };

  // EXPORT EXCEL
  const exportToExcel = () => {
    if (!reportData || previewRows.length === 0) return;

    // Create sheet data
    const headerRow = [...previewColumns];
    const dataRows = [...previewRows];

    // Auto-calculate final column sum totals if applicable
    if (['sales', 'gst', 'non-gst', 'purchases', 'supplier-ledger', 'customer-ledger'].includes(selectedReport)) {
      const totalRow = new Array(headerRow.length).fill('');
      totalRow[0] = 'TOTAL';

      // Accumulate columns that are numbers
      headerRow.forEach((col, idx) => {
        if (col.includes('₹') || col.includes('Amount') || col.includes('Qty') || col.includes('Stock')) {
          const sum = dataRows.reduce((acc, row) => acc + (Number(String(row[idx]).replace(/[^0-9.]/g, '')) || 0), 0);
          totalRow[idx] = sum.toFixed(2);
        }
      });
      dataRows.push(totalRow);
    }

    const worksheet = XLSX.utils.aoa_to_sheet([
      [`SuperMart POS - ${reportTypes.find(r => r.id === selectedReport).name}`],
      [`Date Range: ${selectedReport !== 'stock' ? `${startDate} to ${endDate}` : 'N/A'}`],
      [],
      headerRow,
      ...dataRows
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const fileName = `SuperMart_${selectedReport}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success('Excel spreadsheet downloaded!');
  };

  // EXPORT PDF
  const exportToPDF = () => {
    if (!reportData || previewRows.length === 0) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const reportName = reportTypes.find(r => r.id === selectedReport).name;

    // Title & Header info formatting
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // var(--slate-800)
    doc.text('SUPERMART POS SYSTEM', 14, 18);

    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text(`Report: ${reportName}`, 14, 25);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()} | Period: ${selectedReport !== 'stock' ? `${startDate} to ${endDate}` : 'All Time Inventory'}`, 14, 31);

    doc.setLineWidth(0.5);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 35, 196, 35);

    // Call autoTable functional export
    autoTable(doc, {
      startY: 40,
      head: [previewColumns],
      body: previewRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 40, right: 14, bottom: 20, left: 14 }
    });

    const fileName = `SuperMart_${selectedReport}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    toast.success('PDF document downloaded!');
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Reports & Exports</h1>
          <p>Generate analytical logs and export bookkeeping ledgers to Excel or PDF format.</p>
        </div>
      </div>

      <div className="reports-layout" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Filter Parameters Panel */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 650, color: 'var(--slate-800)', marginBottom: '20px' }}>
            Report Parameters
          </h3>

          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '6px' }}>
              Report Type
            </label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="form-select"
              style={{ width: '100%' }}
            >
              {reportTypes.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {selectedReport !== 'stock' && (
            <>
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '6px' }}>
                  <HiOutlineCalendar /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '6px' }}>
                  <HiOutlineCalendar /> End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}

          {/* Conditional supplier selector */}
          {selectedReport === 'supplier-ledger' && (
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '6px' }}>
                Select Supplier
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="form-select"
                style={{ width: '100%' }}
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
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '6px' }}>
                Customer Mobile Number
              </label>
              <input
                type="text"
                placeholder="Search or enter mobile number..."
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
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
            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            {loading ? <div className="spinner-sm"></div> : <HiOutlineDocumentReport />}
            {loading ? 'Compiling Report...' : 'Generate Report'}
          </button>
        </div>

        {/* Right Data Grid & Actions Display */}
        <div className="card" style={{ padding: '24px', minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
          {reportData ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--slate-200)' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--slate-800)' }}>
                    {reportTypes.find(r => r.id === selectedReport)?.name} Preview
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
                    Found {previewRows.length} record entries
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={exportToExcel} className="btn btn--outline" style={{ gap: '6px', color: '#16a34a', borderColor: '#bbf7d0' }}>
                    <HiOutlineDownload /> Export Excel (.xlsx)
                  </button>
                  <button onClick={exportToPDF} className="btn btn--primary" style={{ gap: '6px' }}>
                    <HiOutlineDownload /> Export PDF Document
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="table-wrapper" style={{ flex: 1 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {previewColumns.map((col, i) => (
                        <th key={i}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '60px 20px', textAlign: 'center', color: 'var(--slate-400)' }}>
              <HiOutlineDocumentReport style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>
                No report loaded
              </h3>
              <p style={{ fontSize: '13px', maxWidth: '360px' }}>
                Select report configurations on the left sidebar and click "Generate Report" to preview.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
