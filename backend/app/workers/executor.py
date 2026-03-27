import os
import uuid
import logging
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Cancellation registry ─────────────────────────────────────────────────────
# Maps run_id → threading.Event. Setting the event requests cancellation.
_cancel_events: dict[str, threading.Event] = {}
_events_lock = threading.Lock()


def request_cancel(run_id: str) -> bool:
    """Signal a running batch to stop. Returns True if the run was found."""
    with _events_lock:
        event = _cancel_events.get(run_id)
    if event:
        event.set()
        return True
    return False


def _register_cancel_event(run_id: str) -> threading.Event:
    event = threading.Event()
    with _events_lock:
        _cancel_events[run_id] = event
    return event


def _cleanup_cancel_event(run_id: str) -> None:
    with _events_lock:
        _cancel_events.pop(run_id, None)

from app.infrastructure.db.repositories.run_repo import RunRepository
from app.infrastructure.db.repositories.settings_repo import SettingsRepository
from app.infrastructure.db.repositories.api_key_repo import ApiKeyRepository
from app.infrastructure.providers.openai_provider import OpenAIProvider
from app.infrastructure.providers.openrouter_provider import OpenRouterProvider
from app.workers.clean_image_worker import process_clean_image
from app.workers.selling_point_worker import process_selling_point
from app.workers.seg_worker import process_seg_image
from app.workers.psd_builder import build_psd, build_psd_fallback
from app.workers.psd_rename_worker import build_rename_jsx, run_photoshop_jsx, parse_jsx_log
from app.domain.enums import (
    RunStatus, ItemStatus, WorkflowType, Provider,
    OpenAIModel, OpenRouterModel
)


def _get_provider(db: Session, provider: Provider, model: str):
    key_repo = ApiKeyRepository(db)
    raw_key = key_repo.get_raw_key(provider)
    if not raw_key:
        raise ValueError(f"No API key configured for {provider.value}")

    if provider == Provider.OPENAI:
        return OpenAIProvider(raw_key, model=model)
    elif provider == Provider.OPENROUTER:
        return OpenRouterProvider(raw_key, model=model)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def _workflow_subfolder(workflow_type: WorkflowType, source) -> str:
    """
    Map (source, workflow_type) → output subfolder name.
      local  + clean_image      → local
      sheet  + clean_image      → sheet_clean
      sheet  + selling_point    → sheet_selling_point
      *      + seg_image        → seg
    """
    from app.domain.enums import RunSource
    if workflow_type == WorkflowType.SEG_IMAGE:
        return "seg"
    if source == RunSource.LOCAL:
        return "local"
    if workflow_type == WorkflowType.CLEAN_IMAGE:
        return "sheet_clean"
    return "sheet_selling_point"


