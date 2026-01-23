
import React, { useState } from 'react';
import { FrappeClient } from '../services/frappe';
import { User, Language } from '../types';
import { translations } from '../translations';

interface LoginProps {
  onLogin: (user: User) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, lang, onLangChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const t = translations[lang];
  const isRtl = lang === 'ar' || lang === 'ur';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoading(true);
    setError('');
    try {
      const userData = await FrappeClient.login(username, password);
      onLogin(userData);
    } catch (err: any) {
      console.error(err);
      setError(err.message === "Invalid username or password" ? t.invalidCredentials : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 max-w-md mx-auto relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Lang Selector */}
      <div className="absolute top-8 right-8 flex gap-2">
        {(['en', 'ar', 'ur'] as Language[]).map(l => (
            <button 
                key={l}
                onClick={() => onLangChange(l)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-full transition-all ${lang === l ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
            >
                {l.toUpperCase()}
            </button>
        ))}
      </div>

      <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white text-5xl font-black shadow-2xl mb-8 relative rotate-3">
        G
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white animate-pulse"></div>
      </div>
      
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t.loginTitle}</h2>
        <p className="text-slate-500 mt-2 font-medium">{t.loginSubtitle}</p>
      </div>

      <div className="w-full space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 p-5 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
              </div>
              <div className="flex-1 text-left rtl:text-right">
                <p className="text-sm font-bold text-red-700">{t.systemBlocked}</p>
                <p className="text-xs text-red-600/80 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSignIn} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-4' : 'left-4'} text-slate-400`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              </div>
              <input 
                type="text" 
                placeholder={t.username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={`w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all`}
              />
            </div>

            <div className="relative">
              <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-4' : 'left-4'} text-slate-400`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              </div>
              <input 
                type="password" 
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all`}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-slate-300 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 group"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="animate-pulse">{t.handshaking}</span>
              </>
            ) : (
              <>
                <span>{t.signIn}</span>
                <svg className={`w-5 h-5 group-hover:translate-x-1 transition-transform ${isRtl ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
