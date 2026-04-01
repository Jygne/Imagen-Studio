from __future__ import annotations
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.infrastructure.db.repositories.run_repo import RunRepository
from app.domain.schemas.run import RunOut, RunDetailOut, RunListOut, RunItemOut, RunListItemOut, RunItemListOut
from app.domain.enums import RunStatus, RunSource, WorkflowType


def _path_to_url(path: str | None) -> str | None:
    if not path:
        return None
    return f"/api/v1/files?path={quote(path, safe='')}"


def _source_access_url(run_id: str, item_id: str, source: RunSource, source_image_url: str | None) -> str | None:
    """
    Compute a browser-safe URL for the source image.
      - LOCAL runs  → proxy through /local-generate/source-file
      - SHEET runs  → use the remote URL directly
    """
    if not source_image_url:
        return None
    if source == RunSource.LOCAL:
        return f"/api/v1/local-generate/source-file?run_id={quote(run_id, safe='')}&item_id={quote(item_id, safe='')}"
    return source_image_url


class RunService:
    def __init__(self, db: Session):
        self.repo = RunRepository(db)

    def list_runs(self, limit: int = 50, offset: int = 0) -> RunListOut:
        runs, total = self.repo.list_runs(limit=limit, offset=offset)
        run_ids = [r.id for r in runs]
        thumbnails = self.repo.get_first_success_outputs(run_ids)
        labels = self.repo.get_first_item_labels(run_ids)
        return RunListOut(
            runs=[
                self._to_run_out(
                    r,
                    thumbnail_path=thumbnails.get(r.id),
                    first_bb_model_id=labels.get(r.id),
                )
                for r in runs
            ],
            total_count=total,
        )

    def get_run_detail(self, run_id: str) -> RunDetailOut:
        run = self.repo.get_run(run_id)
        if not run:
            raise ValueError(f"Run {run_id} not found")
        items = self.repo.get_items_by_run(run_id)
        return RunDetailOut(
            **self._to_run_out(run).model_dump(),
            items=[self._to_item_out(i, run.source) for i in items],
        )

    def list_run_items(self, limit: int = 100, offset: int = 0) -> RunItemListOut:
        rows, total_count = self.repo.list_run_items(limit=limit, offset=offset)
        totals = self.repo.get_item_list_totals()
        items = [
            RunListItemOut(
                item_id=item.id,
                run_id=run.id,
                row_index=item.row_index,
                bb_model_id=item.bb_model_id,
                # seg_image: show source image as thumbnail (PSD can't render in browser)
                thumbnail_url=(
                    _source_access_url(run.id, item.id, run.source, item.source_image_url)
                    if run.workflow_type == WorkflowType.SEG_IMAGE
                    else _path_to_url(item.output_file_path)
                ),
                source_image_access_url=_source_access_url(run.id, item.id, run.source, item.source_image_url),
                workflow_type=run.workflow_type,
                source=run.source,
                item_status=item.status,
                run_status=run.status,
                provider=run.provider,
                model=run.model,
                run_total=run.total,
                run_success=run.success,
                run_failed=run.failed,
                run_skipped=run.skipped,
                created_at=run.created_at,
                run_started_at=run.started_at,
                run_finished_at=run.finished_at,
                item_started_at=item.started_at,
                item_finished_at=item.finished_at,
            )
            for item, run in rows
        ]
        return RunItemListOut(items=items, total_count=total_count, **totals)

    def get_run_status(self, run_id: str) -> RunOut:
        run = self.repo.get_run(run_id)
        if not run:
            raise ValueError(f"Run {run_id} not found")
        return self._to_run_out(run)

    @staticmethod
    def _to_run_out(r, thumbnail_path: str | None = None, first_bb_model_id: str | None = None) -> RunOut:
        return RunOut(
            id=r.id,
            workflow_type=r.workflow_type,
            source=r.source,
            status=r.status,
            provider=r.provider,
            model=r.model,
            total=r.total,
            success=r.success,
            failed=r.failed,
            skipped=r.skipped,
            created_at=r.created_at,
            started_at=r.started_at,
            finished_at=r.finished_at,
            metadata=r.run_metadata or {},
            thumbnail_url=_path_to_url(thumbnail_path),
            first_bb_model_id=first_bb_model_id,
        )

    @staticmethod
    def _to_item_out(i, source: RunSource = RunSource.SHEET) -> RunItemOut:
        return RunItemOut(
            id=i.id,
            run_id=i.run_id,
            row_index=i.row_index,
            bb_model_id=i.bb_model_id,
            source_image_url=i.source_image_url,
            source_image_access_url=_source_access_url(i.run_id, i.id, source, i.source_image_url),
            status=i.status,
            output_file_path=i.output_file_path,
            output_image_url=_path_to_url(i.output_file_path),
            error_reason=i.error_reason,
            skipped_reason=i.skipped_reason,
            started_at=i.started_at,
            finished_at=i.finished_at,
        )
