import React, { useEffect, useState } from 'react';
import { Language, TripInvoice } from '../types';
import { FrappeClient } from '../services/frappe';

interface TripInvoiceFormProps {
  invoiceName: string;
  lang: Language;
  onBack: () => void;
}

const TripInvoiceForm: React.FC<TripInvoiceFormProps> = ({ invoiceName, lang, onBack }) => {
  const [invoice, setInvoice] = useState<TripInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';

  useEffect(() => {
    const loadInvoice = async () => {
      setLoading(true);
      try {
        const doc = await FrappeClient.getTripInvoice(invoiceName);
        setInvoice(doc);
      } catch (err: any) {
        setMessage(err.message || "Failed to load Trip Invoice");
      } finally {
        setLoading(false);
      }
    };
    loadInvoice();
  }, [invoiceName]);

  const updateInvoice = (patch: Partial<TripInvoice>) => {
    setInvoice(prev => prev ? { ...prev, ...patch } : prev);
  };

  const updateItem = (idx: number, patch: Record<string, any>) => {
    setInvoice(prev => {
      if (!prev) return prev;
      const items = [...(prev.items || [])];
      items[idx] = { ...items[idx], ...patch };
      return { ...prev, items };
    });
  };

  const saveInvoice = async () => {
    if (!invoice) return;
    setSaving(true);
    setMessage("");
    try {
      const saved = await FrappeClient.saveDoc('Trip Invoice', invoice);
      setInvoice(saved);
      setMessage("Trip Invoice saved.");
    } catch (err: any) {
      setMessage(err.message || "Failed to save Trip Invoice");
    } finally {
      setSaving(false);
    }
  };

  const markReady = async () => {
    if (!invoice?.name) return;
    setSaving(true);
    setMessage("");
    try {
      await FrappeClient.markTripInvoiceReady(invoice.name);
      const latest = await FrappeClient.getTripInvoice(invoice.name);
      setInvoice(latest);
      setMessage("Trip Invoice is ready.");
    } catch (err: any) {
      setMessage(err.message || "Failed to mark ready");
    } finally {
      setSaving(false);
    }
  };

  const printInvoice = () => {
    if (!invoice?.name) return;
    window.open(FrappeClient.getPrintUrl('Trip Invoice', invoice.name, 'Trip Invoice POS'), '_blank');
  };

  if (loading) {
    return (
      <div className={`min-h-full bg-slate-50 p-6 ${fontClass}`}>
        <button onClick={onBack} className="mb-6 text-xs font-black text-slate-500 uppercase">Back</button>
        <div className="py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Trip Invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className={`min-h-full bg-slate-50 p-6 ${fontClass}`}>
        <button onClick={onBack} className="mb-6 text-xs font-black text-slate-500 uppercase">Back</button>
        <div className="bg-red-50 border border-red-100 rounded-3xl p-6 text-xs font-bold text-red-600">{message || "Trip Invoice not found"}</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-50 pb-28 ${fontClass}`}>
      <div className="px-4 py-6 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xl z-30 border-b border-slate-100 shadow-sm">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-2xl active:scale-90 transition-all">
          <svg className={`w-6 h-6 ${lang !== 'en' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex-1 px-4 text-center min-w-0">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Trip Invoice</h2>
          <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight">{invoice.name}</p>
        </div>
        <button onClick={saveInvoice} disabled={saving} className="px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase bg-slate-900 text-white shadow-lg shadow-slate-200 disabled:opacity-50">
          {saving ? "Saving" : "Save"}
        </button>
      </div>

      {message && (
        <div className="mx-4 mt-4 bg-white border border-slate-100 rounded-2xl p-4 text-[10px] font-black text-slate-600 uppercase">
          {message}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Details</h3>
            <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-100 text-slate-600">{invoice.status || "Draft"}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Passenger</span>
              <input value={invoice.invoice_passenger_name || ''} onChange={(e) => updateInvoice({ invoice_passenger_name: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none" />
            </label>
            <label className="space-y-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mobile</span>
              <input value={invoice.invoice_passenger_mobile || ''} onChange={(e) => updateInvoice({ invoice_passenger_mobile: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[8px] font-black text-slate-300 uppercase">Net</p>
              <p className="text-xs font-black text-slate-900">{invoice.net_total ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[8px] font-black text-slate-300 uppercase">VAT</p>
              <p className="text-xs font-black text-slate-900">{invoice.vat_amount ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[8px] font-black text-slate-300 uppercase">Total</p>
              <p className="text-xs font-black text-slate-900">{invoice.grand_total ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Items</h3>
          <div className="space-y-4">
            {(invoice.items || []).map((item, idx) => (
              <div key={idx} className="bg-slate-50 rounded-[2rem] p-5 border border-slate-100 space-y-4">
                <input value={item.description || ''} onChange={(e) => updateItem(idx, { description: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none" placeholder="Description" />
                <div className="grid grid-cols-3 gap-3">
                  <input type="number" value={item.qty ?? ''} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) || 0 })} className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none" placeholder="Qty" />
                  <input type="number" value={item.rate ?? ''} onChange={(e) => updateItem(idx, { rate: Number(e.target.value) || 0 })} className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none" placeholder="Rate" />
                  <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 text-xs font-black text-slate-700">{item.total_amount ?? 0}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          {invoice.status !== "Ready" && (
            <button onClick={markReady} disabled={saving} className="bg-emerald-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase disabled:opacity-50">Mark Ready</button>
          )}
          <button onClick={printInvoice} className="bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase">Print Invoice</button>
        </div>
      </div>
    </div>
  );
};

export default TripInvoiceForm;
