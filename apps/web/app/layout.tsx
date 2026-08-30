import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { type ReactNode } from "react";
import "./globals.css";
import { ObservabilityRouteTracker } from "@/components/debug/observability-route-tracker";
import { I18nProvider } from "@/lib/i18n/i18n-provider";
import {
  getLocaleDirection,
  LOCALE_COOKIE_NAME,
  resolveLocale
} from "@/lib/i18n/config";
import { QueryProvider } from "@/lib/query/query-provider";
import { ThemeProvider } from "@/lib/theme/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "Balcona — Hospitality Operating System",
    template: "%s · Balcona"
  },
  description:
    "One connected operating system for the guest, service floor, kitchen and back office.",
  applicationName: "Balcona",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#C68A4A",
  colorScheme: "dark"
};

async function getInitialLocale() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  return resolveLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerStore.get("accept-language")
  );
}

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getInitialLocale();

  return (
    <html lang={locale} dir={getLocaleDirection(locale)} suppressHydrationWarning>
      <body>
        <QueryProvider>
          <I18nProvider initialLocale={locale}>
            <ThemeProvider>
              <ObservabilityRouteTracker />
              {children}
            </ThemeProvider>
          </I18nProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