def _save_output(
    bb_model_id: str,
    image_bytes: bytes,
    output_dir: str,
    workflow_type: WorkflowType,
    source,
    item_id: str = "",
    ext: str = ".png",
) -> str:
    """
    Save to: output_dir/YYYYMMDD/<subfolder>/<filename><ext>

    SEG_IMAGE: filename = bb_model_id  (no random suffix — re-runs overwrite)
    Others:    filename = bb_model_id_item_id[:8]  (suffix prevents overwrites)
    """
    today = datetime.now().strftime("%Y%m%d")
    subfolder = _workflow_subfolder(workflow_type, source)
    folder = os.path.join(output_dir, today, subfolder)
    os.makedirs(folder, exist_ok=True)

    name = (bb_model_id or "").strip() or str(uuid.uuid4())
    if workflow_type == WorkflowType.SEG_IMAGE:
        filename = f"{name}{ext}"
    else:
        suffix = item_id[:8] if item_id else uuid.uuid4().hex[:8]
        filename = f"{name}_{suffix}{ext}"
    filepath = os.path.join(folder, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    return filepath


def _process_item(
    item_id: str,
    row: dict,
    workflow_type: WorkflowType,
    run_source,
    provider,
    prompt: str,
    size: str,
    quality: str,
    timeout: int,
    output_dir: str,
) -> dict:
    """Execute a single item. Returns result dict. Never raises."""
    image_url = row.get("rsku_model_image_url", "").strip()

    if not image_url:
        return {
            "item_id": item_id,
            "status": ItemStatus.SKIPPED,
            "skipped_reason": "No image URL (rsku_model_image_url is empty)",
        }

    if workflow_type == WorkflowType.SELLING_POINT:
        variation = row.get("variation_1_value", "").strip()
        selling_pts = row.get("llm_sellingpoints", "").strip()
        if not variation and not selling_pts:
            return {
                "item_id": item_id,
                "status": ItemStatus.SKIPPED,
                "skipped_reason": "Both variation_1_value and llm_sellingpoints are empty",
            }

    try:
        if workflow_type == WorkflowType.SEG_IMAGE:
            # image_url is the local file path for seg workflow
            segments = process_seg_image(image_url)
            try:
                psd_bytes = build_psd(image_url, segments)
                output_bytes = psd_bytes
                ext = ".psd"
            except Exception as psd_err:
                logger.warning("[executor] psd-tools failed (%s), falling back to PNG", psd_err)
                # fallback: save first segment as PNG
                output_bytes = segments[0]["image_bytes"] if segments else b""
                ext = ".png"

            bb_model_id = row.get("bb_model_id", "")
            output_path = _save_output(
                bb_model_id, output_bytes, output_dir, workflow_type, run_source,
                item_id=item_id, ext=ext
            )
            return {
                "item_id": item_id,
                "status": ItemStatus.SUCCESS,
                "output_file_path": output_path,
            }

        elif workflow_type == WorkflowType.CLEAN_IMAGE:
            image_bytes = process_clean_image(
                provider=provider,
                image_url=image_url,
                prompt=prompt,
                size=size,
                quality=quality,
                timeout=timeout,
            )
        else:
            image_bytes = process_selling_point(
                provider=provider,
                image_url=image_url,
                prompt=prompt,
                variation_1_value=row.get("variation_1_value", ""),
                llm_sellingpoints=row.get("llm_sellingpoints", ""),
                size=size,
                quality=quality,
                timeout=timeout,
            )

        bb_model_id = row.get("bb_model_id", "")
        output_path = _save_output(bb_model_id, image_bytes, output_dir, workflow_type, run_source, item_id=item_id)
        return {
            "item_id": item_id,
            "status": ItemStatus.SUCCESS,
            "output_file_path": output_path,
        }

    except Exception as e:
        return {
            "item_id": item_id,
            "status": ItemStatus.FAILED,
            "error_reason": str(e),
        }


def _execute_psd_rename_batch(run_id, run, items, settings, run_repo, cancel_event) -> None:
    """
    PSD_RENAME dedicated executor.
    Generates one JSX, launches Photoshop once, polls log file to update RunItems.
    """
    import time as _time
    from pathlib import Path as _Path

    meta = run.run_metadata or {}
    name_pixel     = meta.get("name_pixel", "scenebg")
    name_shape     = meta.get("name_shape", "stickerbg")
    delete_hidden  = meta.get("delete_hidden", True)
    skip_no_text   = meta.get("skip_no_text", True)
    flatten_groups = meta.get("flatten_groups", True)

    today = datetime.now().strftime("%Y%m%d")
    output_dir = settings.output_directory or os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "data", "outputs"
    )
    output_folder = os.path.join(output_dir, today, "psd_rename")
    os.makedirs(output_folder, exist_ok=True)

    jsx_log_path = os.path.join(output_folder, f"psd_rename_{run_id[:8]}.log")
    psd_paths = [item.source_image_url for item in items if item.source_image_url]

    # filename → item map for status updates
    filename_to_item = {
        _Path(item.source_image_url).name: item
        for item in items if item.source_image_url
    }

    # Mark all items as running
    for item in items:
        run_repo.update_item(item.id, status=ItemStatus.RUNNING, started_at=datetime.utcnow())

    try:
        jsx_code = build_rename_jsx(
            psd_paths=psd_paths,
            output_folder=output_folder,
            name_pixel=name_pixel,
            name_shape=name_shape,
            jsx_log_path=jsx_log_path,
            delete_hidden=delete_hidden,
            skip_no_text=skip_no_text,
            flatten_groups=flatten_groups,
        )
        process = run_photoshop_jsx(jsx_code, jsx_log_path)
    except Exception as e:
        logger.exception("[psd_rename] launch failed: %s", e)
        for item in items:
            run_repo.update_item(item.id, status=ItemStatus.FAILED,
                                 error_reason=str(e), finished_at=datetime.utcnow())
        run_repo.update_run_counts(run_id, total=len(items),
                                   success=0, failed=len(items), skipped=0)
        run_repo.update_run_status(run_id, RunStatus.FAILED, finished_at=datetime.utcnow())
        return

    success = failed = skipped = 0
    last_offset = 0
    cancelled = False

    while process.poll() is None:
        if cancel_event.is_set():
            process.kill()
            cancelled = True
            break

        events, last_offset = parse_jsx_log(jsx_log_path, last_offset)
        for event in events:
            item = filename_to_item.get(event["filename"])
            if not item:
                continue
            if event["type"] == "saved":
                out_path = os.path.join(output_folder, event["filename"])
                run_repo.update_item(item.id, status=ItemStatus.SUCCESS,
                                     output_file_path=out_path, finished_at=datetime.utcnow())
                success += 1
            elif event["type"] == "skipped":
                run_repo.update_item(item.id, status=ItemStatus.SKIPPED,
                                     skipped_reason=event["message"], finished_at=datetime.utcnow())
                skipped += 1
            elif event["type"] == "error":
                run_repo.update_item(item.id, status=ItemStatus.FAILED,
                                     error_reason=event["message"], finished_at=datetime.utcnow())
                failed += 1
        run_repo.update_run_counts(run_id, total=len(items),
                                   success=success, failed=failed, skipped=skipped)
        _time.sleep(2)

    # Flush remaining log lines after process exits
    events, _ = parse_jsx_log(jsx_log_path, last_offset)
    for event in events:
        item = filename_to_item.get(event["filename"])
        if not item:
            continue
        if event["type"] == "saved":
            out_path = os.path.join(output_folder, event["filename"])
            run_repo.update_item(item.id, status=ItemStatus.SUCCESS,
                                 output_file_path=out_path, finished_at=datetime.utcnow())
            success += 1
        elif event["type"] == "skipped":
            run_repo.update_item(item.id, status=ItemStatus.SKIPPED,
                                 skipped_reason=event["message"], finished_at=datetime.utcnow())
            skipped += 1
        elif event["type"] == "error":
            run_repo.update_item(item.id, status=ItemStatus.FAILED,
                                 error_reason=event["message"], finished_at=datetime.utcnow())
            failed += 1

    # Items still RUNNING after PS exits = unaccounted (treat as failed)
    for item in items:
        if item.status == ItemStatus.RUNNING:
            run_repo.update_item(item.id, status=ItemStatus.FAILED,
                                 error_reason="Photoshop exited without reporting result",
                                 finished_at=datetime.utcnow())
            failed += 1

    run_repo.update_run_counts(run_id, total=len(items),
                               success=success, failed=failed, skipped=skipped)
    final_status = RunStatus.CANCELLED if cancelled else RunStatus.DONE
    run_repo.update_run_status(run_id, final_status, finished_at=datetime.utcnow())
    logger.info("[psd_rename] run %s finished: success=%d failed=%d skipped=%d",
                run_id, success, failed, skipped)


