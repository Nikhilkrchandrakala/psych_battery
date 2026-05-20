import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { api } from '../lib/api';

// Environment-aware URLs for the main site
const MAIN_SITE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5173'
    : 'https://ssbwithisv.in';

const ADMIN_PANEL_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/admin-login'
    : 'https://ssbwithisv.in/admin-login';

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
    // SSO: Extract token from query params if available (passed from main site/admin panel)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('auth_token', urlToken);
      // Clean up URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await api.auth.me();
      setUser(userData);
      setProfile(userData);
      setIsAdminUser(userData.role === 'admin');

      // Role-based auto-routing after SSO entry
      if (urlToken) {
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
    const role = profile?.role;
    localStorage.removeItem('auth_token');
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
