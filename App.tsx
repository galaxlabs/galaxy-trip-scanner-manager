import React, { useEffect, useState } from 'react';
import { Trip, User, Language, VehicleInspectionLog } from './types';
import { FrappeClient } from './services/frappe';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TripForm from './components/TripForm';
import TripInvoiceList from './components/TripInvoiceList';
import InspectionDashboard from './components/InspectionDashboard';
import VehicleInspectionForm from './components/VehicleInspectionForm';
import FeedbackPage from './components/FeedbackPage';
import ExpenseCaptureDemo from './components/ExpenseCaptureDemo';
import DriverVatDashboard from './components/DriverVatDashboard';
import { Layout } from './components/Layout';

type ActiveModule = 'trip' | 'trip_invoice' | 'inspection' | 'driver_vat' | 'expense_demo' | 'feedback';
type CurrentView = 'dashboard' | 'create' | 'edit';
type NavigationTarget = CurrentView | ActiveModule | 'trips' | 'trip_invoices' | 'inspections';

function moduleFromPath(pathname: string): ActiveModule {
  if (pathname === '/dashboard/driver-vat') return 'driver_vat';
  if (pathname === '/expenses/demo') return 'expense_demo';
  if (pathname === '/feedback') return 'feedback';
  if (pathname.startsWith('/trip-invoices')) return 'trip_invoice';
  if (pathname.startsWith('/inspections')) return 'inspection';
  return 'trip';
}

function moduleToPath(module: ActiveModule): string {
  switch (module) {
    case 'driver_vat':
      return '/dashboard/driver-vat';
    case 'expense_demo':
      return '/expenses/demo';
    case 'feedback':
      return '/feedback';
    case 'trip_invoice':
      return '/trip-invoices';
    case 'inspection':
      return '/inspections';
    default:
      return '/trips';
  }
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeModule, setActiveModule] = useState<ActiveModule>(() => moduleFromPath(window.location.pathname));
  const [currentView, setCurrentView] = useState<CurrentView>('dashboard');
  const [selectedTrip, setSelectedTrip] = useState<Partial<Trip> | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<Partial<VehicleInspectionLog> | null>(null);
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    (async () => {
      try {
        const userInfo = await FrappeClient.getCurrentUser();
        if (userInfo?.is_authenticated) {
          const profile: User = {
            username: userInfo.name,
            full_name: userInfo.full_name || userInfo.name,
            email: userInfo.email,
          };
          setUser(profile);
          localStorage.setItem('frappe_user', JSON.stringify(profile));
        }
      } catch {
        const savedUser = localStorage.getItem('frappe_user');
        if (savedUser) {
          try { setUser(JSON.parse(savedUser)); } catch { localStorage.removeItem('frappe_user'); }
        }
      }
    })();

    const savedLang = localStorage.getItem('app_lang') as Language;
    if (savedLang) setLang(savedLang);

    const handlePopState = () => {
      setActiveModule(moduleFromPath(window.location.pathname));
      setCurrentView('dashboard');
      setSelectedTrip(null);
      setSelectedInspection(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const syncPath = (module: ActiveModule) => {
    const nextPath = moduleToPath(module);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

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

  const activateModule = (module: ActiveModule) => {
    setActiveModule(module);
    setCurrentView('dashboard');
    setSelectedTrip(null);
    setSelectedInspection(null);
    syncPath(module);
  };

  const startNewTrip = (initialData?: Partial<Trip>) => {
    setSelectedTrip(initialData || { trip_status: 'Scheduled', passengers: [] });
    setSelectedInspection(null);
    setActiveModule('trip');
    setCurrentView('create');
    syncPath('trip');
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
    syncPath('inspection');
  };

  const handleNavigate = (view: NavigationTarget) => {
    if (view === 'trips') {
      activateModule('trip');
      return;
    }
    if (view === 'trip_invoices') {
      activateModule('trip_invoice');
      return;
    }
    if (view === 'inspections') {
      activateModule('inspection');
      return;
    }
    if (view === 'driver_vat' || view === 'expense_demo' || view === 'feedback') {
      activateModule(view);
      return;
    }

    if (view === 'create') {
      if (activeModule === 'trip') {
        startNewTrip();
      } else if (activeModule === 'inspection') {
        startNewInspection();
      } else {
        activateModule('trip');
      }
      return;
    }

    setCurrentView('dashboard');
    setSelectedTrip(null);
    setSelectedInspection(null);
    syncPath(activeModule);
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
      onNavigate={handleNavigate}
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
          user={user}
          onBack={() => {
            setCurrentView('dashboard');
            setSelectedTrip(null);
            syncPath('trip');
          }}
          onSave={() => {
            setCurrentView('dashboard');
            syncPath('trip');
          }}
        />
      )}

      {activeModule === 'trip_invoice' && currentView === 'dashboard' && (
        <TripInvoiceList lang={lang} />
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
            syncPath('inspection');
          }}
          onSave={() => {
            setCurrentView('dashboard');
            syncPath('inspection');
          }}
        />
      )}

      {activeModule === 'driver_vat' && <DriverVatDashboard lang={lang} user={user} />}
      {activeModule === 'expense_demo' && <ExpenseCaptureDemo lang={lang} />}
      {activeModule === 'feedback' && <FeedbackPage lang={lang} />}
    </Layout>
  );
};

export default App;
