import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppThemeMode = 'light' | 'dark';
export const APP_THEME_PREFERENCE_KEY = 'appThemePreference';

type AppThemeColors = {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  primary: string;
};

type AppThemeContextValue = {
  mode: AppThemeMode;
  isDark: boolean;
  colors: AppThemeColors;
  themeReady: boolean;
  setThemePreference: (mode: AppThemeMode) => Promise<void>;
};

const LIGHT_COLORS: AppThemeColors = {
  background: '#f5f6fa',
  surface: '#ffffff',
  text: '#111827',
  mutedText: '#6b7280',
  border: '#e5e7eb',
  primary: '#7726B9',
};

const DARK_COLORS: AppThemeColors = {
  background: '#0f172a',
  surface: '#111827',
  text: '#f9fafb',
  mutedText: '#cbd5e1',
  border: '#334155',
  primary: '#8b5cf6',
};

const AppThemeContext = createContext<AppThemeContextValue>({
  mode: 'light',
  isDark: false,
  colors: LIGHT_COLORS,
  themeReady: true,
  setThemePreference: async () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppThemeMode>('light');
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(APP_THEME_PREFERENCE_KEY);
        setMode(stored === 'dark' ? 'dark' : 'light');
      } catch (error) {
        console.warn('Failed to load app theme preference:', error);
        setMode('light');
      } finally {
        setThemeReady(true);
      }
    };

    loadThemePreference();
  }, []);

  const setThemePreference = useCallback(async (nextMode: AppThemeMode) => {
    setMode(nextMode);
    await AsyncStorage.setItem(APP_THEME_PREFERENCE_KEY, nextMode);
  }, []);

  const isDark = mode === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const value = useMemo(
    () => ({
      mode,
      isDark,
      colors,
      themeReady,
      setThemePreference,
    }),
    [mode, isDark, colors, themeReady, setThemePreference]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
