import React, { useEffect, useState } from 'react';
import type { Language, TripInvoice } from '../types';
import { FrappeClient } from '../services/frappe';

interface TripInvoiceViewerProps {
  invoiceName: string;
  lang: Language;
  onBack: () => void;
}

const money = (value?: number) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const TripInvoiceViewer: React.FC<TripInvoiceViewerProps> = ({ invoiceName, lang, onBack }) => {
  const [invoice, setInvoice] = useState<TripInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';

  useEffect(() => {
    let active = true;

    const loadInvoice = async () => {
      setLoading(true);
      setError('');
      try {
        const doc = await FrappeClient.getTripInvoice(invoiceName);
        if (!active) return;
        if (doc?.status !== 'Ready') {
          setError('Only Ready Trip Invoices can be opened here.');
          return;
        }
        setInvoice(doc);
      } catch (err: any) {
        if (active) setError(err?.message || 'Failed to load Trip Invoice');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInvoice();
    return () => {
      active = false;
    };
  }, [invoiceName]);

  const printInvoice = () => {
    if (!invoice?.name) return;
    window.open(FrappeClient.getPrintUrl('Trip Invoice', invoice.name, 'Trip Invoice POS'), '_blank');
  };

  return (
    <div className={`min-h-full pb-28 ${fontClass}`}>
      <header className="surface-panel sticky top-0 z-30 flex items-center gap-3 rounded-[1.75rem] p-4">
        <button
          type="button"
          onClick={onBack}
          className="surface-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[var(--ink)]"
          aria-label="Back to filtered invoices"
        >
          <svg className={`h-5 w-5 ${lang !== 'en' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/55">Ready Trip Invoice</p>
          <h2 className="mt-1 truncate text-sm font-black text-[var(--ink)]">{invoiceName}</h2>
        </div>
        <span className="rounded-full bg-[var(--mint)] px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--cyan)]">
          Read only
        </span>
      </header>

      {loading ? (
        <div className="py-20 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/60">
          Loading invoice
        </div>
      ) : error || !invoice ? (
        <div className="surface-panel mt-5 rounded-[2rem] p-6 text-center text-sm font-bold text-[var(--danger)]">
          {error || 'Trip Invoice not found'}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <section className="surface-panel rounded-[2rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ink-soft)]/55">Passenger</p>
                <h3 className="mt-2 truncate text-lg font-black text-[var(--ink)]">
                  {invoice.invoice_passenger_name || invoice.customer || 'Walk-in'}
                </h3>
              </div>
              <span className="rounded-full bg-[var(--mint)] px-3 py-2 text-[9px] font-black uppercase text-[var(--cyan)]">
                Ready
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-[var(--ink-soft)]">
              <p>Trip: <span className="font-black text-[var(--ink)]">{invoice.trip || '-'}</span></p>
              <p>Date: <span className="font-black text-[var(--ink)]">{invoice.invoice_date || '-'}</span></p>
              <p>Route: <span className="font-black text-[var(--ink)]">{invoice.trip_route || '-'}</span></p>
              <p>Distance: <span className="font-black text-[var(--ink)]">{invoice.distance || 0}</span></p>
              <p>VAT Mode: <span className="font-black text-[var(--ink)]">{invoice.vat_mode || 'Included'}</span></p>
              <p>VAT Rate: <span className="font-black text-[var(--ink)]">{invoice.vat_rate ?? 15}%</span></p>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-3">
            <div className="surface-panel rounded-[1.5rem] p-4 text-center">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--ink-soft)]/50">Net</p>
              <p className="mt-2 text-sm font-black text-[var(--ink)]">{money(invoice.net_total)}</p>
            </div>
            <div className="surface-panel rounded-[1.5rem] p-4 text-center">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--ink-soft)]/50">VAT</p>
              <p className="mt-2 text-sm font-black text-[var(--cyan)]">{money(invoice.vat_amount)}</p>
            </div>
            <div className="surface-panel rounded-[1.5rem] p-4 text-center">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--ink-soft)]/50">Total</p>
              <p className="mt-2 text-sm font-black text-[var(--amber)]">{money(invoice.grand_total)}</p>
            </div>
          </section>

          {Boolean(invoice.items?.length) && (
            <section className="surface-panel rounded-[2rem] p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/55">Invoice Items</p>
              <div className="mt-4 space-y-3">
                {invoice.items?.map((item, index) => (
                  <div key={item.name || index} className="surface-muted rounded-[1.5rem] p-4">
                    <p className="font-black text-[var(--ink)]">{item.description || item.item_name || 'Trip service'}</p>
                    <div className="mt-2 flex justify-between gap-3 text-sm text-[var(--ink-soft)]">
                      <span>{item.qty || 0} x {money(item.rate)}</span>
                      <span className="font-black text-[var(--ink)]">{money(item.total_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={printInvoice}
            className="ink-action w-full rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Print Invoice
          </button>
        </div>
      )}
    </div>
  );
};

export default TripInvoiceViewer;
