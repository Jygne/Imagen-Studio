export type WorkflowType = "clean_image" | "selling_point" | "seg_image" | "psd_rename";
export type RunStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type ItemStatus = "pending" | "running" | "success" | "failed" | "skipped";
export type RunSource = "sheet" | "local";
export type Provider = "openai" | "openrouter";

export interface ApiKeyOut {
  provider: Provider;
  key_masked: string;
  is_configured: boolean;
  is_valid: boolean | null;
  last_validated_at: string | null;
}

export interface AppSettings {
  output_directory: string;
  max_concurrency: number;
  timeout_seconds: number;
  clean_image_prompt: string;
  selling_point_prompt: string;
  seg_user_token: string;
}

export interface GoogleSheetConfig {
  spreadsheet_url: string;
  spreadsheet_id: string;
  clean_tab: string;
  selling_point_tab: string;
  has_service_account: boolean;
}

export interface HeaderValidationResult {
  tab: string;
  valid: boolean;
  present: string[];
  missing: string[];
}

export interface SheetStatusOut {
  connected: boolean;
  spreadsheet_url: string;
  spreadsheet_id: string;
  spreadsheet_title: string | null;
  service_account_configured: boolean;
  service_account_email: string | null;
  clean_tab_validation: HeaderValidationResult | null;
  selling_point_tab_validation: HeaderValidationResult | null;
  connection_error: string | null;
}

export interface SheetPreviewRow {
  row_index: number;
  bb_model_id: string | null;
  rsku_model_image_url: string | null;
  rsku_model_image: string | null;
  variation_1_value: string | null;
  llm_sellingpoints: string | null;
  generate: string;
}

export interface SheetPreviewOut {
  workflow_type: string;
  tab: string;
  total_yes_rows: number;
  preview_rows: SheetPreviewRow[];
}

export interface RunItemOut {
  id: string;
  run_id: string;
  row_index: number;
  bb_model_id: string | null;
  source_image_url: string | null;
  source_image_access_url: string | null;
  status: ItemStatus;
  output_file_path: string | null;
  output_image_url: string | null;
  error_reason: string | null;
  skipped_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
}

// ── Local Generate ────────────────────────────────────────────────────────────

export interface LocalPreviewItem {
  index: number;
  filename: string;
  stem: string;
  thumbnail: string | null;
}

export interface LocalPreviewOut {
  input_dir: string;
  total_images: number;
  has_more: boolean;
  preview_items: LocalPreviewItem[];
}

export interface LocalBatchExecuteResponse {
  run_id: string;
  message: string;
  queued_count: number;
}

export interface RunOut {
  id: string;
  workflow_type: WorkflowType;
  source: RunSource;
  status: RunStatus;
  provider: Provider | null;
  model: string | null;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  metadata: Record<string, unknown>;
  thumbnail_url: string | null;
  first_bb_model_id: string | null;
}

export interface RunDetailOut extends RunOut {
  items: RunItemOut[];
}

// ── Item-first list view ───────────────────────────────────────────────────────

export interface RunListItemOut {
  item_id: string;
  run_id: string;
  row_index: number;
  bb_model_id: string | null;
  thumbnail_url: string | null;
  source_image_access_url: string | null;
  workflow_type: WorkflowType;
  source: RunSource;
  item_status: ItemStatus;
  run_status: RunStatus;
  provider: Provider | null;
  model: string | null;
  run_total: number;
  run_success: number;
  run_failed: number;
  run_skipped: number;
  created_at: string;
  run_started_at: string | null;
  run_finished_at: string | null;
  item_started_at: string | null;
  item_finished_at: string | null;
}

export interface RunItemListOut {
  items: RunListItemOut[];
  total_count: number;
  total_runs: number;
  total_items: number;
  total_success: number;
  total_failed: number;
}
