import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: any | null; // This will hold the user object from our API
  profile: UserProfile | null;
  loading: boolean;
  isAdminUser: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdminUser: false,
  logout: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  const checkAuth = async () => {
    // SSO: Extract token from query params if available
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
      setProfile(userData); // In our new setup, profile is the same as user object
      setIsAdminUser(userData.role === 'admin');
    } catch (error) {
      console.error('Auth verification failed:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
      setProfile(null);
      setIsAdminUser(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setProfile(null);
    setIsAdminUser(false);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdminUser, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
