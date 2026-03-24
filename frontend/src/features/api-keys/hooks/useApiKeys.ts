"use client";
import { useState, useEffect, useCallback } from "react";
import { apiKeysApi } from "@/shared/lib/api-client";
import type { ApiKeyOut, Provider } from "@/shared/types/common";

export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKeyOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Partial<Record<Provider, boolean>>>({});
  const [validating, setValidating] = useState<Partial<Record<Provider, boolean>>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await apiKeysApi.list();
      setKeys(res.data);
    } catch (e) {
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const saveKey = async (provider: Provider, apiKey: string) => {
    setSaving((s) => ({ ...s, [provider]: true }));
    try {
      await apiKeysApi.save(provider, apiKey);
      await fetchKeys();
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }));
    }
  };

  const deleteKey = async (provider: Provider) => {
    try {
      await apiKeysApi.delete(provider);
      await fetchKeys();
    } catch (e) {
      setError("Failed to delete key");
    }
  };

  const validateKey = async (provider: Provider) => {
    setValidating((s) => ({ ...s, [provider]: true }));
    try {
      await apiKeysApi.validate(provider);
      await fetchKeys();
    } finally {
      setValidating((s) => ({ ...s, [provider]: false }));
    }
  };

  return { keys, loading, saving, validating, error, saveKey, deleteKey, validateKey };
}
