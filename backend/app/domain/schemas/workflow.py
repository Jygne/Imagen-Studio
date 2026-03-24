from pydantic import BaseModel
from typing import Optional, List
from app.domain.enums import WorkflowType, Provider, ImageSize, ImageQuality


class SheetBatchExecuteRequest(BaseModel):
    workflow_type: WorkflowType
    provider: Optional[Provider] = None
    model: Optional[str] = None
    size: Optional[ImageSize] = None
    quality: Optional[ImageQuality] = None
    prompt_override: Optional[str] = None


class SheetBatchExecuteResponse(BaseModel):
    run_id: str
    message: str
    queued_count: int


class LocalBatchExecuteRequest(BaseModel):
    """Phase 1: local clean_image only. selling_point returns 400."""
    input_dir: str
    included_filenames: Optional[List[str]] = None  # None = include all; list = explicit allowlist
    provider: Optional[Provider] = None
    model: Optional[str] = None
    size: Optional[ImageSize] = None
    quality: Optional[ImageQuality] = None
    prompt_override: Optional[str] = None


class LocalBatchExecuteResponse(BaseModel):
    run_id: str
    message: str
    queued_count: int


class SegBatchExecuteRequest(BaseModel):
    """Seg Image workflow: local images → piseg API → PSD output."""
    input_dir: str
    included_filenames: Optional[List[str]] = None  # None = include all; list = explicit allowlist


class SegBatchExecuteResponse(BaseModel):
    run_id: str
    message: str
    queued_count: int
