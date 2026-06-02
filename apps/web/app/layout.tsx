import type { Metadata, Viewport } from "next";
import { type ReactNode } from "react";
import "./globals.css";
import { QueryProvider } from "@/lib/query/query-provider";
import { ThemeProvider } from "@/lib/theme/theme-provider";

export const metadata: Metadata = {
  title: "Balcona Bar Smart Cafe",
  description:
    "Frontend foundation for the Cafe AI Waiter App and smart cafe operating system.",
  applicationName: "Balcona Bar",
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

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
