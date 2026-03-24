from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.infrastructure.db.database import get_db
from app.infrastructure.db.repositories.settings_repo import SettingsRepository

router = APIRouter(tags=["Files"])


@router.get("/files")
def serve_file(path: str = Query(...), db: Session = Depends(get_db)):
    settings = SettingsRepository(db).get_settings()
    output_dir = settings.output_directory

    file_path = Path(path)
    if not file_path.is_absolute():
        raise HTTPException(status_code=400, detail="Absolute path required")

    if output_dir:
        try:
            file_path.resolve().relative_to(Path(output_dir).resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(str(file_path))
