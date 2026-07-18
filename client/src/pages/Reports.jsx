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
  { id: 'sales', name: 'Sales Report', icon: HiOutlineDocumentReport },
  { id: 'purchases', name: 'Purchase Report', icon: HiOutlineTruck },
  { id: 'gst', name: 'GST Tax Report', icon: HiOutlineDocumentReport },
  { id: 'stock', name: 'Stock Inventory Valuation', icon: HiOutlineDatabase },
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

      case 'purchases':
        cols = ['Purchase No', 'Supplier', 'Invoice Date', 'Payment', 'Subtotal (₹)', 'GST (₹)', 'Total (₹)', 'Status'];
        rows = data.map(p => [
          p.purchaseNumber,
          p.supplier?.name || 'Deleted Supplier',
          new Date(p.invoiceDate).toLocaleDateString(),
          p.paymentMethod,
          p.subtotal.toFixed(2),
          p.tax.toFixed(2),
          p.total.toFixed(2),
          p.status
        ]);
        break;

      case 'gst':
        cols = ['Txn No', 'Type', 'Date', 'Subtotal (₹)', 'GST Amount (₹)', 'Total (₹)'];
        // Combine sales & purchases itemized by tax
        const saleRows = data.sales.map(s => [
          s.invoiceNo,
          'Sales (Output)',
          new Date(s.createdAt).toLocaleDateString(),
          s.subtotal.toFixed(2),
          s.taxAmount.toFixed(2),
          s.grandTotal.toFixed(2)
        ]);
        const purchaseRows = data.purchases.map(p => [
          p.purchaseNumber,
          'Purchase (Input)',
          new Date(p.invoiceDate).toLocaleDateString(),
          p.subtotal.toFixed(2),
          p.tax.toFixed(2),
          p.total.toFixed(2)
        ]);
        rows = [...saleRows, ...purchaseRows];
        break;

      case 'stock':
        cols = ['Product Name', 'Variant', 'Barcode', 'Category', 'Purchase ₹', 'Selling ₹', 'Stock', 'Value at Cost', 'Value at Retail'];
        rows = data.map(p => [
          p.name,
          p.variant || '-',
          p.barcode,
          p.category,
          p.purchasePrice.toFixed(2),
          p.sellingPrice.toFixed(2),
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
    if (['sales', 'purchases', 'gst', 'supplier-ledger', 'customer-ledger'].includes(selectedReport)) {
      const totalRow = new Array(headerRow.length).fill('');
      totalRow[0] = 'TOTAL';
      
      // Accumulate columns that are numbers
      headerRow.forEach((col, idx) => {
        if (col.includes('₹') || col.includes('Amount')) {
          const sum = dataRows.reduce((acc, row) => acc + (Number(row[idx]) || 0), 0);
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
    doc.text(`${reportName.toUpperCase()}`, 14, 25);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);
    if (selectedReport !== 'stock') {
      doc.text(`Period: ${startDate} to ${endDate}`, 14, 36);
    }

    // Ledger specific subtitle
    if (selectedReport === 'supplier-ledger' && reportData.supplier) {
      doc.text(`Supplier Details: ${reportData.supplier.name} (Ph: ${reportData.supplier.phone})`, 14, 42);
    } else if (selectedReport === 'customer-ledger' && reportData.customer) {
      doc.text(`Customer Details: ${reportData.customer.name} (Ph: ${reportData.customer.mobile})`, 14, 42);
    }

    // Auto Table builder
    const finalRows = [...previewRows];

    // Compute PDF Totals row
    if (['sales', 'purchases', 'gst', 'supplier-ledger', 'customer-ledger'].includes(selectedReport)) {
      const pdfTotalRow = new Array(previewColumns.length).fill('');
      pdfTotalRow[0] = 'TOTAL';
      previewColumns.forEach((col, idx) => {
        if (col.includes('₹') || col.includes('Amount')) {
          const sum = previewRows.reduce((acc, row) => acc + (Number(row[idx]) || 0), 0);
          pdfTotalRow[idx] = `Rs ${sum.toFixed(2)}`;
        }
      });
      finalRows.push(pdfTotalRow);
    }

    autoTable(doc, {
      head: [previewColumns],
      body: finalRows,
      startY: selectedReport.includes('ledger') ? 48 : 42,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9 }, // Indigo style
      bodyStyles: { fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 40 }
    });

    const fileName = `SuperMart_${selectedReport}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    toast.success('PDF report document saved!');
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header-row">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>Reports & Exports</h1>
          <p style={{ color: 'var(--slate-500)', marginTop: 4, fontSize: 14 }}>
            Generate analytical logs and export bookkeeping ledgers to Excel or PDF format.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        
        {/* Filters Box Column */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
            Report Parameters
          </h3>

          {/* Report type choose */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Report Type</label>
            <select
              className="form-select"
              value={selectedReport}
              onChange={(e) => {
                setSelectedReport(e.target.value);
                setReportData(null);
                setPreviewRows([]);
              }}
            >
              {reportTypes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {/* Conditional supplier list select */}
          {selectedReport === 'supplier-ledger' && (
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Select Supplier</label>
              <select
                className="form-select"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                required
              >
                <option value="">Choose vendor</option>
                {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Conditional customer mobile check select */}
          {selectedReport === 'customer-ledger' && (
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Customer Mobile No</label>
              <input
                type="text"
                className="form-input"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="Enter customer phone"
                required
              />
            </div>
          )}

          {/* Conditional date ranges */}
          {selectedReport !== 'stock' && (
            <>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><HiOutlineCalendar /> Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><HiOutlineCalendar /> End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          <button 
            onClick={handleGenerateReport} 
            disabled={loading}
            className="btn btn--primary" 
            style={{ width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
          >
            {loading ? 'Compiling data...' : '🔍 Generate Report'}
          </button>
        </div>

        {/* Live Grid Preview card Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Actions toolbar */}
          {previewRows.length > 0 && (
            <div className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid var(--slate-200)' }}>
              <span style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600 }}>
                📊 Loaded dataset: <strong>{previewRows.length} records</strong>
              </span>
              
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={exportToExcel}
                  className="btn btn--ghost"
                  style={{ border: '1px solid var(--slate-300)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 12px', background: '#fff' }}
                >
                  <HiOutlineDownload /> Export Excel
                </button>
                <button 
                  onClick={exportToPDF}
                  className="btn btn--primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 12px' }}
                >
                  <HiOutlineDownload /> Export PDF Document
                </button>
              </div>
            </div>
          )}

          {/* Visual grid sheet */}
          <div className="card" style={{ minHeight: 400, padding: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--slate-400)' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: 12, fontSize: 14 }}>Aggregating system bookkeeping records...</p>
              </div>
            ) : previewRows.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--slate-400)', padding: 20, textAlign: 'center' }}>
                <HiOutlineDocumentReport size={40} style={{ color: 'var(--slate-300)' }} />
                <h4 style={{ marginTop: 12, fontSize: 14, color: 'var(--slate-700)', fontWeight: 700 }}>No report loaded</h4>
                <p style={{ marginTop: 6, fontSize: 12, maxWidth: 300, lineHeight: 1.4 }}>Select report configurations on the left sidebar and click "Generate Report" to preview.</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ boxShadow: 'none', border: 'none', borderRadius: 8, maxHeight: '60vh', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {previewColumns.map((col, idx) => <th key={idx}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td 
                            key={cIdx} 
                            style={{ 
                              color: 'var(--slate-700)', 
                              fontSize: 13,
                              fontWeight: cIdx === 0 ? 600 : 'normal' 
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default Reports;
