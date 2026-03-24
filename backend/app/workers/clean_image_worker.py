from app.infrastructure.providers.base import AbstractProvider
from app.workers.image_utils import load_image_bytes


def process_clean_image(
    provider: AbstractProvider,
    image_url: str,
    prompt: str,
    size: str,
    quality: str,
    timeout: int,
) -> bytes:
    """
    Load image from URL or local path, send to provider for editing.
    Returns edited image bytes.
    """
    image_bytes = load_image_bytes(image_url, timeout=30)

    return provider.generate_image(
        image_bytes=image_bytes,
        prompt=prompt,
        size=size,
        quality=quality,
        timeout=timeout,
    )
