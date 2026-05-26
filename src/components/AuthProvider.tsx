import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { api } from '../lib/api';

// Environment-aware URLs for the main site
const MAIN_SITE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://ssbwithisv.in';

const ADMIN_PANEL_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : 'https://api.ssbwithisv.in/admin-login';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdminUser: boolean;
  mainSiteUrl: string;
  adminPanelUrl: string;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdminUser: false,
  mainSiteUrl: MAIN_SITE_URL,
  adminPanelUrl: ADMIN_PANEL_URL,
  logout: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  const checkAuth = async () => {
    // Check for bypass parameter (for local development/testing)
    const urlParams = new URLSearchParams(window.location.search);
    const urlBypass = urlParams.get('bypass');
    const urlToken = urlParams.get('token');
    
    if (urlBypass && ['student', 'assessor', 'admin'].includes(urlBypass)) {
      localStorage.setItem('auth_token', `mock-${urlBypass}`);
      // Clean up URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlToken) {
      localStorage.setItem('auth_token', urlToken);
      // Clean up URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    try {
      const userData = await api.auth.me();
      setUser(userData);
      setProfile(userData);
      setIsAdminUser(userData.role === 'admin');

      // Role-based auto-routing after SSO or bypass entry
      if (urlToken || urlBypass) {
        const currentPath = window.location.pathname;
        if (userData.role === 'admin' && currentPath === '/') {
          window.history.replaceState({}, '', '/admin');
        } else if (userData.role === 'assessor' && currentPath === '/') {
          window.history.replaceState({}, '', '/assessor');
        }
        // Students stay at / (dashboard) — no redirect needed
      }
    } catch (error) {
      console.error('Auth verification failed:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
      setProfile(null);
      setIsAdminUser(false);

      // If SSO token was provided but is invalid/expired, redirect to main site login
      if (urlToken) {
        window.location.href = `${MAIN_SITE_URL}/SignIn`;
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const logout = () => {
    const role = profile?.role || localStorage.getItem('role');
    // Clear PsychBattery session token
    localStorage.removeItem('auth_token');
    // Also clear admin portal session keys so the portal lands on login (not loop-redirect)
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('permissions');
    localStorage.removeItem('name');

    setUser(null);
    setProfile(null);
    setIsAdminUser(false);

    // Redirect based on user role
    if (role === 'assessor' || role === 'admin') {
      window.location.href = ADMIN_PANEL_URL;
    } else {
      window.location.href = `${MAIN_SITE_URL}/ProfileDashboard`;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdminUser, mainSiteUrl: MAIN_SITE_URL, adminPanelUrl: ADMIN_PANEL_URL, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
