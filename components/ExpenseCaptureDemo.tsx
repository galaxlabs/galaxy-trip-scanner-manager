import React, { useMemo, useState } from 'react';
import { Language } from '../types';

interface ExpenseCaptureDemoProps {
  lang: Language;
}

type ReviewStatus = 'Draft' | 'Extracted' | 'Needs Review' | 'Reviewed' | 'Ready for Purchase Invoice';

const expenseTypes = ['Fuel', 'Maintenance', 'Oil Change', 'Tyres', 'Spare Parts', 'Washing', 'Parking', 'Toll', 'Insurance', 'Vehicle Registration', 'Workshop Bill', 'Traffic Fine', 'Driver Allowance', 'Other'];
const paidByOptions = ['Company', 'Driver / Captain', 'Customer', 'Other'];
const whatsappNumber = '923003764818';

const ExpenseCaptureDemo: React.FC<ExpenseCaptureDemoProps> = ({ lang }) => {
  const [header, setHeader] = useState({
    company: '',
    vehicle: '',
    driver: '',
    trip: '',
    rentalContract: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    paidBy: paidByOptions[0],
  });
  const [expenseType, setExpenseType] = useState(expenseTypes[0]);
  const [supplier, setSupplier] = useState({
    supplierName: '',
    supplierVatNumber: '',
    externalInvoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
  });
  const [vatIncluded, setVatIncluded] = useState(true);
  const [vatRate, setVatRate] = useState(15);
  const [netInput, setNetInput] = useState('0');
  const [grandInput, setGrandInput] = useState('0');
  const [lastEdited, setLastEdited] = useState<'net' | 'grand'>('grand');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('Draft');
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';

  const amounts = useMemo(() => {
    const rate = Number(vatRate || 0) / 100;
    const net = Number(netInput || 0);
    const grand = Number(grandInput || 0);

    if (vatIncluded) {
      if (lastEdited === 'net') {
        const computedVat = net * rate;
        return {
          netAmount: net,
          vatAmount: computedVat,
          grandTotal: net + computedVat,
        };
      }
      const computedNet = grand / (1 + rate || 1);
      return {
        netAmount: computedNet,
        vatAmount: grand - computedNet,
        grandTotal: grand,
      };
    }

    if (lastEdited === 'grand') {
      const computedNet = grand / (1 + rate || 1);
      return {
        netAmount: computedNet,
        vatAmount: grand - computedNet,
        grandTotal: grand,
      };
    }

    const computedVat = net * rate;
    return {
      netAmount: net,
      vatAmount: computedVat,
      grandTotal: net + computedVat,
    };
  }, [grandInput, lastEdited, netInput, vatIncluded, vatRate]);

  const extracted = {
    supplier: supplier.supplierName || 'Al Waha Fuel Station',
    invoiceNo: supplier.externalInvoiceNumber || 'SCAN-2026-0042',
    vatDetected: amounts.vatAmount.toFixed(2),
    confidence: reviewStatus === 'Draft' ? '62%' : '94%',
  };

  const feedbackUrl = useMemo(() => {
    const message = [
      'TMS KSA Feedback',
      '',
      'Name:',
      'Mobile:',
      'User Type: Company Staff',
      'Related Area: Expense',
      'Priority: Normal',
      '',
      'Message:',
      `Expense demo feedback for ${expenseType} on ${header.vehicle || 'vehicle not selected'}`,
      '',
      `App Page: ${window.location.href}`,
    ].join('\n');
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }, [expenseType, header.vehicle]);

  return (
    <div className={`p-4 space-y-5 ${fontClass}`}>
      <section className="surface-panel rounded-[2.25rem] p-5 space-y-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,127,143,0.2),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(216,135,22,0.18),transparent_34%)]" />
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--cyan)]">Expense Demo</p>
          <h2 className="text-2xl font-black tracking-tight text-[var(--ink)] mt-2">Vehicle Expense Capture Demo</h2>
          <p className="text-sm text-[var(--ink-soft)]/75 mt-3 leading-6">This screen will later create a middleware Expense Import record. Purchase Invoice will be created only after review.</p>
        </div>
      </section>

      <section className="surface-panel rounded-[2.25rem] p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Company</span><input value={header.company} onChange={(e) => setHeader((prev) => ({ ...prev, company: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Vehicle</span><input value={header.vehicle} onChange={(e) => setHeader((prev) => ({ ...prev, vehicle: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Driver / Captain</span><input value={header.driver} onChange={(e) => setHeader((prev) => ({ ...prev, driver: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Trip</span><input value={header.trip} onChange={(e) => setHeader((prev) => ({ ...prev, trip: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Rental Contract</span><input value={header.rentalContract} onChange={(e) => setHeader((prev) => ({ ...prev, rentalContract: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Expense Date</span><input type="date" value={header.expenseDate} onChange={(e) => setHeader((prev) => ({ ...prev, expenseDate: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
            <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Paid By</span><select value={header.paidBy} onChange={(e) => setHeader((prev) => ({ ...prev, paidBy: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none">{paidByOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          </div>
        </div>
      </section>

      <section className="surface-panel rounded-[2.25rem] p-5 space-y-4">
        <label className="space-y-2 block"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Expense Type</span><select value={expenseType} onChange={(e) => setExpenseType(e.target.value)} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none">{expenseTypes.map((option) => <option key={option}>{option}</option>)}</select></label>
        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Supplier Name</span><input value={supplier.supplierName} onChange={(e) => setSupplier((prev) => ({ ...prev, supplierName: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Supplier VAT Number</span><input value={supplier.supplierVatNumber} onChange={(e) => setSupplier((prev) => ({ ...prev, supplierVatNumber: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">External Invoice Number</span><input value={supplier.externalInvoiceNumber} onChange={(e) => setSupplier((prev) => ({ ...prev, externalInvoiceNumber: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
            <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Invoice Date</span><input type="date" value={supplier.invoiceDate} onChange={(e) => setSupplier((prev) => ({ ...prev, invoiceDate: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          </div>
        </div>
      </section>

      <section className="surface-panel rounded-[2.25rem] p-5 space-y-4">
        <div className="flex items-center justify-between rounded-2xl bg-[var(--paper-soft)] px-4 py-3 border border-[var(--line)]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">VAT Included?</p>
            <p className="text-sm text-[var(--ink-soft)]/75 mt-1">Switch how the demo values are calculated.</p>
          </div>
          <button onClick={() => setVatIncluded((prev) => !prev)} className={`w-16 h-9 rounded-full transition-all ${vatIncluded ? 'bg-[var(--cyan)]' : 'bg-[var(--line)]'}`}>
            <span className={`block w-7 h-7 rounded-full bg-white transition-transform ${vatIncluded ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Net Amount</span><input type="number" value={netInput} onChange={(e) => { setNetInput(e.target.value); setLastEdited('net'); }} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">VAT Rate</span><input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value || 0))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
          <div className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">VAT Amount</p>
            <p className="mt-2 text-xl font-black text-[var(--cyan)]">{amounts.vatAmount.toFixed(2)}</p>
          </div>
          <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Grand Total</span><input type="number" value={grandInput} onChange={(e) => { setGrandInput(e.target.value); setLastEdited('grand'); }} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" /></label>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-[1.5rem] bg-white/80 border border-[var(--line)] px-3 py-4"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ink-soft)]/65">Net</p><p className="mt-2 text-lg font-black text-[var(--ink)]">{amounts.netAmount.toFixed(2)}</p></div>
          <div className="rounded-[1.5rem] bg-white/80 border border-[var(--line)] px-3 py-4"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ink-soft)]/65">VAT</p><p className="mt-2 text-lg font-black text-[var(--cyan)]">{amounts.vatAmount.toFixed(2)}</p></div>
          <div className="rounded-[1.5rem] bg-white/80 border border-[var(--line)] px-3 py-4"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ink-soft)]/65">Grand</p><p className="mt-2 text-lg font-black text-[var(--amber)]">{amounts.grandTotal.toFixed(2)}</p></div>
        </div>
      </section>

      <section className="surface-panel rounded-[2.25rem] p-5 space-y-4">
        <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] bg-white/60 p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Invoice Scan Area</p>
          <div className="grid grid-cols-3 gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
            <button className="surface-muted rounded-2xl px-3 py-4">Upload Invoice Image/PDF</button>
            <button className="surface-muted rounded-2xl px-3 py-4">Scan Invoice</button>
            <button onClick={() => setReviewStatus('Extracted')} className="ink-action rounded-2xl px-3 py-4">Extract Details</button>
          </div>
        </div>
        <div className="rounded-[1.75rem] bg-[var(--ink)] text-[var(--paper-soft)] p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Extracted Result</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-white/45 text-[10px] uppercase font-black tracking-[0.18em]">Supplier detected</p><p className="mt-1 font-bold">{extracted.supplier}</p></div>
            <div><p className="text-white/45 text-[10px] uppercase font-black tracking-[0.18em]">Invoice number detected</p><p className="mt-1 font-bold">{extracted.invoiceNo}</p></div>
            <div><p className="text-white/45 text-[10px] uppercase font-black tracking-[0.18em]">VAT detected</p><p className="mt-1 font-bold">{extracted.vatDetected}</p></div>
            <div><p className="text-white/45 text-[10px] uppercase font-black tracking-[0.18em]">Confidence score</p><p className="mt-1 font-bold">{extracted.confidence}</p></div>
          </div>
        </div>
      </section>

      <section className="surface-panel rounded-[2.25rem] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Review Status</p>
            <h3 className="text-lg font-black text-[var(--ink)] mt-2">{reviewStatus}</h3>
          </div>
          <span className="rounded-full bg-[var(--mint)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--cyan)]">{reviewStatus}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
          <button onClick={() => setReviewStatus('Draft')} className="surface-muted rounded-2xl px-4 py-4">Save Demo Expense</button>
          <button onClick={() => setReviewStatus('Extracted')} className="surface-muted rounded-2xl px-4 py-4">Extract Demo Data</button>
          <button onClick={() => setReviewStatus('Reviewed')} className="surface-muted rounded-2xl px-4 py-4">Mark Reviewed</button>
          <a href={feedbackUrl} target="_blank" rel="noreferrer" className="brand-action rounded-2xl px-4 py-4 text-center">Send Feedback</a>
        </div>
      </section>
    </div>
  );
};

export default ExpenseCaptureDemo;
