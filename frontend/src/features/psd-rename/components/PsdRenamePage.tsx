"use client";
import Link from "next/link";
import { usePsdRename } from "../hooks/usePsdRename";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import {
  FolderOpen, Play, Loader2, AlertTriangle, FileImage,
  RefreshCw, X, Square,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";

export function PsdRenamePage() {
  const { t } = useLocale();
  const {
    inputDir,
    outputDirectory,
    previewItems,
    totalScanned,
    loadingDir,
    loadingPreview,
    pickInputDir,
    rescan,
    removeItem,
    executing,
    executeBatch,
    cancelBatch,
    canExecute,
    activeRun,
    error,
    namePixel, setNamePixel,
    nameShape, setNameShape,
    deleteHidden, setDeleteHidden,
    flattenGroups, setFlattenGroups,
    skipNoText, setSkipNoText,
  } = usePsdRename();

  const outputDirMissing = !outputDirectory;
  const hasPreview = previewItems.length > 0 || totalScanned > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{t("psdRenameTitle")}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("psdRenameDesc")}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1fr_420px] gap-4">
        {/* Left: Configuration */}
        <div className="space-y-4">
          {/* Input Directory */}
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">{t("inputFolder")}</h2>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary truncate">
                {inputDir || <span className="text-text-muted">{t("noFolderSelected")}</span>}
              </div>
              <button
                onClick={pickInputDir}
                disabled={loadingDir || loadingPreview}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {loadingDir ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                {t("browse")}
              </button>
              {inputDir && (
                <button
                  onClick={rescan}
                  disabled={loadingPreview}
                  title={t("rescan")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {loadingPreview ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {t("rescan")}
                </button>
              )}
            </div>
          </div>

          {/* Output dir warning */}
          {outputDirMissing && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-status-warning/10 border border-status-warning/20 rounded-lg text-status-warning text-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                {t("outputDirWarning")}{" "}
                <Link href="/settings" className="underline hover:opacity-80">
                  {t("goToSettings")}
                </Link>{" "}
                {t("configureHint")}
              </span>
            </div>
          )}

          {/* Layer Naming Config */}
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">{t("psdNamingConfig")}</h2>
            <div className="space-y-2">
              {/* Text — fixed */}
              <div className="flex items-center gap-3 px-3 py-2 bg-bg-input rounded-lg">
                <span className="text-xs text-text-muted w-40 shrink-0">{t("psdTextLayerNote")}</span>
              </div>
              {/* Frame — fixed */}
              <div className="flex items-center gap-3 px-3 py-2 bg-bg-input rounded-lg">
                <span className="text-xs text-text-muted w-40 shrink-0">{t("psdFrameLayerNote")}</span>
              </div>
              {/* Pixel */}
              <div className="flex items-center gap-3 px-3 py-2 border border-border rounded-lg">
                <span className="text-xs text-text-secondary w-40 shrink-0">{t("psdPixelLayerLabel")}</span>
                <span className="text-text-muted text-xs">→</span>
                <input
                  type="text"
                  value={namePixel}
                  onChange={(e) => setNamePixel(e.target.value)}
                  className="flex-1 bg-bg-input border border-border rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              {/* Shape */}
              <div className="flex items-center gap-3 px-3 py-2 border border-border rounded-lg">
                <span className="text-xs text-text-secondary w-40 shrink-0">{t("psdShapeLayerLabel")}</span>
                <span className="text-text-muted text-xs">→</span>
                <input
                  type="text"
                  value={nameShape}
                  onChange={(e) => setNameShape(e.target.value)}
                  className="flex-1 bg-bg-input border border-border rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="mt-3 space-y-1.5">
              {[
                { label: t("psdDeleteHidden"), value: deleteHidden, set: setDeleteHidden },
                { label: t("psdFlattenGroups"), value: flattenGroups, set: setFlattenGroups },
                { label: t("psdSkipNoText"), value: skipNoText, set: setSkipNoText },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => set(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-accent"
                  />
                  <span className="text-xs text-text-secondary">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Execute / Cancel Button */}
          {executing ? (
            <button
              onClick={cancelBatch}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-status-error hover:bg-status-error/80 transition-colors"
            >
              <Square size={13} fill="currentColor" /> {t("stopBatch")}
            </button>
          ) : (
            <button
              onClick={executeBatch}
              disabled={!canExecute}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={15} /> {t("startPsdRename")} ({previewItems.length} {t("psdFiles")})
            </button>
          )}
        </div>

        {/* Right: Batch Preview */}
        <div className="space-y-4">
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary">{t("batchPreview")}</h2>
              {loadingPreview && <Loader2 size={13} className="animate-spin text-text-muted" />}
            </div>

            {/* Active Run Progress */}
            {activeRun && (
              <div className="mb-4 p-3 bg-bg-input border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <StatusBadge status={activeRun.status} />
                  <span className="text-xs text-text-secondary font-mono">
                    {activeRun.success + activeRun.failed + activeRun.skipped} / {activeRun.total}
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      activeRun.status === "failed" ? "bg-status-error" : "bg-accent"
                    )}
                    style={{
                      width: activeRun.total > 0
                        ? `${Math.round(((activeRun.success + activeRun.failed + activeRun.skipped) / activeRun.total) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
                <div className="flex gap-3 mt-2 text-xs">
                  <span className="text-status-success">✓ {activeRun.success}</span>
                  <span className="text-status-error">✗ {activeRun.failed}</span>
                  <span className="text-status-warning">⊘ {activeRun.skipped}</span>
                </div>
              </div>
            )}

            {hasPreview ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded border border-accent/20">
                    {previewItems.length} {t("psdFiles")}
                  </span>
                  {previewItems.length < totalScanned && (
                    <span className="text-xs text-text-muted">
                      {totalScanned - previewItems.length} {t("removed")}
                    </span>
                  )}
                </div>

                {/* Scrollable thumbnail grid */}
                <div className="overflow-y-auto max-h-[420px] pr-1">
                  <div className="grid grid-cols-4 gap-2">
                    {previewItems.map((item) => (
                      <div
                        key={item.index}
                        className="aspect-square rounded-lg overflow-hidden bg-bg-input border border-border relative group"
                      >
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileImage size={16} className="text-text-muted" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate">{item.filename}</p>
                        </div>
                        <button
                          onClick={() => removeItem(item.index)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-status-error transition-all"
                          title={t("removed")}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <FolderOpen size={24} className="text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">
                  {loadingPreview ? t("scanningFolder") : t("selectFolderHint")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
