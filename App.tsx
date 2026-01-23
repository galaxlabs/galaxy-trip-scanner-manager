
import React, { useState, useEffect } from 'react';
import { Trip, User, Language } from './types';
import { FrappeClient } from './services/frappe';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TripForm from './components/TripForm';
import { Layout } from './components/Layout';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'edit'>('dashboard');
  const [selectedTrip, setSelectedTrip] = useState<Partial<Trip> | null>(null);
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    const savedUser = localStorage.getItem('frappe_user');
    const savedLang = localStorage.getItem('app_lang') as Language;
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedLang) setLang(savedLang);
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('frappe_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    FrappeClient.logout();
    setUser(null);
    localStorage.removeItem('frappe_user');
  };

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const startNewTrip = (initialData?: Partial<Trip>) => {
    setSelectedTrip(initialData || { trip_status: 'Scheduled', passengers: [] });
    setCurrentView('create');
  };

  if (!user) {
    return <Login onLogin={handleLogin} lang={lang} onLangChange={handleLangChange} />;
  }

  return (
    <Layout 
      user={user} 
      lang={lang}
      onLogout={handleLogout} 
      onLangChange={handleLangChange}
      onNavigate={(view) => {
        if (view === 'create') {
            startNewTrip();
        } else {
            setCurrentView('dashboard');
            setSelectedTrip(null);
        }
      }}
      currentView={currentView}
    >
      {currentView === 'dashboard' && (
        <Dashboard 
          lang={lang}
          onCreateNew={startNewTrip}
          onEditTrip={(trip) => {
            setSelectedTrip(trip);
            setCurrentView('edit');
          }}
        />
      )}
      {(currentView === 'create' || currentView === 'edit') && (
        <TripForm 
          lang={lang}
          trip={selectedTrip as Trip}
          onBack={() => {
            setCurrentView('dashboard');
            setSelectedTrip(null);
          }}
          onSave={() => setCurrentView('dashboard')}
        />
      )}
    </Layout>
  );
};

export default App;
