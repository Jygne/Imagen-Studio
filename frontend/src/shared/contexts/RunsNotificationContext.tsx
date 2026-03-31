"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { runsApi } from "@/shared/lib/api-client";
import type { RunListItemOut, RunItemListOut } from "@/shared/types/common";

const STORAGE_KEY = "lastRunsVisit";
const POLL_INTERVAL = 3000;

interface RunsNotificationContextValue {
  hasUnread: boolean;
  markAllRead: () => void;
  notifyRunStarted: () => void;
}

const RunsNotificationContext = createContext<RunsNotificationContextValue>({
  hasUnread: false,
  markAllRead: () => {},
  notifyRunStarted: () => {},
});

export function useRunsNotification() {
  return useContext(RunsNotificationContext);
}

export function RunsNotificationProvider({ children }: { children: React.ReactNode }) {
  const [hasUnread, setHasUnread] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to avoid stale closure inside setInterval
  const checkRef = useRef<() => void>(() => {});

  const checkForUnread = useCallback(async () => {
    try {
      const res = await runsApi.listItems({ limit: 100 });
      const data = res.data as RunItemListOut;
      const items: RunListItemOut[] = data.items;

      const lastVisit = localStorage.getItem(STORAGE_KEY);
      const lastVisitTime = lastVisit ? new Date(lastVisit).getTime() : 0;

      const hasNewCompleted = items.some((item) => {
        if (item.run_status !== "done" && item.run_status !== "failed") return false;
        if (!item.run_finished_at) return false;
        return new Date(item.run_finished_at).getTime() > lastVisitTime;
      });

      setHasUnread(hasNewCompleted);

      const hasActive = items.some(
        (i) => i.run_status === "running" || i.run_status === "queued"
      );

      if (hasActive && !pollRef.current) {
        // Active runs detected but not yet polling — start polling
        pollRef.current = setInterval(() => checkRef.current(), POLL_INTERVAL);
      } else if (!hasActive && pollRef.current) {
        // No more active runs — stop polling
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      // silently ignore
    }
  }, []);

  // Keep checkRef in sync so the interval always calls the latest version
  checkRef.current = checkForUnread;

  // Mount: single check — if active runs exist, polling starts automatically inside checkForUnread
  useEffect(() => {
    checkForUnread();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkForUnread]);

  // Called by workflow pages right after submitting a run
  const notifyRunStarted = useCallback(() => {
    if (!pollRef.current) {
      pollRef.current = setInterval(() => checkRef.current(), POLL_INTERVAL);
    }
  }, []);

  const markAllRead = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setHasUnread(false);
  }, []);

  return (
    <RunsNotificationContext.Provider value={{ hasUnread, markAllRead, notifyRunStarted }}>
      {children}
    </RunsNotificationContext.Provider>
  );
}
