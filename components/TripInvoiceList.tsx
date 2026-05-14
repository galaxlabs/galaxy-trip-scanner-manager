import React, { useEffect, useState } from 'react';
import { Language, TripInvoice } from '../types';
import { FrappeClient } from '../services/frappe';
import TripInvoiceForm from './TripInvoiceForm';
import { translations } from '../translations';

type TimeFilter = 'today' | 'recent' | 'archived';

interface TripInvoiceListProps {
  lang: Language;
}

const TripInvoiceList: React.FC<TripInvoiceListProps> = ({ lang }) => {
  const [invoices, setInvoices] = useState<TripInvoice[]>([]);
  const [selectedInvoiceName, setSelectedInvoiceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<TimeFilter>('today');
  const t = translations[lang];
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';
  const todayKey = new Date().toISOString().slice(0, 10);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await FrappeClient.getList(
        'Trip Invoice',
        {},
        ['name', 'creation', 'invoice_date', 'trip', 'status', 'grand_total', 'invoice_passenger_name'],
        500
      );
      setInvoices(res.message || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Trip Invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const toDateKey = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
  };
  const daysAgo = (dateKey: string) => {
    const today = new Date(`${todayKey}T00:00:00`);
    const date = new Date(`${dateKey}T00:00:00`);
    return Math.floor((today.getTime() - date.getTime()) / 86400000);
  };
  const invoiceDateKey = (invoice: TripInvoice) => toDateKey(invoice.invoice_date || invoice.creation);
  const todayInvoices = invoices.filter((invoice) => invoiceDateKey(invoice) === todayKey);
  const recentInvoices = invoices.filter((invoice) => {
    const age = daysAgo(invoiceDateKey(invoice));
    return age > 0 && age <= 2;
  });
  const archivedInvoices = invoices.filter((invoice) => daysAgo(invoiceDateKey(invoice)) > 2);
  const visibleInvoices = invoiceFilter === 'today' ? todayInvoices : invoiceFilter === 'recent' ? recentInvoices : archivedInvoices;
  const filterTitle = invoiceFilter === 'today' ? t.todayTripInvoices : invoiceFilter === 'recent' ? t.recentTripInvoices : t.archivedTripInvoices;
  const filterCards = [
    { key: 'today' as const, label: t.today, count: todayInvoices.length },
    { key: 'recent' as const, label: t.recent, count: recentInvoices.length },
    { key: 'archived' as const, label: t.archived, count: archivedInvoices.length },
  ];

  if (selectedInvoiceName) {
    return (
      <TripInvoiceForm
        invoiceName={selectedInvoiceName}
        lang={lang}
        onBack={async () => {
          setSelectedInvoiceName(null);
          await fetchInvoices();
        }}
      />
    );
  }

  return (
    <div className={`p-4 space-y-6 ${fontClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">{t.tripInvoices}</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{filterTitle}</p>
        </div>
        <button onClick={fetchInvoices} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 transition-all active:scale-90">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      <section className="grid grid-cols-3 gap-3">
        {filterCards.map((card) => {
          const isActive = invoiceFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setInvoiceFilter(card.key)}
              className={`rounded-2xl p-4 text-center transition-all active:scale-95 ${isActive ? 'filter-card-active' : 'filter-card'}`}
            >
              <p className={`text-[8px] font-black uppercase ${isActive ? 'text-white/50' : 'text-slate-300'}`}>{card.label}</p>
              <p className="text-lg font-black">{card.count}</p>
            </button>
          );
        })}
      </section>

      {loading ? (
        <div className="py-20 text-center space-y-4">
          <div className="inline-block w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{t.loadingInvoices}</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500 bg-red-50 rounded-[2.5rem] p-6 border border-red-100">
          <p className="text-xs font-black uppercase mb-1">{t.error}</p>
          <p className="text-[10px] text-red-400 mb-4">{error}</p>
          <button onClick={fetchInvoices} className="px-6 py-2 bg-[var(--danger)] text-white rounded-xl text-[10px] font-black uppercase">{t.retry}</button>
        </div>
      ) : visibleInvoices.length === 0 ? (
        <div className="py-16 text-center bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem]">
          <p className="text-xs font-black text-slate-300 uppercase">{t.noRecords.replace('{label}', filterTitle)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleInvoices.map((invoice) => (
            <button
              key={invoice.name}
              onClick={() => invoice.name && setSelectedInvoiceName(invoice.name)}
              className="w-full bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm text-left rtl:text-right active:scale-[0.99] transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-900 uppercase truncate">{invoice.name}</p>
                  <p className="text-[9px] font-black data-accent uppercase mt-2 truncate">{t.tripLabel}: {invoice.trip || '-'}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 truncate">{invoice.invoice_passenger_name || t.tripInvoices}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-900">{invoice.grand_total ?? 0}</p>
                  <p className="text-[8px] font-black text-[var(--cyan)] uppercase mt-1">{invoice.status || t.draft}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TripInvoiceList;
