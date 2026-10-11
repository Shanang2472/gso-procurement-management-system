import React, { useEffect, useState } from 'react';
import {
  FileText, Trash2, Printer, Download, AlertTriangle, CheckCircle2,
  ShieldAlert, Eye, ChevronDown, ChevronRight, BookOpen, Archive,
  Layers, ClipboardList, Truck, ShieldCheck, Users, BarChart3, Clock,
  RefreshCw, X, Building2
} from 'lucide-react';

interface AdminLedgerPanelProps {
  currentUser: any;
  systemSettings: any;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => void;
  showAlert: (type: 'success' | 'error', msg: string) => void;
}

const formatPesos = (val: number | string) =>
  '\u20b1 ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d: string) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleString('en-PH'); } catch { return d; }
};

const statusColor = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (s === 'disapproved' || s === 'cancelled') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

// ----------------------------------------------------------------
// Printable Ledger Document
// ----------------------------------------------------------------
const PrintableLedger: React.FC<{ data: any; settings: any }> = ({ data, settings }) => {
  if (!data) return null;
  const s = settings || {};
  const now = new Date(data.exported_at || Date.now());

  const SectionHeader = ({ title, count }: { title: string; count?: number }) => (
    <div className="flex items-center justify-between mt-8 mb-2 pb-1 border-b-2 border-black">
      <h3 className="text-[12px] font-bold uppercase tracking-widest">{title}</h3>
      {count !== undefined && (
        <span className="text-[10px] font-mono border border-black px-2 py-0.5">{count} record(s)</span>
      )}
    </div>
  );

  const Th = ({ children }: { children: React.ReactNode }) => (
    <th className="border border-black p-1 text-[9px] font-bold uppercase text-left bg-gray-100">{children}</th>
  );
  const Td = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
    <td className={`border border-black p-1 text-[9px] ${mono ? 'font-mono' : ''}`}>{children}</td>
  );

  return (
    <div id="ledger-print-body" className="bg-white text-black font-sans text-[10px] p-8 w-full max-w-[210mm] mx-auto print:p-4 print:max-w-none leading-tight">
      {/* Header */}
      <div className="text-center mb-6 border-b-4 border-double border-black pb-4">
        <p className="text-[10px] font-semibold">Republic of the Philippines</p>
        <h1 className="text-[16px] font-black uppercase tracking-widest mt-1">{s.municipal_name || 'LGU PROCUREMENT SYSTEM'}</h1>
        <p className="text-[10px] text-gray-600">{s.province_name || ''}</p>
        <div className="mt-3 bg-black text-white py-2 px-4">
          <h2 className="text-[13px] font-black uppercase tracking-widest">OFFICIAL SYSTEM DATA LEDGER</h2>
          <p className="text-[9px] mt-0.5 opacity-80">Procurement Management System \u2014 Archive Record</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3 text-[9px]">
          <div className="text-left"><span className="font-bold uppercase">Generated:</span> {now.toLocaleString('en-PH')}</div>
          <div className="text-center"><span className="font-bold uppercase">By:</span> {data.exported_by} ({data.exported_by_role})</div>
          <div className="text-right">
            <span className="font-bold uppercase">Total Records:</span> {
              (data.ppmpItems?.length || 0) + (data.purchaseRequests?.length || 0) +
              (data.purchaseOrders?.length || 0) + (data.iarRecords?.length || 0) +
              (data.inventory?.length || 0) + (data.suppliers?.length || 0)
            }
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <SectionHeader title="I. Summary Statistics" />
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'PPMP Items', val: data.ppmpItems?.length || 0, color: 'bg-blue-50 border-blue-200' },
          { label: 'Purchase Requests', val: data.purchaseRequests?.length || 0, color: 'bg-purple-50 border-purple-200' },
          { label: 'Purchase Orders', val: data.purchaseOrders?.length || 0, color: 'bg-green-50 border-green-200' },
          { label: 'IAR Records', val: data.iarRecords?.length || 0, color: 'bg-orange-50 border-orange-200' },
          { label: 'Inventory Assets', val: data.inventory?.length || 0, color: 'bg-teal-50 border-teal-200' },
          { label: 'Suppliers', val: data.suppliers?.length || 0, color: 'bg-rose-50 border-rose-200' },
          { label: 'Departments', val: data.departments?.length || 0, color: 'bg-amber-50 border-amber-200' },
          { label: 'Audit Entries', val: data.auditLogs?.length || 0, color: 'bg-gray-50 border-gray-200' },
        ].map(item => (
          <div key={item.label} className={`border rounded p-2 text-center ${item.color}`}>
            <p className="text-[15px] font-black">{item.val}</p>
            <p className="text-[8px] font-bold uppercase mt-0.5 leading-tight">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Departments */}
      <SectionHeader title="II. Department Registry" count={data.departments?.length} />
      <table className="w-full border-collapse border border-black text-[9px] mb-4">
        <thead><tr><Th>ID</Th><Th>Name</Th><Th>Code</Th><Th>Head</Th><Th>Designation</Th></tr></thead>
        <tbody>
          {(data.departments || []).map((d: any) => (
            <tr key={d.id}>
              <Td mono>#{d.id}</Td><Td>{d.name}</Td><Td mono>{d.code}</Td>
              <Td>{d.head_name}</Td><Td>{d.head_designation}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PPMP */}
      <SectionHeader title="III. PPMP / APP Items" count={data.ppmpItems?.length} />
      <table className="w-full border-collapse border border-black text-[9px] mb-4">
        <thead><tr><Th>ID</Th><Th>Year</Th><Th>Category</Th><Th>Description</Th><Th>Unit</Th><Th>Unit Cost</Th><Th>Total Qty</Th><Th>Total Cost</Th><Th>Mode</Th></tr></thead>
        <tbody>
          {(data.ppmpItems || []).map((item: any) => (
            <tr key={item.id}>
              <Td mono>#{item.id}</Td><Td>{item.year}</Td><Td>{item.category}</Td>
              <Td>{item.description}</Td><Td>{item.unit}</Td>
              <Td mono>{formatPesos(item.unit_cost)}</Td>
              <Td mono>{item.total_qty}</Td>
              <Td mono>{formatPesos(item.total_cost)}</Td>
              <Td>{item.mode_of_procurement}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Purchase Requests */}
      <SectionHeader title="IV. Purchase Requests" count={data.purchaseRequests?.length} />
      <table className="w-full border-collapse border border-black text-[9px] mb-4">
        <thead><tr><Th>PR No.</Th><Th>Date</Th><Th>Purpose</Th><Th>Requested By</Th><Th>Status</Th><Th>ALOBS No.</Th><Th>Mode</Th></tr></thead>
        <tbody>
          {(data.purchaseRequests || []).map((pr: any) => (
            <tr key={pr.id}>
              <Td mono>{pr.pr_no}</Td><Td>{pr.date}</Td>
              <Td>{(pr.purpose || '').substring(0, 35)}{pr.purpose?.length > 35 ? '...' : ''}</Td>
              <Td>{pr.requested_by_name}</Td><Td>{pr.status}</Td>
              <Td mono>{pr.alobs_number || '\u2014'}</Td>
              <Td>{pr.mode_of_procurement || '\u2014'}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Purchase Orders */}
      <SectionHeader title="V. Purchase Orders" count={data.purchaseOrders?.length} />
      <table className="w-full border-collapse border border-black text-[9px] mb-4">
        <thead><tr><Th>PO No.</Th><Th>Date</Th><Th>PR ID</Th><Th>Supplier</Th><Th>Mode</Th><Th>Status</Th></tr></thead>
        <tbody>
          {(data.purchaseOrders || []).map((po: any) => (
            <tr key={po.id}>
              <Td mono>{po.po_no}</Td>
              <Td>{po.date || po.created_at?.split('T')[0]}</Td>
              <Td mono>#{po.pr_id}</Td>
              <Td>{po.supplier_name || `Supplier #${po.supplier_id}`}</Td>
              <Td>{po.mode_of_procurement}</Td><Td>{po.status}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* IAR */}
      <SectionHeader title="VI. Inspection & Acceptance Reports" count={data.iarRecords?.length} />
      <table className="w-full border-collapse border border-black text-[9px] mb-4">
        <thead><tr><Th>IAR No.</Th><Th>PO ID</Th><Th>Invoice No.</Th><Th>Invoice Date</Th><Th>Type</Th><Th>Created</Th></tr></thead>
        <tbody>
          {(data.iarRecords || []).map((iar: any) => (
            <tr key={iar.id}>
              <Td mono>{iar.iar_no || `IAR-${String(iar.id).padStart(4, '0')}`}</Td>
              <Td mono>#{iar.po_id}</Td><Td mono>{iar.invoice_no}</Td>
              <Td>{iar.invoice_date}</Td>
              <Td>{iar.is_partial ? 'Partial' : 'Full'}</Td>
              <Td>{formatDate(iar.created_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Inventory */}
      <SectionHeader title="VII. Inventory Assets (ICS / PAR)" count={data.inventory?.length} />
      <table className="w-full border-collapse border border-black text-[9px] mb-4">
        <thead><tr><Th>Prop. No.</Th><Th>Type</Th><Th>Description</Th><Th>Cost</Th><Th>Date Acquired</Th><Th>Assigned To</Th><Th>Status</Th></tr></thead>
        <tbody>
          {(data.inventory || []).map((asset: any) => (
            <tr key={asset.id}>
              <Td mono>{asset.property_no}</Td><Td>{asset.type}</Td>
              <Td>{asset.description}</Td>
              <Td mono>{formatPesos(asset.cost || 0)}</Td>
              <Td>{asset.date_acquired?.split('T')[0] || '\u2014'}</Td>
              <Td>{asset.receiver_name}</Td><Td>{asset.status}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Suppliers */}
      <SectionHeader title="VIII. Supplier Registry" count={data.suppliers?.length} />
      <table className="w-full border-collapse border border-black text-[9px] mb-4">
        <thead><tr><Th>ID</Th><Th>Name</Th><Th>TIN</Th><Th>Address</Th><Th>Contact Person</Th><Th>Rating</Th></tr></thead>
        <tbody>
          {(data.suppliers || []).map((sup: any) => (
            <tr key={sup.id}>
              <Td mono>#{sup.id}</Td><Td>{sup.name}</Td>
              <Td mono>{sup.tin}</Td>
              <Td>{(sup.address || '').substring(0, 35)}</Td>
              <Td>{sup.contact_person}</Td>
              <Td>{sup.performance_rating}/5</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Audit Trail */}
      <SectionHeader title="IX. System Audit Trail (Latest 200)" count={data.auditLogs?.length} />
      <table className="w-full border-collapse border border-black text-[9px] mb-4">
        <thead><tr><Th>Timestamp</Th><Th>Action</Th><Th>Table</Th><Th>Record ID</Th><Th>User</Th><Th>Role</Th></tr></thead>
        <tbody>
          {(data.auditLogs || []).slice(0, 200).map((log: any) => (
            <tr key={log.id}>
              <Td mono>{formatDate(log.timestamp)}</Td>
              <Td>{log.action}</Td><Td mono>{log.table_name}</Td>
              <Td mono>#{log.record_id}</Td>
              <Td>{log.user_name}</Td><Td>{log.user_role}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signature Block */}
      <div className="mt-10 border-t-2 border-double border-black pt-4">
        <p className="text-[10px] font-bold uppercase text-center tracking-widest mb-6">Official Certification &amp; Signatories</p>
        <div className="grid grid-cols-3 gap-8 text-center text-[9px]">
          <div>
            <div className="border-b border-black mb-1 pb-10"></div>
            <p className="font-bold uppercase">{s.gso_officer_name || 'GSO Officer'}</p>
            <p className="text-gray-600">General Services Officer</p>
          </div>
          <div>
            <div className="border-b border-black mb-1 pb-10"></div>
            <p className="font-bold uppercase">{s.accountant_name || 'Accountant'}</p>
            <p className="text-gray-600">Municipal Accountant</p>
          </div>
          <div>
            <div className="border-b border-black mb-1 pb-10"></div>
            <p className="font-bold uppercase">{s.mayor_name || 'Mayor'}</p>
            <p className="text-gray-600">Municipal Mayor / HOPE</p>
          </div>
        </div>
        <div className="mt-6 text-center text-[8px] text-gray-500 border-t border-gray-200 pt-3">
          <p>Generated from {s.system_name || 'GSO Procurement Management System'} on {now.toLocaleString('en-PH')}.</p>
          <p className="mt-0.5">In compliance with COA Circular guidelines and RA 9184 Government Procurement Reform Act.</p>
          <p className="mt-0.5 font-bold">CONFIDENTIAL \u2014 FOR OFFICIAL USE ONLY</p>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------
// Main Panel
// ----------------------------------------------------------------
export const AdminLedgerPanel: React.FC<AdminLedgerPanelProps> = ({
  currentUser, systemSettings, apiFetch, onRefresh, showAlert
}) => {
  if (!currentUser || !['Mayor', 'GSO Officer', 'Finance Officer'].includes(currentUser.role)) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-red-200 shadow-sm max-w-lg mx-auto my-12">
        <ShieldAlert size={48} className="text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 mb-1">Access Restricted</h3>
        <p className="text-xs text-slate-600">
          The Admin Ledger and Data Cleanup panel is restricted to the Mayor, GSO Officer, and Finance Officer.
        </p>
      </div>
    );
  }

  const [ledgerData, setLedgerData] = useState<any | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [activeSection, setActiveSection] = useState<'ledger' | 'manage'>('ledger');
  const [expandedSection, setExpandedSection] = useState<string | null>('ppmp');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showLedgerPreview, setShowLedgerPreview] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', head_name: '', head_designation: '' });
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [departmentRecords, setDepartmentRecords] = useState<any[]>([]);
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);

  const loadDepartments = async () => {
    try {
      const res = await apiFetch('/api/departments');
      if (!res.ok) throw new Error('Failed to load departments');
      setDepartmentRecords(await res.json());
    } catch (e: any) {
      showAlert('error', e.message);
    }
  };

  useEffect(() => { loadDepartments(); }, []);

  const canDelete = currentUser?.role === 'Mayor';
  const ledgerGenerated = !!ledgerData;

  const handleGenerateLedger = async () => {
    try {
      setLoadingLedger(true);
      const res = await apiFetch('/api/ledger/export');
      if (!res.ok) throw new Error('Failed to fetch ledger data');
      const data = await res.json();
      setLedgerData(data);
      showAlert('success', 'Full system ledger generated. You may now Print/Save as PDF or manage records.');
    } catch (e: any) {
      showAlert('error', e.message);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handlePrint = () => {
    if (!ledgerData) { showAlert('error', 'Please generate the ledger first.'); return; }
    setShowLedgerPreview(true);
    setTimeout(() => window.print(), 400);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const endpointMap: Record<string, string> = {
        ppmp: '/api/ppmp', pr: '/api/pr', po: '/api/po', rfq: '/api/rfq',
        iar: '/api/iar', supplier: '/api/suppliers', asset: '/api/inventory', department: '/api/departments',
      };
      const endpoint = endpointMap[deleteConfirm.type];
      if (!endpoint) throw new Error('Unknown entity type');
      const res = await apiFetch(`${endpoint}/${deleteConfirm.id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to delete'); }
      showAlert('success', `${deleteConfirm.label} deleted and logged in audit trail.`);
      setDeleteConfirm(null);
      if (deleteConfirm.type === 'department') await loadDepartments();
      setLedgerData(null);
      onRefresh();
    } catch (e: any) { showAlert('error', e.message); } finally { setDeleting(false); }
  };

  const handleCreateDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingDepartment(true);
    try {
      const endpoint = editingDepartmentId ? `/api/departments/${editingDepartmentId}` : '/api/departments';
      const res = await apiFetch(endpoint, {
        method: editingDepartmentId ? 'PUT' : 'POST',
        body: JSON.stringify(departmentForm)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create department');
      showAlert('success', `Department ${result.name} ${editingDepartmentId ? 'updated' : 'created'} successfully.`);
      setDepartmentForm({ name: '', code: '', head_name: '', head_designation: '' });
      setEditingDepartmentId(null);
      await loadDepartments();
      setLedgerData(null);
      onRefresh();
    } catch (e: any) {
      showAlert('error', e.message);
    } finally {
      setCreatingDepartment(false);
    }
  };

  const startDepartmentEdit = (department: any) => {
    setEditingDepartmentId(department.id);
    setDepartmentForm({ name: department.name, code: department.code, head_name: department.head_name, head_designation: department.head_designation });
  };

  const SectionToggle = ({ id, title, icon, count }: { id: string; title: string; icon: React.ReactNode; count: number }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === id ? null : id)}
      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-500">{icon}</span>
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</span>
        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">{count} records</span>
      </div>
      {expandedSection === id ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
    </button>
  );

  const DeleteBtn = ({ type, id, label, requiresLedger = true }: { type: string; id: number; label: string; requiresLedger?: boolean }) => (
    <button
      disabled={(requiresLedger && !ledgerGenerated) || !canDelete}
      title={requiresLedger && !ledgerGenerated ? 'Generate the ledger first before deleting' : !canDelete ? 'Only the Mayor can delete records' : `Delete ${label}`}
      onClick={() => setDeleteConfirm({ type, id, label })}
      className={`flex items-center gap-1 text-[10px] font-bold py-1 px-2 rounded border transition-colors ${
        (!requiresLedger || ledgerGenerated) && canDelete
          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 cursor-pointer'
          : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
      }`}
    >
      <Trash2 size={10} /> Delete
    </button>
  );

  const data = ledgerData;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">

      {/* Print Preview Modal */}
      {showLedgerPreview && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex flex-col items-center justify-center print:bg-transparent print:static print:block print:inset-auto print:overflow-visible">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-h-none print:overflow-visible print:rounded-none print:w-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden">
              <span className="text-sm font-bold text-slate-800">System Ledger \u2014 Print Preview</span>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 px-4 rounded flex items-center gap-2">
                  <Printer size={12} /> Print / Save as PDF
                </button>
                <button onClick={() => setShowLedgerPreview(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-1.5 px-3 rounded flex items-center gap-1">
                  <X size={12} /> Close
                </button>
              </div>
            </div>
            <div className="p-4 print:p-0">
              <PrintableLedger data={ledgerData} settings={systemSettings} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-red-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <ShieldAlert size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Confirm Permanent Deletion</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              <p className="font-bold mb-1">\u26a0\ufe0f Permanently deleting:</p>
              <p className="font-mono font-semibold">{deleteConfirm.label}</p>
              <p className="mt-2 text-red-700">All child records will also be deleted (cascade) and logged in the audit trail.</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-[10px] text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-600 flex-shrink-0" />
              <span>System ledger has been generated and is available for PDF archival.</span>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded shadow-sm flex items-center gap-2 disabled:opacity-60">
                <Trash2 size={12} />{deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-slate-900 text-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center"><Archive size={16} /></div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide">Admin Ledger &amp; Data Management</h2>
              <p className="text-[10px] text-slate-400">Authorized: {currentUser?.name} ({currentUser?.role})</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {ledgerGenerated && (
              <span className="flex items-center gap-1.5 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                <CheckCircle2 size={10} /> Ledger Generated
              </span>
            )}
            {!canDelete && (
              <span className="text-[10px] bg-amber-600/30 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-full font-bold">
                Read-Only (GSO Officer)
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {([{ key: 'ledger', label: 'Ledger Generator', icon: BookOpen }, { key: 'manage', label: 'Manage Records', icon: Trash2 }] as any[]).map(tab => (
            <button key={tab.key} onClick={() => setActiveSection(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t transition-all ${activeSection === tab.key ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <tab.icon size={13} />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* LEDGER GENERATOR */}
        {activeSection === 'ledger' && (
          <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={20} className="text-blue-600" />
                    <h3 className="text-base font-bold text-slate-800">Official System Data Ledger</h3>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl">Generate a comprehensive, print-ready snapshot of <strong>all system records</strong> \u2014 PPMP, PRs, POs, IAR, Inventory, Suppliers, and the full Audit Trail. Save as PDF before any cleanup operations.</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['PPMP Items', 'Purchase Requests', 'Purchase Orders', 'IAR Records', 'Inventory', 'Suppliers', 'Audit Trail'].map(s => (
                      <span key={s} className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={handleGenerateLedger} disabled={loadingLedger}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-5 rounded-lg shadow-sm disabled:opacity-60">
                    {loadingLedger ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                    {loadingLedger ? 'Generating...' : 'Generate Full Ledger'}
                  </button>
                  <button onClick={handlePrint} disabled={!ledgerGenerated}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-5 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                    <Printer size={13} /> Print / Save as PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '01', color: 'border-blue-200 bg-blue-50', tc: 'text-blue-700', nc: 'bg-blue-600', Icon: Download, title: 'Generate Ledger', desc: 'Fetch and compile all current system records into a comprehensive archive document.' },
                { step: '02', color: 'border-emerald-200 bg-emerald-50', tc: 'text-emerald-700', nc: 'bg-emerald-600', Icon: Printer, title: 'Print / Save as PDF', desc: "Use browser Print (Ctrl+P) and select Save as PDF to create a permanent offline archive." },
                { step: '03', color: 'border-red-200 bg-red-50', tc: 'text-red-700', nc: 'bg-red-600', Icon: Trash2, title: 'Manage Records', desc: 'After archiving, switch to Manage Records to delete outdated records. All deletions are permanently logged.' },
              ].map(item => (
                <div key={item.step} className={`rounded-xl border p-4 ${item.color}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-7 h-7 ${item.nc} rounded-full flex items-center justify-center text-white text-[10px] font-black`}>{item.step}</div>
                    <item.Icon size={16} className={item.tc} />
                    <h4 className={`text-xs font-bold ${item.tc}`}>{item.title}</h4>
                  </div>
                  <p className={`text-[10px] ${item.tc} leading-relaxed`}>{item.desc}</p>
                </div>
              ))}
            </div>

            {ledgerData && (
              <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <h4 className="text-sm font-bold text-slate-800">Ledger Generated Successfully</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(ledgerData.exported_at).toLocaleString('en-PH')}</span>
                    <button onClick={handlePrint} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-1.5 px-3 rounded">
                      <Printer size={11} /> Open Print View
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'PPMP Items', count: ledgerData.ppmpItems?.length, Icon: Layers },
                    { label: 'Purchase Requests', count: ledgerData.purchaseRequests?.length, Icon: FileText },
                    { label: 'Purchase Orders', count: ledgerData.purchaseOrders?.length, Icon: ClipboardList },
                    { label: 'IAR Records', count: ledgerData.iarRecords?.length, Icon: Truck },
                    { label: 'Inventory Assets', count: ledgerData.inventory?.length, Icon: ShieldCheck },
                    { label: 'Suppliers', count: ledgerData.suppliers?.length, Icon: Users },
                    { label: 'Departments', count: ledgerData.departments?.length, Icon: BarChart3 },
                    { label: 'Audit Entries', count: ledgerData.auditLogs?.length, Icon: Clock },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="flex justify-center mb-1 text-slate-400"><item.Icon size={14} /></div>
                      <p className="text-xl font-black text-slate-800">{item.count ?? 0}</p>
                      <p className="text-[9px] text-slate-500 font-semibold uppercase mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800"><strong>Important:</strong> Save this ledger as PDF before deleting any records. Once deleted, records cannot be recovered. This ledger is your permanent official archive per COA requirements.</p>
                </div>
              </div>
            )}

            <div className="bg-slate-800 text-slate-300 rounded-xl p-5 text-[10px] leading-relaxed">
              <p className="text-white font-bold uppercase tracking-wide text-[11px] mb-2">COA Compliance Notice</p>
              <p>Under <strong className="text-white">COA Circular No. 2009-002</strong> and the Government Procurement Reform Act (RA 9184), all government procurement records must be preserved for a minimum of <strong className="text-white">10 years</strong>. The system ledger must be printed and filed before any record is removed. All deletions are permanently logged in the audit trail.</p>
            </div>
          </>
        )}

        {/* MANAGE RECORDS */}
        {activeSection === 'manage' && (
          <>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={17} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">Department Registry</h3>
                </div>
                <p className="text-[11px] text-slate-500">All departments currently registered in the system.</p>
                {canDelete && (
                  <form onSubmit={handleCreateDepartment} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
                    <input value={departmentForm.name} onChange={e => setDepartmentForm({ ...departmentForm, name: e.target.value })} placeholder="Department name" className="border border-slate-200 rounded p-2 text-xs" required />
                    <input value={departmentForm.code} onChange={e => setDepartmentForm({ ...departmentForm, code: e.target.value.toUpperCase() })} placeholder="Code (e.g. MEO)" className="border border-slate-200 rounded p-2 text-xs uppercase" maxLength={50} required />
                    <input value={departmentForm.head_name} onChange={e => setDepartmentForm({ ...departmentForm, head_name: e.target.value })} placeholder="Department head" className="border border-slate-200 rounded p-2 text-xs" required />
                    <div className="flex gap-2">
                      <input value={departmentForm.head_designation} onChange={e => setDepartmentForm({ ...departmentForm, head_designation: e.target.value })} placeholder="Head designation" className="min-w-0 flex-1 border border-slate-200 rounded p-2 text-xs" required />
                      <button type="submit" disabled={creatingDepartment} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 rounded disabled:opacity-60">
                        {creatingDepartment ? 'Saving...' : editingDepartmentId ? 'Update' : 'Add'}
                      </button>
                      {editingDepartmentId && <button type="button" onClick={() => { setEditingDepartmentId(null); setDepartmentForm({ name: '', code: '', head_name: '', head_designation: '' }); }} className="shrink-0 border border-slate-200 text-slate-600 font-bold text-xs px-3 rounded">Cancel</button>}
                    </div>
                  </form>
                )}
              </div>
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                    <th className="p-3 text-left font-bold">Name</th><th className="p-3 text-left font-bold">Code</th><th className="p-3 text-left font-bold">Head</th><th className="p-3 text-left font-bold">Designation</th>{canDelete && <th className="p-3 text-center font-bold">Actions</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {departmentRecords.length === 0 && <tr><td colSpan={canDelete ? 5 : 4} className="p-6 text-center text-slate-400 italic">No departments found.</td></tr>}
                    {departmentRecords.map(department => (
                      <tr key={department.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-800">{department.name}</td><td className="p-3 font-mono text-slate-600">{department.code}</td><td className="p-3 text-slate-700">{department.head_name}</td><td className="p-3 text-slate-600">{department.head_designation}</td>
                        {canDelete && <td className="p-3"><div className="flex justify-center gap-2"><button type="button" onClick={() => startDepartmentEdit(department)} className="border border-blue-200 bg-blue-50 text-blue-700 rounded px-2 py-1 text-[10px] font-bold">Edit</button><DeleteBtn type="department" id={department.id} label={`Department: ${department.name}`} requiresLedger={false} /></div></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!ledgerGenerated && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 border-2 border-amber-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-amber-800">Ledger Required Before Deletion</h4>
                  <p className="text-xs text-amber-700">You must <strong>generate and save the system ledger</strong> before any records can be deleted. This ensures a permanent archive exists per COA requirements.</p>
                  <button onClick={() => setActiveSection('ledger')} className="text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded flex items-center gap-2">
                    <BookOpen size={12} /> Go to Ledger Generator
                  </button>
                </div>
              </div>
            )}
            {!canDelete && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                <Eye size={16} className="text-blue-600" />
                <p className="text-xs text-blue-800"><strong>Read-Only Mode:</strong> As GSO Officer, you can generate and view the ledger but cannot delete records. Only the Mayor has deletion authority.</p>
              </div>
            )}

            <div className="space-y-3">

              {/* PPMP */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <SectionToggle id="ppmp" title="APP / PPMP Items" icon={<Layers size={14} />} count={data?.ppmpItems?.length || 0} />
                {expandedSection === 'ppmp' && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                        <th className="p-3 text-left font-bold">ID</th>
                        <th className="p-3 text-left font-bold">Description</th>
                        <th className="p-3 text-left font-bold">Category</th>
                        <th className="p-3 font-bold">Unit Cost</th>
                        <th className="p-3 font-bold">Total Cost</th>
                        <th className="p-3 font-bold">Mode</th>
                        {canDelete && <th className="p-3 font-bold text-center">Action</th>}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.ppmpItems || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400 italic text-xs">No PPMP items found.</td></tr>}
                        {(data?.ppmpItems || []).map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono text-slate-500">#{item.id}</td>
                            <td className="p-3 font-medium text-slate-800 max-w-xs truncate">{item.description}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${statusColor(item.category)}`}>{item.category}</span></td>
                            <td className="p-3 font-mono text-right">{formatPesos(item.unit_cost)}</td>
                            <td className="p-3 font-mono font-bold text-right">{formatPesos(item.total_cost)}</td>
                            <td className="p-3 text-slate-500">{item.mode_of_procurement}</td>
                            {canDelete && <td className="p-3 text-center"><DeleteBtn type="ppmp" id={item.id} label={`APP / PPMP #${item.id}`} /></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Purchase Requests */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <SectionToggle id="pr" title="Purchase Requests" icon={<FileText size={14} />} count={data?.purchaseRequests?.length || 0} />
                {expandedSection === 'pr' && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                        <th className="p-3 text-left font-bold">PR No.</th>
                        <th className="p-3 text-left font-bold">Date</th>
                        <th className="p-3 text-left font-bold">Purpose</th>
                        <th className="p-3 font-bold">Status</th>
                        <th className="p-3 font-bold">Requested By</th>
                        {canDelete && <th className="p-3 font-bold text-center">Action</th>}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.purchaseRequests || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic text-xs">No purchase requests found.</td></tr>}
                        {(data?.purchaseRequests || []).map((pr: any) => (
                          <tr key={pr.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-800">{pr.pr_no}</td>
                            <td className="p-3 text-slate-500">{pr.date}</td>
                            <td className="p-3 text-slate-700 max-w-xs truncate">{pr.purpose}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${statusColor(pr.status)}`}>{pr.status}</span></td>
                            <td className="p-3 text-slate-600">{pr.requested_by_name}</td>
                            {canDelete && <td className="p-3 text-center"><DeleteBtn type="pr" id={pr.id} label={`PR ${pr.pr_no}`} /></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Purchase Orders */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <SectionToggle id="po" title="Purchase Orders" icon={<ClipboardList size={14} />} count={data?.purchaseOrders?.length || 0} />
                {expandedSection === 'po' && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                        <th className="p-3 text-left font-bold">PO No.</th>
                        <th className="p-3 text-left font-bold">Date</th>
                        <th className="p-3 text-left font-bold">Supplier</th>
                        <th className="p-3 font-bold">Status</th>
                        <th className="p-3 font-bold">Mode</th>
                        {canDelete && <th className="p-3 font-bold text-center">Action</th>}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.purchaseOrders || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic text-xs">No purchase orders found.</td></tr>}
                        {(data?.purchaseOrders || []).map((po: any) => (
                          <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-800">{po.po_no}</td>
                            <td className="p-3 text-slate-500">{po.date || po.created_at?.split('T')[0]}</td>
                            <td className="p-3 text-slate-700">{po.supplier_name || `Supplier #${po.supplier_id}`}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${statusColor(po.status)}`}>{po.status}</span></td>
                            <td className="p-3 text-slate-500">{po.mode_of_procurement}</td>
                            {canDelete && <td className="p-3 text-center"><DeleteBtn type="po" id={po.id} label={`PO ${po.po_no}`} /></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* IAR */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <SectionToggle id="iar" title="IAR Records" icon={<Truck size={14} />} count={data?.iarRecords?.length || 0} />
                {expandedSection === 'iar' && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                        <th className="p-3 text-left font-bold">IAR No.</th>
                        <th className="p-3 text-left font-bold">Invoice No.</th>
                        <th className="p-3 font-bold">Invoice Date</th>
                        <th className="p-3 font-bold">Type</th>
                        <th className="p-3 font-bold">Created</th>
                        {canDelete && <th className="p-3 font-bold text-center">Action</th>}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.iarRecords || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic text-xs">No IAR records found.</td></tr>}
                        {(data?.iarRecords || []).map((iar: any) => (
                          <tr key={iar.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-800">{iar.iar_no || `IAR-${String(iar.id).padStart(4, '0')}`}</td>
                            <td className="p-3 font-mono text-slate-700">{iar.invoice_no}</td>
                            <td className="p-3 text-slate-500">{iar.invoice_date}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${iar.is_partial ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{iar.is_partial ? 'Partial' : 'Full'}</span></td>
                            <td className="p-3 text-slate-400 font-mono text-[10px]">{formatDate(iar.created_at)}</td>
                            {canDelete && <td className="p-3 text-center"><DeleteBtn type="iar" id={iar.id} label={`IAR ${iar.iar_no || iar.id}`} /></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Inventory */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <SectionToggle id="asset" title="Inventory Assets" icon={<ShieldCheck size={14} />} count={data?.inventory?.length || 0} />
                {expandedSection === 'asset' && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                        <th className="p-3 text-left font-bold">Property No.</th>
                        <th className="p-3 text-left font-bold">Type</th>
                        <th className="p-3 text-left font-bold">Description</th>
                        <th className="p-3 font-bold">Cost</th>
                        <th className="p-3 font-bold">Status</th>
                        <th className="p-3 font-bold">Assigned To</th>
                        {canDelete && <th className="p-3 font-bold text-center">Action</th>}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.inventory || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400 italic text-xs">No inventory assets found.</td></tr>}
                        {(data?.inventory || []).map((asset: any) => (
                          <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-800">{asset.property_no}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${asset.type === 'PAR' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{asset.type}</span></td>
                            <td className="p-3 text-slate-700 max-w-xs truncate">{asset.description}</td>
                            <td className="p-3 font-mono text-right">{formatPesos(asset.cost || 0)}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${statusColor(asset.status)}`}>{asset.status}</span></td>
                            <td className="p-3 text-slate-600">{asset.receiver_name}</td>
                            {canDelete && <td className="p-3 text-center"><DeleteBtn type="asset" id={asset.id} label={`Asset ${asset.property_no}`} /></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Suppliers */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <SectionToggle id="supplier" title="Supplier Registry" icon={<Users size={14} />} count={data?.suppliers?.length || 0} />
                {expandedSection === 'supplier' && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                        <th className="p-3 text-left font-bold">ID</th>
                        <th className="p-3 text-left font-bold">Name</th>
                        <th className="p-3 text-left font-bold">TIN</th>
                        <th className="p-3 font-bold">Contact</th>
                        <th className="p-3 font-bold">Rating</th>
                        {canDelete && <th className="p-3 font-bold text-center">Action</th>}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.suppliers || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic text-xs">No suppliers registered.</td></tr>}
                        {(data?.suppliers || []).map((sup: any) => (
                          <tr key={sup.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono text-slate-500">#{sup.id}</td>
                            <td className="p-3 font-bold text-slate-800">{sup.name}</td>
                            <td className="p-3 font-mono text-slate-600">{sup.tin}</td>
                            <td className="p-3 text-slate-600">{sup.contact_person} &middot; {sup.contact_no}</td>
                            <td className="p-3 text-center">
                              <span className={`text-[10px] font-bold ${sup.performance_rating >= 4 ? 'text-emerald-600' : sup.performance_rating >= 2 ? 'text-amber-600' : 'text-red-600'}`}>
                                {'★'.repeat(sup.performance_rating)}{'☆'.repeat(5 - sup.performance_rating)} {sup.performance_rating}/5
                              </span>
                            </td>
                            {canDelete && <td className="p-3 text-center"><DeleteBtn type="supplier" id={sup.id} label={`Supplier: ${sup.name}`} /></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              {canDelete && (
                <div className="bg-red-950/10 border-2 border-red-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-600" />
                    <h4 className="text-sm font-bold text-red-800 uppercase tracking-wide">Danger Zone \u2014 Bulk Operations</h4>
                  </div>
                  <p className="text-xs text-red-700">These operations affect multiple records at once. Use with extreme caution.</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      disabled={!ledgerGenerated}
                      onClick={async () => {
                        if (!confirm('Clear all audit log entries older than 90 days?')) return;
                        try {
                          const res = await apiFetch('/api/audit-logs/clear', { method: 'DELETE' });
                          const result = await res.json();
                          if (!res.ok) throw new Error(result.error);
                          showAlert('success', `Cleared ${result.cleared_count} old audit log entries (older than 90 days).`);
                          setLedgerData(null);
                          onRefresh();
                        } catch (e: any) { showAlert('error', e.message); }
                      }}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={12} /> Clear Old Audit Logs (&gt;90 days)
                    </button>
                  </div>
                  {!ledgerGenerated && <p className="text-[10px] text-red-500 italic">\u26a0\ufe0f Generate the system ledger first to enable bulk operations.</p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
