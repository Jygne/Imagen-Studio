"use client";
import { useState, useEffect } from "react";
import { useSettings } from "../hooks/useSettings";
import { Loader2, CheckCircle, FolderOpen, AlertTriangle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { settingsApi } from "@/shared/lib/api-client";
import { useLocale } from "@/shared/lib/i18n";
import type { AppSettings } from "@/shared/types/common";


function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-bg-surface border border-border rounded-xl p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description && <p className="text-sm text-text-secondary mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary",
        "placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors",
        className
      )}
    />
  );
}


export function SettingsPage() {
  const { t } = useLocale();
  const { settings, loading, saving, saved, error, updateSettings } = useSettings();
  const [form, setForm] = useState<AppSettings | null>(null);
  const [pickingDir, setPickingDir] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  const handlePickDirectory = async () => {
    setPickingDir(true);
    setPickError(null);
    try {
      const res = await settingsApi.pickDirectory();
      if (res.data?.path) {
        setForm((prev) => prev ? { ...prev, output_directory: res.data.path } : prev);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Unknown error";
      setPickError(`${t("folderPickerFailed")} ${msg}`);
    } finally {
      setPickingDir(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex items-center gap-2 text-text-secondary mt-8">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">{t("loadingSettings")}</span>
      </div>
    );
  }

  const set = (key: keyof AppSettings) => (value: string | number) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">{t("settingsTitle")}</h1>
        <p className="text-sm text-text-secondary mt-1">{t("settingsDesc")}</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 max-w-3xl">
        {/* Output */}
        <SectionCard title={t("outputSection")} description={t("outputDesc")}>
          <Field label={t("outputDirectory")}>
            <div className="flex gap-2">
              <TextInput
                value={form.output_directory}
                onChange={set("output_directory")}
                placeholder={t("outputDirPlaceholder")}
                className="flex-1"
              />
              <button
                onClick={handlePickDirectory}
                disabled={pickingDir}
                title={t("browse")}
                className="px-3 py-2 border border-border rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                {pickingDir ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />}
              </button>
            </div>
            {!form.output_directory && (
              <p className="text-xs text-status-warning flex items-center gap-1.5 mt-1.5">
                <AlertTriangle size={11} />
                {t("outputDirRequired")}
              </p>
            )}
            {pickError && (
              <p className="text-xs text-status-error flex items-center gap-1.5 mt-1.5">
                <AlertTriangle size={11} />
                {pickError}
              </p>
            )}
          </Field>
        </SectionCard>

        {/* Execution */}
        <SectionCard title={t("executionSection")} description={t("executionDesc")}>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("maxConcurrency")}>
              <input
                type="number"
                min={1} max={20}
                value={form.max_concurrency}
                onChange={(e) => set("max_concurrency")(Number(e.target.value))}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </Field>
            <Field label={t("timeoutSeconds")}>
              <input
                type="number"
                min={10} max={600}
                value={form.timeout_seconds}
                onChange={(e) => set("timeout_seconds")(Number(e.target.value))}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </Field>
          </div>
        </SectionCard>

        {/* Seg User Token */}
        <SectionCard title={t("segUserTokenSection")} description={t("segUserTokenDesc")}>
          <Field label={t("segUserToken")}>
            <TextInput
              value={form.seg_user_token}
              onChange={set("seg_user_token")}
              placeholder={t("segUserTokenPlaceholder")}
            />
          </Field>
        </SectionCard>

        {/* Prompts */}
        <SectionCard title={t("promptsSection")} description={t("promptsDesc")}>
          <div className="space-y-4">
            <Field label={t("cleanImagePrompt")}>
              <textarea
                value={form.clean_image_prompt}
                onChange={(e) => set("clean_image_prompt")(e.target.value)}
                rows={5}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none font-mono"
              />
            </Field>
            <Field label={t("sellingPointPrompt")}>
              <textarea
                value={form.selling_point_prompt}
                onChange={(e) => set("selling_point_prompt")(e.target.value)}
                rows={5}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none font-mono"
              />
            </Field>
          </div>
        </SectionCard>
      </div>

      {/* Save Button */}
      <div className="mt-6 max-w-3xl">
        <button
          onClick={() => updateSettings(form)}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <><Loader2 size={14} className="animate-spin" /> {t("saving")}</>
          ) : saved ? (
            <><CheckCircle size={14} /> {t("saved")}</>
          ) : (
            t("saveSettings")
          )}
        </button>
      </div>
    </div>
  );
}
