"use client";
import Link from "next/link";
import { useLocalGenerate } from "../hooks/useLocalGenerate";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import { FolderOpen, Play, Loader2, AlertTriangle, ImageIcon, RefreshCw, X, Square } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { Provider } from "@/shared/types/common";
import { useLocale } from "@/shared/lib/i18n";

const PROVIDER_MODELS: Record<Provider, string[]> = {
  openai: ["gpt-image-1.5"],
  openrouter: [
    "google/gemini-2.5-flash-image",
    "google/gemini-3.1-flash-image-preview",
  ],
};

export function LocalGeneratePage() {
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
    provider, setProvider,
    model, setModel,
    size, setSize,
    quality, setQuality,
    promptOverride, setPromptOverride,
    executing, executeBatch, cancelBatch, canExecute,
    activeRun,
    error,
  } = useLocalGenerate();

  const outputDirMissing = !outputDirectory;
  const hasPreview = previewItems.length > 0 || totalScanned > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{t("lgTitle")}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("lgDesc")}</p>
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

          {/* Provider / Model / Size / Quality */}
          <div className="bg-bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">{t("configuration")}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
                  {t("imageProvider")}
                </label>
                <select
                  value={`${provider}:${model}`}
                  onChange={(e) => {
                    const [p, ...m] = e.target.value.split(":");
                    setProvider(p as Provider);
                    setModel(m.join(":"));
                  }}
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none"
                >
                  <optgroup label="OpenAI">
                    {PROVIDER_MODELS.openai.map((m) => (
                      <option key={m} value={`openai:${m}`}>OpenAI · {m}</option>
                    ))}
                  </optgroup>
                  <optgroup label="OpenRouter">
                    {PROVIDER_MODELS.openrouter.map((m) => (
                      <option key={m} value={`openrouter:${m}`}>OpenRouter · {m.replace("google/", "")}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">{t("sizePx")}</label>
                  <select value={size} onChange={(e) => setSize(e.target.value)}
                    className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent appearance-none">
                    {["1024x1024", "1536x1024", "1024x1536", "auto"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">{t("quality")}</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value)}
                    className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent appearance-none">
                    {["low", "medium", "high", "auto"].map((q) => (
                      <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
                  {t("promptLabel")}
                  <span className="ml-1 text-text-muted normal-case font-normal">{t("promptOverrideHint")}</span>
                </label>
                <textarea
                  value={promptOverride}
                  onChange={(e) => setPromptOverride(e.target.value)}
                  rows={5}
                  placeholder={t("promptPlaceholder")}
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none font-mono"
                />
              </div>
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
              <Play size={15} /> {t("startGeneration")} ({previewItems.length} {t("images")})
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
                {/* LCD 双列显示 */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-bg-base rounded-lg px-3 py-2">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">processed</p>
                    <p className="lcd text-2xl">
                      {String(activeRun.success + activeRun.failed + activeRun.skipped).padStart(4, "0")}
                    </p>
                  </div>
                  <div className="flex-1 bg-bg-base rounded-lg px-3 py-2">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">total</p>
                    <p className="lcd text-2xl">
                      {String(activeRun.total).padStart(4, "0")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <StatusBadge status={activeRun.status} />
                  <div className="flex gap-3 text-xs">
                    <span className="text-status-success">✓ {activeRun.success}</span>
                    <span className="text-status-error">✗ {activeRun.failed}</span>
                    <span className="text-status-warning">⊘ {activeRun.skipped}</span>
                  </div>
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
                        : "0%"
                    }}
                  />
                </div>
              </div>
            )}

            {hasPreview ? (
              <div>
                {/* Summary */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded border border-accent/20">
                    {previewItems.length} {t("images")}
                  </span>
                  {previewItems.length < totalScanned && (
                    <span className="text-xs text-text-muted">
                      {totalScanned - previewItems.length} {t("removed")}
                    </span>
                  )}
                </div>

                {/* Scrollable thumbnail grid: 4 columns, all images */}
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
                            <ImageIcon size={16} className="text-text-muted" />
                          </div>
                        )}
                        {/* Filename on hover */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate">{item.filename}</p>
                        </div>
                        {/* Delete button on hover */}
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
