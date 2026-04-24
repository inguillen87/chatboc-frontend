import { useEffect, useMemo, useState } from 'react';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

export type PortalTheme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'chatboc_portal_theme';

const getSystemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const applyThemeClass = (theme: PortalTheme) => {
  const root = document.documentElement;
  const shouldEnableDark = theme === 'dark' || (theme === 'system' && getSystemPrefersDark());
  root.classList.toggle('dark', shouldEnableDark);
};

export const usePortalTheme = () => {
  const [theme, setTheme] = useState<PortalTheme>(() => {
    try {
      const stored = safeLocalStorage.getItem(STORAGE_KEY) as PortalTheme | null;
      return stored ?? 'system';
    } catch {
      return 'system';
    }
  });

  const active = useMemo<PortalTheme>(() => {
    if (theme === 'system') {
      return getSystemPrefersDark() ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  useEffect(() => {
    applyThemeClass(theme);
    try {
      safeLocalStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const listener = (event: MediaQueryListEvent) => {
      if (theme === 'system') {
        applyThemeClass(event.matches ? 'dark' : 'light');
      }
    };

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    mediaQuery?.addEventListener('change', listener);
    return () => mediaQuery?.removeEventListener('change', listener);
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, active, setTheme, toggle };
};
