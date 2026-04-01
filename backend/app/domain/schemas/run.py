from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.domain.enums import RunStatus, ItemStatus, WorkflowType, RunSource, Provider



class RunItemOut(BaseModel):
    id: str
    run_id: str
    row_index: int
    bb_model_id: Optional[str] = None
    source_image_url: Optional[str] = None
    source_image_access_url: Optional[str] = None  # computed by service; safe URL for browser
    status: ItemStatus
    output_file_path: Optional[str] = None
    output_image_url: Optional[str] = None
    error_reason: Optional[str] = None
    skipped_reason: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RunOut(BaseModel):
    id: str
    workflow_type: WorkflowType
    source: RunSource
    status: RunStatus
    provider: Optional[Provider] = None
    model: Optional[str] = None
    total: int
    success: int
    failed: int
    skipped: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    metadata: dict = {}
    thumbnail_url: Optional[str] = None
    first_bb_model_id: Optional[str] = None

    class Config:
        from_attributes = True


class RunDetailOut(RunOut):
    items: list[RunItemOut] = []


class RunListOut(BaseModel):
    runs: list[RunOut]
    total_count: int


# ── Item-first list view ───────────────────────────────────────────────────────

class RunListItemOut(BaseModel):
    """One row in the item-first Runs table."""
    item_id: str
    run_id: str
    row_index: int
    bb_model_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    source_image_access_url: Optional[str] = None
    workflow_type: WorkflowType
    source: RunSource
    item_status: ItemStatus
    run_status: RunStatus
    provider: Optional[Provider] = None
    model: Optional[str] = None
    run_total: int
    run_success: int
    run_failed: int
    run_skipped: int
    created_at: datetime
    run_started_at: Optional[datetime] = None
    run_finished_at: Optional[datetime] = None
    item_started_at: Optional[datetime] = None
    item_finished_at: Optional[datetime] = None


class RunItemListOut(BaseModel):
    items: list[RunListItemOut]
    total_count: int       # items on this page (for pagination)
    total_runs: int        # all-time run count
    total_items: int       # all-time item count
    total_success: int     # all-time success items
    total_failed: int      # all-time failed items
