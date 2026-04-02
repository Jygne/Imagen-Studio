"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Upload, Table2, History, Key, Sheet, Settings, Scissors, Layers
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";
import { useRunsNotification } from "@/shared/contexts/RunsNotificationContext";

function PixelLogo() {
  // 方案A: 4×4 pixel mosaic, main-diagonal gradient (top-left↔bottom-right bright)
  const grid = [
    [1.00, 0.60, 0.25, 0.08],
    [0.75, 1.00, 0.60, 0.25],
    [0.25, 0.60, 1.00, 0.75],
    [0.08, 0.25, 0.60, 1.00],
  ];
  const s = 3;    // square size
  const g = 0.6;  // gap
  const step = s + g;
  const offset = (14 - (4 * s + 3 * g)) / 2;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      {grid.map((row, ri) =>
        row.map((opacity, ci) => (
          <rect
            key={`${ri}-${ci}`}
            x={offset + ci * step}
            y={offset + ri * step}
            width={s}
            height={s}
            rx={0.5}
            fill="white"
            fillOpacity={opacity}
          />
        ))
      )}
    </svg>
  );
}

function NavItem({
  href, label, icon: Icon, badge,
}: { href: string; label: string; icon: React.ElementType; badge?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
        active
          ? "text-accent"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
      )}
      style={active ? { backgroundColor: "rgba(232, 134, 58, 0.12)" } : undefined}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />
      )}
      <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
      {label}
      {badge && (
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block ml-1" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const { t } = useLocale();
  const { hasUnread } = useRunsNotification();

  const WORKFLOW_NAV = [
    { href: "/local-generate", label: t("localGenerate"), icon: Upload },
    { href: "/sheet-generate", label: t("sheetGenerate"), icon: Table2 },
    { href: "/seg-generate",   label: t("segGenerate"),   icon: Scissors },
    { href: "/psd-rename",     label: t("psdRename"),     icon: Layers },
    { href: "/runs",           label: t("runs"),          icon: History, badge: hasUnread },
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
          <PixelLogo />
        </div>
        <span className="text-text-primary font-semibold text-sm">Imagen Studio</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted px-3 mb-3">
            {t("workflow")}
          </p>
          <div className="space-y-0.5">
            {WORKFLOW_NAV.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted px-3 mb-3">
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
