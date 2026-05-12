
import React, { useState, useEffect, useRef } from 'react';
import { Trip, Route, Staff, Passenger, Language, TripInvoice } from '../types';
import { FrappeClient, isFrappeCheckEnabled } from '../services/frappe';
import { extractDocumentInfo } from '../services/geminiService';
import { translations } from '../translations';
import TripInvoiceForm from './TripInvoiceForm';

interface TripFormProps {
  trip?: Trip | null;
  onBack: () => void;
  onSave: () => void;
  lang: Language;
}

interface ScanQueue {
    total: number;
    processed: number;
    scanning: boolean;
}

const TripForm: React.FC<TripFormProps> = ({ trip, onBack, onSave, lang }) => {
  const [formData, setFormData] = useState<Trip>(trip || {
    trip_status: 'Scheduled',
    passengers: [],
    departure: new Date().toISOString().split('T')[0],
    billing_mode: "Route Amount",
    vat_mode: "Included",
    vat_rate: 15,
  });
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeSearch, setRouteSearch] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [tripInvoice, setTripInvoice] = useState<TripInvoice | null>(null);
  const [showTripInvoiceForm, setShowTripInvoiceForm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [queue, setQueue] = useState<ScanQueue>({ total: 0, processed: 0, scanning: false });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });
  const [confirmModal, setConfirmModal] = useState<{ title: string; desc: string; action: () => void } | null>(null);
  
  const t = translations[lang];
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const getRouteLabel = (route: Route) =>
    `${route.from_place_full || route.name} -> ${route.to_place_full || ""}${route.route_value ? ` | ${route.route_value}` : ""}`;
  const hasTripInvoice = Boolean(formData.trip_invoice);
  const tripInvoiceAlreadyCreated = isFrappeCheckEnabled(formData.trip_invoice_created) || hasTripInvoice;
  const hasTripValue = Number(formData.trip_value || 0) > 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const routesRes = await FrappeClient.getList('Route', {}, ['name', 'from_place_full', 'to_place_full', 'distance', 'duration_minutes', 'return_route', 'route_value'], 500);
        const staffRes = await FrappeClient.getList('Staff', {}, ['name', 'vehicle_assigned']);
        const nextRoutes = routesRes.message || [];
        setRoutes(nextRoutes);
        setStaff(staffRes.message || []);

        if (trip?.name && !formData.passengers?.length) {
            const fullTrip = await FrappeClient.getDoc('Trip', trip.name);
            const nextTrip = fullTrip.message;
            setFormData({
              billing_mode: "Route Amount",
              vat_mode: "Included",
              vat_rate: 15,
              ...nextTrip,
            });
            const selectedRoute = nextRoutes.find((r: Route) => r.name === nextTrip.trip_route);
            if (selectedRoute) setRouteSearch(getRouteLabel(selectedRoute));
            if (nextTrip.trip_invoice) {
              const invoice = await FrappeClient.getTripInvoice(nextTrip.trip_invoice);
              setTripInvoice(invoice);
            }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [trip]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3000);
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleRouteUpdate = (routeName: string) => {
    const route = routes.find(r => r.name === routeName);
    if (route) {
        setFormData(prev => ({
            ...prev,
            trip_route: routeName,
            distance: route.distance,
            duration_minutes: route.duration_minutes,
            from_location: route.from_place_full,
            to_location: route.to_place_full,
            trip_value: route.route_value || prev.trip_value
        }));
        setRouteSearch(getRouteLabel(route));
        setIsDirty(true);
    }
  };

  const handleRouteSearchChange = (value: string) => {
    setRouteSearch(value);
    const route = routes.find(r => getRouteLabel(r) === value || r.name === value);
    if (route) handleRouteUpdate(route.name);
  };

  const handleDriverUpdate = (driverName: string) => {
    const s = staff.find(x => x.name === driverName);
    setFormData(prev => ({
        ...prev,
        driver: driverName,
        assigned_vehicle: s?.vehicle_assigned || ''
    }));
    setIsDirty(true);
  };

  const execDuplicate = () => {
    const duplicateData: Trip = {
        ...formData,
        name: undefined, 
        trip_status: 'Scheduled',
        departure: new Date().toISOString().split('T')[0],
    };
    setFormData(duplicateData);
    setIsDirty(true);
    setConfirmModal(null);
    showToast(t.duplicateSuccess, "success");
  };

  const execReturnTrip = () => {
    const reverseData: Trip = {
        ...formData,
        name: undefined, 
        from_location: formData.to_location,
        to_location: formData.from_location,
        is_return_trip: 1,
        trip_status: 'Scheduled',
        departure: new Date().toISOString().split('T')[0],
    };

    const matchingRoute = routes.find(r => 
        r.from_place_full === formData.to_location && 
        r.to_place_full === formData.from_location
    );
    
    if (matchingRoute) {
        reverseData.trip_route = matchingRoute.name;
        reverseData.distance = matchingRoute.distance;
        reverseData.duration_minutes = matchingRoute.duration_minutes;
        reverseData.trip_value = matchingRoute.route_value || formData.trip_value;
    } else {
        reverseData.trip_route = ""; 
    }

    setFormData(reverseData);
    setIsDirty(true);
    setConfirmModal(null);
    showToast(t.returnSuccess, "success");
  };

  const isPdfFile = (file: File): boolean =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const isImageFile = (file: File): boolean => file.type.startsWith('image/');

  const normalizeText = (value?: string): string =>
    (value || '')
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();

  const normalizeDocumentNumber = (value?: string): string =>
    normalizeText(value).replace(/[^A-Z0-9]/g, '');

  const getPassengerKey = (p: Passenger): string => {
    const docKey = normalizeDocumentNumber(p.id_no || p.document_number);
    if (docKey) return `DOC:${docKey}`;
    const nameKey = normalizeText(p.passenger_name);
    const mobileKey = normalizeDocumentNumber(p.mobile_no || p.contact_no);
    return `NAME:${nameKey}|MOBILE:${mobileKey}`;
  };

  const mergeUniquePassengers = (existing: Passenger[], incoming: Passenger[]): Passenger[] => {
    const result = [...existing];
    const seen = new Set(result.map(getPassengerKey));

    for (const p of incoming) {
      const key = getPassengerKey(p);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
    return result;
  };

  const processFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const rawBase64 = reader.result as string;
                const imageFile = isImageFile(file);
                const pdfFile = isPdfFile(file);
                const preparedBase64 = imageFile ? await compressImage(rawBase64) : rawBase64;
                const mimeType = pdfFile ? 'application/pdf' : 'image/jpeg';
                let extractedPassengers: any[] = [];
                let extractedTrip: any = {};

                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const result = await extractDocumentInfo(preparedBase64, mimeType);
                        extractedPassengers = result.passengers || [];
                        extractedTrip = result.trip || {};
                        break;
                    } catch (err: any) {
                        const retryAfter = Number(err?.retryAfterSeconds || 0);
                        if (retryAfter > 0 && attempt < 2) {
                            await sleep((retryAfter + 1) * 1000);
                            continue;
                        }
                        throw err;
                    }
                }

                if (extractedPassengers && extractedPassengers.length > 0) {
                    const newPassengers: Passenger[] = extractedPassengers.map(p => ({
                        passenger_name: p.name,
                        document_number: p.passport,
                        nationality: p.nationality,
                        document_type: p.document_type || "Passport",
                        contact_no: p.contact_no,
                        expiry_date: p.expiry_date,
                        source: "OCR",
                        is_auto_filled: 1,
                    }));
                    setFormData(prev => ({
                        ...prev,
                        passengers: mergeUniquePassengers(prev.passengers || [], newPassengers)
                    }));
                    setIsDirty(true);
                } else {
                    if (extractedTrip && Object.keys(extractedTrip).length > 0) {
                        setFormData(prev => ({ ...prev, ...extractedTrip }));
                        setIsDirty(true);
                    }
                }
                resolve();
            } catch (err) {
                console.error("Processing error", err);
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files).filter((file) => isImageFile(file) || isPdfFile(file)) as File[];
    if (fileList.length === 0) {
      showToast(t.invalidUploadType, "error");
      if (e.target) e.target.value = '';
      return;
    }
    setQueue({ total: fileList.length, processed: 0, scanning: true });
    
    let failures = 0;
    let firstError = "";
    for (let i = 0; i < fileList.length; i++) {
        try { 
          await processFile(fileList[i]); 
        } catch (err) { 
          console.error(`Scan error ${i + 1}`, err);
          failures++;
          if (!firstError) {
            const msg = String((err as any)?.message || err || "");
            firstError = msg.slice(0, 180);
          }
        }
        setQueue(q => ({ ...q, processed: i + 1 }));
    }
    
    setQueue(q => ({ ...q, scanning: false }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    
    if (failures > 0) {
        showToast(
          `Failed to process ${failures} file(s)${firstError ? `: ${firstError}` : ""}`,
          "error"
        );
    } else {
        showToast(t.syncSuccess, "success");
    }
  };

  const saveTrip = async () => {
    if (!formData.driver) return showToast(t.selectDriverErr, "error");
    if (!formData.trip_route) return showToast(t.selectRouteErr, "error");
    setLoading(true);
    try {
      const savedDoc = await FrappeClient.saveDoc('Trip', {
        billing_mode: "Route Amount",
        vat_mode: "Included",
        vat_rate: 15,
        ...formData,
      });
      setFormData(savedDoc);
      setIsDirty(false);
      showToast(t.syncSuccess, "success");
    } catch (err: any) {
      showToast(err.message || "Error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!tripInvoice?.name) return;
    window.open(FrappeClient.getPrintUrl('Trip Invoice', tripInvoice.name, 'Trip Invoice POS'), '_blank');
  };

  const printTripSheet = () => {
    if (!formData.name) return showToast(t.savePrintErr, "error");
    if (!hasTripInvoice) return showToast("Create Trip Invoice before printing Trip.", "error");
    window.open(FrappeClient.getPrintUrl('Trip', formData.name, 'Trip'), '_blank');
  };

  const createTripInvoice = async () => {
    if (!formData.name) return showToast(t.savePrintErr, "error");
    if (tripInvoiceAlreadyCreated) {
      return showToast("Trip Invoice already exists.", "error");
    }
    if (!hasTripValue) {
      return showToast("Trip Value is required before creating Trip Invoice.", "error");
    }
    if (formData.billing_mode === "KM Based" && Number(formData.distance || 0) <= 0) {
      return showToast("Distance is required for KM Based billing.", "error");
    }

    setInvoiceLoading(true);
    try {
      const result = await FrappeClient.createTripInvoiceFromTrip(formData.name);
      const invoice = result.trip_invoice ? await FrappeClient.getTripInvoice(result.trip_invoice) : null;
      setFormData(prev => ({
        ...prev,
        trip_invoice_created: 1,
        trip_invoice: result.trip_invoice,
      }));
      setTripInvoice(invoice || {
        name: result.trip_invoice,
        trip: result.trip,
        status: result.status,
        kashf_ready: result.kashf_ready,
      });
      showToast(`Trip Invoice created: ${result.trip_invoice}`, "success");
    } catch (err: any) {
      showToast(err.message || "Error", "error");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const triggerUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const triggerCamera = () => {
    if (cameraInputRef.current) cameraInputRef.current.click();
  };

  if (showTripInvoiceForm && formData.trip_invoice) {
    return (
      <TripInvoiceForm
        invoiceName={formData.trip_invoice}
        lang={lang}
        onBack={async () => {
          setShowTripInvoiceForm(false);
          if (formData.trip_invoice) {
            const invoice = await FrappeClient.getTripInvoice(formData.trip_invoice);
            setTripInvoice(invoice);
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-28 relative">
      {/* Toast Notification */}
      {toast.type && (
          <div className={`fixed top-20 left-4 right-4 z-[100] p-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-300 flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
              <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <p className="text-xs font-black uppercase tracking-widest">{toast.message}</p>
          </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                  <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 uppercase tracking-tighter">{confirmModal.title}</h3>
                  <p className="text-xs text-slate-500 font-medium mb-8 leading-relaxed">{confirmModal.desc}</p>
                  <div className="space-y-2">
                      <button onClick={confirmModal.action} className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">{t.confirmAction}</button>
                      <button onClick={() => setConfirmModal(null)} className="w-full bg-slate-50 text-slate-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">{t.cancel}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Header Bar */}
      <div className="px-4 py-6 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xl z-30 border-b border-slate-100 shadow-sm">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-2xl active:scale-90 transition-all">
          <svg className={`w-6 h-6 ${lang !== 'en' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex-1 px-4 text-center min-w-0">
            <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">{t.terminalEntry}</h2>
            <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight">
                {formData.name || t.draftRecord}
            </p>
        </div>
        <div className="flex items-center gap-1.5">
            <button disabled={loading} onClick={saveTrip} className={`px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg transition-all active:scale-95 ${isDirty ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-900 text-white shadow-slate-200'}`}>
                {loading ? t.syncing : t.save}
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Record Quick Actions */}
        {formData.name && (
            <div className="grid grid-cols-2 gap-4">
                {hasTripInvoice && (
                    <button
                        onClick={printTripSheet}
                        className="bg-white text-slate-700 py-4 rounded-[1.5rem] border border-slate-100 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm group"
                    >
                        <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z"/></svg>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Print Trip</span>
                    </button>
                )}
                <button 
                    onClick={() => setConfirmModal({ title: t.duplicateTrip, desc: t.duplicateDesc, action: execDuplicate })}
                    className="bg-white text-slate-700 py-4 rounded-[1.5rem] border border-slate-100 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm group"
                >
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2"/></svg>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.duplicate}</span>
                </button>
                <button 
                    onClick={() => setConfirmModal({ title: t.returnTripTitle, desc: t.returnTripDesc, action: execReturnTrip })}
                    className="bg-white text-slate-700 py-4 rounded-[1.5rem] border border-slate-100 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm group"
                >
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3"/></svg>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.returnTrip}</span>
                </button>
                {!tripInvoiceAlreadyCreated && (
                    <button
                        onClick={createTripInvoice}
                        disabled={invoiceLoading || !hasTripValue}
                        className="bg-white text-slate-700 py-4 rounded-[1.5rem] border border-slate-100 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm group disabled:opacity-40"
                    >
                        <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12h6m-6 4h6M9 8h6M5 4h14v16H5z"/></svg>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{invoiceLoading ? "Creating..." : "Create Trip Invoice"}</span>
                    </button>
                )}
                {hasTripInvoice && (
                    <button
                        onClick={() => setShowTripInvoiceForm(true)}
                        className="bg-white text-slate-700 py-4 rounded-[1.5rem] border border-slate-100 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm group"
                    >
                        <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7h4m0 0v4m0-4L7 17"/></svg>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Trip Invoice</span>
                    </button>
                )}
                {hasTripInvoice && tripInvoice?.name && (
                    <button
                        onClick={handlePrint}
                        className="bg-white text-slate-700 py-4 rounded-[1.5rem] border border-slate-100 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm group"
                    >
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z"/></svg>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Print Invoice</span>
                    </button>
                )}
            </div>
        )}

        {/* AI Scanner Card */}
        {tripInvoice?.name && (
            <section className="bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 space-y-5 text-left rtl:text-right">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Trip Invoice</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{tripInvoice.name}</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${tripInvoice.status === "Ready" ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {tripInvoice.status || 'Draft'}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-600">
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-slate-300 font-black uppercase mb-1">Passenger</p>
                        <p className="text-slate-900">{tripInvoice.invoice_passenger_name || '-'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-slate-300 font-black uppercase mb-1">Grand Total</p>
                        <p className="text-slate-900">{tripInvoice.grand_total ?? 0}</p>
                    </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                    {(tripInvoice.items || []).map((item, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 border-b last:border-b-0 border-slate-100 text-[10px]">
                            <div>
                                <p className="font-black text-slate-800 uppercase">{item.description || item.item_name || 'Trip Route'}</p>
                                <p className="font-bold text-slate-400">Qty {item.qty || 0} x {item.rate || 0}</p>
                            </div>
                            <p className="font-black text-slate-900">{item.total_amount ?? 0}</p>
                        </div>
                    ))}
                </div>
            </section>
        )}

        <div className="bg-white p-7 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group text-left rtl:text-right">
            <div className="flex items-center justify-between mb-8 cursor-pointer" onClick={triggerCamera}>
                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{t.aiScanner}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t.multiDoc}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
            </div>
            <button onClick={triggerCamera} disabled={queue.scanning} className="w-full mb-3 bg-blue-600 text-white py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg shadow-blue-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 13a3 3 0 106 0 3 3 0 00-6 0z"/></svg>
                <span className="text-xs font-black uppercase tracking-widest">{t.openCamera}</span>
            </button>
            <button onClick={triggerUpload} disabled={queue.scanning} className="w-full bg-slate-900 text-white py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-slate-300 relative overflow-hidden">
                {queue.scanning ? (
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{t.scanning} {queue.processed}/{queue.total}</span>
                    </div>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        <span className="text-xs font-black uppercase tracking-widest">{t.batchUpload}</span>
                    </>
                )}
                {queue.scanning && <div className="absolute bottom-0 left-0 h-1 bg-blue-400 transition-all duration-300" style={{ width: `${(queue.processed / queue.total) * 100}%` }}></div>}
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*,.pdf,application/pdf" 
              multiple 
              className="hidden" 
              onChange={handleFileUpload}
            />
        </div>

        <div className="space-y-4">
            <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 text-left rtl:text-right">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{t.operationalSetup}</h4>
                </div>
                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{t.captainUnit}</label>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none" value={formData.driver || ''} onChange={(e) => handleDriverUpdate(e.target.value)}>
                            <option value="">{t.choosePersonnel}</option>
                            {staff.map(s => <option key={s.name} value={s.name}>{s.name} - {s.vehicle_assigned || 'Unassigned'}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{t.routeSelection}</label>
                        <input
                            list="trip-route-options"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                            value={routeSearch}
                            placeholder="Search route"
                            onChange={(e) => handleRouteSearchChange(e.target.value)}
                        />
                        <datalist id="trip-route-options">
                            {routes.map(r => <option key={r.name} value={getRouteLabel(r)} />)}
                        </datalist>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Trip Value</label>
                            <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all" value={formData.trip_value || ''} onChange={(e) => { setFormData(prev => ({ ...prev, trip_value: Number(e.target.value) || undefined })); setIsDirty(true); }} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Billing Mode</label>
                            <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none" value={formData.billing_mode || 'Route Amount'} onChange={(e) => { setFormData(prev => ({ ...prev, billing_mode: e.target.value as Trip['billing_mode'] })); setIsDirty(true); }}>
                                <option value="Route Amount">Route Amount</option>
                                <option value="KM Based">KM Based</option>
                                <option value="Manual">Manual</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">VAT Mode</label>
                            <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none" value={formData.vat_mode || 'Included'} onChange={(e) => { setFormData(prev => ({ ...prev, vat_mode: e.target.value as Trip['vat_mode'] })); setIsDirty(true); }}>
                                <option value="Included">Included</option>
                                <option value="Manual Add VAT">Manual Add VAT</option>
                                <option value="No VAT">No VAT</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">VAT Rate</label>
                            <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all" value={formData.vat_rate ?? 15} onChange={(e) => { setFormData(prev => ({ ...prev, vat_rate: Number(e.target.value) || 15 })); setIsDirty(true); }} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Invoice Passenger</label>
                            <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all" value={formData.invoice_passenger_name || ''} onChange={(e) => { setFormData(prev => ({ ...prev, invoice_passenger_name: e.target.value })); setIsDirty(true); }} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Invoice Mobile</label>
                            <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all" value={formData.invoice_passenger_mobile || ''} onChange={(e) => { setFormData(prev => ({ ...prev, invoice_passenger_mobile: e.target.value })); setIsDirty(true); }} />
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 text-left rtl:text-right">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{t.manifest} ({formData.passengers?.length || 0})</h4>
                    </div>
                    <button onClick={() => { setFormData(prev => ({ ...prev, passengers: [...(prev.passengers || []), { passenger_name: '', document_number: '', contact_no: '', source: 'MANUAL' }] })); setIsDirty(true); }} className="text-[9px] font-black text-blue-600 bg-blue-50 px-3.5 py-2 rounded-xl uppercase active:scale-95 transition-all">
                        + {t.addRecord}
                    </button>
                </div>
                <div className="space-y-4">
                    {(!formData.passengers || formData.passengers.length === 0) ? (
                        <div className="py-12 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2rem]">
                            <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">{t.emptyManifest}</p>
                        </div>
                    ) : (
                        formData.passengers.map((p, idx) => (
                            <div key={idx} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 relative group transition-all hover:border-blue-200 text-left rtl:text-right">
                                <button onClick={() => { setFormData(prev => ({ ...prev, passengers: prev.passengers?.filter((_, i) => i !== idx) })); setIsDirty(true); }} className="absolute -top-2 -right-2 w-8 h-8 bg-white shadow-lg border border-slate-50 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 active:scale-90 transition-all z-10">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                                <div className="space-y-5">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">{t.fullLegalName}</label>
                                        <input className="w-full bg-transparent text-sm font-black text-slate-900 outline-none border-b border-transparent focus:border-blue-200 transition-colors py-1 uppercase" placeholder="..." value={p.passenger_name} onChange={(e) => { const next = [...(formData.passengers || [])]; next[idx].passenger_name = e.target.value; setFormData({...formData, passengers: next}); setIsDirty(true); }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 pt-3 border-t border-slate-100">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">{t.idPassport}</label>
                                            <input className="w-full bg-transparent text-[11px] font-bold text-slate-600 outline-none uppercase" placeholder="---" value={p.document_number || p.id_no || ''} onChange={(e) => { const next = [...(formData.passengers || [])]; next[idx].document_number = e.target.value; setFormData({...formData, passengers: next}); setIsDirty(true); }} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Mobile</label>
                                            <input className="w-full bg-transparent text-[11px] font-bold text-slate-600 outline-none uppercase" placeholder="---" value={p.contact_no || p.mobile_no || ''} onChange={(e) => { const next = [...(formData.passengers || [])]; next[idx].contact_no = e.target.value; setFormData({...formData, passengers: next}); setIsDirty(true); }} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Nationality</label>
                                            <input className="w-full bg-transparent text-[11px] font-bold text-slate-600 outline-none uppercase" placeholder="---" value={p.nationality || ''} onChange={(e) => { const next = [...(formData.passengers || [])]; next[idx].nationality = e.target.value; setFormData({...formData, passengers: next}); setIsDirty(true); }} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">Document Type</label>
                                            <select className="w-full bg-transparent text-[11px] font-bold text-slate-600 outline-none uppercase" value={p.document_type || 'Passport'} onChange={(e) => { const next = [...(formData.passengers || [])]; next[idx].document_type = e.target.value; setFormData({...formData, passengers: next}); setIsDirty(true); }}>
                                                <option value="Passport">Passport</option>
                                                <option value="Aqama">Aqama</option>
                                                <option value="Nusuk">Nusuk</option>
                                                <option value="Visa">Visa</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-3 pt-3 border-t border-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(p.is_invoice_customer)}
                                            onChange={(e) => {
                                                const next = [...(formData.passengers || [])].map((row, rowIdx) => ({
                                                    ...row,
                                                    is_invoice_customer: rowIdx === idx && e.target.checked ? 1 : 0,
                                                }));
                                                setFormData({...formData, passengers: next});
                                                setIsDirty(true);
                                            }}
                                        />
                                        Invoice Customer
                                    </label>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
      </div>
    </div>
  );
};

export default TripForm;
