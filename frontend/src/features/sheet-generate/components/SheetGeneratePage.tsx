"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSheetGenerate } from "../hooks/useSheetGenerate";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import {
  CheckCircle, XCircle, AlertCircle, Loader2,
  RefreshCw, Play, ExternalLink, AlertTriangle
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";
import type { WorkflowType, Provider } from "@/shared/types/common";

const PROVIDER_MODELS: Record<Provider, string[]> = {
  openai: ["gpt-image-1.5"],
  openrouter: [
    "google/gemini-2.5-flash-image",
    "google/gemini-3.1-flash-image-preview",
  ],
};

function WorkflowToggle({
  value, onChange
}: { value: WorkflowType; onChange: (v: WorkflowType) => void }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center bg-bg-input border border-border rounded-lg p-1 gap-1">
      {(["clean_image", "selling_point"] as WorkflowType[]).map((type) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            value === type
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {type === "clean_image" ? t("workflowClean") : t("workflowSelling")}
        </button>
      ))}
    </div>
  );
}

function StatusIndicator({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {ok === null ? <AlertCircle size={13} className="text-text-muted shrink-0" /> :
       ok ? <CheckCircle size={13} className="text-status-success shrink-0" /> :
            <XCircle size={13} className="text-status-error shrink-0" />}
      <div className="min-w-0">
        <span className="text-sm text-text-primary">{label}</span>
        {detail && <span className="ml-2 text-xs text-text-secondary truncate">{detail}</span>}
      </div>
    </div>
  );
}

export function SheetGeneratePage() {
  const { t } = useLocale();
  const {
    workflowType, switchWorkflow,
    status, loadingStatus, refreshStatus,
    preview, loadingPreview,
    provider, setProvider, model, setModel,
    size, setSize, quality, setQuality,
    promptOverride, setPromptOverride,
    executing, executeBatch,
    activeRun, outputDirectory, error,
  } = useSheetGenerate();

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status?.connected) {
      switchWorkflow(workflowType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  const currentTabValidation = workflowType === "clean_image"
    ? status?.clean_tab_validation
    : status?.selling_point_tab_validation;

  const headersOk = currentTabValidation?.valid ?? false;
  const outputDirMissing = !outputDirectory;
  const canExecute = status?.connected && headersOk && !executing && (preview?.total_yes_rows ?? 0) > 0 && !outputDirMissing;

  const getTabName = () => workflowType === "clean_image"
    ? (status?.clean_tab_validation?.tab ?? "—")
    : (status?.selling_point_tab_validation?.tab ?? "—");

  const tabDetail = currentTabValidation?.missing.length
    ? `${t("sgMissing")} ${currentTabValidation.missing.join(", ")}`
    : currentTabValidation?.valid ? t("sgHeadersOk") : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{t("sgTitle")}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("sgDesc")}</p>
        </div>
        <WorkflowToggle value={workflowType} onChange={switchWorkflow} />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1fr_420px] gap-4">
        {/* Left: Configuration */}
        <div className="space-y-4">
          {/* Sheet Status Bar */}
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                {t("connectionStatus")}
                {loadingStatus && <Loader2 size={13} className="animate-spin text-text-muted" />}
              </h2>
              <div className="flex items-center gap-2">
                <Link href="/google-sheet" className="text-xs text-accent hover:underline flex items-center gap-1">
                  <ExternalLink size={10} /> {t("configure")}
                </Link>
                <button
                  onClick={refreshStatus}
                  disabled={loadingStatus}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary border border-border px-2 py-1 rounded-lg hover:bg-bg-hover transition-colors"
                >
                  <RefreshCw size={10} className={loadingStatus ? "animate-spin" : ""} />
                  {t("refresh")}
                </button>
              </div>
            </div>

            {status ? (
              <div className="divide-y divide-border/40">
                <StatusIndicator
                  ok={status.connected}
                  label={t("spreadsheet")}
                  detail={status.spreadsheet_title ?? status.spreadsheet_id ?? undefined}
                />
                <StatusIndicator
                  ok={status.service_account_configured}
                  label={t("serviceAccount")}
                  detail={status.service_account_email ?? undefined}
                />
                <StatusIndicator
                  ok={currentTabValidation?.valid ?? null}
                  label={`${t("tabLabel")} ${getTabName()}`}
                  detail={tabDetail}
                />
              </div>
            ) : (
              <p className="text-xs text-text-muted py-2">{t("sgClickRefresh")}</p>
            )}
          </div>

          {/* Provider/Model/Size/Quality */}
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
                  {workflowType === "clean_image" ? t("sgPromptClean") : t("sgPromptSelling")}
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

          {/* Execute Button */}
          <button
            onClick={executeBatch}
            disabled={!canExecute}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {executing ? (
              <><Loader2 size={15} className="animate-spin" /> {t("sgRunningBatch")}</>
            ) : (
              <><Play size={15} /> {t("sgStartGeneration")} ({preview?.total_yes_rows ?? 0} {t("sgRows")})</>
            )}
          </button>
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
                        : "0%"
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

            {preview ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-text-secondary">
                    {t("tabLabel")} <span className="font-mono text-text-primary">{preview.tab}</span>
                  </span>
                  <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded border border-accent/20">
                    {preview.total_yes_rows} {t("sgRowsGenerate")}
                  </span>
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-2 text-text-muted font-medium">{t("rowLabel")}</th>
                      <th className="text-left py-2 pr-2 text-text-muted font-medium">{t("modelId")}</th>
                      {workflowType === "selling_point" && (
                        <th className="text-left py-2 text-text-muted font-medium">{t("variation")}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview_rows.map((row) => (
                      <tr key={row.row_index} className="border-b border-border/30 hover:bg-bg-hover/30">
                        <td className="py-2 pr-2 text-text-muted font-mono">{row.row_index}</td>
                        <td className="py-2 pr-2 text-text-primary max-w-[120px] truncate">
                          {row.bb_model_id || "—"}
                        </td>
                        {workflowType === "selling_point" && (
                          <td className="py-2 text-text-secondary max-w-[100px] truncate">
                            {row.variation_1_value || "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {preview.total_yes_rows > 5 && (
                  <p className="text-xs text-text-muted mt-2 text-center">
                    {t("sgShowingFirst")} {preview.total_yes_rows} {t("sgRows")}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-text-muted">
                  {status?.connected ? t("sgConnectHint") : t("sgConfigureHint")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
