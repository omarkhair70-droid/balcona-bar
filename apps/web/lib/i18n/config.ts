export const SUPPORTED_LOCALES = ["en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocaleDirection = "ltr" | "rtl";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "balcona_locale";
export const LOCALE_STORAGE_KEY = "balcona.locale";

export const LANGUAGE_OPTIONS: Array<{
  locale: Locale;
  label: string;
  nativeLabel: string;
}> = [
  { locale: "en", label: "English", nativeLabel: "English" },
  { locale: "ar", label: "Arabic", nativeLabel: "العربية" }
];

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    SUPPORTED_LOCALES.includes(value.toLowerCase() as Locale)
  );
}

export function normalizeLocale(value?: string | null): Locale | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (isSupportedLocale(normalized)) {
    return normalized;
  }

  const language = normalized.split(/[-_,;]/)[0];

  return isSupportedLocale(language) ? language : undefined;
}

export function resolveLocale(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);

    if (locale) {
      return locale;
    }
  }

  return DEFAULT_LOCALE;
}

export function getLocaleDirection(locale: Locale): LocaleDirection {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getClientLocaleSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  let storedLocale: string | null = null;

  try {
    storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    storedLocale = null;
  }

  return resolveLocale(
    storedLocale,
    document.documentElement.lang,
    navigator.language
  );
}
