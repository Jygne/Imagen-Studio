"use client";
import { useState, useEffect, useCallback } from "react";
import { googleSheetApi } from "@/shared/lib/api-client";
import type { BBStatusCheckOut, GoogleSheetConfig, SheetStatusOut, SheetPreviewOut } from "@/shared/types/common";

export function useGoogleSheet() {
  const [config, setConfig] = useState<GoogleSheetConfig | null>(null);
  const [status, setStatus] = useState<SheetStatusOut | null>(null);
  const [preview, setPreview] = useState<SheetPreviewOut | null>(null);
  const [bbStatusResult, setBbStatusResult] = useState<BBStatusCheckOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [checkingBbStatus, setCheckingBbStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await googleSheetApi.getConfig();
      setConfig(res.data);
    } catch {
      setError("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = async (updates: Partial<GoogleSheetConfig> & { service_account_json?: string }) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await googleSheetApi.updateConfig(updates as Record<string, unknown>);
      setConfig(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  const validateAndRefresh = async () => {
    setValidating(true);
    setError(null);
    try {
      const statusRes = await googleSheetApi.getStatus();
      setStatus(statusRes.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const fetchPreview = async (workflowType: string) => {
    try {
      const res = await googleSheetApi.getPreview(workflowType);
      setPreview(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Preview failed");
    }
  };

  const checkBbStatus = async (payload: { spreadsheet_url: string; tab_name: string; only_generate_yes?: boolean; limit?: number | null; start_row?: number | null; end_row?: number | null }) => {
    setCheckingBbStatus(true);
    setError(null);
    try {
      const res = await googleSheetApi.checkBbStatus(payload);
      setBbStatusResult(res.data);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail
        ?? e?.response?.data
        ?? e?.message
        ?? "BB status check failed"
      );
    } finally {
      setCheckingBbStatus(false);
    }
  };

  return {
    config, status, preview, bbStatusResult,
    loading, validating, checkingBbStatus, saving, saved, error,
    saveConfig, validateAndRefresh, fetchPreview, checkBbStatus,
  };
}
