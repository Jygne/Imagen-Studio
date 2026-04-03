"use client";
import { useEffect, useState } from "react";
import { useRuns } from "../hooks/useRuns";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import { formatDate, formatDuration } from "@/shared/lib/utils";
import {
  Loader2, RefreshCw, X, ChevronRight, ChevronLeft, AlertCircle, ImageOff,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";
import { segGenerateApi } from "@/shared/lib/api-client";
import { useRunsNotification } from "@/shared/contexts/RunsNotificationContext";
import type { RunDetailOut, RunItemOut, RunListItemOut, ItemStatus } from "@/shared/types/common";

// ── Thumbnail ────────────────────────────────────────────────────────────────

function Thumbnail({ url, size = 40, isPsd = false }: { url: string | null; size?: number; isPsd?: boolean }) {
  if (isPsd) {
    return (
      <div
        className="rounded bg-bg-input flex items-center justify-center"
        style={{ width: size, height: size, minWidth: size }}
      >
        <svg width="30" height="30" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* File body — diagonal fold at top-right */}
          <path d="M5 2 L17 2 L23 8 L23 26 Q23 27 22 27 L6 27 Q5 27 5 26 Z"
            fill="#6B3A18" stroke="#E8863A" strokeWidth="1.4" strokeLinejoin="round"/>
          {/* Fold flap fill */}
          <path d="M17 2 L23 8 L17 8 Z" fill="#E8863A" opacity="0.4"/>
          {/* Fold flap border */}
          <line x1="17" y1="2" x2="17" y2="8" stroke="#E8863A" strokeWidth="1.2"/>
          <line x1="17" y1="8" x2="23" y2="8" stroke="#E8863A" strokeWidth="1.2"/>
          {/* PSD banner */}
          <rect x="2" y="17.5" width="24" height="9" rx="2" fill="#E8863A"/>
          <text x="14" y="24.8" textAnchor="middle" fontSize="7.2" fontWeight="800"
            fontFamily="Arial, sans-serif" fill="white" letterSpacing="0.6">PSD</text>
        </svg>
      </div>
    );
  }
  if (url) {
    return (
      <img
        src={url}
        alt="thumbnail"
        width={size}
        height={size}
        className="rounded object-cover bg-bg-input"
        style={{ width: size, height: size, minWidth: size }}
      />
    );
  }
  return (
    <div
      className="rounded bg-bg-input flex items-center justify-center"
      style={{ width: size, height: size, minWidth: size }}
    >
      <ImageOff size={14} className="text-text-muted" />
    </div>
  );
}

// ── ItemRow ───────────────────────────────────────────────────────────────────

function ItemRow({
  item, selected, onOpenModal, onOpenDetail, workflowLabel,
}: {
  item: RunListItemOut;
  selected: boolean;
  onOpenModal: () => void;
  onOpenDetail: (e: React.MouseEvent) => void;
  workflowLabel: string;
}) {
  const itemDone =
    item.item_status === "success" ||
    item.item_status === "failed" ||
    item.item_status === "skipped";
  const isItemRunning = item.item_status === "running";
  const pct = itemDone ? 100 : 0;

  const isPsdWorkflow = item.workflow_type === "psd_rename";

  return (
    <tr
      onClick={isPsdWorkflow ? undefined : onOpenModal}
      className={cn(
        "border-b border-border/50 transition-colors group",
        isPsdWorkflow ? "cursor-default" : "cursor-pointer",
        selected ? "bg-accent/10" : "hover:bg-bg-hover/40"
      )}
    >
      <td className="py-2 px-4 w-14">
        <Thumbnail url={item.thumbnail_url} size={40} isPsd={isPsdWorkflow} />
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-mono text-text-secondary">
            {item.bb_model_id ?? `${item.run_id.slice(0, 8)}…`}
          </span>
          <span className="text-xs text-text-muted">{formatDate(item.created_at)}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-text-primary font-medium">{workflowLabel}</span>
        <span className="ml-2 text-xs text-text-muted capitalize">{item.source}</span>
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={item.item_status} />
      </td>
      <td className="py-3 px-4">
        <div className="flex-1 bg-border rounded-full h-1 w-20 overflow-hidden">
          {isItemRunning ? (
            <div className="h-1 w-1/3 rounded-full bg-accent animate-progress-slide" />
          ) : (
            <div
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                item.item_status === "failed" ? "bg-status-error" : "bg-accent"
              )}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-text-secondary">
        {item.model?.split("/").pop() ?? "—"}
      </td>
      <td className="py-3 px-4 text-xs text-text-muted">
        {formatDuration(item.item_started_at, item.item_finished_at)}
      </td>
      <td className="py-3 px-4 w-10" onClick={onOpenDetail}>
        <ChevronRight
          size={14}
          className="text-text-muted group-hover:text-text-secondary transition-colors"
        />
      </td>
    </tr>
  );
}

