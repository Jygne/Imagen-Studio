"use client";
import { useState, useEffect } from "react";
import { useGoogleSheet } from "../hooks/useGoogleSheet";
import {
  Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw, Eye
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";
import type { HeaderValidationResult } from "@/shared/types/common";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text" value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
    />
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean | null; detail?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
      <div className="mt-0.5">
        {ok === null ? <AlertCircle size={14} className="text-text-muted" /> :
         ok ? <CheckCircle size={14} className="text-status-success" /> :
              <XCircle size={14} className="text-status-error" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">{label}</p>
        {detail && <p className="text-xs text-text-secondary mt-0.5 truncate">{detail}</p>}
      </div>
    </div>
  );
}

function HeaderBadge({ name, present }: { name: string; present: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono",
      present
        ? "bg-status-success/10 text-status-success border border-status-success/20"
        : "bg-status-error/10 text-status-error border border-status-error/20"
    )}>
      {present ? "✓" : "✗"} {name}
    </span>
  );
}

function HeaderValidationBlock({ result }: { result: HeaderValidationResult }) {
  const { t } = useLocale();
  return (
    <div className="mt-3">
      <p className="text-xs text-text-secondary mb-2 font-medium">
        {t("tabLabel")} <span className="text-text-primary font-mono">{result.tab}</span>
        <span className={cn("ml-2 text-xs", result.valid ? "text-status-success" : "text-status-error")}>
          {result.valid
            ? t("allHeadersPresent")
            : `${t("missingHeaders")} ${result.missing.length} ${t("headerCount")}`}
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {result.present.map((h) => <HeaderBadge key={h} name={h} present={true} />)}
        {result.missing.map((h) => <HeaderBadge key={h} name={h} present={false} />)}
      </div>
    </div>
  );
}

