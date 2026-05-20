from __future__ import annotations
import re

import requests
from gspread.exceptions import SpreadsheetNotFound, WorksheetNotFound
from sqlalchemy.orm import Session

from app.infrastructure.db.repositories.settings_repo import SettingsRepository
from app.domain.schemas.settings import (
    AppSettingsOut, AppSettingsUpdate,
    GoogleSheetConfigOut, GoogleSheetConfigUpdate,
    ConnectionValidationResult, HeaderValidationResult,
    SheetStatusOut, SheetPreviewOut, SheetPreviewRow,
    BBStatusCheckRequest, BBStatusCheckOut, BBStatusRowOut,
)
from app.domain.enums import Provider, ImageSize, ImageQuality, WorkflowType
from app.infrastructure.google_sheet.connector import GoogleSheetConnector
from app.infrastructure.google_sheet.header_validator import validate_headers
from app.infrastructure.providers.bb_status_client import BBStatusLookupClient


def _extract_spreadsheet_id(url_or_id: str) -> str:
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url_or_id)
    if match:
        return match.group(1)
    return url_or_id.strip()


def _extract_sheet_gid(url: str) -> int | None:
    match = re.search(r"[?#&]gid=(\d+)", url)
    if match:
        return int(match.group(1))
    return None


def _normalize_status_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


