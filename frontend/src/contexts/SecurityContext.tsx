import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { clearSecurityData } from '@/lib/encryption';

interface SecurityContextType {
  isAuthenticated: boolean;
  encryptionKey: string | null;
  setAuthenticated: (key: string) => void;
  logout: () => void;
  isNativePlatform: boolean;
  lockTimeout: number;
  setLockTimeout: (timeout: number) => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [lockTimeout, setLockTimeout] = useState(5); // minutes
  const isNativePlatform = Capacitor.isNativePlatform();

  useEffect(() => {
    // Auto-lock after inactivity
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (isAuthenticated && lockTimeout > 0) {
        timeoutId = setTimeout(() => {
          handleLock();
        }, lockTimeout * 60 * 1000);
      }
    };

    const handleActivity = () => {
      if (isAuthenticated) {
        resetTimer();
      }
    };

    // Listen to user activity
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [isAuthenticated, lockTimeout]);

  const setAuthenticated = (key: string) => {
    setEncryptionKey(key);
    setIsAuthenticated(true);
    
    // Store in session
    sessionStorage.setItem('session_active', 'true');
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    setEncryptionKey(null);
    sessionStorage.removeItem('session_active');
  };

  const logout = async () => {
    handleLock();
    clearSecurityData();
    
    if (isNativePlatform) {
      await Preferences.remove({ key: 'user_authenticated' });
    }
    
    // Clear all data
    localStorage.clear();
    sessionStorage.clear();
    
    // Reload app
    window.location.reload();
  };

  return (
    <SecurityContext.Provider
      value={{
        isAuthenticated,
        encryptionKey,
        setAuthenticated,
        logout,
        isNativePlatform,
        lockTimeout,
        setLockTimeout,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
