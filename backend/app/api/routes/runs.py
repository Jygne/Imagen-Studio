from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.infrastructure.db.database import get_db
from app.application.run_service import RunService
from app.domain.schemas.run import RunOut, RunDetailOut, RunListOut, RunItemListOut
from app.infrastructure.db.repositories.run_repo import RunRepository
from app.domain.enums import RunStatus
from app.workers.executor import request_cancel

router = APIRouter(prefix="/runs", tags=["Runs"])


@router.get("", response_model=RunListOut)
def list_runs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return RunService(db).list_runs(limit=limit, offset=offset)


@router.get("/items", response_model=RunItemListOut)
def list_run_items(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return RunService(db).list_run_items(limit=limit, offset=offset)


@router.get("/{run_id}", response_model=RunDetailOut)
def get_run_detail(run_id: str, db: Session = Depends(get_db)):
    try:
        return RunService(db).get_run_detail(run_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{run_id}/status", response_model=RunOut)
def get_run_status(run_id: str, db: Session = Depends(get_db)):
    try:
        return RunService(db).get_run_status(run_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{run_id}/cancel")
def cancel_run(run_id: str, db: Session = Depends(get_db)):
    """
    Request cancellation of a queued or running batch.
    Sets DB status to CANCELLED immediately; the executor thread will stop
    processing new items when it next checks the cancel flag.
    """
    repo = RunRepository(db)
    run = repo.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in (RunStatus.QUEUED, RunStatus.RUNNING):
        raise HTTPException(
            status_code=400,
            detail=f"Run is not active (status: {run.status.value})",
        )
    # Signal executor thread
    request_cancel(run_id)
    # Optimistically mark as cancelled in DB
    repo.update_run_status(run_id, RunStatus.CANCELLED, finished_at=__import__("datetime").datetime.utcnow())
    return {"ok": True, "run_id": run_id}
