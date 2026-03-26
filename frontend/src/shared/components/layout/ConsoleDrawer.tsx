"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { X, RefreshCw, ChevronDown } from "lucide-react";
import { logsApi } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

const LINE_COLORS: { pattern: RegExp; cls: string }[] = [
  { pattern: /\bERROR\b|\bException\b|\bTraceback\b/i, cls: "text-red-400" },
  { pattern: /\bWARNING\b|\bWARN\b/i, cls: "text-yellow-400" },
  { pattern: /\[piseg\]|\[seg_worker\]|\[psd_builder\]/i, cls: "text-blue-400" },
  { pattern: /\[executor\]/i, cls: "text-purple-400" },
];

function colorLine(line: string): string {
  for (const { pattern, cls } of LINE_COLORS) {
    if (pattern.test(line)) return cls;
  }
  return "text-text-secondary";
}

export function ConsoleDrawer({ open, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logsApi.get(500);
      setLines((res.data as { lines: string[]; total: number }).lines);
      setTotal((res.data as { lines: string[]; total: number }).total);
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, open]);

  // Fetch on open, then poll if autoRefresh
  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetchLogs();
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, autoRefresh, fetchLogs]);

  if (!open) return null;

  return (
    <div className="fixed bottom-0 left-[248px] right-0 z-50 flex flex-col bg-[#0d0d0d] border-t border-border shadow-2xl"
      style={{ height: "340px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-text-primary font-mono">Console</span>
          <span className="text-xs text-text-muted font-mono">
            {total > 0 && `${total} lines total`}
          </span>
          {loading && (
            <RefreshCw size={11} className="text-text-muted animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors",
              autoRefresh
                ? "border-blue-500 text-blue-400 bg-blue-500/10"
                : "border-border text-text-muted hover:text-text-primary"
            )}
          >
            <RefreshCw size={10} className={autoRefresh ? "animate-spin" : ""} />
            {autoRefresh ? "Auto" : "Manual"}
          </button>
          <button
            onClick={fetchLogs}
            className="px-2 py-0.5 rounded text-xs border border-border text-text-muted hover:text-text-primary transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
            title="Scroll to bottom"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Log lines */}
      <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs leading-5">
        {lines.length === 0 ? (
          <span className="text-text-muted">No log output yet. Start a batch to see logs here.</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={cn("whitespace-pre-wrap break-all", colorLine(line))}>
              {line || "\u00a0"}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
