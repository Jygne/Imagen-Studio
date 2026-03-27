import logging
import re
import threading
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.infrastructure.db.database import get_db, SessionLocal
from app.infrastructure.db.repositories.run_repo import RunRepository
from app.infrastructure.db.repositories.settings_repo import SettingsRepository
from app.infrastructure.google_sheet.connector import GoogleSheetConnector
from app.workers.executor import execute_batch
from app.api.routes.local_generate import _scan_images
from app.domain.schemas.workflow import (
    SheetBatchExecuteRequest, SheetBatchExecuteResponse,
    LocalBatchExecuteRequest, LocalBatchExecuteResponse,
    SegBatchExecuteRequest, SegBatchExecuteResponse,
    PsdRenameBatchExecuteRequest, PsdRenameBatchExecuteResponse,
)
from app.api.routes.psd_rename import _scan_psds
from app.domain.enums import RunSource, RunStatus, WorkflowType

router = APIRouter(prefix="/workflows", tags=["Workflows"])


def _clean_bb_model_id(stem: str) -> str:
    """Remove trailing _[0-9a-f]{8} hash from filename stem.
    e.g. '5885480897_100814690407_3c949eba' → '5885480897_100814690407'
    """
    return re.sub(r'_[0-9a-fA-F]{8}$', '', stem)


