"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { googleSheetApi, workflowsApi, runsApi, settingsApi } from "@/shared/lib/api-client";
import { useRunsNotification } from "@/shared/contexts/RunsNotificationContext";
import type { SheetStatusOut, SheetPreviewOut, RunOut, WorkflowType, Provider } from "@/shared/types/common";

export function useSheetGenerate() {
  const { notifyRunStarted } = useRunsNotification();
  const [workflowType, setWorkflowType] = useState<WorkflowType>("clean_image");
  const [status, setStatus] = useState<SheetStatusOut | null>(null);
  const [preview, setPreview] = useState<SheetPreviewOut | null>(null);
  const [activeRun, setActiveRun] = useState<RunOut | null>(null);
  const [outputDirectory, setOutputDirectory] = useState<string>("");

  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Provider/model/size/quality overrides
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("gpt-image-1.5");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [promptOverride, setPromptOverride] = useState<string>("");

  const SHEET_PROVIDER_KEY = "sheet_generate_provider";
  const SHEET_MODEL_KEY = "sheet_generate_model";
  const SHEET_SIZE_KEY = "sheet_generate_size";
  const SHEET_QUALITY_KEY = "sheet_generate_quality";
  // Flag: skip persistence effects until initialization is complete
  const initialized = useRef(false);

  // Load output directory + defaults from settings on mount
  useEffect(() => {
    settingsApi.get().then((res) => {
      setOutputDirectory(res.data?.output_directory ?? "");
      // Init provider/model/size/quality from localStorage (user's last manual pick)
      setProvider((localStorage.getItem(SHEET_PROVIDER_KEY) as Provider | null) ?? "openai");
      setModel(localStorage.getItem(SHEET_MODEL_KEY) ?? "gpt-image-1.5");
      setSize(localStorage.getItem(SHEET_SIZE_KEY) ?? "1024x1024");
      setQuality(localStorage.getItem(SHEET_QUALITY_KEY) ?? "medium");
    }).catch(() => {}).finally(() => { initialized.current = true; });
  }, []);

  // Persist provider/model/size/quality — skip until initialization completes
  // to prevent hardcoded useState defaults from overwriting localStorage on mount
  useEffect(() => { if (initialized.current) localStorage.setItem(SHEET_PROVIDER_KEY, provider); }, [provider]);
  useEffect(() => { if (initialized.current) localStorage.setItem(SHEET_MODEL_KEY, model); }, [model]);
  useEffect(() => { if (initialized.current) localStorage.setItem(SHEET_SIZE_KEY, size); }, [size]);
  useEffect(() => { if (initialized.current) localStorage.setItem(SHEET_QUALITY_KEY, quality); }, [quality]);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const res = await googleSheetApi.getStatus();
      setStatus(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load sheet status");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const refreshPreview = useCallback(async (type: WorkflowType) => {
    setLoadingPreview(true);
    try {
      const res = await googleSheetApi.getPreview(type);
      setPreview(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const switchWorkflow = useCallback(async (type: WorkflowType) => {
    setWorkflowType(type);
    setPreview(null);
    await refreshPreview(type);
  }, [refreshPreview]);

  const executeBatch = useCallback(async () => {
    setExecuting(true);
    setError(null);
    try {
      const res = await workflowsApi.executeSheetBatch({
        workflow_type: workflowType,
        provider,
        model,
        size,
        quality,
        prompt_override: promptOverride || null,
      });
      const runId: string = res.data.run_id;
      notifyRunStarted();

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await runsApi.getStatus(runId);
          setActiveRun(statusRes.data);
          const s = statusRes.data.status;
          if (s === "done" || s === "failed" || s === "cancelled") {
            clearInterval(pollInterval);
            setExecuting(false);
          }
        } catch {
          clearInterval(pollInterval);
          setExecuting(false);
        }
      }, 2000);

    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Execution failed");
      setExecuting(false);
    }
  }, [workflowType, provider, model, size, quality, promptOverride, notifyRunStarted]);

  return {
    workflowType, switchWorkflow,
    status, loadingStatus, refreshStatus,
    preview, loadingPreview, refreshPreview,
    provider, setProvider,
    model, setModel,
    size, setSize,
    quality, setQuality,
    promptOverride, setPromptOverride,
    executing, executeBatch,
    activeRun,
    outputDirectory,
    error,
  };
}
