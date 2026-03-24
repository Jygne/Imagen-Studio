"""
Routes for Local Generate workflow.

  POST /local-generate/preview        — scan a directory, return file list + thumbnails
  GET  /local-generate/source-file    — proxy a local source image for the Runs viewer
"""
import base64
import io
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.infrastructure.db.database import get_db
from app.infrastructure.db.repositories.run_repo import RunRepository
from app.domain.enums import RunSource

router = APIRouter(prefix="/local-generate", tags=["Local Generate"])

# ── Constants ─────────────────────────────────────────────────────────────────

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".jfif"}
PREVIEW_LIMIT = 8
SCAN_LIMIT = 500

# ── Schemas ───────────────────────────────────────────────────────────────────


class PreviewItem(BaseModel):
    index: int
    filename: str
    stem: str
    thumbnail: Optional[str] = None  # data:image/jpeg;base64,...


class LocalPreviewRequest(BaseModel):
    input_dir: str


class LocalPreviewResponse(BaseModel):
    input_dir: str
    total_images: int
    has_more: bool
    preview_items: list[PreviewItem]


# ── Shared scan helper ────────────────────────────────────────────────────────


def _scan_images(input_dir: str, limit: int = SCAN_LIMIT) -> list[Path]:
    """
    Return up to `limit` image files from `input_dir`, sorted by filename.
    Non-recursive; skips hidden files.
    Raises HTTPException(400) if dir is invalid or over limit.
    """
    dir_path = Path(input_dir)
    if not dir_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory not found: {input_dir}")

    files = sorted(
        [
            p
            for p in dir_path.iterdir()
            if p.is_file()
            and not p.name.startswith(".")
            and p.suffix.lower() in SUPPORTED_EXTENSIONS
        ],
        key=lambda p: p.name.lower(),
    )

    if len(files) > limit:
        raise HTTPException(
            status_code=400,
            detail=f"Directory contains {len(files)} images, which exceeds the {limit}-image limit. "
                   "Please select a smaller directory or split your images into batches.",
        )

    return files


def _make_thumbnail(path: Path, width: int = 120, quality: int = 50) -> Optional[str]:
    """
    Generate a base64-encoded JPEG thumbnail.
    Returns None if Pillow is unavailable or the image can't be read.
    """
    try:
        from PIL import Image

        with Image.open(path) as img:
            img = img.convert("RGB")
            ratio = width / img.width
            new_height = max(1, int(img.height * ratio))
            img = img.resize((width, new_height), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{encoded}"
    except Exception:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/preview", response_model=LocalPreviewResponse)
def preview_directory(payload: LocalPreviewRequest):
    """
    Scan a local directory and return image count + thumbnails for all files.
    The scan is capped at SCAN_LIMIT (500) images.
    """
    files = _scan_images(payload.input_dir)
    total = len(files)

    preview_items = [
        PreviewItem(
            index=i,
            filename=p.name,
            stem=p.stem,
            thumbnail=_make_thumbnail(p),
        )
        for i, p in enumerate(files)
    ]

    return LocalPreviewResponse(
        input_dir=payload.input_dir,
        total_images=total,
        has_more=False,
        preview_items=preview_items,
    )


@router.get("/source-file")
def serve_source_file(
    run_id: str = Query(...),
    item_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Proxy a local source image for the Runs viewer.
    Four-layer validation:
      1. run.source == LOCAL
      2. item.run_id == run_id
      3. item.source_image_url exists and is a file
      4. file is inside run_metadata["input_dir"] (when set)
    """
    repo = RunRepository(db)

    run = repo.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.source != RunSource.LOCAL:
        raise HTTPException(status_code=400, detail="Run is not a local run")

    items = repo.get_items_by_run(run_id)
    item = next((i for i in items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.run_id != run_id:
        raise HTTPException(status_code=400, detail="Item does not belong to this run")

    source_path = item.source_image_url
    if not source_path:
        raise HTTPException(status_code=404, detail="Item has no source image")

    file_path = Path(source_path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Source file not found on disk")

    input_dir = (run.run_metadata or {}).get("input_dir")
    if input_dir:
        try:
            file_path.resolve().relative_to(Path(input_dir).resolve())
        except ValueError:
            raise HTTPException(
                status_code=403,
                detail="Source file is outside the run's input directory",
            )

    return FileResponse(str(file_path))
