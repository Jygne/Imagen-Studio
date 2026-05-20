"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Link2, ShieldCheck, ScanSearch, Rows3, ExternalLink } from "lucide-react";

import { useGoogleSheet } from "@/features/google-sheet/hooks/useGoogleSheet";
import { useLocale } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "accent" | "success" | "warning" | "error";
}) {
  const toneClass = {
    neutral: "border-border text-text-secondary bg-bg-input/40",
    accent: "border-accent/20 text-accent bg-accent/10",
    success: "border-status-success/20 text-status-success bg-status-success/10",
    warning: "border-status-warning/20 text-status-warning bg-status-warning/10",
    error: "border-status-error/20 text-status-error bg-status-error/10",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", toneClass)}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function DecisionBadge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        active
          ? "border-status-success/20 bg-status-success/10 text-status-success"
          : "border-border bg-bg-input/60 text-text-secondary"
      )}
    >
      {children}
    </span>
  );
}

function MatchBadge({ matched, children }: { matched: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        matched
          ? "border-accent/20 bg-accent/10 text-accent"
          : "border-border bg-bg-input/60 text-text-secondary"
      )}
    >
      {children}
    </span>
  );
}

export function BBSearchPage() {
  const { t } = useLocale();
  const {
    config, bbStatusResult,
    loading, checkingBbStatus, error,
    checkBbStatus,
  } = useGoogleSheet();

  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [rangeStartRow, setRangeStartRow] = useState("");
  const [rangeEndRow, setRangeEndRow] = useState("");

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-text-secondary">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">{t("loading")}</span>
      </div>
    );
  }

  const hasSheetGid = /[?#&]gid=\d+/.test(spreadsheetUrl);
  const canCheckAll = !checkingBbStatus && !!spreadsheetUrl.trim() && !!config?.has_service_account && hasSheetGid;
  const canCheckRange = canCheckAll && !!rangeStartRow && !!rangeEndRow;

  const summaryItems = bbStatusResult
    ? [
        { label: t("bbCheckedRows"), value: bbStatusResult.checked_rows, tone: "accent" as const },
        { label: t("bbCurrentPool"), value: bbStatusResult.bb_pool_count, tone: "neutral" as const },
        { label: t("bbNeedDesign"), value: bbStatusResult.need_design_count, tone: bbStatusResult.need_design_count > 0 ? "success" as const : "neutral" as const },
        ...(bbStatusResult.stale_count > 0
          ? [{ label: t("bbNoLongerNeeded"), value: bbStatusResult.stale_count, tone: "warning" as const }]
          : []),
        ...(bbStatusResult.missing_in_bb_count > 0
          ? [{ label: t("bbNotMatched"), value: bbStatusResult.missing_in_bb_count, tone: "neutral" as const }]
          : []),
        ...(bbStatusResult.error_count > 0
          ? [{ label: t("statusFailed"), value: bbStatusResult.error_count, tone: "error" as const }]
          : []),
      ]
    : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">{t("bbSearchTitle")}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t("bbSearchDesc")}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-status-error/20 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-bg-surface p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-text-primary">{t("bbSearchPanelTitle")}</h2>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{t("bbSearchDynamicSheetHint")}</p>
            </div>

            <div className="mb-4 rounded-lg border border-border bg-bg-input/40 px-3 py-3 text-xs text-text-secondary">
              <div className="flex items-start gap-2">
                <ShieldCheck size={13} className={config?.has_service_account ? "mt-0.5 text-status-success" : "mt-0.5 text-status-warning"} />
                <div>
                  <p>{config?.has_service_account ? t("bbServiceAccountReady") : t("bbServiceAccountMissing")}</p>
                  {!config?.has_service_account && (
                    <Link href="/google-sheet" className="mt-1 inline-flex items-center gap-1 text-accent hover:underline">
                      <ExternalLink size={11} />
                      {t("bbGoConfigureServiceAccount")}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Field label={t("gsUrl")}>
                <div className="relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full rounded-lg border border-border bg-bg-input pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                {!hasSheetGid && spreadsheetUrl.trim() && (
                  <p className="text-xs text-status-warning">{t("bbUrlNeedsGid")}</p>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("bbStartRow")}>
                  <input
                    type="number"
                    min={2}
                    value={rangeStartRow}
                    onChange={(e) => setRangeStartRow(e.target.value)}
                    placeholder="2"
                    className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </Field>
                <Field label={t("bbEndRow")}>
                  <input
                    type="number"
                    min={2}
                    value={rangeEndRow}
                    onChange={(e) => setRangeEndRow(e.target.value)}
                    placeholder="50"
                    className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => checkBbStatus({ spreadsheet_url: spreadsheetUrl, tab_name: "" })}
                  disabled={!canCheckAll}
                  className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  {checkingBbStatus ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
                  {checkingBbStatus ? t("bbChecking") : t("bbCheckAll")}
                </button>
                <button
                  onClick={() => checkBbStatus({
                    spreadsheet_url: spreadsheetUrl,
                    tab_name: "",
                    start_row: rangeStartRow ? Number(rangeStartRow) : undefined,
                    end_row: rangeEndRow ? Number(rangeEndRow) : undefined,
                  })}
                  disabled={!canCheckRange}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  {checkingBbStatus ? <Loader2 size={14} className="animate-spin" /> : <Rows3 size={14} />}
                  {checkingBbStatus ? t("bbChecking") : t("bbCheckRange")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{t("bbResultsTitle")}</h2>
                {bbStatusResult ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    <span className="font-mono text-text-primary">{bbStatusResult.tab_name}</span>
                    <span className="mx-2 text-text-muted">·</span>
                    {bbStatusResult.checked_rows}/{bbStatusResult.total_sheet_rows} {t("bbCheckedRows").toLowerCase()}
                    <span className="mx-2 text-text-muted">·</span>
                    {t("bbCurrentStatus")} {bbStatusResult.target_status_code}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-text-secondary">{t("bbResultsHint")}</p>
                )}
              </div>

              {bbStatusResult && summaryItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {summaryItems.map((item) => (
                    <SummaryPill key={`${item.label}-${item.value}`} label={item.label} value={item.value} tone={item.tone} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {bbStatusResult ? (
            <>
              <div className="space-y-3 p-5 xl:hidden">
                {bbStatusResult.rows.map((row) => (
                  <div key={`${row.row_index}-${row.bb_model_id}`} className="rounded-lg border border-border bg-bg-input/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-text-muted">{t("rowLabel")} {row.row_index}</p>
                        <p className="mt-1 break-all text-sm text-text-primary">{row.bb_model_id}</p>
                      </div>
                      <DecisionBadge active={row.need_design}>
                        {row.need_design ? t("bbDesignNeeded") : t("bbSkipForNow")}
                      </DecisionBadge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <MatchBadge matched={row.matched_in_bb}>
                        {row.matched_in_bb ? t("bbCurrentStatus") : t("bbNotMatched")}
                      </MatchBadge>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-text-secondary">
                      {row.error
                        ? row.error
                        : row.matched_in_bb
                          ? [row.current_status_code, row.current_status_text].filter(Boolean).join(" · ") || "—"
                          : t("bbNotInCurrentPool")}
                    </p>
                  </div>
                ))}
              </div>

              <div className="hidden xl:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-input/50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">{t("rowLabel")}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">{t("modelId")}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">{t("bbCurrentStatus")}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">{t("bbDecision")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bbStatusResult.rows.map((row) => (
                      <tr key={`${row.row_index}-${row.bb_model_id}`} className="border-b border-border/40 align-top last:border-0 hover:bg-bg-hover/20">
                        <td className="px-4 py-3 text-xs font-mono text-text-muted">{row.row_index}</td>
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] break-all text-sm text-text-primary">{row.bb_model_id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            <MatchBadge matched={row.matched_in_bb}>
                              {row.matched_in_bb ? t("bbCurrentStatus") : t("bbNotMatched")}
                            </MatchBadge>
                            <p className="max-w-[320px] text-xs leading-5 text-text-secondary">
                              {row.error
                                ? row.error
                                : row.matched_in_bb
                                  ? [row.current_status_code, row.current_status_text].filter(Boolean).join(" · ") || "—"
                                  : t("bbNotInCurrentPool")}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <DecisionBadge active={row.need_design}>
                            {row.need_design ? t("bbDesignNeeded") : t("bbSkipForNow")}
                          </DecisionBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex min-h-[520px] items-center justify-center p-6">
              <div className="text-center">
                <Rows3 size={22} className="mx-auto mb-3 text-text-muted" />
                <p className="text-sm text-text-muted">{t("bbResultsHint")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
