import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FrappeClient } from '../services/frappe';

interface CompanyData {
  company_code?: string;
  company_name?: string;
  legal_name?: string;
  vat_no?: string;
  enable_kashf?: boolean;
}

interface Subscription {
  status: string;
  trial_days_left: number;
  active_days_left: number;
}

interface Permissions {
  company?: string;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

interface User {
  user: string;
  full_name: string;
  email?: string;
  mobile_no?: string;
  portal_role?: string;
  company?: string;
  company_data?: CompanyData;
  subscription?: Subscription;
  permissions?: Permissions;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await FrappeClient.getCurrentUser();
      if (data?.is_authenticated) {
        setUser({
          user: data.user || data.name,
          full_name: data.full_name || data.name,
          email: data.email,
          mobile_no: data.mobile_no,
          portal_role: data.portal_role,
          company: data.company,
          company_data: data.company_data,
          subscription: data.subscription,
          permissions: data.permissions,
          roles: data.roles || [],
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (FrappeClient.isLoggedIn()) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const userData = await FrappeClient.login(username, password);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    await FrappeClient.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated: !!user,
      login, logout, refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
