"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";

interface TopBarProps {
  onToggleConsole?: () => void;
  consoleOpen?: boolean;
}

export function TopBar({ onToggleConsole, consoleOpen }: TopBarProps) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();

  const PAGE_LABELS: Record<string, string> = {
    "/local-generate": t("pageLocalGenerate"),
    "/sheet-generate": t("pageSheetGenerate"),
    "/seg-generate":   t("pageSegGenerate"),
    "/runs":           t("pageRuns"),
    "/api-keys":       t("pageApiKeys"),
    "/google-sheet":   t("pageGoogleSheet"),
    "/settings":       t("pageSettings"),
  };

  const pageLabel = PAGE_LABELS[pathname] ?? "";

  return (
    <header className="fixed top-0 left-[248px] right-0 h-[52px] bg-bg-surface border-b border-border flex items-center justify-between px-6 z-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <span className="text-text-muted">Imagen Studio</span>
        {pageLabel && (
          <>
            <span className="text-text-muted">/</span>
            <span className="text-text-primary font-medium">{pageLabel}</span>
          </>
        )}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={() => setLocale(locale === "en" ? "zh" : "en")}
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
            "border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover"
          )}
          title="Switch language / 切换语言"
        >
          {locale === "en" ? "中文" : "EN"}
        </button>

        <button
          onClick={onToggleConsole}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors",
            consoleOpen
              ? "border-blue-500 text-blue-400 bg-blue-500/10"
              : "border-border text-text-secondary hover:border-border hover:text-text-primary hover:bg-bg-hover"
          )}
        >
          <Terminal size={14} />
          {t("console")}
        </button>
        <Link
          href="/sheet-generate"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors"
        >
          <Plus size={14} />
          {t("newBatch")}
        </Link>
      </div>
    </header>
  );
}
