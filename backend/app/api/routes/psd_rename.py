"""
Routes for PSD Rename workflow.

  POST /psd-rename/preview  — scan a directory for PSD files, return list + thumbnails
"""
import base64
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/psd-rename", tags=["PSD Rename"])

PSD_SCAN_LIMIT = 200


# ── Schemas ───────────────────────────────────────────────────────────────────

class PsdPreviewItem(BaseModel):
    index: int
    filename: str
    stem: str
    thumbnail: Optional[str] = None  # data:image/jpeg;base64,...


class PsdPreviewRequest(BaseModel):
    input_dir: str


class PsdPreviewResponse(BaseModel):
    input_dir: str
    total_files: int
    preview_items: list[PsdPreviewItem]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _scan_psds(input_dir: str) -> list[Path]:
    """Return up to PSD_SCAN_LIMIT .psd files from input_dir, sorted by name."""
    dir_path = Path(input_dir)
    if not dir_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory not found: {input_dir}")

    files = sorted(
        [
            p for p in dir_path.iterdir()
            if p.is_file()
            and not p.name.startswith(".")
            and p.suffix.lower() == ".psd"
        ],
        key=lambda p: p.name.lower(),
    )

    if len(files) > PSD_SCAN_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Directory contains {len(files)} PSD files, exceeding the "
                f"{PSD_SCAN_LIMIT}-file limit. Please split into smaller batches."
            ),
        )
    return files


def _make_psd_thumbnail(psd_path: Path) -> Optional[str]:
    """
    Render the first composite image of a PSD as a small base64 JPEG thumbnail.
    Returns None on any error (psd-tools not available, corrupt file, etc.).
    """
    try:
        from psd_tools import PSDImage
        from PIL import Image
        import io

        psd = PSDImage.open(str(psd_path))
        img = psd.topil()
        if img is None:
            return None
        img = img.convert("RGB")
        img.thumbnail((200, 200))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        logger.debug("[psd_rename] thumbnail failed for %s: %s", psd_path.name, e)
        return None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/preview", response_model=PsdPreviewResponse)
def preview_psd_directory(payload: PsdPreviewRequest):
    """Scan a local directory and return PSD file list + thumbnails."""
    files = _scan_psds(payload.input_dir)

    preview_items = [
        PsdPreviewItem(
            index=i,
            filename=p.name,
            stem=p.stem,
            thumbnail=_make_psd_thumbnail(p),
        )
        for i, p in enumerate(files)
    ]

    return PsdPreviewResponse(
        input_dir=payload.input_dir,
        total_files=len(files),
        preview_items=preview_items,
    )
