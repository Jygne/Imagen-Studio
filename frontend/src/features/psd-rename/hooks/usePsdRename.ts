"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { settingsApi, psdRenameApi, runsApi } from "@/shared/lib/api-client";
import type { RunOut } from "@/shared/types/common";

export interface PsdPreviewItem {
  index: number;
  filename: string;
  stem: string;
  thumbnail: string | null;
}

interface PsdPreviewResponse {
  input_dir: string;
  total_files: number;
  preview_items: PsdPreviewItem[];
}

export function usePsdRename() {
  const [inputDir, setInputDir] = useState<string>("");
  const [outputDirectory, setOutputDirectory] = useState<string>("");
  const [previewItems, setPreviewItems] = useState<PsdPreviewItem[]>([]);
  const [totalScanned, setTotalScanned] = useState<number>(0);
  const previewItemsRef = useRef<PsdPreviewItem[]>([]);
  previewItemsRef.current = previewItems;

  const [activeRun, setActiveRun] = useState<RunOut | null>(null);
  const [loadingDir, setLoadingDir] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Naming config
  const [namePixel, setNamePixel] = useState("scenebg");
  const [nameShape, setNameShape] = useState("stickerbg");
  const [deleteHidden, setDeleteHidden] = useState(true);
  const [flattenGroups, setFlattenGroups] = useState(true);
  const [skipNoText, setSkipNoText] = useState(true);

  const PSD_DIR_KEY = "psd_rename_input_dir";

  useEffect(() => {
    settingsApi.get().then((res) => {
      setOutputDirectory(res.data?.output_directory ?? "");
    }).catch(() => {});

    const savedDir = localStorage.getItem(PSD_DIR_KEY);
    if (savedDir) {
      setInputDir(savedDir);
      setLoadingPreview(true);
      psdRenameApi.preview(savedDir)
        .then((res) => _applyPreview(res.data as PsdPreviewResponse))
        .catch(() => {})
        .finally(() => setLoadingPreview(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inputDir) localStorage.setItem(PSD_DIR_KEY, inputDir);
  }, [inputDir]);

  const _applyPreview = useCallback((data: PsdPreviewResponse) => {
    setPreviewItems(data.preview_items);
    setTotalScanned(data.total_files);
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
          const previewRes = await psdRenameApi.preview(dir);
          _applyPreview(previewRes.data as PsdPreviewResponse);
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
      const previewRes = await psdRenameApi.preview(inputDir);
      _applyPreview(previewRes.data as PsdPreviewResponse);
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
    const currentItems = previewItemsRef.current;
    if (!inputDir || !outputDirectory || currentItems.length === 0) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await psdRenameApi.execute({
        input_dir: inputDir,
        included_filenames: currentItems.map((i) => i.filename),
        name_pixel: namePixel,
        name_shape: nameShape,
        delete_hidden: deleteHidden,
        flatten_groups: flattenGroups,
        skip_no_text: skipNoText,
      });
      const runId: string = (res.data as { run_id: string }).run_id;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputDir, outputDirectory, namePixel, nameShape, deleteHidden, flattenGroups, skipNoText]);

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
    namePixel, setNamePixel,
    nameShape, setNameShape,
    deleteHidden, setDeleteHidden,
    flattenGroups, setFlattenGroups,
    skipNoText, setSkipNoText,
  };
}
