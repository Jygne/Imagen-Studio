"use client";
import { useApiKeys } from "../hooks/useApiKeys";
import { ApiKeyCard } from "./ApiKeyCard";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/shared/lib/i18n";
import type { Provider } from "@/shared/types/common";

export function ApiKeysPage() {
  const { t } = useLocale();
  const { keys, loading, saving, validating, error, saveKey, deleteKey, validateKey } = useApiKeys();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary mt-8">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">{t("loading")}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">{t("apiKeysTitle")}</h1>
        <p className="text-text-secondary text-sm mt-1">{t("apiKeysDesc")}</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 max-w-3xl">
        {keys.map((key) => (
          <ApiKeyCard
            key={key.provider}
            data={key}
            isSaving={saving[key.provider as Provider] ?? false}
            isValidating={validating[key.provider as Provider] ?? false}
            onSave={saveKey}
            onDelete={deleteKey}
            onValidate={validateKey}
          />
        ))}
      </div>
    </div>
  );
}
