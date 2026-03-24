"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Upload, Table2, History, Key, Sheet, Settings, Box, Scissors
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";

function NavItem({
  href, label, icon: Icon,
}: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-accent text-white"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
      )}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { t } = useLocale();

  const WORKFLOW_NAV = [
    { href: "/local-generate", label: t("localGenerate"), icon: Upload },
    { href: "/sheet-generate", label: t("sheetGenerate"), icon: Table2 },
    { href: "/seg-generate",   label: t("segGenerate"),   icon: Scissors },
    { href: "/runs",           label: t("runs"),          icon: History },
  ];

  const CONFIG_NAV = [
    { href: "/api-keys",     label: t("apiKeys"),     icon: Key },
    { href: "/google-sheet", label: t("googleSheet"), icon: Sheet },
    { href: "/settings",     label: t("settings"),    icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-[248px] bg-bg-surface border-r border-border flex flex-col z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Box size={14} className="text-white" />
        </div>
        <span className="text-text-primary font-semibold text-sm">BuyBox</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted px-3 mb-2">
            {t("workflow")}
          </p>
          <div className="space-y-0.5">
            {WORKFLOW_NAV.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted px-3 mb-2">
            {t("config")}
          </p>
          <div className="space-y-0.5">
            {CONFIG_NAV.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
