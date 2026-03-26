"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ConsoleDrawer } from "./ConsoleDrawer";
import { LocaleProvider } from "@/shared/lib/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [consoleOpen, setConsoleOpen] = useState(false);

  return (
    <LocaleProvider>
      <div className="min-h-screen bg-bg-base">
        <Sidebar />
        <TopBar onToggleConsole={() => setConsoleOpen((v) => !v)} consoleOpen={consoleOpen} />
        <main className="ml-[248px] pt-[52px] min-h-screen">
          <div className="p-8">{children}</div>
        </main>
        <ConsoleDrawer open={consoleOpen} onClose={() => setConsoleOpen(false)} />
      </div>
    </LocaleProvider>
  );
}