@router.post("/sheet/execute", response_model=SheetBatchExecuteResponse)
def execute_sheet_batch(
    payload: SheetBatchExecuteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    settings_repo = SettingsRepository(db)
    gs_config = settings_repo.get_google_sheet_config()

    if not gs_config.spreadsheet_id:
        raise HTTPException(status_code=400, detail="Spreadsheet not configured")
    if not gs_config.service_account_json:
        raise HTTPException(status_code=400, detail="Service Account not configured")

    settings = settings_repo.get_settings()
    provider = payload.provider or settings.default_provider
    model = payload.model or settings.default_model
    size = payload.size or settings.default_size
    quality = payload.quality or settings.default_quality

    # Read eligible rows from Google Sheet
    try:
        connector = GoogleSheetConnector(gs_config.service_account_json)
        tab = (
            gs_config.clean_tab
            if payload.workflow_type == WorkflowType.CLEAN_IMAGE
            else gs_config.selling_point_tab
        )
        rows = connector.get_rows_where_generate_yes(
            gs_config.spreadsheet_id, tab, payload.workflow_type
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Sheet error: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="No rows with generate=YES found")

    # Create Run
    run_repo = RunRepository(db)
    run = run_repo.create_run(
        workflow_type=payload.workflow_type,
        source=RunSource.SHEET,
        provider=provider,
        model=model,
        metadata={
            "spreadsheet_id": gs_config.spreadsheet_id,
            "tab": tab,
            "size": size,
            "quality": quality,
            "prompt_override": payload.prompt_override,
        },
    )

    # Build row_data map (row_index -> full row dict) and store in run metadata
    # This lets the executor access SP fields without re-reading the sheet
    row_data_map = {
        str(row["row_index"]): {
            "bb_model_id": row.get("bb_model_id", ""),
            "rsku_model_image_url": row.get("rsku_model_image_url", ""),
            "variation_1_value": row.get("variation_1_value", ""),
            "llm_sellingpoints": row.get("llm_sellingpoints", ""),
        }
        for row in rows
    }

    # Persist row_data into run metadata
    run_orm = run_repo.get_run(run.id)
    run_orm.run_metadata = {**(run_orm.run_metadata or {}), "row_data": row_data_map}
    db.commit()

    # Create RunItems
    item_rows = [
        {
            "row_index": row["row_index"],
            "bb_model_id": row.get("bb_model_id"),
            "source_image_url": row.get("rsku_model_image_url"),
        }
        for row in rows
    ]
    run_repo.create_items_bulk(run.id, item_rows)
    run_repo.update_run_counts(run.id, total=len(rows), success=0, failed=0, skipped=0)

    # Launch background execution
    background_tasks.add_task(execute_batch, run.id, SessionLocal)

    return SheetBatchExecuteResponse(
        run_id=run.id,
        message=f"Batch started with {len(rows)} rows",
        queued_count=len(rows),
    )


@router.post("/local/execute", response_model=LocalBatchExecuteResponse)
def execute_local_batch(
    payload: LocalBatchExecuteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Phase 1: local clean_image only."""
    settings_repo = SettingsRepository(db)
    settings = settings_repo.get_settings()

    if not settings.output_directory:
        raise HTTPException(status_code=400, detail="Output directory not configured")

    provider = payload.provider or settings.default_provider
    model = payload.model or settings.default_model
    size = payload.size or settings.default_size
    quality = payload.quality or settings.default_quality

    # Scan directory (raises 400 if invalid or over limit)
    files = _scan_images(payload.input_dir)
    scanned_count = len(files)

    # Apply explicit allowlist if provided (user removed some thumbnails)
    if payload.included_filenames is not None:
        allowed = set(payload.included_filenames)
        files = [f for f in files if f.name in allowed]
        logger.info(
            "[local/execute] included_filenames=%r | scanned=%d → after_filter=%d",
            payload.included_filenames,
            scanned_count,
            len(files),
        )
    else:
        logger.info(
            "[local/execute] included_filenames=None (no filter) | scanned=%d",
            scanned_count,
        )

    if not files:
        raise HTTPException(status_code=400, detail="No supported images found in directory")

    # Create Run
    run_repo = RunRepository(db)
    run = run_repo.create_run(
        workflow_type=WorkflowType.CLEAN_IMAGE,
        source=RunSource.LOCAL,
        provider=provider,
        model=model,
        metadata={
            "input_dir": payload.input_dir,
            "size": size,
            "quality": quality,
            "prompt_override": payload.prompt_override,
        },
    )

    # Create RunItems (row_index is 1-based; bb_model_id = filename stem, hash stripped)
    item_rows = [
        {
            "row_index": i + 1,
            "bb_model_id": _clean_bb_model_id(f.stem),
            "source_image_url": str(f),
        }
        for i, f in enumerate(files)
    ]
    run_repo.create_items_bulk(run.id, item_rows)
    run_repo.update_run_counts(run.id, total=len(files), success=0, failed=0, skipped=0)

    background_tasks.add_task(execute_batch, run.id, SessionLocal)

    return LocalBatchExecuteResponse(
        run_id=run.id,
        message=f"Local batch started with {len(files)} images",
        queued_count=len(files),
    )


@router.post("/seg/execute", response_model=SegBatchExecuteResponse)
def execute_seg_batch(
    payload: SegBatchExecuteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Seg Image: local images → pisegv2 API → PSD output."""
    settings_repo = SettingsRepository(db)
    settings = settings_repo.get_settings()

    if not settings.output_directory:
        raise HTTPException(status_code=400, detail="Output directory not configured")

    # Scan directory (raises 400 if invalid or over limit)
    files = _scan_images(payload.input_dir)
    scanned_count = len(files)

    # Apply explicit allowlist if provided
    if payload.included_filenames is not None:
        allowed = set(payload.included_filenames)
        files = [f for f in files if f.name in allowed]
        logger.info(
            "[seg/execute] included_filenames=%r | scanned=%d → after_filter=%d",
            payload.included_filenames,
            scanned_count,
            len(files),
        )
    else:
        logger.info("[seg/execute] included_filenames=None | scanned=%d", scanned_count)

    if not files:
        raise HTTPException(status_code=400, detail="No supported images found in directory")

    # Create Run (no provider/model needed for seg)
    run_repo = RunRepository(db)
    run = run_repo.create_run(
        workflow_type=WorkflowType.SEG_IMAGE,
        source=RunSource.LOCAL,
        provider=None,
        model=None,
        metadata={"input_dir": payload.input_dir},
    )

    # Create RunItems (bb_model_id = filename stem, hash stripped)
    item_rows = [
        {
            "row_index": i + 1,
            "bb_model_id": _clean_bb_model_id(f.stem),
            "source_image_url": str(f),
        }
        for i, f in enumerate(files)
    ]
    run_repo.create_items_bulk(run.id, item_rows)
    run_repo.update_run_counts(run.id, total=len(files), success=0, failed=0, skipped=0)

    background_tasks.add_task(execute_batch, run.id, SessionLocal)

    return SegBatchExecuteResponse(
        run_id=run.id,
        message=f"Seg batch started with {len(files)} images",
        queued_count=len(files),
    )


@router.post("/psd-rename/execute", response_model=PsdRenameBatchExecuteResponse)
def execute_psd_rename_batch(
    payload: PsdRenameBatchExecuteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """PSD Rename: scan PSD files → Photoshop ExtendScript → renamed PSD output."""
    settings_repo = SettingsRepository(db)
    settings = settings_repo.get_settings()

    if not settings.output_directory:
        raise HTTPException(status_code=400, detail="Output directory not configured")

    files = _scan_psds(payload.input_dir)
    scanned_count = len(files)

    if payload.included_filenames is not None:
        allowed = set(payload.included_filenames)
        files = [f for f in files if f.name in allowed]
        logger.info(
            "[psd-rename/execute] included=%r | scanned=%d → filtered=%d",
            payload.included_filenames, scanned_count, len(files),
        )

    if not files:
        raise HTTPException(status_code=400, detail="No PSD files found in directory")

    run_repo = RunRepository(db)
    run = run_repo.create_run(
        workflow_type=WorkflowType.PSD_RENAME,
        source=RunSource.LOCAL,
        provider=None,
        model=None,
        metadata={
            "input_dir": payload.input_dir,
            "name_pixel": payload.name_pixel,
            "name_shape": payload.name_shape,
            "delete_hidden": payload.delete_hidden,
            "skip_no_text": payload.skip_no_text,
            "flatten_groups": payload.flatten_groups,
        },
    )

    item_rows = [
        {
            "row_index": i + 1,
            "bb_model_id": f.stem,
            "source_image_url": str(f),
        }
        for i, f in enumerate(files)
    ]
    run_repo.create_items_bulk(run.id, item_rows)
    run_repo.update_run_counts(run.id, total=len(files), success=0, failed=0, skipped=0)

    background_tasks.add_task(execute_batch, run.id, SessionLocal)

    return PsdRenameBatchExecuteResponse(
        run_id=run.id,
        message=f"PSD rename batch started with {len(files)} files",
        queued_count=len(files),
    )
