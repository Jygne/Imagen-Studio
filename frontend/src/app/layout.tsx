import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/shared/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Imgen Studio",
  description: "Batch image generation workbench",
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
