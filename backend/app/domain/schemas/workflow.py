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


class PsdRenameBatchExecuteRequest(BaseModel):
    """PSD Rename workflow: batch rename PSD layers via Photoshop ExtendScript."""
    input_dir: str
    included_filenames: Optional[List[str]] = None
    name_pixel: str = "scenebg"    # pixel / smart object layers
    name_shape: str = "stickerbg"  # shape / fill layers (non-frame)
    delete_hidden: bool = True
    skip_no_text: bool = True
    flatten_groups: bool = True


class PsdRenameBatchExecuteResponse(BaseModel):
    run_id: str
    message: str
    queued_count: int
