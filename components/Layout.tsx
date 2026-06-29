import React, { useState } from 'react';
import { User, Language } from '../types';
import { translations } from '../translations';

type ActiveModule = 'trip' | 'trip_invoice' | 'inspection' | 'driver_vat' | 'expense_demo' | 'feedback';
type NavigationTarget = 'dashboard' | 'create' | 'trips' | 'trip_invoices' | 'inspections' | 'driver_vat' | 'expense_demo' | 'feedback';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: string;
  activeModule: ActiveModule;
  lang: Language;
  onLogout: () => void;
  onLangChange: (lang: Language) => void;
  onNavigate: (view: NavigationTarget) => void;
}

const moduleTitles: Record<ActiveModule, { eyebrow: string; title: string }> = {
  trip: { eyebrow: 'Operations', title: 'Trips' },
  trip_invoice: { eyebrow: 'Operations', title: 'Trip Invoices' },
  inspection: { eyebrow: 'Operations', title: 'Vehicle Inspections' },
  driver_vat: { eyebrow: 'Dashboard', title: 'Driver VAT Dashboard' },
  expense_demo: { eyebrow: 'Expenses', title: 'Expense Capture Demo' },
  feedback: { eyebrow: 'Help & Feedback', title: 'Suggest a Feature' },
};

export const Layout: React.FC<LayoutProps> = ({ children, user, currentView, activeModule, lang, onLogout, onLangChange, onNavigate }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const t = translations[lang];
  const isRtl = lang === 'ar' || lang === 'ur';
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';
  const canCreate = activeModule === 'trip' || activeModule === 'inspection';
  const moduleMeta = moduleTitles[activeModule];
  const createLabel = activeModule === 'inspection' ? t.newInspection : t.newTrip;

  return (
    <div className={`flex flex-col min-h-screen max-w-md mx-auto app-shell shadow-2xl relative overflow-hidden ${fontClass}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-50 app-header px-4 pt-4 pb-3 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => onNavigate('dashboard')}
            className="w-11 h-11 bg-[var(--paper-soft)] text-[var(--ink)] rounded-2xl flex-shrink-0 flex items-center justify-center active:scale-95 transition-all"
            aria-label={t.home}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l9-8 9 8M5 10v10h14V10"/></svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.22em] leading-none">{moduleMeta.eyebrow}</p>
            <h1 className="font-black text-base truncate tracking-tight mt-1">{moduleMeta.title}</h1>
          </div>
          <button
            onClick={() => setMenuOpen(true)}
            className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 transition-all"
            aria-label={t.menu}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7h16M4 12h16M4 17h10"/></svg>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[90] bg-[var(--ink)]/60 backdrop-blur-sm p-4 flex items-end justify-center" onClick={() => setMenuOpen(false)}>
          <div className="w-full max-w-md surface-panel rounded-[2rem] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-[var(--cyan)] uppercase tracking-[0.2em]">{t.signedIn}</p>
                <p className="text-sm font-black text-[var(--ink)] truncate max-w-[220px]">{user.full_name || user.username}</p>
              </div>
              <button onClick={() => setMenuOpen(false)} className="w-10 h-10 rounded-2xl surface-muted text-[var(--ink-soft)] flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]/55">Operations</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { setMenuOpen(false); onNavigate('trips'); }} className={`py-3 rounded-2xl text-[10px] font-black uppercase ${activeModule === 'trip' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>{t.trips}</button>
                <button onClick={() => { setMenuOpen(false); onNavigate('trip_invoices'); }} className={`py-3 rounded-2xl text-[10px] font-black uppercase ${activeModule === 'trip_invoice' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>{t.invoices}</button>
                <button onClick={() => { setMenuOpen(false); onNavigate('inspections'); }} className={`py-3 rounded-2xl text-[10px] font-black uppercase ${activeModule === 'inspection' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>{t.inspect}</button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]/55">Dashboard</p>
              <button onClick={() => { setMenuOpen(false); onNavigate('driver_vat'); }} className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase ${activeModule === 'driver_vat' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>Driver VAT Dashboard</button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]/55">Expenses</p>
              <button onClick={() => { setMenuOpen(false); onNavigate('expense_demo'); }} className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase ${activeModule === 'expense_demo' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>Expense Capture Demo</button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]/55">Help &amp; Feedback</p>
              <button onClick={() => { setMenuOpen(false); onNavigate('feedback'); }} className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase ${activeModule === 'feedback' ? 'ink-action' : 'surface-muted text-[var(--ink-soft)]'}`}>Suggest Feature</button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['en', 'ar', 'ur'] as Language[]).map((code) => (
                <button
                  key={code}
                  onClick={() => onLangChange(code)}
                  className={`py-3 rounded-2xl text-[10px] font-black uppercase ${lang === code ? 'brand-action' : 'surface-muted text-[var(--ink-soft)]'}`}
                >
                  {code === 'en' ? 'EN' : code === 'ar' ? 'عربي' : 'اردو'}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="w-full bg-[var(--danger-soft)] text-[var(--danger)] py-4 rounded-2xl text-[10px] font-black uppercase"
            >
              {t.logout}
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 pb-28 overflow-y-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-4 z-40 pointer-events-none">
        <div className="h-20 surface-panel backdrop-blur-xl rounded-[2rem] flex items-center justify-around px-4 pointer-events-auto">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`flex flex-col items-center gap-1.5 transition-colors ${currentView === 'dashboard' ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]/45'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">{t.home}</span>
          </button>

          {canCreate ? (
            <button
              onClick={() => onNavigate('create')}
              className={`flex flex-col items-center gap-1.5 transition-transform active:scale-90 ${currentView === 'create' ? 'text-[var(--amber)]' : 'text-[var(--ink-soft)]/45'}`}
            >
              <div className="brand-action -mt-10 w-14 h-14 rounded-[1.5rem] flex items-center justify-center border-4 border-[var(--paper-soft)]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest mt-1">{createLabel}</span>
            </button>
          ) : (
            <button
              onClick={() => setMenuOpen(true)}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-90 text-[var(--ink-soft)]/55"
            >
              <div className="brand-action -mt-10 w-14 h-14 rounded-[1.5rem] flex items-center justify-center border-4 border-[var(--paper-soft)]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h10"/></svg>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest mt-1">Sections</span>
            </button>
          )}

          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1.5 transition-colors text-[var(--ink-soft)]/45"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7h16M4 12h16M4 17h10"/></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">{t.menu}</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
