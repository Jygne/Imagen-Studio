from __future__ import annotations
import json
from typing import Optional
from app.infrastructure.google_sheet.header_validator import validate_headers, build_row_dict
from app.domain.enums import WorkflowType


class GoogleSheetConnector:
    """
    Read-only Google Sheet connector using Service Account credentials.
    Never writes back to the sheet.
    """

    def __init__(self, service_account_json: str):
        self.service_account_json = service_account_json
        self._client = None
        self._sa_email: Optional[str] = None

    def _get_client(self):
        if self._client is None:
            import gspread
            from google.oauth2.service_account import Credentials

            SCOPES = [
                "https://www.googleapis.com/auth/spreadsheets.readonly",
                "https://www.googleapis.com/auth/drive.readonly",
            ]

            sa_info = json.loads(self.service_account_json)
            self._sa_email = sa_info.get("client_email", "")

            creds = Credentials.from_service_account_info(sa_info, scopes=SCOPES)
            self._client = gspread.authorize(creds)
        return self._client

    @property
    def service_account_email(self) -> Optional[str]:
        if self._sa_email is None and self.service_account_json:
            try:
                info = json.loads(self.service_account_json)
                self._sa_email = info.get("client_email", "")
            except Exception:
                pass
        return self._sa_email

    def open_spreadsheet(self, spreadsheet_id: str):
        client = self._get_client()
        return client.open_by_key(spreadsheet_id)

    def get_spreadsheet_title(self, spreadsheet_id: str) -> str:
        ss = self.open_spreadsheet(spreadsheet_id)
        return ss.title

    def get_headers(self, spreadsheet_id: str, tab_name: str) -> list[str]:
        ss = self.open_spreadsheet(spreadsheet_id)
        ws = ss.worksheet(tab_name)
        row1 = ws.row_values(1)
        return row1

    def get_rows_where_generate_yes(
        self,
        spreadsheet_id: str,
        tab_name: str,
        workflow_type: WorkflowType,
    ) -> list[dict]:
        """
        Read all rows where generate=YES.
        Returns list of dicts keyed by header name.
        Raises ValueError if required headers are missing.
        """
        ss = self.open_spreadsheet(spreadsheet_id)
        ws = ss.worksheet(tab_name)
        all_values = ws.get_all_values()

        if not all_values:
            return []

        headers = all_values[0]
        present, missing = validate_headers(headers, workflow_type)

        if missing:
            raise ValueError(
                f"Missing required headers in tab '{tab_name}': {', '.join(missing)}"
            )

        result = []
        for row_idx, row in enumerate(all_values[1:], start=2):
            row_dict = build_row_dict(headers, row)
            generate_val = row_dict.get("generate", "").strip().upper()
            if generate_val == "YES":
                result.append({"row_index": row_idx, **row_dict})

        return result

    def get_preview_rows(
        self,
        spreadsheet_id: str,
        tab_name: str,
        workflow_type: WorkflowType,
        limit: int = 10,
    ) -> tuple[list[dict], int]:
        """Returns (preview_rows[:limit], total_yes_count)."""
        all_rows = self.get_rows_where_generate_yes(spreadsheet_id, tab_name, workflow_type)
        return all_rows[:limit], len(all_rows)
