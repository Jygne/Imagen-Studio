"""
Routes for backend log access.

  GET /logs  — return last N lines from the backend log file
"""
import os
from fastapi import APIRouter, Query

router = APIRouter(prefix="/logs", tags=["Logs"])

LOG_FILE = "/tmp/buybox-backend.log"


@router.get("")
def get_logs(lines: int = Query(default=300, ge=1, le=5000)):
    """Return the last N lines from the backend log file."""
    if not os.path.exists(LOG_FILE):
        return {"lines": [], "total": 0, "file": LOG_FILE}

    with open(LOG_FILE, "r", errors="replace") as f:
        all_lines = f.readlines()

    tail = all_lines[-lines:] if len(all_lines) > lines else all_lines
    return {
        "lines": [line.rstrip("\n") for line in tail],
        "total": len(all_lines),
        "file": LOG_FILE,
    }
