import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

export default apiClient;

// ── API Keys ──────────────────────────────────────────────────────────────────

export const apiKeysApi = {
  list: () => apiClient.get("/api-keys"),
  save: (provider: string, api_key: string) =>
    apiClient.post("/api-keys", { provider, api_key }),
  delete: (provider: string) =>
    apiClient.delete(`/api-keys/${provider}`),
  validate: (provider: string) =>
    apiClient.post(`/api-keys/${provider}/validate`),
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => apiClient.get("/settings"),
  update: (data: Record<string, unknown>) => apiClient.put("/settings", data),
  pickDirectory: () => apiClient.post("/settings/pick-directory"),
};

// ── Google Sheet ──────────────────────────────────────────────────────────────

export const googleSheetApi = {
  getConfig: () => apiClient.get("/google-sheet/config"),
  updateConfig: (data: Record<string, unknown>) =>
    apiClient.put("/google-sheet/config", data),
  validateConnection: () => apiClient.post("/google-sheet/validate"),
  validateHeaders: () => apiClient.post("/google-sheet/validate-headers"),
  getStatus: () => apiClient.get("/google-sheet/status"),
  getPreview: (workflow_type: string) =>
    apiClient.get("/google-sheet/preview", { params: { workflow_type } }),
};

// ── Workflows ─────────────────────────────────────────────────────────────────

export const workflowsApi = {
  executeSheetBatch: (data: Record<string, unknown>) =>
    apiClient.post("/workflows/sheet/execute", data),
  executeLocalBatch: (data: Record<string, unknown>) =>
    apiClient.post("/workflows/local/execute", data),
  executeSegBatch: (data: Record<string, unknown>) =>
    apiClient.post("/workflows/seg/execute", data),
};

// ── Local Generate ────────────────────────────────────────────────────────────

export const localGenerateApi = {
  preview: (input_dir: string) =>
    apiClient.post("/local-generate/preview", { input_dir }, { timeout: 30000 }),
};

// ── Seg Generate ──────────────────────────────────────────────────────────────

export const segGenerateApi = {
  preview: (input_dir: string) =>
    apiClient.post("/seg-generate/preview", { input_dir }, { timeout: 30000 }),
  getPsdPreviews: (psdPath: string) =>
    apiClient.get("/seg-generate/psd-previews", { params: { path: psdPath }, timeout: 30000 }),
};

// ── Logs ──────────────────────────────────────────────────────────────────────

export const logsApi = {
  get: (lines?: number) =>
    apiClient.get("/logs", { params: lines ? { lines } : undefined, timeout: 10000 }),
};

// ── Runs ──────────────────────────────────────────────────────────────────────

export const runsApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    apiClient.get("/runs", { params }),
  listItems: (params?: { limit?: number; offset?: number }) =>
    apiClient.get("/runs/items", { params }),
  getDetail: (runId: string) => apiClient.get(`/runs/${runId}`),
  getStatus: (runId: string) => apiClient.get(`/runs/${runId}/status`),
  cancel: (runId: string) => apiClient.post(`/runs/${runId}/cancel`),
};
