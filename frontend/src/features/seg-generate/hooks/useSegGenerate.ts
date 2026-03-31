"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { settingsApi, segGenerateApi, workflowsApi, runsApi } from "@/shared/lib/api-client";
import { useRunsNotification } from "@/shared/contexts/RunsNotificationContext";
import type {
  LocalPreviewOut,
  LocalPreviewItem,
  RunOut,
} from "@/shared/types/common";

export function useSegGenerate() {
  const { notifyRunStarted } = useRunsNotification();
  const [inputDir, setInputDir] = useState<string>("");
  const [outputDirectory, setOutputDirectory] = useState<string>("");
  const [previewItems, setPreviewItems] = useState<LocalPreviewItem[]>([]);
  const [totalScanned, setTotalScanned] = useState<number>(0);
  // Ref always holds the latest previewItems — prevents stale closure in executeBatch
  const previewItemsRef = useRef<LocalPreviewItem[]>([]);
  previewItemsRef.current = previewItems;
  const [activeRun, setActiveRun] = useState<RunOut | null>(null);

  const [loadingDir, setLoadingDir] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SEG_DIR_KEY = "seg_generate_input_dir";

  // On mount: restore settings + last-used input dir, then rescan if dir exists
  useEffect(() => {
    settingsApi.get().then((res) => {
      setOutputDirectory(res.data?.output_directory ?? "");
    }).catch(() => {});

    const savedDir = localStorage.getItem(SEG_DIR_KEY);
    if (savedDir) {
      setInputDir(savedDir);
      setLoadingPreview(true);
      segGenerateApi.preview(savedDir)
        .then((res) => _applyPreview(res.data as LocalPreviewOut))
        .catch(() => {})
        .finally(() => setLoadingPreview(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist inputDir to localStorage whenever it changes
  useEffect(() => {
    if (inputDir) {
      localStorage.setItem(SEG_DIR_KEY, inputDir);
    }
  }, [inputDir]);

  const _applyPreview = useCallback((data: LocalPreviewOut) => {
    setPreviewItems(data.preview_items);
    setTotalScanned(data.total_images);
  }, []);

  const pickInputDir = useCallback(async () => {
    setLoadingDir(true);
    setError(null);
    try {
      const res = await settingsApi.pickDirectory();
      if (!res.data.cancelled && res.data.path) {
        const dir: string = res.data.path;
        setInputDir(dir);
        setPreviewItems([]);
        setTotalScanned(0);
        setLoadingPreview(true);
        try {
          const previewRes = await segGenerateApi.preview(dir);
          _applyPreview(previewRes.data as LocalPreviewOut);
        } catch (e: unknown) {
          const err = e as { response?: { data?: { detail?: string } } };
          setError(err?.response?.data?.detail ?? "Failed to scan directory");
        } finally {
          setLoadingPreview(false);
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? "Failed to open folder picker");
    } finally {
      setLoadingDir(false);
    }
  }, [_applyPreview]);

  const rescan = useCallback(async () => {
    if (!inputDir) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const previewRes = await segGenerateApi.preview(inputDir);
      _applyPreview(previewRes.data as LocalPreviewOut);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? "Failed to scan directory");
    } finally {
      setLoadingPreview(false);
    }
  }, [inputDir, _applyPreview]);

  const removeItem = useCallback((index: number) => {
    setPreviewItems((prev) => prev.filter((item) => item.index !== index));
  }, []);

  const cancelBatch = useCallback(async () => {
    if (!activeRun) return;
    try {
      await runsApi.cancel(activeRun.id);
      setExecuting(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? "Failed to cancel run");
    }
  }, [activeRun]);

  const executeBatch = useCallback(async () => {
    // Read from ref — always the latest value regardless of closure staleness
    const currentItems = previewItemsRef.current;
    if (!inputDir || !outputDirectory || currentItems.length === 0) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await workflowsApi.executeSegBatch({
        input_dir: inputDir,
        included_filenames: currentItems.map((i) => i.filename),
      });
      const runId: string = (res.data as { run_id: string }).run_id;
      notifyRunStarted();

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await runsApi.getStatus(runId);
          setActiveRun(statusRes.data as RunOut);
          const s = (statusRes.data as RunOut).status;
          if (s === "done" || s === "failed" || s === "cancelled") {
            clearInterval(pollInterval);
            setExecuting(false);
          }
        } catch {
          clearInterval(pollInterval);
          setExecuting(false);
        }
      }, 2000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? "Execution failed");
      setExecuting(false);
    }
  // previewItems intentionally excluded — read via ref to avoid stale closure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputDir, outputDirectory, notifyRunStarted]);

  const canExecute = Boolean(inputDir && outputDirectory && previewItems.length > 0 && !executing);

  return {
    inputDir,
    outputDirectory,
    previewItems,
    totalScanned,
    loadingDir,
    loadingPreview,
    pickInputDir,
    rescan,
    removeItem,
    executing,
    executeBatch,
    cancelBatch,
    canExecute,
    activeRun,
    error,
  };
}
