
import React, { useState, useEffect } from 'react';
import { Trip, Route, Language } from '../types';
import { FrappeClient, isFrappeCheckEnabled } from '../services/frappe';
import { translations } from '../translations';

type TimeFilter = 'today' | 'recent' | 'archived';
type TripInvoiceMeta = {
  status?: string;
  kashf_ready?: unknown;
  grand_total?: number;
};

interface DashboardProps {
  onCreateNew: (initialData?: Partial<Trip>) => void;
  onEditTrip: (trip: Trip) => void;
  lang: Language;
}

const Dashboard: React.FC<DashboardProps> = ({ onCreateNew, onEditTrip, lang }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [tripInvoiceMeta, setTripInvoiceMeta] = useState<Record<string, TripInvoiceMeta>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tripFilter, setTripFilter] = useState<TimeFilter>('today');
  const t = translations[lang];
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripsRes, routesRes] = await Promise.all([
        FrappeClient.getList('Trip', {}, [
          'name', 'creation', 'trip_status', 'from_location', 'to_location', 'departure', 'driver', 'assigned_vehicle', 'trip_route', 'distance', 'duration_minutes', 'trip_value', 'billing_mode', 'trip_invoice', 'trip_invoice_created'
        ], 100),
        FrappeClient.getList('Route', {}, ['name', 'from_place_full', 'to_place_full', 'distance', 'duration_minutes', 'return_route', 'route_value'], 100)
      ]);
      const nextTrips = tripsRes.message || [];
      setTrips(nextTrips);
      setRoutes(routesRes.message || []);

      const invoiceNames = nextTrips.map((trip: Trip) => trip.trip_invoice).filter(Boolean);
      if (invoiceNames.length) {
        const invoicesRes = await FrappeClient.getList(
          'Trip Invoice',
          [['name', 'in', invoiceNames]],
          ['name', 'status', 'kashf_ready', 'grand_total'],
          invoiceNames.length
        );
        const metaMap = Object.fromEntries(
          (invoicesRes.message || []).map((invoice: any) => [
            invoice.name,
            {
              status: invoice.status,
              kashf_ready: invoice.kashf_ready,
              grand_total: invoice.grand_total,
            },
          ])
        );
        setTripInvoiceMeta(metaMap);
      } else {
        setTripInvoiceMeta({});
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const closeMenu = () => setActiveMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const prepareRecordData = async (tripName: string) => {
    const fullDoc = (await FrappeClient.getDoc('Trip', tripName)).message;
    return {
        driver: fullDoc.driver,
        assigned_vehicle: fullDoc.assigned_vehicle,
        trip_route: fullDoc.trip_route,
        from_location: fullDoc.from_location,
        to_location: fullDoc.to_location,
        distance: fullDoc.distance,
        trip_value: fullDoc.trip_value,
        duration_minutes: fullDoc.duration_minutes,
        passengers: fullDoc.passengers?.map(({ name, parent, parentfield, parenttype, doctype, owner, creation, modified, ...rest }: any) => rest),
        trip_status: 'Scheduled',
        departure: new Date().toISOString().split('T')[0]
    };
  };

  const handleDuplicate = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    setActiveMenu(null);
    try {
      const newData = await prepareRecordData(trip.name!);
      onCreateNew(newData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReturnAction = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    setActiveMenu(null);
    try {
      const baseData = await prepareRecordData(trip.name!);
      const returnData: Partial<Trip> = {
          ...baseData,
          from_location: baseData.to_location,
          to_location: baseData.from_location,
          is_return_trip: 1
      };
      const matchingRoute = routes.find(r => 
        r.from_place_full === baseData.to_location && 
        r.to_place_full === baseData.from_location
      );
      if (matchingRoute) {
          returnData.trip_route = matchingRoute.name;
          returnData.distance = matchingRoute.distance;
          returnData.duration_minutes = matchingRoute.duration_minutes;
          returnData.trip_value = matchingRoute.route_value || baseData.trip_value;
      } else {
          returnData.trip_route = "";
      }
      onCreateNew(returnData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTripInvoice = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    if (!trip.name || trip.trip_invoice) return;
    setActionLoading(`invoice:${trip.name}`);
    try {
      await FrappeClient.createTripInvoiceFromTrip(trip.name);
      await fetchData();
      setActiveMenu(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrintTrip = (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    if (!trip.name) return;
    setActiveMenu(null);
    window.open(FrappeClient.getPrintUrl('Trip', trip.name, 'Trip'), '_blank');
  };

  const handlePrintInvoice = (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    if (!trip.trip_invoice) return;
    setActiveMenu(null);
    window.open(FrappeClient.getPrintUrl('Trip Invoice', trip.trip_invoice, 'Trip Invoice POS'), '_blank');
  };

  const getInvoiceMeta = (trip: Trip) => trip.trip_invoice ? tripInvoiceMeta[trip.trip_invoice] : undefined;
  const canPrintInvoice = (trip: Trip) => {
    const meta = getInvoiceMeta(trip);
    return Boolean(trip.trip_invoice && meta?.status === 'Ready' && Number(meta?.grand_total || 0) > 0);
  };

  const getInvoiceStatusLabel = (trip: Trip) =>
    trip.trip_invoice
      ? (getInvoiceMeta(trip)?.status === 'Ready' && isFrappeCheckEnabled(getInvoiceMeta(trip)?.kashf_ready) ? t.readyForKashf : (getInvoiceMeta(trip)?.status || t.tripInvoiceDraft))
      : t.noTripInvoice;

  const todayKey = new Date().toISOString().slice(0, 10);
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
  const tripDateKey = (trip: Trip) => toDateKey(trip.departure || trip.creation);
  const todayTrips = trips.filter((trip) => tripDateKey(trip) === todayKey);
  const recentTrips = trips.filter((trip) => {
    const age = daysAgo(tripDateKey(trip));
    return age > 0 && age <= 2;
  });
  const archivedTrips = trips.filter((trip) => daysAgo(tripDateKey(trip)) > 2);
  const visibleTrips = tripFilter === 'today' ? todayTrips : tripFilter === 'recent' ? recentTrips : archivedTrips;
  const filterTitle = tripFilter === 'today' ? t.todayTrips : tripFilter === 'recent' ? t.recentTrips : t.archivedTrips;
  const filterCards = [
    { key: 'today' as const, label: t.todayTrips, count: todayTrips.length },
    { key: 'recent' as const, label: t.recentTrips, count: recentTrips.length },
    { key: 'archived' as const, label: t.archived, count: archivedTrips.length },
  ];

  return (
    <div className={`p-4 space-y-6 ${fontClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">{t.activeFleet}</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{filterTitle}</p>
        </div>
        <button onClick={() => fetchData()} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 transition-all active:scale-90">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      <section className="grid grid-cols-3 gap-3">
        {filterCards.map((card) => {
          const isActive = tripFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setTripFilter(card.key)}
              className={`rounded-2xl p-4 text-center transition-all active:scale-95 ${isActive ? 'filter-card-active' : 'filter-card'}`}
            >
              <p className={`text-[8px] font-black uppercase ${isActive ? 'text-white/50' : 'text-slate-300'}`}>{card.label}</p>
              <p className="text-lg font-black">{card.count}</p>
            </button>
          );
        })}
      </section>

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="inline-block w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{t.syncingTerminal}</p>
          </div>
        ) : error ? (
           <div className="py-12 text-center text-red-500 bg-red-50 rounded-[2.5rem] p-6 border border-red-100">
             <p className="text-xs font-black uppercase mb-1">{t.error}</p>
             <p className="text-[10px] text-red-400 mb-4">{error}</p>
             <button onClick={() => fetchData()} className="px-6 py-2 bg-[var(--danger)] text-white rounded-xl text-[10px] font-black uppercase">{t.retry}</button>
           </div>
        ) : visibleTrips.length === 0 ? (
          <div className="py-16 text-center bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem]">
            <p className="text-xs font-black text-slate-300 uppercase">{t.noRecords.replace('{label}', filterTitle)}</p>
          </div>
        ) : (
          visibleTrips.map((trip) => (
            <div key={trip.name} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm relative transition-all hover:shadow-xl hover:shadow-slate-200/50 group">
              <div className="flex justify-between items-start mb-6">
                <div onClick={() => onEditTrip(trip)} className="cursor-pointer">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">{t.recordRef}</span>
                  <p className="text-xs font-black text-slate-900 mt-1 tracking-tighter">{trip.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase ${trip.trip_status === 'Scheduled' ? 'bg-amber-100 text-amber-700 shadow-sm shadow-amber-100' : 'bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-100'}`}>
                    {trip.trip_status}
                  </span>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button 
                        onClick={() => setActiveMenu(activeMenu === trip.name ? null : trip.name!)} 
                        className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${activeMenu === trip.name ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>
                    </button>
                    
                    {activeMenu === trip.name && (
                        <div className={`absolute top-12 z-[100] w-56 bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-black/5 ${lang === 'en' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}>
                            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(null); onEditTrip(trip); }} className="w-full text-left rtl:text-right px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 flex items-center gap-3 uppercase transition-colors">
                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                </div>
                                {t.openTrip}
                            </button>
                            {!trip.trip_invoice && (
                              <button onClick={(e) => handleCreateTripInvoice(e, trip)} disabled={actionLoading === `invoice:${trip.name}`} className="w-full text-left rtl:text-right px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50 uppercase transition-colors disabled:opacity-50">
                                  <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6M9 8h6M5 4h14v16H5z"/></svg>
                                  </div>
                                  {actionLoading === `invoice:${trip.name}` ? t.creating : t.createTripInvoice}
                              </button>
                            )}
                            {canPrintInvoice(trip) && (
                              <>
                                <button onClick={(e) => handlePrintTrip(e, trip)} className="w-full text-left rtl:text-right px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50 uppercase transition-colors">
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z"/></svg>
                                    </div>
                                    {t.printTrip}
                                </button>
                                <button onClick={(e) => handlePrintInvoice(e, trip)} className="w-full text-left rtl:text-right px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50 uppercase transition-colors">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/></svg>
                                    </div>
                                    {t.printInvoice}
                                </button>
                              </>
                            )}
                            <button onClick={(e) => handleDuplicate(e, trip)} className="w-full text-left rtl:text-right px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 flex items-center gap-3 uppercase transition-colors">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2"/></svg>
                                </div>
                                {t.duplicate}
                            </button>
                            <button onClick={(e) => handleReturnAction(e, trip)} className="w-full text-left rtl:text-right px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50 uppercase transition-colors">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3"/></svg>
                                </div>
                                {t.returnTrip}
                            </button>
                        </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div onClick={() => onEditTrip(trip)} className="cursor-pointer space-y-5">
                  <div className="flex gap-5">
                    <div className="flex flex-col items-center pt-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm shadow-blue-400"></div>
                      <div className="w-[2.5px] h-12 bg-slate-100 my-1"></div>
                      <div className="w-3 h-3 rounded-full border-2 border-slate-200"></div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-5">
                      <div>
                        <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{trip.from_location || t.pointOfOrigin}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{trip.to_location || t.destination}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-5 border-t border-slate-50 group-hover:border-slate-100 transition-colors">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter truncate max-w-[140px]">{trip.driver || t.noDriver}</span>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest mb-1">{getInvoiceStatusLabel(trip)}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{trip.departure ? new Date(trip.departure).toLocaleDateString(lang, { day: '2-digit', month: 'short' }) : 'N/A'}</p>
                    </div>
                  </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;