def execute_batch(run_id: str, db_session_factory) -> None:
    """
    Main batch execution entry point. Runs in a background thread.
    Uses ThreadPoolExecutor for concurrency.
    """
    cancel_event = _register_cancel_event(run_id)
    # Use a fresh DB session for the background thread
    db: Session = db_session_factory()

    try:
        run_repo = RunRepository(db)
        settings_repo = SettingsRepository(db)

        run = run_repo.get_run(run_id)
        if not run:
            return

        settings = settings_repo.get_settings()
        gs_config = settings_repo.get_google_sheet_config()

        # Resolve provider & model
        provider_enum = run.provider or settings.default_provider
        model = run.model or settings.default_model
        size = run.run_metadata.get("size", settings.default_size)
        quality = run.run_metadata.get("quality", settings.default_quality)
        timeout = settings.timeout_seconds
        workflow_type = run.workflow_type

        prompt = (
            settings.clean_image_prompt
            if workflow_type == WorkflowType.CLEAN_IMAGE
            else settings.selling_point_prompt
        )
        if run.run_metadata.get("prompt_override"):
            prompt = run.run_metadata["prompt_override"]

        # Output directory
        output_dir = settings.output_directory or os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "data", "outputs"
        )

        # PSD_RENAME: dedicated execution path (Photoshop ExtendScript)
        if workflow_type == WorkflowType.PSD_RENAME:
            run_repo.update_run_status(run_id, RunStatus.RUNNING, started_at=datetime.utcnow())
            items = run_repo.get_items_by_run(run_id)
            if not items:
                run_repo.update_run_status(run_id, RunStatus.DONE, finished_at=datetime.utcnow())
                return
            _execute_psd_rename_batch(run_id, run, items, settings, run_repo, cancel_event)
            return

        # Build provider (SEG_IMAGE does not use an AI provider)
        provider = None
        if workflow_type != WorkflowType.SEG_IMAGE:
            try:
                provider = _get_provider(db, provider_enum, model)
            except ValueError as e:
                run_repo.update_run_status(run_id, RunStatus.FAILED, finished_at=datetime.utcnow())
                return

        # Mark running
        run_repo.update_run_status(run_id, RunStatus.RUNNING, started_at=datetime.utcnow())

        # Load items
        items = run_repo.get_items_by_run(run_id)
        if not items:
            run_repo.update_run_status(run_id, RunStatus.DONE, finished_at=datetime.utcnow())
            return

        # Build task map: item_id -> row dict
        # SP fields (variation_1_value, llm_sellingpoints) are stored in
        # run_metadata["row_data"] keyed by str(row_index)
        row_data_map: dict = run.run_metadata.get("row_data", {})

        task_map = {}
        for item in items:
            stored = row_data_map.get(str(item.row_index), {})
            row = {
                "rsku_model_image_url": item.source_image_url or stored.get("rsku_model_image_url", ""),
                "bb_model_id": item.bb_model_id or stored.get("bb_model_id", ""),
                "variation_1_value": stored.get("variation_1_value", ""),
                "llm_sellingpoints": stored.get("llm_sellingpoints", ""),
            }
            task_map[item.id] = (item, row)

        max_workers = min(settings.max_concurrency, len(items))

        success = failed = skipped = 0
        cancelled = False

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures: dict = {}
            for item_id, (item, row) in task_map.items():
                if cancel_event.is_set():
                    # Mark unsubmitted items as skipped
                    run_repo.update_item(
                        item_id,
                        status=ItemStatus.SKIPPED,
                        skipped_reason="Run cancelled",
                        finished_at=datetime.utcnow(),
                    )
                    skipped += 1
                    continue
                run_repo.update_item(item_id, status=ItemStatus.RUNNING, started_at=datetime.utcnow())
                future = executor.submit(
                    _process_item,
                    item_id=item_id,
                    row=row,
                    workflow_type=workflow_type,
                    run_source=run.source,
                    provider=provider,
                    prompt=prompt,
                    size=size,
                    quality=quality,
                    timeout=timeout,
                    output_dir=output_dir,
                )
                futures[future] = item_id

            for future in as_completed(futures):
                if cancel_event.is_set() and not future.done():
                    future.cancel()
                    item_id = futures[future]
                    run_repo.update_item(
                        item_id,
                        status=ItemStatus.SKIPPED,
                        skipped_reason="Run cancelled",
                        finished_at=datetime.utcnow(),
                    )
                    skipped += 1
                    cancelled = True
                    continue

                result = future.result()
                status = result["status"]

                update_kwargs = {
                    "status": status,
                    "finished_at": datetime.utcnow(),
                }
                if status == ItemStatus.SUCCESS:
                    update_kwargs["output_file_path"] = result.get("output_file_path")
                    success += 1
                elif status == ItemStatus.FAILED:
                    update_kwargs["error_reason"] = result.get("error_reason")
                    failed += 1
                elif status == ItemStatus.SKIPPED:
                    update_kwargs["skipped_reason"] = result.get("skipped_reason")
                    skipped += 1

                run_repo.update_item(result["item_id"], **update_kwargs)
                run_repo.update_run_counts(
                    run_id, total=len(items),
                    success=success, failed=failed, skipped=skipped
                )

        final_status = RunStatus.CANCELLED if (cancelled or cancel_event.is_set()) else RunStatus.DONE
        run_repo.update_run_counts(run_id, total=len(items), success=success, failed=failed, skipped=skipped)
        run_repo.update_run_status(run_id, final_status, finished_at=datetime.utcnow())

    except Exception as e:
        logger.exception("execute_batch error for run %s: %s", run_id, e)
        try:
            RunRepository(db).update_run_status(
                run_id, RunStatus.FAILED, finished_at=datetime.utcnow()
            )
        except Exception:
            pass
    finally:
        _cleanup_cancel_event(run_id)
        db.close()
