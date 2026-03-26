from __future__ import annotations
import re
from sqlalchemy.orm import Session

from app.infrastructure.db.repositories.settings_repo import SettingsRepository
from app.domain.schemas.settings import (
    AppSettingsOut, AppSettingsUpdate,
    GoogleSheetConfigOut, GoogleSheetConfigUpdate,
    ConnectionValidationResult, HeaderValidationResult,
    SheetStatusOut, SheetPreviewOut, SheetPreviewRow,
)
from app.domain.enums import Provider, ImageSize, ImageQuality, WorkflowType
from app.infrastructure.google_sheet.connector import GoogleSheetConnector
from app.infrastructure.google_sheet.header_validator import validate_headers


def _extract_spreadsheet_id(url_or_id: str) -> str:
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url_or_id)
    if match:
        return match.group(1)
    return url_or_id.strip()


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
