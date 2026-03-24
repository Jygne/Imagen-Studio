"use client";
import { useState } from "react";
import { Zap, Key, CheckCircle, XCircle, Loader2, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "@/shared/lib/i18n";
import type { ApiKeyOut, Provider } from "@/shared/types/common";

interface Props {
  data: ApiKeyOut;
  isSaving: boolean;
  isValidating: boolean;
  onSave: (provider: Provider, key: string) => void;
  onDelete: (provider: Provider) => void;
  onValidate: (provider: Provider) => void;
}

const PROVIDER_META: Record<Provider, { label: string; model: string; iconBg: string; Icon: React.ElementType }> = {
  openai: {
    label: "OpenAI",
    model: "gpt-image-1.5",
    iconBg: "bg-emerald-500/20",
    Icon: Zap,
  },
  openrouter: {
    label: "OpenRouter",
    model: "gemini-2.5-flash / 3.1-flash",
    iconBg: "bg-orange-500/20",
    Icon: Key,
  },
};

export function ApiKeyCard({ data, isSaving, isValidating, onSave, onDelete, onValidate }: Props) {
  const { t } = useLocale();
  const [inputValue, setInputValue] = useState("");
  const meta = PROVIDER_META[data.provider];
  const { Icon } = meta;

  const handleSave = () => {
    if (!inputValue.trim()) return;
    onSave(data.provider, inputValue.trim());
    setInputValue("");
  };

  const validityIcon = () => {
    if (isValidating) return <Loader2 size={14} className="animate-spin text-text-secondary" />;
    if (data.is_valid === true) return <CheckCircle size={14} className="text-status-success" />;
    if (data.is_valid === false) return <XCircle size={14} className="text-status-error" />;
    return null;
  };

  const statusText = () => {
    if (isValidating) return t("validating");
    if (!data.is_configured) return t("notConfigured");
    if (data.is_valid === true) return t("validKey");
    if (data.is_valid === false) return t("invalidKey");
    return t("configured");
  };

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", meta.iconBg)}>
          <Icon size={16} className="text-text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text-primary font-semibold text-sm">{meta.label} · {meta.model}</p>
          <p className="text-text-muted text-xs mt-0.5 font-mono uppercase tracking-wide">
            {data.provider.toUpperCase()}_API_KEY
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        {validityIcon()}
        <span className={cn(
          data.is_valid === true ? "text-status-success" :
          data.is_valid === false ? "text-status-error" : "text-text-secondary"
        )}>
          {statusText()}
        </span>
      </div>

      {/* Key Input */}
      <div className="space-y-2">
        <input
          type="password"
          value={data.is_configured ? data.key_masked : inputValue}
          onChange={(e) => !data.is_configured && setInputValue(e.target.value)}
          readOnly={data.is_configured}
          placeholder={data.is_configured ? "" : t("pasteApiKey")}
          className={cn(
            "w-full bg-bg-input border border-border rounded-lg px-3 py-2",
            "text-sm font-mono text-text-secondary",
            "placeholder:text-text-muted",
            data.is_configured ? "cursor-default" : "focus:outline-none focus:border-accent"
          )}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {data.is_configured ? (
          <>
            <button
              onClick={() => onDelete(data.provider)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-status-error border border-status-error/20 hover:bg-status-error/10 transition-colors"
            >
              <Trash2 size={12} />
              {t("deleteKey")}
            </button>
            <button
              onClick={() => onValidate(data.provider)}
              disabled={isValidating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary border border-border hover:border-border hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isValidating ? "animate-spin" : ""} />
              {t("validate")}
            </button>
          </>
        ) : (
          <button
            onClick={handleSave}
            disabled={!inputValue.trim() || isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : null}
            {t("saveKey")}
          </button>
        )}
      </div>
    </div>
  );
}
