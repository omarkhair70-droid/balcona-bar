import { type ReactNode } from "react";

export default function PlatformLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <section className="min-h-screen bg-background text-foreground">
      {children}
    </section>
  );
}
