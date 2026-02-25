
import React, { useState, useEffect } from 'react';
import { Trip, User, Language, VehicleInspectionLog } from './types';
import { FrappeClient } from './services/frappe';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TripForm from './components/TripForm';
import InspectionDashboard from './components/InspectionDashboard';
import VehicleInspectionForm from './components/VehicleInspectionForm';
import { Layout } from './components/Layout';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeModule, setActiveModule] = useState<'trip' | 'inspection'>('trip');
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'edit'>('dashboard');
  const [selectedTrip, setSelectedTrip] = useState<Partial<Trip> | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<Partial<VehicleInspectionLog> | null>(null);
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
    setSelectedInspection(null);
    setActiveModule('trip');
    setCurrentView('create');
  };

  const startNewInspection = (initialData?: Partial<VehicleInspectionLog>) => {
    setSelectedInspection(initialData || {
      naming_series: 'VIL-.YYYY.-.#####',
      inspection_date: new Date().toISOString().split('T')[0],
      auto_fill_checklist: 1,
      items: [],
    });
    setSelectedTrip(null);
    setActiveModule('inspection');
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
        if (view === 'switch_module') {
          const nextModule = activeModule === 'trip' ? 'inspection' : 'trip';
          setActiveModule(nextModule);
          setCurrentView('dashboard');
          setSelectedTrip(null);
          setSelectedInspection(null);
          return;
        }

        if (view === 'create') {
          if (activeModule === 'trip') {
            startNewTrip();
          } else {
            startNewInspection();
          }
        } else {
          setCurrentView('dashboard');
          setSelectedTrip(null);
          setSelectedInspection(null);
        }
      }}
      currentView={currentView}
      activeModule={activeModule}
    >
      {activeModule === 'trip' && currentView === 'dashboard' && (
        <Dashboard 
          lang={lang}
          onCreateNew={startNewTrip}
          onEditTrip={(trip) => {
            setSelectedTrip(trip);
            setActiveModule('trip');
            setCurrentView('edit');
          }}
        />
      )}
      {activeModule === 'trip' && (currentView === 'create' || currentView === 'edit') && (
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

      {activeModule === 'inspection' && currentView === 'dashboard' && (
        <InspectionDashboard
          lang={lang}
          onCreateNew={startNewInspection}
          onEditInspection={(log) => {
            setSelectedInspection(log);
            setActiveModule('inspection');
            setCurrentView('edit');
          }}
        />
      )}
      {activeModule === 'inspection' && (currentView === 'create' || currentView === 'edit') && (
        <VehicleInspectionForm
          lang={lang}
          inspection={selectedInspection as VehicleInspectionLog}
          onBack={() => {
            setCurrentView('dashboard');
            setSelectedInspection(null);
          }}
          onSave={() => setCurrentView('dashboard')}
        />
      )}
    </Layout>
  );
};

export default App;
