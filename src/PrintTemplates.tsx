import React from 'react';

interface PrintHeaderProps {
  appendix: string;
  title: string;
  settings?: any;
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({ appendix, title, settings }) => (
  <div className="flex justify-between items-start mb-4 font-serif">
    <div className="flex items-start gap-2">
      {settings?.logo_data ? <img src={settings.logo_data} alt="System logo" className="w-10 h-10 object-contain" /> : null}
      <p className="text-[10px] italic font-bold">{appendix}</p>
    </div>
    <div className="text-center">
      <h4 className="text-[14px] font-bold uppercase tracking-tight">{title}</h4>
      <p className="text-[10px] mt-0.5">Republic of the Philippines</p>
      <p className="text-[10px] font-bold uppercase">{settings?.municipal_name || "MUNICIPALITY OF SAN JOSE"}</p>
      <p className="text-[9px] text-slate-500">{settings?.province_name || "Province of Bulacan"}</p>
    </div>
    <div className="w-12"></div>
  </div>
);

// 1. APPENDIX 60: Purchase Request
export const PrintPR: React.FC<{
  pr: any;
  department: any;
  settings?: any;
  editable?: boolean;
  onChange?: (changes: any) => void;
}> = ({ pr, department, settings, editable = false, onChange }) => {
  const [newItem, setNewItem] = React.useState({ unit: '', description: '', quantity: '1', unit_cost: '' });
  if (!pr) return null;
  const totalCost = pr.items?.reduce((sum: number, item: any) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0) || 0;
  const updateItem = (index: number, field: string, value: string) => {
    const items = (pr.items || []).map((item: any, itemIndex: number) => itemIndex === index
      ? { ...item, [field]: field === 'quantity' || field === 'unit_cost' ? Number(value) : value }
      : item
    );
    onChange?.({ items });
  };
  const addItem = () => {
    if (!newItem.unit.trim() || !newItem.description.trim() || !newItem.quantity || !newItem.unit_cost) return;
    onChange?.({
      items: [...(pr.items || []), {
        id: `new-${Date.now()}`,
        ppmp_item_id: null,
        unit: newItem.unit.trim(),
        description: newItem.description.trim(),
        quantity: Number(newItem.quantity),
        unit_cost: Number(newItem.unit_cost),
        total_cost: Number(newItem.quantity) * Number(newItem.unit_cost)
      }]
    });
    setNewItem({ unit: '', description: '', quantity: '1', unit_cost: '' });
  };
  const inputClass = 'bg-transparent outline-none w-full print:bg-transparent ' + (editable ? 'border-b border-blue-300 print:border-0' : 'border-0');

  return (
    <div className="w-full bg-white text-black p-6 font-sans text-[11px] border border-slate-300 shadow-sm leading-tight max-w-[700px] mx-auto print:p-0 print:border-0 print:shadow-none">
      <PrintHeader appendix="Appendix 60" title="PURCHASE REQUEST" settings={settings} />

      <div className="grid grid-cols-2 border border-black mb-0">
        <div className="border-r border-black p-2">
          <p className="font-bold uppercase text-[9px] text-slate-500">Office/Section:</p>
          <div className="font-semibold text-xs mt-1 uppercase flex items-center gap-1">
            <span>{department?.name || 'GSO'} -</span>
            {editable ? <input value={pr.section || ''} onChange={(e) => onChange?.({ section: e.target.value })} className={`${inputClass} uppercase`} /> : <span>{pr.section || 'Main'}</span>}
          </div>
        </div>
        <div className="p-2 flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="font-bold text-[9px] text-slate-500 uppercase">PR No.:</span>
            {editable ? <input value={pr.pr_no || ''} onChange={(e) => onChange?.({ pr_no: e.target.value })} className={`${inputClass} text-right font-mono font-bold text-xs`} /> : <span className="font-mono font-bold text-xs">{pr.pr_no}</span>}
          </div>
          <div className="flex justify-between border-t border-black/20 pt-1 mt-1">
            <span className="font-bold text-[9px] text-slate-500 uppercase">Date:</span>
            {editable ? <input type="date" value={String(pr.date || '').slice(0, 10)} onChange={(e) => onChange?.({ date: e.target.value })} className={`${inputClass} text-right`} /> : <span>{pr.date}</span>}
          </div>
        </div>
      </div>

      <table className="w-full border-x border-b border-black text-[10px] border-collapse">
        <thead>
          <tr className="border-t border-black bg-slate-50">
            <th className="border-r border-black p-1 w-12 text-center uppercase font-bold">Item No.</th>
            <th className="border-r border-black p-1 w-16 text-center uppercase font-bold">Unit</th>
            <th className="border-r border-black p-1 text-left uppercase font-bold">Item Description</th>
            <th className="border-r border-black p-1 w-12 text-center uppercase font-bold">Qty</th>
            <th className="border-r border-black p-1 w-24 text-right uppercase font-bold">Unit Cost</th>
            <th className="p-1 w-24 text-right uppercase font-bold">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {pr.items?.map((item: any, idx: number) => (
            <tr key={item.id || idx} className="border-t border-black/20 h-8">
              <td className="border-r border-black p-1 text-center">{idx + 1}</td>
              <td className="border-r border-black p-1 text-center uppercase font-serif italic">{editable ? <input value={item.unit || ''} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className={`${inputClass} text-center italic`} /> : item.unit}</td>
              <td className="border-r border-black p-1">{editable ? <input value={item.description || ''} onChange={(e) => updateItem(idx, 'description', e.target.value)} className={inputClass} /> : item.description}</td>
              <td className="border-r border-black p-1 text-center font-bold">{editable ? <input type="number" min="1" value={item.quantity ?? ''} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className={`${inputClass} text-center font-bold`} /> : item.quantity}</td>
              <td className="border-r border-black p-1 text-right font-mono">{editable ? <input type="number" min="0" step="0.01" value={item.unit_cost ?? ''} onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)} className={`${inputClass} text-right font-mono`} /> : `₱${Number(item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
              <td className="p-1 text-right font-mono font-semibold">₱{(Number(item.quantity || 0) * Number(item.unit_cost || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
          {editable && (
            <tr className="border-t border-blue-200 bg-blue-50 print:hidden">
              <td className="border-r border-black p-1 text-center font-bold text-blue-700">+</td>
              <td className="border-r border-black p-1">
                <input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="Unit" className="w-full bg-transparent text-center text-[10px] outline-none border-b border-blue-300" />
              </td>
              <td className="border-r border-black p-1">
                <input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Add item description" className="w-full bg-transparent text-[10px] outline-none border-b border-blue-300" />
              </td>
              <td className="border-r border-black p-1">
                <input type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} className="w-full bg-transparent text-center text-[10px] outline-none border-b border-blue-300" />
              </td>
              <td className="border-r border-black p-1">
                <input type="number" min="0" step="0.01" value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })} placeholder="0.00" className="w-full bg-transparent text-right text-[10px] outline-none border-b border-blue-300" />
              </td>
              <td className="p-1 text-center">
                <button type="button" onClick={addItem} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 text-[9px] font-bold uppercase">Add Item</button>
              </td>
            </tr>
          )}
          {/* Pad Rows */}
          {Array.from({ length: Math.max(0, 4 - (pr.items?.length || 0)) }).map((_, i) => (
            <tr key={`pad-${i}`} className="border-t border-black/10 h-8">
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black text-center text-slate-300 italic">Nothing follows...</td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td></td>
            </tr>
          ))}
          <tr className="border-t border-black bg-slate-100 font-bold">
            <td colSpan={5} className="border-r border-black p-2 text-right uppercase">Total Estimated Budget (ABC):</td>
            <td className="p-2 text-right font-mono text-xs underline">₱{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <div className="border-x border-b border-black p-3 bg-slate-50">
        <p className="font-bold uppercase text-[9px] text-slate-500">Purpose / Justification:</p>
        {editable ? <textarea value={pr.purpose || ''} onChange={(e) => onChange?.({ purpose: e.target.value })} rows={2} className={`${inputClass} text-xs mt-1 italic resize-none`} /> : <p className="text-xs mt-1 italic">"{pr.purpose}"</p>}
        {pr.alobs_number && (
          <div className="mt-2 pt-2 border-t border-black/10 grid grid-cols-2 text-[10px]">
            <div><span className="font-bold">ALOBS/CAF Number:</span> <span className="font-mono bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">{pr.alobs_number}</span></div>
            <div><span className="font-bold">Mode of Procurement:</span> <span className="font-semibold text-blue-800">{pr.mode_of_procurement || 'N/A'}</span></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 border-x border-b border-black text-[10px]">
        <div className="border-r border-black p-2 flex flex-col justify-between h-28">
          <p className="font-bold uppercase text-[9px] text-slate-500">Requested By:</p>
          <div className="text-center mt-auto">
            {editable ? <input value={pr.requested_by_name || ''} onChange={(e) => onChange?.({ requested_by_name: e.target.value })} className={`${inputClass} text-center font-bold underline uppercase`} /> : <p className="font-bold underline uppercase">{pr.requested_by_name}</p>}
            {editable ? <input value={pr.requested_by_designation || ''} onChange={(e) => onChange?.({ requested_by_designation: e.target.value })} className={`${inputClass} text-center text-[9px] text-slate-500`} /> : <p className="text-[9px] text-slate-500">{pr.requested_by_designation}</p>}
          </div>
        </div>
        <div className="p-2 flex flex-col justify-between">
          <p className="font-bold uppercase text-[9px] text-slate-500">Approved / Processed By:</p>
          <PrintSignatures mode={pr.mode_of_procurement} settings={settings} />
        </div>
      </div>
    </div>
  );
};

// 2. APPENDIX 61: Purchase Order
export const PrintSignatures: React.FC<{
  mode: string;
  settings?: any;
}> = ({ mode, settings }) => {
  if (mode === 'Public Bidding') {
    return (
      <div className="grid grid-cols-3 gap-2 border-t border-black p-4 text-center text-[10px]">
        <div>
          <p className="font-bold underline uppercase">{settings?.bac_chair || "BAC CHAIRPERSON"}</p>
          <p className="text-[9px]">BAC Chairperson</p>
        </div>
        <div>
          <p className="font-bold underline uppercase">{settings?.bac_member1 || "BAC MEMBER"}</p>
          <p className="text-[9px]">BAC Member</p>
        </div>
        <div>
          <p className="font-bold underline uppercase">{settings?.bac_member2 || "BAC MEMBER"}</p>
          <p className="text-[9px]">BAC Member</p>
        </div>
      </div>
    );
  } else {
    return (
      <div className="grid grid-cols-2 gap-4 border-t border-black p-4 text-center text-[10px]">
        <div>
          <p className="font-bold underline uppercase">{settings?.gso_officer_name || "GSO OFFICER"}</p>
          <p className="text-[9px]">GSO Supply Officer</p>
        </div>
        <div>
          <p className="font-bold underline uppercase">{settings?.mayor_name || "HON. Johnielle Keith Pasion Nieto"}</p>
          <p className="text-[9px]">Municipal Mayor (HOPE)</p>
        </div>
      </div>
    );
  }
};

// 2. APPENDIX 61: Purchase Order
export const PrintPO: React.FC<{ po: any; supplier: any; department: any; settings?: any }> = ({ po, supplier, department, settings }) => {
  if (!po) return null;
  const resolvedSupplier = supplier || po.supplier || (po.supplier_name ? { name: po.supplier_name, address: po.supplier_address, tin: po.supplier_tin, contact_no: po.supplier_contact_no } : null);
  const totalCost = po.items?.reduce((sum: number, item: any) => sum + Number(item.total_cost), 0) || 0;

  return (
    <div className="w-full bg-white text-black p-6 font-sans text-[11px] border border-slate-300 shadow-sm leading-tight max-w-[700px] mx-auto print:p-0 print:border-0 print:shadow-none">
      <PrintHeader appendix="Appendix 61" title="PURCHASE ORDER" settings={settings} />

      <div className="grid grid-cols-2 border border-black text-[10px] mb-0">
        <div className="border-r border-black p-2 space-y-1">
          <p><span className="font-bold uppercase text-[9px] text-slate-500 block">Supplier:</span> <span className="font-bold text-xs uppercase">{resolvedSupplier?.name || 'Unknown Supplier'}</span></p>
          <p><span className="font-bold text-[9px] text-slate-500 block">Address:</span> {resolvedSupplier?.address || '—'}</p>
          <p><span className="font-bold text-[9px] text-slate-500">TIN:</span> <span className="font-mono">{resolvedSupplier?.tin || '—'}</span></p>
        </div>
        <div className="p-2 flex flex-col justify-between space-y-1">
          <div className="flex justify-between">
            <span className="font-bold text-[9px] text-slate-500 uppercase">PO No.:</span>
            <span className="font-mono font-bold text-xs text-blue-700">{po.po_no}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-[9px] text-slate-500 uppercase">Date:</span>
            <span>{po.po_date}</span>
          </div>
          <div className="flex justify-between border-t border-black/10 pt-1">
            <span className="font-bold text-[9px] text-slate-500 uppercase">Procurement Mode:</span>
            <span className="font-semibold text-slate-800">{po.mode_of_procurement}</span>
          </div>
        </div>
      </div>

      <div className="border-x border-b border-black p-2 bg-slate-50 text-[10px] space-y-1">
        <p className="font-serif italic text-center text-slate-600">"Gentlemen: Please furnish this Office the following articles subject to the terms and conditions contained herein:"</p>
        <div className="grid grid-cols-2 gap-4 pt-1 text-[9px] border-t border-black/10">
          <div><span className="font-bold uppercase text-slate-500">Place of Delivery:</span> {po.delivery_place}</div>
          <div><span className="font-bold uppercase text-slate-500">Delivery Term:</span> {po.delivery_term}</div>
          <div><span className="font-bold uppercase text-slate-500">Payment Term:</span> {po.payment_term}</div>
        </div>
      </div>

      <table className="w-full border-x border-b border-black text-[10px] border-collapse">
        <thead>
          <tr className="border-t border-black bg-slate-100">
            <th className="border-r border-black p-1 w-10 text-center uppercase font-bold">Item No.</th>
            <th className="border-r border-black p-1 w-16 text-center uppercase font-bold">Unit</th>
            <th className="border-r border-black p-1 text-left uppercase font-bold">Description</th>
            <th className="border-r border-black p-1 w-12 text-center uppercase font-bold">Qty</th>
            <th className="border-r border-black p-1 w-24 text-right uppercase font-bold">Unit Cost</th>
            <th className="p-1 w-24 text-right uppercase font-bold">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {po.items?.map((item: any, idx: number) => (
            <tr key={item.id || idx} className="border-t border-black/20 h-8">
              <td className="border-r border-black p-1 text-center">{idx + 1}</td>
              <td className="border-r border-black p-1 text-center uppercase font-serif italic">{item.unit || 'unit'}</td>
              <td className="border-r border-black p-1">{item.description || 'Delivered item specifications'}</td>
              <td className="border-r border-black p-1 text-center font-bold">{item.quantity}</td>
              <td className="border-r border-black p-1 text-right font-mono">₱{Number(item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="p-1 text-right font-mono font-semibold">₱{Number(item.total_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
          <tr className="border-t border-black bg-slate-100 font-bold">
            <td colSpan={5} className="border-r border-black p-2 text-right uppercase">GRAND TOTAL:</td>
            <td className="p-2 text-right font-mono text-xs underline text-blue-700">₱{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <div className="border-x border-b border-black p-3 text-[9px] bg-slate-50 text-slate-700 space-y-1">
        <p className="font-bold uppercase text-[8px] text-slate-500">Liquidated Damages Clause:</p>
        <p className="leading-relaxed">{po.penalty_clause || settings?.penalty_clause_text}</p>
      </div>

      <div className="grid grid-cols-2 border-x border-b border-black text-[10px]">
        <div className="border-r border-black p-3 flex flex-col justify-between h-28">
          <div className="space-y-1">
            <p className="font-bold uppercase text-[8px] text-slate-500">Conforme / Acceptance:</p>
            <p className="text-[9px] text-slate-500">I hereby conform to the terms, conditions, and delivery schedules specified above.</p>
          </div>
          <div className="text-center mt-auto">
            <div className="border-b border-black w-40 mx-auto"></div>
            <p className="font-semibold text-[9px] mt-1 text-slate-500">Signature Over Printed Name of Supplier</p>
            <div className="border-b border-black w-24 mx-auto mt-2"></div>
            <p className="text-[8px] text-slate-400 mt-0.5">Date Signed</p>
          </div>
        </div>
        <div className="p-3 flex flex-col justify-between h-28 text-center">
          <p className="font-bold uppercase text-[8px] text-slate-500 text-left">Very truly yours,</p>
          <PrintSignatures mode={po.mode_of_procurement} settings={settings} />
        </div>
      </div>
    </div>
  );
};

// 3. APPENDIX 62: Inspection and Acceptance Report
export const PrintIAR: React.FC<{ iar: any; supplier: any; department: any; settings?: any }> = ({ iar, supplier, department, settings }) => {
  if (!iar) return null;
  const resolvedSupplier = supplier || iar.supplier || (iar.supplier_name ? { name: iar.supplier_name } : null);

  return (
    <div className="w-full bg-white text-black p-6 font-sans text-[11px] border border-slate-300 shadow-sm leading-tight max-w-[700px] mx-auto print:p-0 print:border-0 print:shadow-none">
      <PrintHeader appendix="Appendix 62" title="INSPECTION AND ACCEPTANCE REPORT" settings={settings} />

      <div className="grid grid-cols-2 border border-black text-[10px] mb-0">
        <div className="border-r border-black p-2 space-y-1">
          <p><span className="font-bold uppercase text-[8px] text-slate-400 block">Supplier:</span> <span className="font-bold text-xs uppercase">{resolvedSupplier?.name || 'Unknown Supplier'}</span></p>
          <p><span className="font-bold uppercase text-[8px] text-slate-400 block">PO Reference:</span> <span className="font-mono font-bold text-blue-700">{iar.po_no}</span></p>
          <p><span className="font-bold uppercase text-[8px] text-slate-400 block">Requisitioning Office:</span> <span className="uppercase font-semibold">{department?.name || 'GSO'}</span></p>
        </div>
        <div className="p-2 space-y-1">
          <p><span className="font-bold uppercase text-[8px] text-slate-400 block">IAR No.:</span> <span className="font-mono font-bold text-xs text-green-700">{iar.iar_no}</span></p>
          <p><span className="font-bold uppercase text-[8px] text-slate-400 block">Invoice No. & Date:</span> <span className="font-mono">{iar.invoice_no}</span> ({iar.invoice_date})</p>
          <p><span className="font-bold uppercase text-[8px] text-slate-400 block">Created On:</span> {iar.created_at?.split('T')[0]}</p>
        </div>
      </div>

      <table className="w-full border-x border-b border-black text-[10px] border-collapse">
        <thead>
          <tr className="border-t border-black bg-slate-50">
            <th className="border-r border-black p-1 w-12 text-center uppercase font-bold">Item No.</th>
            <th className="border-r border-black p-1 w-20 text-center uppercase font-bold">Unit</th>
            <th className="border-r border-black p-1 text-left uppercase font-bold">Description</th>
            <th className="p-1 w-24 text-center uppercase font-bold">Qty Delivered</th>
          </tr>
        </thead>
        <tbody>
          {iar.items?.map((item: any, idx: number) => (
            <tr key={item.id || idx} className="border-t border-black/20 h-8">
              <td className="border-r border-black p-1 text-center">{idx + 1}</td>
              <td className="border-r border-black p-1 text-center uppercase font-serif italic">{item.unit || 'unit'}</td>
              <td className="border-r border-black p-1">{item.description || 'Supplied item details'}</td>
              <td className="p-1 text-center font-bold text-green-700 font-mono text-xs">{item.quantity_delivered}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 3 - (iar.items?.length || 0)) }).map((_, i) => (
            <tr key={`pad-${i}`} className="border-t border-black/10 h-8">
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black text-center text-slate-300 italic">Nothing follows...</td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TWO DISTINCT SIGN-OFF SECTIONS */}
      <div className="grid grid-cols-2 border-x border-b border-black text-[10px] min-h-40">
        <div className="border-r border-black p-3 flex flex-col justify-between">
          <div className="space-y-2">
            <p className="font-bold uppercase text-[9px] text-green-700">INSPECTION BOX</p>
            <p className="text-[9px] text-slate-500">Inspected, verified, and found compliant as to quantity, specifications, and physical conditions.</p>
            {iar.inspection_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[9px] italic text-slate-600">
                "{iar.inspection_remarks}"
              </div>
            )}
            <div className="flex gap-2 pt-1 text-[9px]">
              <span>Date Inspected:</span>
              <span className="font-semibold underline">{iar.date_inspected || 'Pending'}</span>
            </div>
          </div>
          <div className="text-center mt-6">
            <p className="font-bold underline uppercase">{iar.inspected_by || settings?.gso_officer_name || 'Arthur N. Ramos'}</p>
            <p className="text-[8px] text-slate-500">Inspection & Appraisal Committee</p>
          </div>
        </div>

        <div className="p-3 flex flex-col justify-between">
          <div className="space-y-2">
            <p className="font-bold uppercase text-[9px] text-blue-700">ACCEPTANCE BOX</p>
            <p className="text-[9px] text-slate-500">Received complete / partial delivery in good condition, turned over for stock logging and asset tags.</p>
            {iar.acceptance_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[9px] italic text-slate-600">
                "{iar.acceptance_remarks}"
              </div>
            )}
            <div className="flex gap-2 pt-1 text-[9px]">
              <span>Date Accepted:</span>
              <span className="font-semibold underline">{iar.date_accepted || 'Pending'}</span>
            </div>
          </div>
          <div className="text-center mt-6">
            <p className="font-bold underline uppercase">{iar.accepted_by || settings?.gso_officer_name || 'Arthur N. Ramos'}</p>
            <p className="text-[8px] text-slate-500">Municipal GSO Supply Officer</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. INVENTORY CUSTODIAN SLIP (ICS) / PROPERTY ACKNOWLEDGMENT RECEIPT (PAR)
export const PrintICSorPAR: React.FC<{ asset: any; department: any; settings?: any }> = ({ asset, department, settings }) => {
  if (!asset) return null;
  const isPAR = asset.type === 'PAR';

  return (
    <div className="w-full bg-white text-black p-6 font-sans text-[11px] border border-slate-300 shadow-sm leading-tight max-w-[700px] mx-auto print:p-0 print:border-0 print:shadow-none">
      <PrintHeader
        appendix={isPAR ? "Appendix 63" : "Appendix 59"}
        title={isPAR ? "PROPERTY ACKNOWLEDGMENT RECEIPT" : "INVENTORY CUSTODIAN SLIP"}
        settings={settings}
      />

      <div className="border border-black text-[10px] p-2 bg-slate-50 mb-0 flex justify-between items-center">
        <div>
          <span className="font-bold uppercase text-[8px] text-slate-500 block">LGU Asset Class:</span>
          <span className="font-bold text-xs text-indigo-700 uppercase">{isPAR ? 'Capitalized Fixed Asset (PAR)' : 'Semi-Expendable Equipment (ICS)'}</span>
        </div>
        <div className="text-right">
          <span className="font-bold uppercase text-[8px] text-slate-500 block">Property / Asset ID No.:</span>
          <span className="font-mono font-bold text-xs">{asset.property_no}</span>
        </div>
      </div>

      <table className="w-full border-x border-b border-black text-[10px] border-collapse">
        <thead>
          <tr className="border-t border-black bg-slate-100">
            <th className="border-r border-black p-1 w-16 text-center uppercase font-bold">Qty</th>
            <th className="border-r border-black p-1 w-16 text-center uppercase font-bold">Unit</th>
            <th className="border-r border-black p-1 text-left uppercase font-bold">Description / Brand / Serial No.</th>
            <th className="border-r border-black p-1 w-28 text-right uppercase font-bold">Acquisition Cost</th>
            <th className="p-1 w-24 text-center uppercase font-bold">Acquisition Date</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-black h-20">
            <td className="border-r border-black p-1.5 text-center font-bold">1</td>
            <td className="border-r border-black p-1.5 text-center uppercase italic">{asset.unit}</td>
            <td className="border-r border-black p-1.5">
              <p className="font-bold text-xs">{asset.description}</p>
              <p className="text-[9px] text-slate-500 mt-1">LGU GSO Standard Property Tag Applied. Accountable department assigned.</p>
            </td>
            <td className="border-r border-black p-1.5 text-right font-mono text-xs font-bold text-blue-700">₱{Number(asset.cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td className="p-1.5 text-center font-mono">{asset.date_acquired}</td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-2 border-x border-b border-black text-[10px] h-28">
        <div className="border-r border-black p-3 flex flex-col justify-between">
          <div>
            <p className="font-bold uppercase text-[8px] text-slate-500">Received By (Accountable Officer):</p>
            <p className="text-[9px] text-slate-500 mt-1">I acknowledge physical custody and accountabilities for the property detailed above.</p>
          </div>
          <div className="text-center mt-auto">
            <p className="font-bold underline uppercase">{asset.receiver_name}</p>
            <p className="text-[8px] text-slate-500">{asset.receiver_designation} - {department?.code || 'Dept'}</p>
          </div>
        </div>

        <div className="p-3 flex flex-col justify-between">
          <div>
            <p className="font-bold uppercase text-[8px] text-slate-500">Issued By (Supply Officer):</p>
            <p className="text-[9px] text-slate-500 mt-1">Property registered in GSO ledger and handed over to end-user division.</p>
          </div>
          <div className="text-center mt-auto">
            <p className="font-bold underline uppercase">{asset.issuer_name || settings?.gso_officer_name || 'Arthur N. Ramos'}</p>
            <p className="text-[8px] text-slate-500">GSO Property Custodian</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. NOTICE TO PROCEED (NTP) Letter
export const PrintNTP: React.FC<{ po: any; supplier: any; department: any; settings?: any }> = ({ po, supplier, department, settings }) => {
  if (!po) return null;
  const resolvedSupplier = supplier || po.supplier || (po.supplier_name ? { name: po.supplier_name, address: po.supplier_address, contact_no: po.supplier_contact_no } : null);
  const ntp = po.ntp || {
    ntp_no: `NTP-${po.po_no?.split('-').slice(1).join('-') || '2026-0001'}`,
    date_issued: po.po_date,
    delivery_period_days: 15,
  };

  return (
    <div className="w-full bg-white text-black p-8 font-sans text-[11.5px] border border-slate-300 shadow-sm leading-relaxed max-w-[700px] mx-auto print:p-0 print:border-0 print:shadow-none font-serif">
      {/* Letterhead */}
      <div className="text-center mb-6">
        <p className="text-[10px] uppercase tracking-wide">Republic of the Philippines</p>
        <p className="text-[10px] font-bold uppercase">{settings?.province_name || 'PROVINCE OF BULACAN'}</p>
        <h4 className="text-[13px] font-bold uppercase tracking-tight text-slate-800 uppercase">{settings?.municipal_name || 'MUNICIPALITY OF SAN JOSE'}</h4>
        <div className="w-12 h-0.5 bg-black mx-auto my-1"></div>
        <p className="text-[11px] font-semibold uppercase">Office of the Municipal Mayor</p>
      </div>

      {/* Date */}
      <div className="mb-6 text-right">
        <p className="font-semibold">{ntp.date_issued || po.po_date}</p>
      </div>

      {/* Supplier Address */}
      <div className="mb-6 space-y-1">
        <p className="font-bold uppercase text-xs">{resolvedSupplier?.name || 'Unknown Supplier'}</p>
        <p className="text-slate-700">{resolvedSupplier?.address || 'San Jose, Bulacan'}</p>
        <p className="text-slate-700">Contact: {resolvedSupplier?.contact_no || resolvedSupplier?.contact_number || 'N/A'}</p>
      </div>

      {/* Subject */}
      <div className="mb-6 border-y border-black/10 py-2">
        <p className="font-bold text-center text-xs tracking-wider uppercase">NOTICE TO PROCEED</p>
      </div>

      {/* Salutation */}
      <p className="mb-4">Dear Sir / Madame:</p>

      {/* Letter Body */}
      <div className="space-y-4 text-justify">
        <p>
          The attached Contract / Purchase Order having been approved, notice is hereby given to{' '}
          <span className="font-bold uppercase underline">{resolvedSupplier?.name || 'your firm'}</span> that work / delivery
          may commence on the project/purchase:{' '}
          <span className="font-semibold">
            "{po.items?.[0]?.description || 'Supplies and Equipment Procurement'}"
          </span>{' '}
          under Purchase Order No.{' '}
          <span className="font-mono font-bold text-blue-700">{po.po_no}</span> within{' '}
          <span className="font-bold">{ntp.delivery_period_days || 15} calendar days</span> upon receipt of this notice.
        </p>

        <p>
          Upon receipt of this notice, you are responsible for performing the services / delivering the goods under the
          terms and conditions of the Agreement and in accordance with the standard COA Implementation Schedule.
        </p>

        <p>
          Please acknowledge receipt and acceptance of this notice by signing both copies in the space provided below.
          Keep one copy and return the other to the General Services Office (GSO) of the {settings?.municipal_name || 'Municipality of San Jose'}.
        </p>
      </div>

      {/* Mayor's Signature */}
      <div className="mt-10 flex justify-between">
        <div className="w-1/2"></div>
        <div className="w-1/2 text-center space-y-1">
          <p className="text-left text-[10px] text-slate-500 uppercase">Very truly yours,</p>
          <div className="h-10"></div>
          <p className="font-bold underline uppercase">{settings?.mayor_name || 'HON. Johnielle Keith Pasion Nieto'}</p>
          <p className="text-[10px] text-slate-500">Municipal Mayor</p>
        </div>
      </div>

      {/* Conforme Block */}
      <div className="mt-10 border-t border-dashed border-slate-400 pt-6">
        <p className="font-bold text-[9px] uppercase tracking-wider text-slate-500 mb-4">Conforme / Receipt Acknowledged:</p>
        <div className="grid grid-cols-2 gap-8 text-[10px]">
          <div className="space-y-4">
            <div className="border-b border-black h-8"></div>
            <p className="text-center font-semibold text-slate-500">Signature over Printed Name of Bidder/Representative</p>
          </div>
          <div className="space-y-4">
            <div className="border-b border-black h-8"></div>
            <p className="text-center font-semibold text-slate-500">Date Received</p>
          </div>
        </div>
      </div>
    </div>
  );
};
