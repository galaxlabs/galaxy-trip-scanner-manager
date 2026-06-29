import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Language, User } from '../types';
import TripInvoiceViewer from './TripInvoiceViewer';
import {
  DriverVatDashboardData,
  DriverVatDashboardFilters,
  getDriverVatDashboard,
  getSuggestedRange,
} from '../services/driverVatDashboard';

interface DriverVatDashboardProps {
  lang: Language;
  user: User;
}

const initialMonth = new Date().toISOString().slice(0, 7);
const currency = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const defaultFilters = (): DriverVatDashboardFilters => {
  const range = getSuggestedRange('this_month', initialMonth);
  return {
    fromDate: range.fromDate,
    toDate: range.toDate,
    driver: '',
    vatMode: 'Included',
    timeSpan: 'this_month',
    month: initialMonth,
  };
};

const ChartBlock: React.FC<{
  title: string;
  rows: Array<{ label: string; value: number }>;
  accent: string;
}> = ({ title, rows, accent }) => {
  const maxValue = rows.reduce((max, row) => Math.max(max, row.value), 0) || 1;
  return (
    <section className="surface-panel rounded-[2rem] p-4 space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]/55">Chart</p>
        <h3 className="text-lg font-black text-[var(--ink)] mt-2">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--ink-soft)]/70">
          No Ready invoice values in this period.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-[var(--ink)] truncate">{row.label}</span>
                <span className="font-black text-[var(--ink-soft)]">{decimal(row.value)}</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--paper)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(row.value / maxValue) * 100}%`, background: accent }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const DriverVatDashboard: React.FC<DriverVatDashboardProps> = ({ lang, user }) => {
  const [filters, setFilters] = useState<DriverVatDashboardFilters>(() => defaultFilters());
  const [data, setData] = useState<DriverVatDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoiceName, setSelectedInvoiceName] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';

  const loadDashboard = async (nextFilters: DriverVatDashboardFilters) => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getDriverVatDashboard(nextFilters, user);
      if (requestId !== latestRequest.current) return;
      setData(result);
      if (result.context.isStaffView && result.context.selectedStaff) {
        setFilters((current) => ({ ...current, driver: result.context.selectedStaff?.name || '' }));
      }
    } catch (err: any) {
      if (requestId === latestRequest.current) {
        setError(err?.message || 'Failed to load dashboard data');
      }
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(filters);
  }, []);

  const applyTimeSpan = (timeSpan: DriverVatDashboardFilters['timeSpan'], month = filters.month) => {
    const range = getSuggestedRange(timeSpan, month);
    const nextFilters = { ...filters, timeSpan, month, ...range };
    setFilters(nextFilters);
    loadDashboard(nextFilters);
  };

  const updateFilter = <K extends keyof DriverVatDashboardFilters>(
    key: K,
    value: DriverVatDashboardFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const isStaffView = Boolean(data?.context.isStaffView);

  const exportCsv = () => {
    if (!data?.detailRows.length || isStaffView) return;
    const headers = [
      'Invoice No', 'Trip', 'Date', 'Driver', 'Customer',
      'Total KM', 'Trip Value', 'Net Amount', 'VAT Rate', 'VAT Amount', 'Grand Total',
    ];
    const lines = [headers.join(',')];
    for (const row of data.detailRows) {
      lines.push([
        row.invoiceNo, row.trip, row.date, row.driver, row.customer,
        row.totalKm, row.tripValue, row.netAmount, row.vatRate, row.vatAmount, row.grandTotal,
      ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'driver-vat-dashboard.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Ready Trips', value: decimal(data.summary.totalTrips), accent: 'text-[var(--ink)]' },
      { label: 'Total Kilometers', value: decimal(data.summary.totalKilometers), accent: 'text-[var(--cyan)]' },
      { label: 'Total Trip Value', value: currency(data.summary.totalTripValue), accent: 'text-[var(--amber)]' },
      { label: 'Net Before VAT', value: currency(data.summary.totalNetBeforeVat), accent: 'text-[var(--ink)]' },
      { label: 'VAT Amount', value: currency(data.summary.totalVatAmount), accent: 'text-[var(--cyan)]' },
      { label: 'Grand Total', value: currency(data.summary.totalGrandTotal), accent: 'text-[var(--amber)]' },
      { label: 'Active Drivers', value: decimal(data.summary.activeDriversCount), accent: 'text-[var(--ink)]' },
      { label: 'Average Per Trip', value: currency(data.summary.averageValuePerTrip), accent: 'text-[var(--cyan)]' },
    ];
  }, [data]);

  if (selectedInvoiceName) {
    return (
      <TripInvoiceViewer
        invoiceName={selectedInvoiceName}
        lang={lang}
        onBack={() => setSelectedInvoiceName(null)}
      />
    );
  }

  return (
    <div className={`space-y-5 ${fontClass}`}>
      <section className="surface-panel rounded-[2.25rem] p-5 overflow-hidden relative">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[var(--cyan)]/10" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-[var(--mint)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--cyan)]">
              Ready invoices only
            </span>
            {isStaffView && (
              <span className="inline-flex rounded-full bg-[var(--paper)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                Read-only self view
              </span>
            )}
          </div>
          <h2 className="mt-4 text-2xl font-black text-[var(--ink)]">Driver VAT Dashboard</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-soft)]/75">
            Statistics show only Included, Ready Trip Invoices for the selected staff. Draft and cancelled invoices are excluded.
          </p>
        </div>
      </section>

      <section className="surface-panel rounded-[2.25rem] p-5 space-y-4 sticky top-20 z-20">
        <div className="grid grid-cols-2 gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
          <button onClick={() => applyTimeSpan('this_month')} className={`rounded-2xl px-3 py-4 ${filters.timeSpan === 'this_month' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>This Month</button>
          <button onClick={() => applyTimeSpan('last_30_days')} className={`rounded-2xl px-3 py-4 ${filters.timeSpan === 'last_30_days' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>Last 30 Days</button>
          <button onClick={() => applyTimeSpan('this_quarter')} className={`rounded-2xl px-3 py-4 ${filters.timeSpan === 'this_quarter' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>This Quarter</button>
          <button onClick={() => applyTimeSpan('custom', filters.month)} className={`rounded-2xl px-3 py-4 ${filters.timeSpan === 'custom' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>Selected Month</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isStaffView && (
            <label className="col-span-2 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Driver / Staff</span>
              <select value={filters.driver} onChange={(event) => { const nextFilters = { ...filters, driver: event.target.value, vatMode: 'Included' as const }; setFilters(nextFilters); loadDashboard(nextFilters); }} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none">
                <option value="">All drivers</option>
                {data?.options.staff.map((staff) => <option key={staff.name} value={staff.name}>{staff.displayName}</option>)}
              </select>
            </label>
          )}

          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Month</span>
            <select
              value={filters.month}
              onChange={(event) => {
                const month = event.target.value;
                const range = filters.timeSpan === 'custom' ? getSuggestedRange('custom', month) : {};
                setFilters((current) => ({ ...current, month, ...range }));
              }}
              className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none"
            >
              <option value="">Select</option>
              {data?.options.months.map((month) => <option key={month}>{month}</option>)}
            </select>
          </label>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ink-soft)]/55">VAT Mode</p>
            <p className="mt-2 text-sm font-black text-[var(--ink)]">Included</p>
          </div>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">From Date</span>
            <input type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">To Date</span>
            <input type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm outline-none" />
          </label>
        </div>

        <div className={`grid gap-3 text-[10px] font-black uppercase tracking-[0.18em] ${isStaffView ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <button onClick={() => loadDashboard(filters)} className="ink-action rounded-2xl px-4 py-4">Apply Filters</button>
          {!isStaffView && <button onClick={exportCsv} className="surface-muted rounded-2xl px-4 py-4 text-[var(--ink-soft)]">Export CSV</button>}
        </div>
      </section>

      {loading ? (
        <div className="py-20 text-center space-y-4"><div className="inline-block w-8 h-8 border-4 border-[var(--cyan)]/15 border-t-[var(--cyan)] rounded-full animate-spin" /><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Calculating Ready invoices</p></div>
      ) : error ? (
        <div className="surface-panel rounded-[2rem] p-6 text-center"><p className="text-sm font-black text-[var(--danger)]">{error}</p><button onClick={() => loadDashboard(filters)} className="mt-4 rounded-2xl bg-[var(--danger)] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white">Retry</button></div>
      ) : data ? (
        <>
          <section className="grid grid-cols-2 gap-3">
            {summaryCards.map((card) => <div key={card.label} className="surface-panel rounded-[1.8rem] p-4"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--ink-soft)]/55">{card.label}</p><p className={`mt-3 text-lg font-black ${card.accent}`}>{card.value}</p></div>)}
          </section>

          <div className="grid grid-cols-1 gap-4">
            <ChartBlock title="VAT by Driver" rows={data.charts.vatByDriver} accent="linear-gradient(135deg, #0f7f8f, #59c2cf)" />
            <ChartBlock title="Trip Value by Driver" rows={data.charts.tripValueByDriver} accent="linear-gradient(135deg, #d88716, #f2b355)" />
            <ChartBlock title="Trips Count by Driver" rows={data.charts.tripsCountByDriver} accent="linear-gradient(135deg, #12201f, #375753)" />
            <ChartBlock title="Kilometers by Driver" rows={data.charts.kilometersByDriver} accent="linear-gradient(135deg, #8c6b3e, #d1a76c)" />
          </div>

          <section className="surface-panel rounded-[2rem] p-4 space-y-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]/55">Read-only Details</p><h3 className="text-lg font-black text-[var(--ink)] mt-2">Ready Trip Invoice values</h3></div><span className="rounded-full bg-[var(--mint)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--cyan)]">Open in app</span></div>
            <div className="space-y-3">
              {data.detailRows.length === 0 ? <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--ink-soft)]/70">No Ready invoice records in this period.</div> : data.detailRows.map((row) => (
                <button type="button" key={row.invoiceNo} onClick={() => setSelectedInvoiceName(row.invoiceNo)} className="w-full rounded-[1.5rem] bg-white/75 border border-[var(--line)] p-4 space-y-3 text-left rtl:text-right transition-transform active:scale-[0.99]">
                  <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h4 className="font-black text-[var(--ink)] truncate">{row.invoiceNo}</h4><p className="text-sm text-[var(--ink-soft)]/75 truncate">{row.customer}</p></div><span className="text-sm font-black text-[var(--amber)]">{currency(row.grandTotal)}</span></div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-[var(--ink-soft)]">
                    <p>Trip: <span className="font-black text-[var(--ink)]">{row.trip || '-'}</span></p><p>Date: <span className="font-black text-[var(--ink)]">{row.date || '-'}</span></p>
                    <p>Driver: <span className="font-black text-[var(--ink)]">{row.driver}</span></p><p>Total KM: <span className="font-black text-[var(--ink)]">{decimal(row.totalKm)}</span></p>
                    <p>Trip Value: <span className="font-black text-[var(--ink)]">{currency(row.tripValue)}</span></p><p>Net: <span className="font-black text-[var(--ink)]">{currency(row.netAmount)}</span></p>
                    <p>VAT Rate: <span className="font-black text-[var(--ink)]">{decimal(row.vatRate)}%</span></p><p>VAT Amount: <span className="font-black text-[var(--cyan)]">{currency(row.vatAmount)}</span></p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default DriverVatDashboard;
