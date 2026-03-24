"use client";
import { useState, useEffect, useCallback } from "react";
import { settingsApi } from "@/shared/lib/api-client";
import type { AppSettings } from "@/shared/types/common";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await settingsApi.get();
      setSettings(res.data);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSettings = async (updates: Partial<AppSettings>) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await settingsApi.update(updates as Record<string, unknown>);
      setSettings(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return { settings, loading, saving, saved, error, updateSettings };
}
