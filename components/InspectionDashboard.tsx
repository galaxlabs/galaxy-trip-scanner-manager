import React, { useEffect, useState } from 'react';
import { Language, VehicleInspectionLog } from '../types';
import { FrappeClient } from '../services/frappe';
import { translations } from '../translations';

interface InspectionDashboardProps {
  onCreateNew: (initialData?: Partial<VehicleInspectionLog>) => void;
  onEditInspection: (log: VehicleInspectionLog) => void;
  lang: Language;
}

const InspectionDashboard: React.FC<InspectionDashboardProps> = ({ onCreateNew, onEditInspection, lang }) => {
  const [logs, setLogs] = useState<VehicleInspectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = translations[lang];
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await FrappeClient.getList('Vehicle Inspection Log', {}, [
        'name',
        'inspection_date',
        'driver',
        'vehicle',
        'modified',
      ]);
      setLogs(res.message || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inspection logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className={`p-4 space-y-6 ${fontClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">{t.activeInspections}</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t.inspectionLogs}</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 transition-all active:scale-90"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="inline-block w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{t.syncingTerminal}</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 bg-red-50 rounded-[2.5rem] p-6 border border-red-100">
            <p className="text-xs font-black uppercase mb-1">Error</p>
            <p className="text-[10px] text-red-400 mb-4">{error}</p>
            <button onClick={fetchLogs} className="px-6 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase">Retry</button>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem]">
            <p className="text-xs font-black text-slate-300 uppercase">{t.emptyLog}</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.name} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div onClick={() => onEditInspection(log)} className="cursor-pointer">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">{t.recordRef}</span>
                  <p className="text-xs font-black text-slate-900 mt-1 tracking-tighter">{log.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(FrappeClient.getPrintUrl('Vehicle Inspection Log', log.name!, 'Vehicle Inspection'), '_blank')}
                    className="w-10 h-10 flex items-center justify-center text-indigo-600 bg-indigo-50 rounded-2xl active:scale-90 transition-all"
                    title={t.printPdf}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  </button>
                  <button
                    onClick={() => onEditInspection(log)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div onClick={() => onEditInspection(log)} className="cursor-pointer grid grid-cols-2 gap-4 text-left rtl:text-right">
                <div>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{t.inspectionDate}</p>
                  <p className="text-[11px] font-black text-slate-700 mt-1">{log.inspection_date || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{t.captainUnit}</p>
                  <p className="text-[11px] font-black text-slate-700 mt-1 truncate">{log.driver || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{t.selectVehicle}</p>
                  <p className="text-[11px] font-black text-slate-700 mt-1 truncate">{log.vehicle || '-'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => onCreateNew()}
        className="fixed bottom-24 right-6 z-30 w-14 h-14 bg-blue-600 text-white rounded-[1.5rem] shadow-xl shadow-blue-200 border-4 border-white flex items-center justify-center active:scale-90 transition-all"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
      </button>
    </div>
  );
};

export default InspectionDashboard;
