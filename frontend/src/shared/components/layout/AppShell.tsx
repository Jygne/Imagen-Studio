import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LocaleProvider } from "@/shared/lib/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="min-h-screen bg-bg-base">
        <Sidebar />
        <TopBar />
        <main className="ml-[248px] pt-[52px] min-h-screen">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </LocaleProvider>
  );
}
