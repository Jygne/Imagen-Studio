import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/shared/components/layout/AppShell";

export const metadata: Metadata = {
  title: "BuyBox v2",
  description: "Batch content production workbench",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
