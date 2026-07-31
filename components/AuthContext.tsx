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
  username?: string;
  name?: string;
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
      const stored = localStorage.getItem('frappe_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser({
          user: parsed.username || parsed.name,
          username: parsed.username || parsed.name,
          name: parsed.name || parsed.username,
          full_name: parsed.full_name || parsed.username,
          email: parsed.email,
          roles: parsed.roles || [],
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
    const stored = localStorage.getItem('frappe_user');
    if (stored) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const userData = await FrappeClient.login(username, password);
    setUser({
      user: userData.username || userData.name,
      username: userData.username || userData.name,
      name: userData.name || userData.username,
      full_name: userData.full_name || userData.username,
      email: userData.email,
      roles: userData.roles || [],
    });
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
