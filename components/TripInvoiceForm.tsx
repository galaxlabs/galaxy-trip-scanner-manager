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
  const hasPrintableInvoice = Boolean(invoice?.name && invoice.status === "Ready" && Number(invoice?.grand_total || 0) > 0);

  const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const getArabicRouteLabel = (value?: string) => {
    const parts = String(value || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts[1] || parts[0] || "";
  };
  const getRouteDescription = (doc: TripInvoice) => {
    const fromLabel = getArabicRouteLabel(doc.from_location);
    const toLabel = getArabicRouteLabel(doc.to_location);
    return fromLabel && toLabel ? `${fromLabel}-إلى-${toLabel}` : doc.trip_route || "خدمة نقل";
  };

  const makeDefaultItem = (doc: TripInvoice) => ({
    doctype: "Trip Invoice Item" as const,
    source_type: "Trip Route" as const,
    trip: doc.trip,
    route: doc.trip_route,
    description: getRouteDescription(doc),
    qty: doc.billing_mode === "KM Based" && Number(doc.distance || 0) > 0 ? Number(doc.distance) : 1,
    rate:
      doc.billing_mode === "KM Based" && Number(doc.distance || 0) > 0
        ? roundCurrency(Number(doc.trip_value || 0) / Number(doc.distance || 1))
        : Number(doc.trip_value || 0),
    vat_rate: Number(doc.vat_rate || 15),
    vat_category: "Standard 15%" as const,
    is_manual: 0,
  });

  const calculateInvoice = (doc: TripInvoice): TripInvoice => {
    const vatMode = doc.vat_mode || "Included";
    const parentVatRate = Number(doc.vat_rate ?? 15);
    const sourceItems = doc.items?.length ? doc.items : [makeDefaultItem(doc)];

    const items = sourceItems.map((item) => {
      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || 0);
      const grossOrNet = qty * rate;
      const itemVatRate = Number(item.vat_rate ?? parentVatRate);
      const noVat = ["Zero Rated", "Exempt", "Out of Scope"].includes(String(item.vat_category || ""));

      let amount = grossOrNet;
      let vatAmount = 0;
      let totalAmount = grossOrNet;

      if (!noVat && vatMode === "Included") {
        amount = grossOrNet / (1 + itemVatRate / 100);
        vatAmount = grossOrNet - amount;
        totalAmount = grossOrNet;
      } else if (!noVat && vatMode === "Manual VAT") {
        vatAmount = amount * itemVatRate / 100;
        totalAmount = amount + vatAmount;
      }

      return {
        ...item,
        doctype: "Trip Invoice Item" as const,
        qty,
        rate,
        amount: roundCurrency(amount),
        vat_amount: roundCurrency(vatAmount),
        total_amount: roundCurrency(totalAmount),
      };
    });

    return {
      ...doc,
      items,
      net_total: roundCurrency(items.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
      vat_amount: roundCurrency(items.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0)),
      grand_total: roundCurrency(items.reduce((sum, item) => sum + Number(item.total_amount || 0), 0)),
    };
  };

  useEffect(() => {
    const loadInvoice = async () => {
      setLoading(true);
      try {
        const doc = await FrappeClient.getTripInvoice(invoiceName);
        setInvoice(calculateInvoice(doc));
      } catch (err: any) {
        setMessage(err.message || "Failed to load Trip Invoice");
      } finally {
        setLoading(false);
      }
    };
    loadInvoice();
  }, [invoiceName]);

  const updateInvoice = (patch: Partial<TripInvoice>) => {
    setInvoice(prev => prev ? calculateInvoice({ ...prev, ...patch }) : prev);
  };

  const updateTripValue = (value: number) => {
    setInvoice(prev => {
      if (!prev) return prev;
      const nextTripValue = Number(value || 0);
      const sourceItems = prev.items?.length ? [...prev.items] : [makeDefaultItem({ ...prev, trip_value: nextTripValue })];
      const routeIndex = sourceItems.findIndex((item) => (item.source_type || "Trip Route") === "Trip Route" && !item.is_manual);
      const targetIndex = routeIndex >= 0 ? routeIndex : 0;
      const target = sourceItems[targetIndex] || makeDefaultItem(prev);
      const qty = prev.billing_mode === "KM Based" && Number(prev.distance || 0) > 0 ? Number(prev.distance) : Number(target.qty || 1);
      sourceItems[targetIndex] = {
        ...target,
        qty,
        rate: prev.billing_mode === "KM Based" && qty > 0 ? roundCurrency(nextTripValue / qty) : nextTripValue,
        vat_rate: Number(target.vat_rate ?? prev.vat_rate ?? 15),
        vat_category: target.vat_category || "Standard 15%",
      };
      return calculateInvoice({ ...prev, trip_value: nextTripValue, items: sourceItems });
    });
  };

  const updateItem = (idx: number, patch: Record<string, any>) => {
    setInvoice(prev => {
      if (!prev) return prev;
      const items = [...(prev.items || [])];
      items[idx] = { ...items[idx], ...patch };
      return calculateInvoice({ ...prev, items });
    });
  };

  const saveInvoice = async () => {
    if (!invoice) return;
    const calculated = calculateInvoice(invoice);
    if (Number(calculated.grand_total || 0) <= 0) {
      setMessage("Grand Total must be greater than zero before saving.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const saved = await FrappeClient.saveDoc('Trip Invoice', {
        ...calculated,
        doctype: "Trip Invoice",
        status: calculated.status === "Cancelled" ? calculated.status : "Ready",
        kashf_ready: 1,
      });
      setInvoice(calculateInvoice(saved));
      setMessage("Trip Invoice saved.");
    } catch (err: any) {
      setMessage(err.message || "Failed to save Trip Invoice");
    } finally {
      setSaving(false);
    }
  };

  const printInvoice = () => {
    if (!hasPrintableInvoice) {
      setMessage("Save Trip Invoice with Grand Total before printing.");
      return;
    }
    window.open(FrappeClient.getPrintUrl('Trip Invoice', invoice.name!, 'Trip Invoice POS'), '_blank');
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
        <div className="w-10" />
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
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">VAT Mode</span>
              <select value={invoice.vat_mode || 'Included'} onChange={(e) => updateInvoice({ vat_mode: e.target.value as TripInvoice['vat_mode'] })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none appearance-none">
                <option value="Included">Included</option>
                <option value="Manual VAT">Manual Add VAT</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">VAT Rate</span>
              <input type="number" value={invoice.vat_rate ?? 15} onChange={(e) => updateInvoice({ vat_rate: Number(e.target.value) || 15 })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none" />
            </label>
          </div>
          <label className="space-y-2 block">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trip Value</span>
            <input type="number" value={invoice.trip_value ?? ''} onChange={(e) => updateTripValue(Number(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none" />
          </label>
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
                <div className="grid grid-cols-3 gap-2">
                  <label className="space-y-1 min-w-0">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Qty</span>
                    <input type="number" value={item.qty ?? ''} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) || 0 })} className="w-full bg-white border border-slate-100 rounded-2xl px-3 py-3 text-xs font-bold outline-none" placeholder="Qty" />
                  </label>
                  <label className="space-y-1 min-w-0">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Rate</span>
                    <input type="number" value={item.rate ?? ''} onChange={(e) => updateItem(idx, { rate: Number(e.target.value) || 0 })} className="w-full bg-white border border-slate-100 rounded-2xl px-3 py-3 text-xs font-bold outline-none" placeholder="Rate" />
                  </label>
                  <div className="space-y-1 min-w-0">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Total</span>
                    <div className="bg-white border border-slate-100 rounded-2xl px-3 py-3 text-xs font-black text-slate-700 truncate">{item.total_amount ?? 0}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={saveInvoice} disabled={saving} className="bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase disabled:opacity-50">Save Invoice</button>
          <button onClick={printInvoice} disabled={!hasPrintableInvoice} className="bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase disabled:opacity-40">Print Invoice</button>
        </div>
      </div>
    </div>
  );
};

export default TripInvoiceForm;
