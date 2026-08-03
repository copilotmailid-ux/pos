import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineUserCircle,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineLocationMarker,
  HiOutlineIdentification
} from 'react-icons/hi';

const emptyForm = {
  name: '',
  supplierType: 'GST',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  gstin: ''
};

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detailsSupplier, setDetailsSupplier] = useState(null);
  const [detailsPurchases, setDetailsPurchases] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async (query = '') => {
    try {
      setLoading(true);
      const { data } = await api.get(`/suppliers${query ? `?search=${query}` : ''}`);
      setSuppliers(data);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(window._supplierSearchTimeout);
    window._supplierSearchTimeout = setTimeout(() => fetchSuppliers(value), 300);
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
    document.body.classList.add('modal-open');
  };

  const openEdit = (s, e) => {
    e.stopPropagation(); // Avoid triggering details modal
    setEditId(s._id);
    setForm({
      name: s.name,
      supplierType: s.supplierType || (s.gstin ? 'GST' : 'Non-GST'),
      contactPerson: s.contactPerson || '',
      phone: s.phone,
      email: s.email || '',
      address: s.address || '',
      gstin: s.gstin || ''
    });
    setModalOpen(true);
    document.body.classList.add('modal-open');
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
    document.body.classList.remove('modal-open');
  };

  const openDetails = async (supplierId) => {
    try {
      const { data } = await api.get(`/suppliers/${supplierId}`);
      setDetailsSupplier(data.supplier);
      setDetailsPurchases(data.purchases);
      setDetailsOpen(true);
      document.body.classList.add('modal-open');
    } catch {
      toast.error('Failed to load supplier details');
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsSupplier(null);
    setDetailsPurchases([]);
    document.body.classList.remove('modal-open');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error('Please fill required fields (Name, Phone)');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/suppliers/${editId}`, form);
        toast.success('Supplier profile updated!');
      } else {
        await api.post('/suppliers', form);
        toast.success('Supplier profile registered!');
      }
      closeModal();
      fetchSuppliers(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving supplier profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove supplier "${s.name}"?`)) return;
    try {
      await api.delete(`/suppliers/${s._id}`);
      toast.success('Supplier removed successfully');
      fetchSuppliers(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove supplier');
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header-row">
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>Suppliers Registry</h1>
        <button onClick={openAdd} className="btn btn--primary">
          <HiOutlinePlus /> Add Supplier Profile
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="search-input-group" style={{ maxWidth: 500 }}>
          <HiOutlineSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by supplier name, contact person, or phone number..."
            value={search}
            onChange={handleSearch}
          />
        </div>
      </div>

        <div className="card">
          <div className="table-wrapper">
            <table className="data-table data-table--bordered">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Type</th>
                  <th>Contact Person</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>GSTIN</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>Loading suppliers...</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>No suppliers registered</td></tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s._id} onClick={() => openDetails(s._id)} style={{ cursor: 'pointer' }} className="clickable-row">
                      <td className="font-semibold" style={{ color: 'var(--slate-800)' }}>{s.name}</td>
                      <td>
                        <span className={`badge ${s.supplierType === 'Non-GST' ? 'badge--warning' : 'badge--success'}`}>
                          {s.supplierType || (s.gstin ? 'GST (A)' : 'Non-GST (B)')}
                        </span>
                      </td>
                      <td>{s.contactPerson || '-'}</td>
                      <td>{s.phone}</td>
                      <td>{s.email || '-'}</td>
                      <td><span className="badge badge--brand">{s.gstin || 'None'}</span></td>
                      <td className="text-right">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <button onClick={(e) => openEdit(s, e)} className="btn--icon" title="Edit">
                            <HiOutlinePencil />
                          </button>
                          <button onClick={(e) => handleDelete(s, e)} className="btn--icon btn--icon-danger" title="Delete">
                            <HiOutlineTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Add/Edit Modal */}
      {modalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeModal} />
          <div className="modal modal--md">
            <div className="modal-header">
              <h3>{editId ? 'Edit Supplier Profile' : 'Add New Supplier'}</h3>
              <button onClick={closeModal} className="close-btn"><HiOutlineX /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Supplier Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Supplier A (GST) / Supplier B (Non-GST)"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Contact Person</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  placeholder="e.g., Rajesh Kumar"
                />
              </div>
              <div className="form-group">
                <label>Phone Number <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g., 9876543210"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g., contact@abc.com"
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g., 12, Main Street, Delhi"
                />
              </div>
              <div className="form-group">
                <label>GSTIN Number <span className="hint">(Optional for Non-GST suppliers)</span></label>
                <input
                  type="text"
                  className="form-input form-input--mono"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g., 22AAAAA0000A1Z5"
                />
              </div>
              <div className="form-actions" style={{ marginTop: 20 }}>
                <button type="button" onClick={closeModal} className="btn btn--ghost">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn--primary">
                  {saving ? 'Saving...' : editId ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Supplier Profile & Purchase History Modal */}
      {detailsOpen && detailsSupplier && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeDetails} />
          <div className="modal modal--lg">
            <div className="modal-header">
              <h3>Supplier Overview & History</h3>
              <button onClick={closeDetails} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Profile Card */}
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--slate-800)', margin: 0 }}>{detailsSupplier.name}</h2>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span className={`badge ${detailsSupplier.supplierType === 'Non-GST' ? 'badge--warning' : 'badge--success'}`}>
                        {detailsSupplier.supplierType || (detailsSupplier.gstin ? 'GST (A)' : 'Non-GST (B)')}
                      </span>
                      {detailsSupplier.contactPerson && (
                        <span style={{ fontSize: 13, color: 'var(--slate-500)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <HiOutlineUserCircle /> {detailsSupplier.contactPerson}
                        </span>
                      )}
                    </div>
                  </div>
                  {detailsSupplier.gstin && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>GSTIN</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>{detailsSupplier.gstin}</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, borderTop: '1px solid #cbd5e1', paddingTop: 14 }}>
                  <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate-400)', fontWeight: 650, marginBottom: 4 }}><HiOutlinePhone /> Phone</h4>
                    <p style={{ fontSize: 14, color: 'var(--slate-700)', margin: 0 }}>{detailsSupplier.phone}</p>
                  </div>
                  <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate-400)', fontWeight: 650, marginBottom: 4 }}><HiOutlineMail /> Email</h4>
                    <p style={{ fontSize: 14, color: 'var(--slate-700)', margin: 0 }}>{detailsSupplier.email || '-'}</p>
                  </div>
                  <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate-400)', fontWeight: 650, marginBottom: 4 }}><HiOutlineLocationMarker /> Address</h4>
                    <p style={{ fontSize: 14, color: 'var(--slate-700)', margin: 0 }}>{detailsSupplier.address || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Purchase History Ledger */}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 12 }}>Supply Purchases History</h3>
                {detailsPurchases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--slate-400)', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                    No purchase history found for this supplier.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table data-table--bordered" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr>
                          <th>Purchase No</th>
                          <th>Invoice Date</th>
                          <th>Payment Method</th>
                          <th>Status</th>
                          <th className="text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailsPurchases.map(p => (
                          <tr key={p._id}>
                            <td className="font-mono" style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{p.purchaseNumber}</td>
                            <td>{new Date(p.invoiceDate).toLocaleDateString()}</td>
                            <td>{p.paymentMethod}</td>
                            <td>
                              <span className={`badge ${p.status === 'Received' ? 'badge--success' : 'badge--warning'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="text-right font-semibold">₹{p.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button onClick={closeDetails} className="btn btn--ghost">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Suppliers;