class SettingsService:
    def __init__(self, db: Session):
        self.repo = SettingsRepository(db)

    # ── App Settings ───────────────────────────────────────────────────────────

    def get_settings(self) -> AppSettingsOut:
        s = self.repo.get_settings()
        return AppSettingsOut(
            output_directory=s.output_directory or "",
            default_provider=s.default_provider,
            default_model=s.default_model,
            default_size=s.default_size,
            default_quality=s.default_quality,
            max_concurrency=s.max_concurrency,
            timeout_seconds=s.timeout_seconds,
            seg_user_token=s.seg_user_token or "",
            bb_status_api_url=s.bb_status_api_url or "",
            bb_client_name=s.bb_client_name or "AIGC",
            bb_token=s.bb_token or "",
            bb_region=s.bb_region or "PH",
            bb_hidden_no_image_status=s.bb_hidden_no_image_status or 13,
            clean_image_prompt=s.clean_image_prompt or "",
            selling_point_prompt=s.selling_point_prompt or "",
        )

    def update_settings(self, payload: AppSettingsUpdate) -> AppSettingsOut:
        updates = payload.model_dump(exclude_none=True)
        self.repo.update_settings(updates)
        return self.get_settings()

    # ── Google Sheet Config ────────────────────────────────────────────────────

    def get_sheet_config(self) -> GoogleSheetConfigOut:
        c = self.repo.get_google_sheet_config()
        return GoogleSheetConfigOut(
            spreadsheet_url=c.spreadsheet_url or "",
            spreadsheet_id=c.spreadsheet_id or "",
            clean_tab=c.clean_tab or "Sheet1",
            selling_point_tab=c.selling_point_tab or "Sheet2",
            has_service_account=bool(c.service_account_json),
        )

    def update_sheet_config(self, payload: GoogleSheetConfigUpdate) -> GoogleSheetConfigOut:
        updates = payload.model_dump(exclude_none=True)
        # Don't allow saving empty tab names — keep existing DB value instead
        if "clean_tab" in updates and not updates["clean_tab"].strip():
            del updates["clean_tab"]
        if "selling_point_tab" in updates and not updates["selling_point_tab"].strip():
            del updates["selling_point_tab"]
        if "spreadsheet_url" in updates:
            updates["spreadsheet_id"] = _extract_spreadsheet_id(updates["spreadsheet_url"])
        self.repo.update_google_sheet_config(updates)
        return self.get_sheet_config()

    # ── Validation ─────────────────────────────────────────────────────────────

    def _get_connector(self) -> GoogleSheetConnector:
        config = self.repo.get_google_sheet_config()
        if not config.service_account_json:
            raise ValueError("Service Account not configured")
        return GoogleSheetConnector(config.service_account_json)

    def validate_connection(self) -> ConnectionValidationResult:
        try:
            config = self.repo.get_google_sheet_config()
            if not config.spreadsheet_id:
                return ConnectionValidationResult(connected=False, error="Spreadsheet ID not configured")
            connector = self._get_connector()
            title = connector.get_spreadsheet_title(config.spreadsheet_id)
            return ConnectionValidationResult(connected=True, spreadsheet_title=title)
        except Exception as e:
            return ConnectionValidationResult(connected=False, error=str(e))

    def validate_headers(self) -> list[HeaderValidationResult]:
        config = self.repo.get_google_sheet_config()
        connector = self._get_connector()
        results = []

        # Use effective tab names with fallback so empty DB values don't break things
        effective_tabs = [
            (WorkflowType.CLEAN_IMAGE, config.clean_tab or "Sheet1"),
            (WorkflowType.SELLING_POINT, config.selling_point_tab or "Sheet2"),
        ]

        for workflow_type, tab_name in effective_tabs:
            try:
                headers = connector.get_headers(config.spreadsheet_id, tab_name)
                present, missing = validate_headers(headers, workflow_type)
                results.append(HeaderValidationResult(
                    tab=tab_name,
                    valid=len(missing) == 0,
                    present=present,
                    missing=missing,
                ))
            except Exception as e:
                # Give a clear "tab not found" message instead of raw exception text
                err_str = str(e)
                if tab_name and tab_name.lower() in err_str.lower():
                    friendly = f"Tab '{tab_name}' not found in spreadsheet"
                else:
                    friendly = f"Error reading tab '{tab_name}': {err_str}"
                results.append(HeaderValidationResult(
                    tab=tab_name,
                    valid=False,
                    present=[],
                    missing=[friendly],
                ))

        return results

    def get_sheet_status(self) -> SheetStatusOut:
        config = self.repo.get_google_sheet_config()
        sa_email = None

        if config.service_account_json:
            try:
                import json
                sa_info = json.loads(config.service_account_json)
                sa_email = sa_info.get("client_email")
            except Exception:
                pass

        conn = self.validate_connection()

        clean_validation = None
        sp_validation = None
        if conn.connected:
            try:
                header_results = self.validate_headers()
                # Match using effective tab names (same fallback as validate_headers)
                effective_clean_tab = config.clean_tab or "Sheet1"
                effective_sp_tab = config.selling_point_tab or "Sheet2"
                clean_validation = next((r for r in header_results if r.tab == effective_clean_tab), None)
                sp_validation = next((r for r in header_results if r.tab == effective_sp_tab), None)
            except Exception:
                pass

        return SheetStatusOut(
            connected=conn.connected,
            spreadsheet_url=config.spreadsheet_url or "",
            spreadsheet_id=config.spreadsheet_id or "",
            spreadsheet_title=conn.spreadsheet_title,
            service_account_configured=bool(config.service_account_json),
            service_account_email=sa_email,
            clean_tab_validation=clean_validation,
            selling_point_tab_validation=sp_validation,
            connection_error=conn.error,
        )

    def get_preview(self, workflow_type: WorkflowType) -> SheetPreviewOut:
        config = self.repo.get_google_sheet_config()
        connector = self._get_connector()

        tab = config.clean_tab if workflow_type == WorkflowType.CLEAN_IMAGE else config.selling_point_tab
        rows, total = connector.get_preview_rows(config.spreadsheet_id, tab, workflow_type, limit=5)

        preview_rows = []
        for row in rows:
            preview_rows.append(SheetPreviewRow(
                row_index=row.get("row_index", 0),
                bb_model_id=row.get("bb_model_id") or None,
                rsku_model_image_url=row.get("rsku_model_image_url") or None,
                rsku_model_image=row.get("RSKU Model Image") or None,
                variation_1_value=row.get("variation_1_value") or None,
                llm_sellingpoints=row.get("llm_sellingpoints") or None,
                generate=row.get("generate", "YES"),
            ))

        return SheetPreviewOut(
            workflow_type=workflow_type.value,
            tab=tab,
            total_yes_rows=total,
            preview_rows=preview_rows,
        )

    def check_bb_status(self, payload: BBStatusCheckRequest) -> BBStatusCheckOut:
        config = self.repo.get_google_sheet_config()
        spreadsheet_url = payload.spreadsheet_url.strip()
        spreadsheet_id = _extract_spreadsheet_id(spreadsheet_url)
        if not spreadsheet_id:
            raise ValueError("Spreadsheet URL or ID is required")
        if not config.service_account_json:
            raise ValueError("Service Account not configured")

        connector = self._get_connector()
        sheet_gid = _extract_sheet_gid(spreadsheet_url)
        resolved_tab_name = payload.tab_name
        try:
            if payload.tab_name.strip():
                all_rows = connector.get_all_rows(spreadsheet_id, payload.tab_name)
            elif sheet_gid is not None:
                resolved_tab_name, all_rows = connector.get_all_rows_by_gid(spreadsheet_id, sheet_gid)
            else:
                raise ValueError("Tab name is required unless the spreadsheet URL includes a gid.")
        except WorksheetNotFound as e:
            if sheet_gid is not None:
                try:
                    resolved_tab_name, all_rows = connector.get_all_rows_by_gid(spreadsheet_id, sheet_gid)
                except WorksheetNotFound:
                    raise ValueError(
                        f"Tab '{payload.tab_name}' not found in spreadsheet. Please copy the exact tab name from Google Sheet."
                    ) from e
            else:
                raise ValueError(
                    f"Tab '{payload.tab_name}' not found in spreadsheet. Please copy the exact tab name from Google Sheet."
                ) from e
        except SpreadsheetNotFound as e:
            raise ValueError(
                "Spreadsheet not found or the configured Google Service Account does not have access to it."
            ) from e
        except Exception as e:
            raise ValueError(f"Failed to read spreadsheet/tab: {e}") from e

        if not all_rows:
            return BBStatusCheckOut(
                spreadsheet_url=spreadsheet_url,
                spreadsheet_id=spreadsheet_id,
                tab_name=resolved_tab_name,
                target_status_code=self.repo.get_settings().bb_hidden_no_image_status or 13,
                total_sheet_rows=0,
                checked_rows=0,
                bb_pool_count=0,
                need_design_count=0,
                stale_count=0,
                missing_in_bb_count=0,
                error_count=0,
                rows=[],
            )

        headers = set(all_rows[0].keys())
        if "bb_model_id" not in headers:
            raise ValueError(f"Tab '{resolved_tab_name}' is missing required header: bb_model_id")
        if payload.start_row is not None and payload.end_row is not None and payload.start_row > payload.end_row:
            raise ValueError("start_row cannot be greater than end_row")

        filtered_rows = []
        for row in all_rows:
            bb_model_id = str(row.get("bb_model_id", "")).strip()
            if not bb_model_id:
                continue
            row_index = int(row.get("row_index", 0) or 0)
            if payload.start_row is not None and row_index < payload.start_row:
                continue
            if payload.end_row is not None and row_index > payload.end_row:
                continue
            if payload.only_generate_yes:
                generate_val = str(row.get("generate", "")).strip().upper()
                if generate_val != "YES":
                    continue
            filtered_rows.append(row)

        if payload.limit is not None and payload.limit > 0:
            filtered_rows = filtered_rows[:payload.limit]

        settings = self.repo.get_settings()
        target_status = settings.bb_hidden_no_image_status or 13
        if not filtered_rows:
            return BBStatusCheckOut(
                spreadsheet_url=spreadsheet_url,
                spreadsheet_id=spreadsheet_id,
                tab_name=resolved_tab_name,
                target_status_code=target_status,
                total_sheet_rows=len(all_rows),
                checked_rows=0,
                bb_pool_count=0,
                need_design_count=0,
                stale_count=0,
                missing_in_bb_count=0,
                error_count=0,
                rows=[],
            )

        client = BBStatusLookupClient(
            api_url=settings.bb_status_api_url or "",
            client_name=settings.bb_client_name or "AIGC",
            token=settings.bb_token or "",
            region=settings.bb_region or "PH",
            timeout_seconds=min(max(settings.timeout_seconds, 10), 120),
        )
        try:
            status_map = client.lookup_by_status(target_status)
        except requests.RequestException as e:
            raise ValueError(f"BB status request failed: {e}") from e

        result_rows: list[BBStatusRowOut] = []
        need_design_count = 0
        missing_in_bb_count = 0
        error_count = 0
        target_status_name = _normalize_status_text("PDP Hidden-No Image")

        for row in filtered_rows:
            bb_model_id = str(row.get("bb_model_id", "")).strip()
            matched = status_map.get(bb_model_id)
            matched_status_name = _normalize_status_text(matched.status_text if matched else None)
            need_design = bool(
                matched and (
                    matched.status_code == target_status
                    or matched_status_name == target_status_name
                )
            )
            if need_design:
                need_design_count += 1

            result_rows.append(BBStatusRowOut(
                row_index=row.get("row_index", 0),
                bb_model_id=bb_model_id,
                variation_1_value=row.get("variation_1_value") or None,
                generate=str(row.get("generate", "")),
                current_status_code=matched.status_code if matched else None,
                current_status_text=matched.status_text if matched else "Not in current Hidden-No-Image pool",
                need_design=need_design,
                matched_in_bb=matched is not None,
                error=None,
            ))

        stale_count = max(len(result_rows) - need_design_count, 0)

        return BBStatusCheckOut(
            spreadsheet_url=spreadsheet_url,
            spreadsheet_id=spreadsheet_id,
            tab_name=resolved_tab_name,
            target_status_code=target_status,
            total_sheet_rows=len(all_rows),
            checked_rows=len(result_rows),
            bb_pool_count=len(status_map),
            need_design_count=need_design_count,
            stale_count=stale_count,
            missing_in_bb_count=missing_in_bb_count,
            error_count=error_count,
            rows=result_rows,
        )
