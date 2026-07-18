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
    setDetailsSupplier(null);
    setDetailsPurchases([]);
    setDetailsOpen(false);
    document.body.classList.remove('modal-open');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/suppliers/${editId}`, form);
        toast.success('Supplier details updated');
      } else {
        await api.post('/suppliers', form);
        toast.success('Supplier added successfully');
      }
      closeModal();
      fetchSuppliers(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s, e) => {
    e.stopPropagation(); // Avoid triggering details modal
    if (!window.confirm(`Are you sure you want to delete supplier "${s.name}"?`)) return;

    try {
      await api.delete(`/suppliers/${s._id}`);
      toast.success('Supplier deleted');
      fetchSuppliers(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete supplier');
    }
  };

  return (
    <>
      <div className="animate-fade-in">
        <div className="page-header-row">
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--slate-800)' }}>Suppliers</h1>
            <p style={{ color: 'var(--slate-500)', marginTop: 4, fontSize: 14 }}>
              Register and manage vendors and check their supply transactions.
            </p>
          </div>
          <button id="add-supplier-btn" onClick={openAdd} className="btn btn--primary">
            <HiOutlinePlus /> Add Supplier
          </button>
        </div>

        <div className="search-bar">
          <span className="search-icon"><HiOutlineSearch /></span>
          <input
            id="supplier-search"
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search by supplier name, contact person, phone..."
          />
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Contact Person</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>GSTIN</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>Loading suppliers...</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-400)' }}>No suppliers found</td></tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s._id} onClick={() => openDetails(s._id)} style={{ cursor: 'pointer' }} className="clickable-row">
                      <td className="font-semibold" style={{ color: 'var(--slate-800)' }}>{s.name}</td>
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
      </div>

      {/* Add/Edit Modal — Portaled to escape stacking context */}
      {modalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={closeModal} />
          <div className="modal modal--md">
            <div className="modal-header">
              <h3>{editId ? 'Edit Supplier' : 'Add New Supplier'}</h3>
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
                  placeholder="e.g., ABC Distributors Ltd."
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
                <label>GSTIN</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g., 07AAAAA1111A1Z1"
                />
              </div>
              <div className="form-actions" style={{ marginTop: 24 }}>
                <button type="button" onClick={closeModal} className="btn btn--ghost">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn--primary">
                  {saving ? 'Saving...' : editId ? 'Update' : 'Add Supplier'}
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
          <div className="modal modal--lg animate-fade-in" style={{ width: '90%', maxWidth: '750px' }}>
            <div className="modal-header">
              <h3>Supplier Profile</h3>
              <button onClick={closeDetails} className="close-btn"><HiOutlineX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate-400)', fontWeight: 650, marginBottom: 4 }}><HiOutlineUserCircle /> Company</h4>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate-800)' }}>{detailsSupplier.name}</p>
                </div>
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate-400)', fontWeight: 650, marginBottom: 4 }}><HiOutlinePhone /> Phone</h4>
                  <p style={{ fontSize: 14, color: 'var(--slate-700)', fontWeight: 600 }}>{detailsSupplier.phone}</p>
                </div>
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate-400)', fontWeight: 650, marginBottom: 4 }}><HiOutlineMail /> Email</h4>
                  <p style={{ fontSize: 14, color: 'var(--slate-700)' }}>{detailsSupplier.email || '-'}</p>
                </div>
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate-400)', fontWeight: 650, marginBottom: 4 }}><HiOutlineIdentification /> GSTIN</h4>
                  <p style={{ fontSize: 14, color: 'var(--slate-700)', fontWeight: 600 }}><span className="badge badge--brand">{detailsSupplier.gstin || 'None'}</span></p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate-400)', fontWeight: 650, marginBottom: 4 }}><HiOutlineLocationMarker /> Address</h4>
                  <p style={{ fontSize: 14, color: 'var(--slate-700)' }}>{detailsSupplier.address || '-'}</p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 12 }}>Purchase Invoices History</h4>
                <div className="table-wrapper" style={{ boxShadow: 'none', border: '1px solid #f1f5f9' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice Number</th>
                        <th>Purchase Date</th>
                        <th>Status</th>
                        <th>Invoice Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsPurchases.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--slate-400)' }}>No past purchases registered for this supplier</td></tr>
                      ) : (
                        detailsPurchases.map((p) => (
                          <tr key={p._id}>
                            <td className="font-mono font-bold" style={{ color: 'var(--brand-600)' }}>{p.purchaseNumber}</td>
                            <td>{new Date(p.invoiceDate).toLocaleDateString()}</td>
                            <td>
                              <span className={`badge ${p.status === 'Received' ? 'badge--green' : 'badge--red'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="font-semibold">₹{p.total.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Suppliers;
