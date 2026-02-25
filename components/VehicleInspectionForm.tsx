import React, { useEffect, useState } from 'react';
import {
  Language,
  Staff,
  VehicleInspectionChecklistItem,
  VehicleInspectionItem,
  VehicleInspectionLog,
} from '../types';
import { FrappeClient } from '../services/frappe';
import { translations } from '../translations';

interface VehicleInspectionFormProps {
  inspection?: VehicleInspectionLog | null;
  onBack: () => void;
  onSave: () => void;
  lang: Language;
}

const SOUND = 'Sound | سليم';
const UNSOUND = 'Unsound | غير سليم';

const VehicleInspectionForm: React.FC<VehicleInspectionFormProps> = ({ inspection, onBack, onSave: _onSave, lang }) => {
  const [formData, setFormData] = useState<VehicleInspectionLog>(inspection || {
    naming_series: 'VIL-.YYYY.-.#####',
    inspection_date: new Date().toISOString().split('T')[0],
    auto_fill_checklist: 1,
    declaration: 'I confirm the above inspection is correct. | أقر بأن بيانات الفحص أعلاه صحيحة.',
    items: [],
  });
  const [staff, setStaff] = useState<Staff[]>([]);
  const [checklist, setChecklist] = useState<VehicleInspectionChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });
  const t = translations[lang];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [staffRes, checklistRes] = await Promise.all([
          FrappeClient.getList('Staff', { is_driver: 1 }, ['name', 'vehicle_assigned']),
          FrappeClient.getList('Vehicle Inspection Checklist Item', { is_active: 1 }, ['name', 'item', 'category', 'sort_order']),
        ]);

        setStaff(staffRes.message || []);
        setChecklist(checklistRes.message || []);

        if (inspection?.name) {
          const fullDoc = await FrappeClient.getDoc('Vehicle Inspection Log', inspection.name);
          const doc = fullDoc.message || {};
          setFormData({
            ...doc,
            items: (doc.items || []).map((row: VehicleInspectionItem) => ({ ...row, doctype: 'Vehicle Inspection Item' })),
          });
          return;
        }

        if ((inspection?.items || []).length > 0) {
          setFormData((prev) => ({ ...prev, ...inspection }));
          return;
        }

        setFormData((prev) => ({
          ...prev,
          items: buildChecklistRows(checklistRes.message || []),
        }));
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [inspection]);

  const buildChecklistRows = (rows: VehicleInspectionChecklistItem[]): VehicleInspectionItem[] => {
    return rows
      .slice()
      .sort((a, b) => {
        const aCategory = a.category || '';
        const bCategory = b.category || '';
        if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);
        return (a.sort_order || 0) - (b.sort_order || 0);
      })
      .map((d) => ({
        doctype: 'Vehicle Inspection Item',
        section: d.category || '',
        item_en: d.name,
        category: d.category || '',
        item: d.item || '',
        sort_order: d.sort_order || 0,
        status: SOUND,
        notes: '',
      }));
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3000);
  };

  const handleDriverChange = (driver: string) => {
    const selected = staff.find((s) => s.name === driver);
    setFormData((prev) => ({
      ...prev,
      driver,
      vehicle: selected?.vehicle_assigned || prev.vehicle || '',
      driver_name_text: driver,
    }));
    setIsDirty(true);
  };

  const updateItem = (index: number, patch: Partial<VehicleInspectionItem>) => {
    const next = [...(formData.items || [])];
    next[index] = { ...next[index], ...patch, doctype: 'Vehicle Inspection Item' };
    setFormData((prev) => ({ ...prev, items: next }));
    setIsDirty(true);
  };

  const resetChecklist = () => {
    setFormData((prev) => ({ ...prev, items: buildChecklistRows(checklist) }));
    setIsDirty(true);
  };

  const saveInspection = async () => {
    if (!formData.driver) return showToast(t.selectDriverErrInspection, 'error');
    if (!formData.vehicle) return showToast(t.selectVehicleErrInspection, 'error');
    if (!formData.items || formData.items.length === 0) return showToast(t.saveInspectionErr, 'error');

    setLoading(true);
    try {
      const payload: VehicleInspectionLog = {
        ...formData,
        items: formData.items.map((row) => ({
          ...row,
          doctype: 'Vehicle Inspection Item',
        })),
      };
      const savedDoc = await FrappeClient.saveDoc('Vehicle Inspection Log', payload);
      setFormData({
        ...savedDoc,
        items: (savedDoc.items || []).map((row: VehicleInspectionItem) => ({ ...row, doctype: 'Vehicle Inspection Item' })),
      });
      setIsDirty(false);
      showToast(t.inspectionSaved, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!formData.name) return showToast(t.savePrintErr, 'error');
    window.open(FrappeClient.getPrintUrl('Vehicle Inspection Log', formData.name, 'Vehicle Inspection'), '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-28 relative">
      {toast.type && (
        <div className={`fixed top-20 left-4 right-4 z-[100] p-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-300 flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
          <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          <p className="text-xs font-black uppercase tracking-widest">{toast.message}</p>
        </div>
      )}

      <div className="px-4 py-6 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xl z-30 border-b border-slate-100 shadow-sm">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-2xl active:scale-90 transition-all">
          <svg className={`w-6 h-6 ${lang !== 'en' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 px-4 text-center min-w-0">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">{t.inspections}</h2>
          <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight">{formData.name || t.draftRecord}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {formData.name && (
            <button onClick={handlePrint} className="w-10 h-10 flex items-center justify-center text-indigo-600 bg-indigo-50 rounded-2xl active:scale-90 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            </button>
          )}
          <button
            disabled={loading}
            onClick={saveInspection}
            className={`px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg transition-all active:scale-95 ${isDirty ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-900 text-white shadow-slate-200'}`}
          >
            {loading ? t.syncing : t.save}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5 text-left rtl:text-right">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{t.operationalSetup}</h4>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{t.inspectionDate}</label>
              <input
                type="date"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={formData.inspection_date || ''}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, inspection_date: e.target.value }));
                  setIsDirty(true);
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{t.captainUnit}</label>
              <select
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none"
                value={formData.driver || ''}
                onChange={(e) => handleDriverChange(e.target.value)}
              >
                <option value="">{t.choosePersonnel}</option>
                {staff.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} - {s.vehicle_assigned || 'Unassigned'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{t.selectVehicle}</label>
              <input
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={formData.vehicle || ''}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, vehicle: e.target.value }));
                  setIsDirty(true);
                }}
                placeholder={t.selectVehicle}
              />
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5 text-left rtl:text-right">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{t.checklist} ({formData.items?.length || 0})</h4>
            </div>
            <button onClick={resetChecklist} className="text-[9px] font-black text-blue-600 bg-blue-50 px-3.5 py-2 rounded-xl uppercase active:scale-95 transition-all">
              Reset
            </button>
          </div>

          {(!formData.items || formData.items.length === 0) ? (
            <div className="py-12 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2rem]">
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">{t.noItems}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {formData.items.map((row, idx) => (
                <div key={`${row.item_en || row.item || 'item'}-${idx}`} className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{row.section || row.category || 'Checklist'}</p>
                      <p className="text-xs font-black text-slate-800 mt-1">{row.item || row.item_en}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={row.status || SOUND}
                        onChange={(e) => updateItem(idx, { status: e.target.value as VehicleInspectionItem['status'] })}
                      >
                        <option value={SOUND}>{SOUND}</option>
                        <option value={UNSOUND}>{UNSOUND}</option>
                      </select>
                      <input
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        placeholder={t.overallNotes}
                        value={row.notes || ''}
                        onChange={(e) => updateItem(idx, { notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4 text-left rtl:text-right">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{t.declaration}</label>
            <textarea
              rows={3}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              value={formData.declaration || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, declaration: e.target.value }));
                setIsDirty(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{t.overallNotes}</label>
            <textarea
              rows={3}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              value={formData.overall_notes || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, overall_notes: e.target.value }));
                setIsDirty(true);
              }}
            />
          </div>
        </section>
      </div>

    </div>
  );
};

export default VehicleInspectionForm;
