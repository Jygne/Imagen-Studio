"""
Routes for Seg Generate workflow.

  POST /seg-generate/preview      — scan a directory, return file list + thumbnails
  GET  /seg-generate/source-file  — proxy a local source image for the Runs viewer
  GET  /seg-generate/psd-previews — open PSD and return product layers as base64 PNGs
"""
import base64
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from io import BytesIO
from pathlib import Path
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.infrastructure.db.database import get_db
from app.infrastructure.db.repositories.run_repo import RunRepository
from app.domain.enums import RunSource
from app.api.routes.local_generate import (
    _scan_images,
    _make_thumbnail,
    PreviewItem,
    LocalPreviewRequest,
    LocalPreviewResponse,
    SCAN_LIMIT,
)

router = APIRouter(prefix="/seg-generate", tags=["Seg Generate"])


@router.post("/preview", response_model=LocalPreviewResponse)
def seg_preview_directory(payload: LocalPreviewRequest):
    """
    Scan a local directory and return image count + thumbnails.
    Reuses the same logic as /local-generate/preview.
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
def seg_serve_source_file(
    run_id: str = Query(...),
    item_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Proxy a local source image for the Runs viewer (Seg workflow).
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


@router.get("/psd-previews")
def get_psd_previews(
    path: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Open a PSD and return all product layers as base64 PNG data URLs.
    Opens the PSD once and returns all layers in a single response.

    Returns:
        { "layers": [{"name": "product", "data_url": "data:image/png;base64,..."}] }
    """
    from app.infrastructure.db.repositories.settings_repo import SettingsRepository

    settings = SettingsRepository(db).get_settings()
    output_dir = settings.output_directory

    file_path = Path(path)
    if not file_path.is_file():
        return {"layers": []}

    if output_dir:
        try:
            file_path.resolve().relative_to(Path(output_dir).resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        from psd_tools import PSDImage
        from PIL import Image

        psd = PSDImage.open(str(file_path))
        result = []

        for layer in psd:
            name = layer.name or ""
            # Match "product" or "product1", "product2", ...
            if name != "product" and not (
                name.startswith("product") and name[7:].isdigit()
            ):
                continue

            # composite(layer_filter=...) renders only this layer with correct
            # alpha/transparency channel applied, returning true RGBA with transparent bg
            img = psd.composite(layer_filter=lambda l, _layer=layer: l == _layer)
            if img is None:
                continue
            if img.mode != "RGBA":
                img = img.convert("RGBA")

            # Auto-crop transparent borders so subject fills the preview cell
            bbox = img.getbbox()
            if bbox:
                img = img.crop(bbox)

            buf = BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            result.append({
                "name": name,
                "data_url": f"data:image/png;base64,{b64}",
            })

        logger.info("[psd-previews] %s → %d product layer(s)", path, len(result))
        return {"layers": result}

    except Exception as e:
        logger.warning("[psd-previews] failed to read PSD %s: %s", path, e)
        return {"layers": []}
