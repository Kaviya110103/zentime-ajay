import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const ADMIN_SESSION_STORAGE_KEY = 'mobileAdminSession';

export type AdminSession = {
  id: number;
  username?: string;
  clientName?: string;
  companyName?: string;
  companyCode?: string;
  employeeCount?: number;
  loggedInAt: string;
};

type AdminSessionContextValue = {
  adminSession: AdminSession | null;
  adminReady: boolean;
  setAdminSession: (session: AdminSession | null) => Promise<void>;
  logoutAdmin: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionContextValue>({
  adminSession: null,
  adminReady: false,
  setAdminSession: async () => {},
  logoutAdmin: async () => {},
});

function normalizeAdminSession(raw: any): AdminSession | null {
  const numericId = Number(raw?.id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return null;
  }

  return {
    id: numericId,
    username: raw?.username ? String(raw.username) : undefined,
    clientName: raw?.clientName ? String(raw.clientName) : undefined,
    companyName: raw?.companyName ? String(raw.companyName) : undefined,
    companyCode: raw?.companyCode ? String(raw.companyCode) : undefined,
    employeeCount:
      raw?.employeeCount === undefined || raw?.employeeCount === null
        ? undefined
        : Number(raw.employeeCount),
    loggedInAt: raw?.loggedInAt ? String(raw.loggedInAt) : new Date().toISOString(),
  };
}

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [adminSession, setAdminSessionState] = useState<AdminSession | null>(null);
  const [adminReady, setAdminReady] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const raw = await AsyncStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        setAdminSessionState(raw ? normalizeAdminSession(JSON.parse(raw)) : null);
      } catch (error) {
        console.warn('Failed to load admin session:', error);
        setAdminSessionState(null);
      } finally {
        setAdminReady(true);
      }
    };

    loadSession();
  }, []);

  const setAdminSession = useCallback(async (session: AdminSession | null) => {
    if (session) {
      await AsyncStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
    setAdminSessionState(session);
  }, []);

  const logoutAdmin = useCallback(async () => {
    await AsyncStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    setAdminSessionState(null);
  }, []);

  const value = useMemo(
    () => ({ adminSession, adminReady, setAdminSession, logoutAdmin }),
    [adminSession, adminReady, setAdminSession, logoutAdmin]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  return useContext(AdminSessionContext);
}
