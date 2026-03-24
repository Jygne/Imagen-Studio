"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { runsApi } from "@/shared/lib/api-client";
import type { RunListItemOut, RunItemListOut, RunDetailOut, RunItemOut } from "@/shared/types/common";

const POLL_INTERVAL = 3000;

export function useRuns() {
  const [items, setItems] = useState<RunListItemOut[]>([]);
  const [totals, setTotals] = useState<Omit<RunItemListOut, "items" | "total_count">>({
    total_runs: 0,
    total_items: 0,
    total_success: 0,
    total_failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comparison modal state
  const [modalItems, setModalItems] = useState<RunItemOut[]>([]);
  const [modalIndex, setModalIndex] = useState(0);
  const [modalGlobalIndex, setModalGlobalIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [modalWorkflowType, setModalWorkflowType] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modalRunIdRef = useRef<string | null>(null);
  // Always-current references to avoid stale closures in navigate
  const itemsRef = useRef<RunListItemOut[]>([]);
  const modalItemsRef = useRef<RunItemOut[]>([]);
  const modalGlobalIndexRef = useRef(0);

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await runsApi.listItems({ limit: 100 });
      const data = res.data as RunItemListOut;
      setItems(data.items);
      itemsRef.current = data.items;
      setTotals({
        total_runs: data.total_runs,
        total_items: data.total_items,
        total_success: data.total_success,
        total_failed: data.total_failed,
      });
    } catch {
      if (!silent) setError("Failed to load runs");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Keep refs in sync on every render
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { modalItemsRef.current = modalItems; }, [modalItems]);
  useEffect(() => { modalGlobalIndexRef.current = modalGlobalIndex; }, [modalGlobalIndex]);

  // Polling: refresh list while any item belongs to an active run
  useEffect(() => {
    const hasActive = items.some(
      (i) => i.run_status === "running" || i.run_status === "queued"
    );
    if (hasActive) {
      pollRef.current = setInterval(() => fetchItems(true), POLL_INTERVAL);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [items, fetchItems]);

  // Polling: refresh modal items while modal is open and run is active
  useEffect(() => {
    if (!modalOpen || !modalRunIdRef.current) return;
    const runId = modalRunIdRef.current;
    const run = items.find((i) => i.run_id === runId);
    if (!run || (run.run_status !== "running" && run.run_status !== "queued")) return;

    const id = setInterval(async () => {
      try {
        const res = await runsApi.getDetail(runId);
        setModalItems(res.data.items);
      } catch {}
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [modalOpen, items]);

  const selectRun = async (runId: string) => {
    setSelectedRunId(runId);
    setLoadingDetail(true);
    try {
      const res = await runsApi.getDetail(runId);
      setDetail(res.data);
    } catch {
      setError("Failed to load run detail");
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedRunId(null);
    setDetail(null);
  };

  // Opens the modal at a specific item (identified by item_id)
  const openModal = useCallback(async (itemId: string) => {
    const globalItems = itemsRef.current;
    const globalIdx = globalItems.findIndex((i) => i.item_id === itemId);
    const targetItem = globalIdx >= 0 ? globalItems[globalIdx] : globalItems[0];
    if (!targetItem) return;

    setModalOpen(true);
    setLoadingModal(true);
    setModalGlobalIndex(globalIdx >= 0 ? globalIdx : 0);
    modalRunIdRef.current = targetItem.run_id;

    try {
      const res = await runsApi.getDetail(targetItem.run_id);
      const runItems: RunItemOut[] = res.data.items;
      setModalItems(runItems);
      setModalWorkflowType(res.data.workflow_type);
      const localIdx = runItems.findIndex((i) => i.id === itemId);
      setModalIndex(localIdx >= 0 ? localIdx : 0);
    } catch {
      setError("Failed to load run detail");
    } finally {
      setLoadingModal(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalItems([]);
    setModalIndex(0);
    setModalGlobalIndex(0);
    setModalWorkflowType(null);
    modalRunIdRef.current = null;
  }, []);

  // Navigate globally across all runs
  const navigate = useCallback(async (direction: 1 | -1) => {
    const globalItems = itemsRef.current;
    const currentGlobal = modalGlobalIndexRef.current;
    const nextGlobal = currentGlobal + direction;

    if (nextGlobal < 0 || nextGlobal >= globalItems.length) return;

    const nextListItem = globalItems[nextGlobal];
    setModalGlobalIndex(nextGlobal);

    if (nextListItem.run_id === modalRunIdRef.current) {
      // Same run — find the local index in already-loaded modalItems
      const localIdx = modalItemsRef.current.findIndex((i) => i.id === nextListItem.item_id);
      setModalIndex(localIdx >= 0 ? localIdx : 0);
    } else {
      // Different run — fetch and swap
      setLoadingModal(true);
      modalRunIdRef.current = nextListItem.run_id;
      try {
        const res = await runsApi.getDetail(nextListItem.run_id);
        const runItems: RunItemOut[] = res.data.items;
        setModalItems(runItems);
        setModalWorkflowType(res.data.workflow_type);
        const localIdx = runItems.findIndex((i) => i.id === nextListItem.item_id);
        setModalIndex(localIdx >= 0 ? localIdx : 0);
      } catch {
        setError("Failed to load run detail");
      } finally {
        setLoadingModal(false);
      }
    }
  }, []);

  const prevItem = useCallback(() => navigate(-1), [navigate]);
  const nextItem = useCallback(() => navigate(1), [navigate]);

  return {
    items, totals, loading, error,
    selectedRunId, detail, loadingDetail,
    fetchItems, selectRun, closeDetail,
    modalOpen, modalItems, modalIndex, modalGlobalIndex, loadingModal, modalWorkflowType,
    openModal, closeModal, prevItem, nextItem,
  };
}
