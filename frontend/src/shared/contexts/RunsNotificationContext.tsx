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

/** Read lastRunsVisit from localStorage.
 *  Supports both formats:
 *  - new: numeric UTC ms string, e.g. "1711857600000"
 *  - legacy: ISO string, e.g. "2026-03-31T03:16:09.460779Z"
 *  If the stored value is the legacy ISO format, also migrates it to numeric on the spot.
 */
function readLastVisitTime(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;

  const asNumber = Number(raw);
  if (isFinite(asNumber)) return asNumber; // already numeric ms

  // Legacy ISO string — parse and migrate to numeric format
  const parsed = Date.parse(raw);
  if (isFinite(parsed)) {
    localStorage.setItem(STORAGE_KEY, parsed.toString()); // one-time migration
    return parsed;
  }

  return 0; // unrecognisable value — treat as "never visited"
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

      const lastVisitTime = readLastVisitTime();

      const hasNewCompleted = items.some((item) => {
        if (item.run_status !== "done" && item.run_status !== "failed") return false;
        if (!item.run_finished_at) return false;
        // Backend returns naive UTC datetimes without 'Z' (e.g. "2024-03-31T10:00:00").
        // Without 'Z', JS parses as local time — causing wrong comparison in UTC+ zones.
        // Force UTC interpretation by appending 'Z' if absent.
        const isoUtc = item.run_finished_at.endsWith("Z")
          ? item.run_finished_at
          : item.run_finished_at + "Z";
        return new Date(isoUtc).getTime() > lastVisitTime;
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
    } catch (err) {
      console.warn("[RunsNotification] checkForUnread failed:", err);
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

  // Called by workflow pages right after submitting a run.
  // Immediately checks once (don't wait 3s for first poll) and starts the interval.
  const notifyRunStarted = useCallback(() => {
    checkRef.current(); // immediate check
    if (!pollRef.current) {
      pollRef.current = setInterval(() => checkRef.current(), POLL_INTERVAL);
    }
  }, []);

  const markAllRead = useCallback(() => {
    // Store as numeric UTC ms — avoids ISO string timezone ambiguity
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setHasUnread(false);
  }, []);

  return (
    <RunsNotificationContext.Provider value={{ hasUnread, markAllRead, notifyRunStarted }}>
      {children}
    </RunsNotificationContext.Provider>
  );
}
