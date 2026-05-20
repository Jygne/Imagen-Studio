from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests


ID_FIELD_CANDIDATES = (
    "bb_model_id",
    "model_id",
    "modelId",
    "id",
)

STATUS_FIELD_CANDIDATES = (
    "status",
    "status_code",
    "statusCode",
    "current_status",
)

STATUS_TEXT_FIELD_CANDIDATES = (
    "status_text",
    "status_name",
    "statusName",
    "status_desc",
    "statusDesc",
    "status_label",
)


@dataclass
class BBModelStatusRecord:
    bb_model_id: str
    status_code: int | None
    status_text: str | None


class BBStatusLookupClient:
    """
    MVP client for the documented BB model search API.

    Uses the existing "search by status" endpoint from the PDF:
    - POST to the configured /bb-model/search URL
    - body shape: {"status": [13], "page_num": 1, "page_size": 50}
    - response contains a list of model records somewhere under common keys
    """

    def __init__(
        self,
        *,
        api_url: str,
        client_name: str,
        token: str,
        region: str,
        timeout_seconds: int = 20,
    ) -> None:
        self.api_url = api_url.strip()
        self.client_name = client_name.strip() or "AIGC"
        self.token = token.strip()
        self.region = region.strip()
        self.timeout_seconds = timeout_seconds

    def lookup_by_status(self, status_code: int, page_size: int = 100, max_pages: int = 200) -> dict[str, BBModelStatusRecord]:
        if not self.api_url:
            raise ValueError("BB status API URL is not configured")
        if not self.token:
            raise ValueError("BB token is not configured")
        if not self.region:
            raise ValueError("BB region is not configured")

        results: dict[str, BBModelStatusRecord] = {}
        previous_page_ids: set[str] | None = None

        for page_num in range(1, max_pages + 1):
            payload = {
                "status": [status_code],
                "page_num": page_num,
                "page_size": page_size,
            }
            response = requests.post(
                self.api_url,
                headers={
                    "Content-Type": "application/json",
                    "Client-Name": self.client_name,
                    "Token": self.token,
                    "Region": self.region,
                },
                json=payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()

            records = self._extract_records(response.json())
            current_page_ids: set[str] = set()
            for raw_record in records:
                parsed = self._parse_record(raw_record)
                if parsed:
                    results[parsed.bb_model_id] = parsed
                    current_page_ids.add(parsed.bb_model_id)

            if not records:
                break
            if len(records) < page_size:
                break
            if previous_page_ids is not None and current_page_ids == previous_page_ids:
                break
            previous_page_ids = current_page_ids

        return results

    def _extract_records(self, payload: Any) -> list[dict[str, Any]]:
        queue: list[Any] = [payload]
        preferred_keys = {"data", "items", "models", "records", "list", "result", "rows"}

        while queue:
            current = queue.pop(0)

            if isinstance(current, list):
                dict_items = [item for item in current if isinstance(item, dict)]
                if dict_items and any(self._looks_like_record(item) for item in dict_items):
                    return dict_items
                queue.extend(dict_items)
                continue

            if isinstance(current, dict):
                if self._looks_like_record(current):
                    return [current]

                prioritized: list[Any] = []
                fallback: list[Any] = []
                for key, value in current.items():
                    if isinstance(value, (dict, list)):
                        if key in preferred_keys:
                            prioritized.append(value)
                        else:
                            fallback.append(value)
                queue = prioritized + queue + fallback

        return []

    def _looks_like_record(self, record: dict[str, Any]) -> bool:
        has_id = any(record.get(field) not in (None, "") for field in ID_FIELD_CANDIDATES)
        has_status = any(record.get(field) not in (None, "") for field in STATUS_FIELD_CANDIDATES)
        return has_id and has_status

    def _parse_record(self, record: dict[str, Any]) -> BBModelStatusRecord | None:
        bb_model_id = self._first_value(record, ID_FIELD_CANDIDATES)
        if bb_model_id in (None, ""):
            return None

        status_raw = self._first_value(record, STATUS_FIELD_CANDIDATES)
        status_text_raw = self._first_value(record, STATUS_TEXT_FIELD_CANDIDATES)

        status_code: int | None = None
        if status_raw not in (None, ""):
            try:
                status_code = int(str(status_raw).strip())
            except ValueError:
                status_text_raw = status_text_raw or str(status_raw)

        status_text = None if status_text_raw in (None, "") else str(status_text_raw).strip()

        return BBModelStatusRecord(
            bb_model_id=str(bb_model_id).strip(),
            status_code=status_code,
            status_text=status_text,
        )

    @staticmethod
    def _first_value(record: dict[str, Any], field_names: tuple[str, ...]) -> Any:
        for field_name in field_names:
            if field_name in record and record[field_name] not in (None, ""):
                return record[field_name]
        return None
