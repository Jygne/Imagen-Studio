import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.infrastructure.db.database import RunORM, RunItemORM
from app.domain.enums import RunStatus, ItemStatus, WorkflowType, RunSource, Provider


class RunRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_run(
        self,
        workflow_type: WorkflowType,
        source: RunSource,
        provider: Optional[Provider],
        model: Optional[str],
        metadata: dict,
    ) -> RunORM:
        run = RunORM(
            id=str(uuid.uuid4()),
            workflow_type=workflow_type,
            source=source,
            status=RunStatus.QUEUED,
            provider=provider,
            model=model,
            run_metadata=metadata,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def get_run(self, run_id: str) -> Optional[RunORM]:
        return self.db.query(RunORM).filter(RunORM.id == run_id).first()

    def list_runs(self, limit: int = 50, offset: int = 0) -> tuple[list[RunORM], int]:
        q = self.db.query(RunORM).order_by(RunORM.created_at.desc())
        total = q.count()
        runs = q.offset(offset).limit(limit).all()
        return runs, total

    def update_run_status(self, run_id: str, status: RunStatus, **kwargs):
        run = self.get_run(run_id)
        if run:
            run.status = status
            for k, v in kwargs.items():
                setattr(run, k, v)
            self.db.commit()

    def update_run_counts(self, run_id: str, total: int, success: int, failed: int, skipped: int):
        run = self.get_run(run_id)
        if run:
            run.total = total
            run.success = success
            run.failed = failed
            run.skipped = skipped
            self.db.commit()

    # ── Items ──────────────────────────────────────────────────────────────────

    def create_items_bulk(self, run_id: str, rows: list[dict]) -> list[RunItemORM]:
        items = []
        for row in rows:
            item = RunItemORM(
                id=str(uuid.uuid4()),
                run_id=run_id,
                row_index=row["row_index"],
                bb_model_id=row.get("bb_model_id"),
                source_image_url=row.get("source_image_url"),
                status=ItemStatus.PENDING,
            )
            self.db.add(item)
            items.append(item)
        self.db.commit()
        return items

    def get_first_item_labels(self, run_ids: list[str]) -> dict[str, str]:
        """Returns {run_id: bb_model_id} for the first item of each run."""
        if not run_ids:
            return {}
        rows = (
            self.db.query(RunItemORM.run_id, RunItemORM.bb_model_id)
            .filter(RunItemORM.run_id.in_(run_ids))
            .order_by(RunItemORM.run_id, RunItemORM.row_index)
            .all()
        )
        seen: dict[str, str] = {}
        for run_id, bb_model_id in rows:
            if run_id not in seen and bb_model_id:
                seen[run_id] = bb_model_id
        return seen

    def get_first_success_outputs(self, run_ids: list[str]) -> dict[str, str]:
        """Returns {run_id: output_file_path} for the first success item of each run."""
        if not run_ids:
            return {}
        rows = (
            self.db.query(RunItemORM.run_id, RunItemORM.output_file_path)
            .filter(
                RunItemORM.run_id.in_(run_ids),
                RunItemORM.status == ItemStatus.SUCCESS,
                RunItemORM.output_file_path.isnot(None),
            )
            .order_by(RunItemORM.run_id, RunItemORM.row_index)
            .all()
        )
        seen: dict[str, str] = {}
        for run_id, path in rows:
            if run_id not in seen:
                seen[run_id] = path
        return seen

    def get_items_by_run(self, run_id: str) -> list[RunItemORM]:
        return (
            self.db.query(RunItemORM)
            .filter(RunItemORM.run_id == run_id)
            .order_by(RunItemORM.row_index)
            .all()
        )

    def list_run_items(self, limit: int = 100, offset: int = 0) -> tuple[list, int]:
        """Flattened item+run rows, sorted by run.created_at DESC, item.row_index ASC."""
        q = (
            self.db.query(RunItemORM, RunORM)
            .join(RunORM, RunItemORM.run_id == RunORM.id)
            .order_by(RunORM.created_at.desc(), RunItemORM.row_index.asc())
        )
        total = q.count()
        rows = q.offset(offset).limit(limit).all()
        return rows, total

    def get_item_list_totals(self) -> dict:
        """Global summary counts for the Runs page header cards."""
        from sqlalchemy import func
        total_runs = self.db.query(func.count(RunORM.id)).scalar() or 0
        total_items = self.db.query(func.count(RunItemORM.id)).scalar() or 0
        total_success = (
            self.db.query(func.count(RunItemORM.id))
            .filter(RunItemORM.status == ItemStatus.SUCCESS)
            .scalar() or 0
        )
        total_failed = (
            self.db.query(func.count(RunItemORM.id))
            .filter(RunItemORM.status == ItemStatus.FAILED)
            .scalar() or 0
        )
        return {
            "total_runs": total_runs,
            "total_items": total_items,
            "total_success": total_success,
            "total_failed": total_failed,
        }

    def update_item(self, item_id: str, **kwargs):
        item = self.db.query(RunItemORM).filter(RunItemORM.id == item_id).first()
        if item:
            for k, v in kwargs.items():
                setattr(item, k, v)
            self.db.commit()
