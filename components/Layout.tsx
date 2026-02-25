
import React from 'react';
import { User, Language } from '../types';
import { translations } from '../translations';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: string;
  activeModule: 'trip' | 'inspection';
  lang: Language;
  onLogout: () => void;
  onLangChange: (lang: Language) => void;
  onNavigate: (view: 'dashboard' | 'create' | 'switch_module') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentView, activeModule, lang, onLogout, onLangChange, onNavigate }) => {
  const t = translations[lang];
  const isRtl = lang === 'ar' || lang === 'ur';
  const createLabel = activeModule === 'trip' ? t.newTrip : t.newInspection;
  
  // Dynamic font class based on language
  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';

  return (
    <div className={`flex flex-col min-h-screen max-w-md mx-auto bg-white shadow-2xl relative ${fontClass}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b px-4 py-4 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black shadow-lg shadow-blue-100">G</div>
            <h1 className="font-black text-lg text-slate-800 truncate tracking-tight">{t.appName}</h1>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative group">
                <select 
                    value={lang} 
                    onChange={(e) => onLangChange(e.target.value as Language)}
                    className="text-[10px] font-black bg-slate-100 border-none rounded-xl px-3 py-2 outline-none appearance-none cursor-pointer transition-colors hover:bg-slate-200"
                >
                    <option value="en">ENGLISH</option>
                    <option value="ar">العربية</option>
                    <option value="ur">اردو</option>
                </select>
            </div>
            <button 
                onClick={onLogout}
                className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl active:scale-90 transition-all"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24">
        {children}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass-morphism border-t h-20 flex items-center justify-around px-6 z-40">
        <button 
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center gap-1.5 transition-colors ${currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">{t.home}</span>
        </button>
        
        <button 
          onClick={() => onNavigate('create')}
          className={`flex flex-col items-center gap-1.5 transition-transform active:scale-90 ${currentView === 'create' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <div className="bg-blue-600 -mt-10 w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-blue-200 border-4 border-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest mt-1">{createLabel}</span>
        </button>

        <button 
          onClick={() => onNavigate('switch_module')}
          className={`flex flex-col items-center gap-1.5 transition-colors ${activeModule === 'inspection' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">{t.inspections}</span>
        </button>
      </nav>
    </div>
  );
};
