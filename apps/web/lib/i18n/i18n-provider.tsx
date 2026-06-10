"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  getLocaleDirection,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  type Locale
} from "./config";
import { translate } from "./messages";

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function persistLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = getLocaleDirection(locale);
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale persistence is a convenience; the cookie remains the source for SSR.
  }
}

export function I18nProvider({
  initialLocale,
  children
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    persistLocale(nextLocale);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: getLocaleDirection(locale),
      setLocale,
      t: (key, values) => translate(locale, key, values)
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}

export function useTranslations(namespace?: string) {
  const { t } = useI18n();

  return useCallback(
    (key: string, values?: Record<string, string | number>) =>
      t(namespace ? `${namespace}.${key}` : key, values),
    [namespace, t]
  );
}
