"""
Shared utilities for image workers.

load_image_bytes(source_ref) abstracts over:
  - HTTP/HTTPS URLs  → fetched with requests
  - Local file paths → read directly from disk
"""
from pathlib import Path


def load_image_bytes(source_ref: str, timeout: int = 30) -> bytes:
    """
    Load raw image bytes from either a remote URL or a local file path.

    Args:
        source_ref: HTTP/HTTPS URL or absolute local file path.
        timeout:    Seconds to wait for HTTP requests (ignored for local paths).

    Returns:
        Raw image bytes.

    Raises:
        FileNotFoundError: If a local path does not exist.
        requests.HTTPError: If an HTTP request returns a non-2xx status.
    """
    if source_ref.startswith("http://") or source_ref.startswith("https://"):
        import requests
        resp = requests.get(source_ref, timeout=timeout)
        resp.raise_for_status()
        return resp.content

    path = Path(source_ref)
    if not path.is_file():
        raise FileNotFoundError(f"Source image not found: {source_ref}")
    return path.read_bytes()
