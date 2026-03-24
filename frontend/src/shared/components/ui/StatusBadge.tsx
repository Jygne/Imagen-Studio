"use client";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";
import type { RunStatus, ItemStatus } from "@/shared/types/common";

type Status = RunStatus | ItemStatus | "valid" | "invalid" | "not_set" | "configured";

const STATUS_STYLES: Record<string, string> = {
  queued:     "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  running:    "bg-accent/15 text-accent border border-accent/20",
  done:       "bg-status-success/15 text-status-success border border-status-success/20",
  success:    "bg-status-success/15 text-status-success border border-status-success/20",
  failed:     "bg-status-error/15 text-status-error border border-status-error/20",
  cancelled:  "bg-text-muted/15 text-text-secondary border border-border",
  pending:    "bg-border/50 text-text-secondary border border-border",
  skipped:    "bg-status-warning/15 text-status-warning border border-status-warning/20",
  valid:      "bg-status-success/15 text-status-success border border-status-success/20",
  invalid:    "bg-status-error/15 text-status-error border border-status-error/20",
  not_set:    "bg-border/50 text-text-muted border border-border",
  configured: "bg-status-success/15 text-status-success border border-status-success/20",
};

const STATUS_DOT: Record<string, string> = {
  queued:    "bg-blue-400",
  running:   "bg-accent animate-pulse",
  done:      "bg-status-success",
  success:   "bg-status-success",
  failed:    "bg-status-error",
  cancelled: "bg-text-muted",
  pending:   "bg-text-muted",
  skipped:   "bg-status-warning",
  valid:     "bg-status-success",
  invalid:   "bg-status-error",
  not_set:   "bg-text-muted",
  configured:"bg-status-success",
};

const STATUS_KEYS: Record<string, string> = {
  queued:     "statusQueued",
  running:    "statusRunning",
  done:       "statusDone",
  success:    "statusSuccess",
  failed:     "statusFailed",
  cancelled:  "statusCancelled",
  pending:    "statusPending",
  skipped:    "statusSkipped",
};

interface Props {
  status: Status;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: Props) {
  const { t } = useLocale();
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const dot = STATUS_DOT[status] ?? STATUS_DOT.pending;
  const key = STATUS_KEYS[status];
  const text = label ?? (key ? t(key as any) : status.replace("_", " "));

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium", style, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      {text}
    </span>
  );
}
