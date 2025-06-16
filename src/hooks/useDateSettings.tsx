import React, { useContext, useState } from 'react';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { TIMEZONE, LOCALE } from '@/config';

interface DateSettingsContextValue {
  timezone: string;
  locale: string;
  updateSettings: (tz: string, loc: string) => void;
}

const DateSettingsContext = React.createContext<DateSettingsContextValue>({
  timezone: TIMEZONE,
  locale: LOCALE,
  updateSettings: () => {},
});

export const DateSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const browserTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined;
  const [timezone, setTimezone] = useState(
    safeLocalStorage.getItem('timezone') || browserTz || TIMEZONE
  );
  const [locale, setLocale] = useState(
    safeLocalStorage.getItem('locale') || LOCALE
  );

  const updateSettings = (tz: string, loc: string) => {
    safeLocalStorage.setItem('timezone', tz);
    safeLocalStorage.setItem('locale', loc);
    setTimezone(tz);
    setLocale(loc);
  };

  return (
    <DateSettingsContext.Provider value={{ timezone, locale, updateSettings }}>
      {children}
    </DateSettingsContext.Provider>
  );
};

export function useDateSettings() {
  return useContext(DateSettingsContext);
}