export function GoogleSheetPage() {
  const { t } = useLocale();
  const {
    config, status, preview,
    loading, validating, saving, saved, error,
    saveConfig, validateAndRefresh, fetchPreview,
  } = useGoogleSheet();

  const [form, setForm] = useState({
    spreadsheet_url: "",
    clean_tab: "Sheet1",
    selling_point_tab: "SellingPoint",
    service_account_json: "",
  });

  useEffect(() => {
    if (config) {
      setForm({
        spreadsheet_url: config.spreadsheet_url || "",
        clean_tab: config.clean_tab || "Sheet1",
        selling_point_tab: config.selling_point_tab || "SellingPoint",
        service_account_json: "",
      });
    }
  }, [config]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary mt-8">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">{t("loading")}</span>
      </div>
    );
  }

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const updates: Record<string, string> = {
      spreadsheet_url: form.spreadsheet_url,
      clean_tab: form.clean_tab,
      selling_point_tab: form.selling_point_tab,
    };
    if (form.service_account_json.trim()) {
      updates.service_account_json = form.service_account_json.trim();
    }
    await saveConfig(updates);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">{t("gsTitle")}</h1>
        <p className="text-sm text-text-secondary mt-1">{t("gsDesc")}</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1fr_360px] gap-4 max-w-5xl">
        {/* Left: Config Form */}
        <div className="space-y-4">
          {/* Spreadsheet */}
          <div className="bg-bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">{t("spreadsheet")}</h2>
            <Field label={t("gsUrl")}>
              <Input
                value={form.spreadsheet_url}
                onChange={set("spreadsheet_url")}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("cleanTab")}>
                <Input value={form.clean_tab} onChange={set("clean_tab")} placeholder="Sheet1" />
              </Field>
              <Field label={t("sellingPointTab")}>
                <Input value={form.selling_point_tab} onChange={set("selling_point_tab")} placeholder="SellingPoint" />
              </Field>
            </div>
          </div>

          {/* Service Account */}
          <div className="bg-bg-surface border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{t("serviceAccount")}</h2>
              {config?.has_service_account && (
                <span className="text-xs text-status-success flex items-center gap-1">
                  <CheckCircle size={11} /> {t("configured")}
                </span>
              )}
            </div>
            <Field label={t("serviceAccountJson")}>
              <textarea
                value={form.service_account_json}
                onChange={(e) => set("service_account_json")(e.target.value)}
                rows={8}
                placeholder={config?.has_service_account
                  ? t("pasteNewJson")
                  : '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </Field>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> {t("saving")}</> :
             saved  ? <><CheckCircle size={14} /> {t("saved")}</> :
                       t("saveConfiguration")}
          </button>
        </div>

        {/* Right: Status + Validation */}
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary">{t("connectionStatus")}</h2>
              <button
                onClick={validateAndRefresh}
                disabled={validating}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border px-2.5 py-1.5 rounded-lg hover:bg-bg-hover transition-colors disabled:opacity-50"
              >
                <RefreshCw size={11} className={validating ? "animate-spin" : ""} />
                {validating ? t("validating") : t("validate")}
              </button>
            </div>

            {status ? (
              <div>
                <StatusRow
                  label={t("spreadsheet")}
                  ok={status.connected}
                  detail={status.spreadsheet_title ?? status.connection_error ?? undefined}
                />
                <StatusRow
                  label={t("serviceAccount")}
                  ok={status.service_account_configured}
                  detail={status.service_account_email ?? undefined}
                />
                {status.clean_tab_validation && (
                  <StatusRow
                    label={`${t("cleanTab")} (${status.clean_tab_validation.tab})`}
                    ok={status.clean_tab_validation.valid}
                    detail={status.clean_tab_validation.missing.length > 0
                      ? `${t("missingHeaders")}: ${status.clean_tab_validation.missing.join(", ")}`
                      : t("allRequiredHeaders")}
                  />
                )}
                {status.selling_point_tab_validation && (
                  <StatusRow
                    label={`${t("sellingPointTab")} (${status.selling_point_tab_validation.tab})`}
                    ok={status.selling_point_tab_validation.valid}
                    detail={status.selling_point_tab_validation.missing.length > 0
                      ? `${t("missingHeaders")}: ${status.selling_point_tab_validation.missing.join(", ")}`
                      : t("allRequiredHeaders")}
                  />
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted py-2">{t("clickValidate")}</p>
            )}
          </div>

          {/* Header Validation Detail */}
          {status && (status.clean_tab_validation || status.selling_point_tab_validation) && (
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-3">{t("headerProtocol")}</h2>
              {status.clean_tab_validation && (
                <HeaderValidationBlock result={status.clean_tab_validation} />
              )}
              {status.selling_point_tab_validation && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <HeaderValidationBlock result={status.selling_point_tab_validation} />
                </div>
              )}
            </div>
          )}

          {/* Preview Trigger */}
          {status?.connected && (
            <div className="bg-bg-surface border border-border rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">{t("dataPreview")}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchPreview("clean_image")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <Eye size={11} /> {t("workflowClean")}
                </button>
                <button
                  onClick={() => fetchPreview("selling_point")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <Eye size={11} /> {t("workflowSelling")}
                </button>
              </div>
              {preview && (
                <div>
                  <p className="text-xs text-text-secondary mb-2">
                    {t("tabLabel")} <span className="text-text-primary font-mono">{preview.tab}</span> ·
                    <span className="text-accent ml-1">{preview.total_yes_rows} {t("sgRows")}</span> with generate=YES
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-1.5 pr-3 text-text-muted font-medium">#</th>
                          <th className="text-left py-1.5 pr-3 text-text-muted font-medium">bb_model_id</th>
                          <th className="text-left py-1.5 text-text-muted font-medium">{t("imageUrl")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview_rows.map((row) => (
                          <tr key={row.row_index} className="border-b border-border/30">
                            <td className="py-1.5 pr-3 text-text-muted font-mono">{row.row_index}</td>
                            <td className="py-1.5 pr-3 text-text-primary truncate max-w-[100px]">
                              {row.bb_model_id || "—"}
                            </td>
                            <td className="py-1.5 text-text-secondary truncate max-w-[140px]">
                              {row.rsku_model_image_url ? (
                                <a href={row.rsku_model_image_url} target="_blank" rel="noreferrer"
                                  className="text-accent hover:underline">
                                  {row.rsku_model_image_url.slice(0, 30)}...
                                </a>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
