import React from 'react';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredCompany?: boolean;
}

export default function ProtectedRoute({ children, requiredRole, requiredCompany }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--amber)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // App.tsx should handle showing Login
  }

  if (requiredRole && user?.portal_role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--ink)]">Access Denied</h2>
          <p className="text-[var(--ink-soft)] mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (requiredCompany && !user?.company) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--ink)]">No Company</h2>
          <p className="text-[var(--ink-soft)] mt-2">You are not linked to any company. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
