"use client";
import { useState, useEffect, useCallback } from "react";
import { googleSheetApi } from "@/shared/lib/api-client";
import type { GoogleSheetConfig, SheetStatusOut, SheetPreviewOut } from "@/shared/types/common";

export function useGoogleSheet() {
  const [config, setConfig] = useState<GoogleSheetConfig | null>(null);
  const [status, setStatus] = useState<SheetStatusOut | null>(null);
  const [preview, setPreview] = useState<SheetPreviewOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
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

  return {
    config, status, preview,
    loading, validating, saving, saved, error,
    saveConfig, validateAndRefresh, fetchPreview,
  };
}
