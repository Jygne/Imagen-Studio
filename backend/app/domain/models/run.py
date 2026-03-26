from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from app.domain.enums import RunStatus, ItemStatus, WorkflowType, RunSource, Provider


@dataclass
class RunItem:
    id: str
    run_id: str
    row_index: int
    bb_model_id: Optional[str]
    source_image_url: Optional[str]
    status: ItemStatus = ItemStatus.PENDING
    output_file_path: Optional[str] = None
    error_reason: Optional[str] = None
    skipped_reason: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


@dataclass
class Run:
    id: str
    workflow_type: WorkflowType
    source: RunSource
    status: RunStatus = RunStatus.QUEUED
    provider: Optional[Provider] = None
    model: Optional[str] = None
    total: int = 0
    success: int = 0
    failed: int = 0
    skipped: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    metadata: dict = field(default_factory=dict)
    items: list[RunItem] = field(default_factory=list)