// ── ItemStatusDot ─────────────────────────────────────────────────────────────

function ItemStatusDot({ status }: { status: ItemStatus }) {
  const colors: Record<ItemStatus, string> = {
    pending: "bg-text-muted",
    running: "bg-accent animate-pulse",
    success: "bg-status-success",
    failed: "bg-status-error",
    skipped: "bg-status-warning",
  };
  return <span className={cn("inline-block w-2 h-2 rounded-full shrink-0 mt-1", colors[status])} />;
}

// ── DetailDrawer ──────────────────────────────────────────────────────────────

function DetailDrawer({
  detail, onClose, loading,
}: {
  detail: RunDetailOut | null; onClose: () => void; loading: boolean;
}) {
  const { t } = useLocale();

  const workflowLabels: Record<string, string> = {
    clean_image: t("workflowCleanLabel"),
    selling_point: t("workflowSellingLabel"),
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-bg-surface border-l border-border z-30 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <p className="text-sm font-semibold text-text-primary">{t("runDetail")}</p>
          {detail && (
            <p className="text-xs text-text-muted font-mono mt-0.5">{detail.id}</p>
          )}
        </div>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
          <X size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 gap-2 text-text-secondary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      ) : detail ? (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Metadata */}
          <div className="bg-bg-input border border-border rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">{t("metadataLabel")}</p>
            {[
              [t("metaWorkflow"), workflowLabels[detail.workflow_type] ?? detail.workflow_type],
              [t("metaSource"), detail.source],
              [t("metaStatus"), null],
              [t("metaProvider"), detail.provider ?? "—"],
              [t("metaModel"), detail.model ?? "—"],
              [t("metaStarted"), detail.started_at ? formatDate(detail.started_at) : "—"],
              [t("metaDuration"), formatDuration(detail.started_at, detail.finished_at)],
              ...(detail.metadata?.spreadsheet_id ? [[t("metaSheetId"), detail.metadata.spreadsheet_id as string]] : []),
              ...(detail.metadata?.tab ? [[t("metaTab"), detail.metadata.tab as string]] : []),
            ].map((entry) =>
              entry[0] === t("metaStatus") ? (
                <div key="status" className="flex items-center justify-between py-1">
                  <span className="text-xs text-text-secondary">{t("metaStatus")}</span>
                  <StatusBadge status={detail.status} />
                </div>
              ) : (
                <div
                  key={entry[0] as string}
                  className="flex items-center justify-between py-1 border-b border-border/30 last:border-0"
                >
                  <span className="text-xs text-text-secondary">{entry[0]}</span>
                  <span className="text-xs text-text-primary font-mono">{entry[1] as string}</span>
                </div>
              )
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t("statsTotal"), value: detail.total, color: "text-text-primary" },
              { label: t("statsSuccess"), value: detail.success, color: "text-status-success" },
              { label: t("statsFailed"), value: detail.failed, color: "text-status-error" },
              { label: t("statsSkipped"), value: detail.skipped, color: "text-status-warning" },
            ].map((s) => (
              <div key={s.label} className="bg-bg-input border border-border rounded-lg p-3 text-center">
                <p className={cn("text-lg font-semibold", s.color)}>{s.value}</p>
                <p className="text-xs text-text-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">{t("itemsLabel")}</p>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {detail.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-bg-input border border-border rounded-lg px-3 py-2.5 flex items-start gap-2.5"
                >
                  <ItemStatusDot status={item.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-muted">Row {item.row_index}</span>
                      {item.bb_model_id && (
                        <span className="text-xs text-text-primary truncate">{item.bb_model_id}</span>
                      )}
                    </div>
                    {item.error_reason && (
                      <p className="text-xs text-status-error mt-1 flex items-start gap-1">
                        <AlertCircle size={11} className="shrink-0 mt-0.5" />
                        {item.error_reason}
                      </p>
                    )}
                    {item.skipped_reason && (
                      <p className="text-xs text-status-warning mt-1">{item.skipped_reason}</p>
                    )}
                    {item.output_file_path && (
                      <p className="text-xs text-status-success mt-1 font-mono truncate">
                        {item.output_file_path.split(/[/\\]/).slice(-2).join("/")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── SegPreviewPanel ───────────────────────────────────────────────────────────

interface PsdLayer { name: string; data_url: string; }

function SegPreviewPanel({ outputFilePath }: { outputFilePath: string | null }) {
  const [layers, setLayers] = useState<PsdLayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!outputFilePath) { setLoading(false); return; }
    setLoading(true);
    segGenerateApi.getPsdPreviews(outputFilePath)
      .then((res) => setLayers((res.data as { layers: PsdLayer[] }).layers ?? []))
      .catch(() => setLayers([]))
      .finally(() => setLoading(false));
  }, [outputFilePath]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 text-text-muted">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-xs">Reading PSD…</p>
      </div>
    );
  }
  if (!layers.length) {
    return (
      <div className="flex flex-col items-center gap-2 text-text-muted">
        <ImageOff size={28} />
        <p className="text-xs">No segments found</p>
      </div>
    );
  }

  const cols = layers.length === 1 ? 1 : layers.length <= 4 ? 2 : 3;

  return (
    <div
      className="w-full overflow-y-auto"
      style={{ maxHeight: "calc(85vh - 120px)" }}
    >
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {layers.map((layer) => (
          <div key={layer.name} className="flex flex-col gap-1.5">
            <div
              className="rounded-lg overflow-hidden border border-border flex items-center justify-center"
              style={{
                background:
                  "repeating-conic-gradient(#2a2a2a 0% 25%, #1e1e1e 0% 50%) 0 0 / 14px 14px",
              }}
            >
              <img
                src={layer.data_url}
                alt={layer.name}
                className="w-full h-auto object-contain"
                style={{ maxHeight: layers.length === 1 ? "calc(85vh - 180px)" : "240px" }}
              />
            </div>
            <p className="text-xs text-center text-text-muted font-mono">{layer.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ComparisonModal ───────────────────────────────────────────────────────────

function ComparisonModal({
  items, index, globalIndex, totalItems, loading, workflowType, onClose, onPrev, onNext,
}: {
  items: RunItemOut[];
  index: number;
  globalIndex: number;
  totalItems: number;
  loading: boolean;
  workflowType: string | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useLocale();
  const item = items[index] ?? null;
  const hasPrevItem = globalIndex > 0;
  const hasNextItem = globalIndex < totalItems - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft" && hasPrevItem) onPrev();
      if (e.key === "ArrowRight" && hasNextItem) onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext, hasPrevItem, hasNextItem]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-bg-surface rounded-xl border border-border shadow-2xl overflow-hidden"
        style={{ width: "90vw", height: "85vh", maxWidth: 1400 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <span className="text-sm text-text-secondary">
            {loading ? `${t("loading")}` : `${globalIndex + 1} / ${totalItems}`}
          </span>
          <span className="text-sm font-medium text-text-primary">
            {item ? (item.bb_model_id ?? `Row ${item.row_index}`) : ""}
          </span>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-stretch relative overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-text-secondary">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : item ? (
            <>
              {hasPrevItem && (
                <button
                  onClick={onPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-bg-input border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors shadow-md"
                >
                  <ChevronLeft size={16} />
                </button>
              )}

              {/* Original */}
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 border-r border-border">
                <p className="text-xs font-medium text-text-muted uppercase tracking-widest">{t("original")}</p>
                {(item.source_image_access_url ?? item.source_image_url) ? (
                  <img
                    src={item.source_image_access_url ?? item.source_image_url ?? undefined}
                    alt="original"
                    className="max-w-full max-h-full object-contain rounded"
                    style={{ maxHeight: "calc(85vh - 120px)" }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <ImageOff size={32} />
                    <p className="text-sm">{t("noSourceImage")}</p>
                  </div>
                )}
              </div>

              {/* Generated */}
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                <p className="text-xs font-medium text-text-muted uppercase tracking-widest">
                  {workflowType === "seg_image" ? "SEGMENTS" : t("generated")}
                </p>
                {workflowType === "seg_image" ? (
                  item.status === "success" ? (
                    <SegPreviewPanel outputFilePath={item.output_file_path} />
                  ) : item.error_reason ? (
                    <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                      <AlertCircle size={32} className="text-status-error" />
                      <p className="text-sm text-status-error">{item.error_reason}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-text-muted">
                      <Loader2 size={32} className="animate-spin" />
                      <p className="text-sm capitalize">{item.status}…</p>
                    </div>
                  )
                ) : item.output_image_url ? (
                  <img
                    src={item.output_image_url}
                    alt="generated"
                    className="max-w-full max-h-full object-contain rounded"
                    style={{ maxHeight: "calc(85vh - 120px)" }}
                  />
                ) : item.error_reason ? (
                  <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                    <AlertCircle size={32} className="text-status-error" />
                    <p className="text-sm text-status-error">{item.error_reason}</p>
                  </div>
                ) : item.status === "running" || item.status === "pending" ? (
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <Loader2 size={32} className="animate-spin" />
                    <p className="text-sm capitalize">{item.status}…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <ImageOff size={32} />
                    <p className="text-sm">{t("noOutput")}</p>
                  </div>
                )}
              </div>

              {hasNextItem && (
                <button
                  onClick={onNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-bg-input border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors shadow-md"
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-text-muted text-sm">
              {t("noItems")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RunsPage ─────────────────────────────────────────────────────────────────

export function RunsPage() {
  const { t } = useLocale();
  const { markAllRead } = useRunsNotification();
  useEffect(() => { markAllRead(); }, [markAllRead]);
  const {
    items, totals, loading, error,
    selectedRunId, detail, loadingDetail,
    fetchItems, selectRun, closeDetail,
    modalOpen, modalItems, modalIndex, modalGlobalIndex, loadingModal, modalWorkflowType,
    openModal, closeModal, prevItem, nextItem,
  } = useRuns();

  const workflowLabels: Record<string, string> = {
    clean_image: t("workflowCleanLabel"),
    selling_point: t("workflowSellingLabel"),
  };

  return (
    <div className={cn("transition-all duration-200 ease-out", selectedRunId ? "mr-[520px]" : "")}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{t("runsTitle")}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("runsDesc")}</p>
        </div>
        <button
          onClick={() => fetchItems()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary border border-border rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {t("refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: t("totalRuns"),   value: totals.total_runs },
          { label: t("totalItems"),  value: totals.total_items },
          { label: t("succeeded"),   value: totals.total_success,  color: "#22C55E" },
          { label: t("failed"),      value: totals.total_failed,   color: "#EF4444" },
        ].map((s) => (
          <div key={s.label} className="bg-bg-surface border border-border rounded-xl p-4">
            <p
              className="text-2xl font-semibold lcd"
              style={{ color: s.color ?? "#dddcda" }}
            >{s.value}</p>
            <p className="text-xs text-text-secondary mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Items Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-text-secondary mt-8">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t("loadingRuns")}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-secondary text-sm">{t("noRuns")}</p>
        </div>
      ) : (
        <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-input/50">
                <th className="py-3 px-4 w-14" />
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wide">{t("colItem")}</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wide">{t("colWorkflow")}</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wide">{t("colStatus")}</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wide">{t("colProgress")}</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wide">{t("colModel")}</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wide">{t("colDuration")}</th>
                <th className="py-3 px-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ItemRow
                  key={item.item_id}
                  item={item}
                  selected={item.run_id === selectedRunId}
                  workflowLabel={workflowLabels[item.workflow_type] ?? item.workflow_type}
                  onOpenModal={() => openModal(item.item_id)}
                  onOpenDetail={(e) => {
                    e.stopPropagation();
                    selectRun(item.run_id);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedRunId && (
        <>
          <div className="fixed inset-0 z-20" onClick={closeDetail} />
          <DetailDrawer detail={detail} onClose={closeDetail} loading={loadingDetail} />
        </>
      )}

      {/* Comparison Modal */}
      {modalOpen && (
        <ComparisonModal
          items={modalItems}
          index={modalIndex}
          globalIndex={modalGlobalIndex}
          totalItems={items.length}
          loading={loadingModal}
          workflowType={modalWorkflowType}
          onClose={closeModal}
          onPrev={prevItem}
          onNext={nextItem}
        />
      )}
    </div>
  );
}
