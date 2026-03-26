from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.infrastructure.db.database import get_db
from app.application.settings_service import SettingsService
from app.domain.schemas.settings import (
    AppSettingsOut, AppSettingsUpdate,
    GoogleSheetConfigOut, GoogleSheetConfigUpdate,
    ConnectionValidationResult, HeaderValidationResult,
    SheetStatusOut, SheetPreviewOut,
)
from app.domain.enums import WorkflowType

router = APIRouter(tags=["Settings"])


# ── App Settings ───────────────────────────────────────────────────────────────

@router.get("/settings", response_model=AppSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return SettingsService(db).get_settings()


@router.put("/settings", response_model=AppSettingsOut)
def update_settings(payload: AppSettingsUpdate, db: Session = Depends(get_db)):
    return SettingsService(db).update_settings(payload)


class PickDirectoryResult(BaseModel):
    path: Optional[str] = None
    cancelled: bool = False


@router.post("/settings/pick-directory", response_model=PickDirectoryResult)
def pick_directory():
    """Open a native folder-picker dialog and return the chosen path. Supports Windows and macOS."""
    import sys

    if sys.platform == "win32":
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            path = filedialog.askdirectory(title="Select Output Directory", parent=root)
            root.destroy()
            if path:
                return PickDirectoryResult(path=path, cancelled=False)
            return PickDirectoryResult(path=None, cancelled=True)
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Folder picker unavailable: {e}")

    elif sys.platform == "darwin":
        import subprocess
        script = (
            'try\n'
            '  set p to POSIX path of (choose folder with prompt "Select Output Directory")\n'
            '  return p\n'
            'on error\n'
            '  return ""\n'
            'end try'
        )
        try:
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True, timeout=60
            )
            path = result.stdout.strip().rstrip("/")
            if path:
                return PickDirectoryResult(path=path, cancelled=False)
            return PickDirectoryResult(path=None, cancelled=True)
        except subprocess.TimeoutExpired:
            return PickDirectoryResult(path=None, cancelled=True)
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Folder picker unavailable: {e}")

    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=501, detail="Folder picker not supported on this platform")


# ── Google Sheet Config ────────────────────────────────────────────────────────

@router.get("/google-sheet/config", response_model=GoogleSheetConfigOut)
def get_sheet_config(db: Session = Depends(get_db)):
    return SettingsService(db).get_sheet_config()


@router.put("/google-sheet/config", response_model=GoogleSheetConfigOut)
def update_sheet_config(payload: GoogleSheetConfigUpdate, db: Session = Depends(get_db)):
    return SettingsService(db).update_sheet_config(payload)


@router.post("/google-sheet/validate", response_model=ConnectionValidationResult)
def validate_connection(db: Session = Depends(get_db)):
    return SettingsService(db).validate_connection()


@router.post("/google-sheet/validate-headers", response_model=list[HeaderValidationResult])
def validate_headers(db: Session = Depends(get_db)):
    return SettingsService(db).validate_headers()


@router.get("/google-sheet/status", response_model=SheetStatusOut)
def get_sheet_status(db: Session = Depends(get_db)):
    return SettingsService(db).get_sheet_status()


@router.get("/google-sheet/preview", response_model=SheetPreviewOut)
def get_preview(workflow_type: WorkflowType, db: Session = Depends(get_db)):
    return SettingsService(db).get_preview(workflow_type)
