from app.infrastructure.providers.base import AbstractProvider
from app.workers.image_utils import load_image_bytes


def build_selling_point_prompt(
    base_prompt: str,
    variation_1_value: str,
    llm_sellingpoints: str,
) -> str:
    """
    Replace {main_selling_point} and {secondary_selling_points} placeholders
    in the prompt template with values read from the sheet row.

    Mapping:
        {main_selling_point}       → variation_1_value
        {secondary_selling_points} → llm_sellingpoints
    """
    result = base_prompt
    result = result.replace("{main_selling_point}", variation_1_value or "")
    result = result.replace("{secondary_selling_points}", llm_sellingpoints or "")
    return result


def process_selling_point(
    provider: AbstractProvider,
    image_url: str,
    prompt: str,
    variation_1_value: str,
    llm_sellingpoints: str,
    size: str,
    quality: str,
    timeout: int,
) -> bytes:
    """
    Load image from URL or local path, build enriched prompt, send to provider.
    Returns generated image bytes with selling points.
    """
    image_bytes = load_image_bytes(image_url, timeout=30)

    enriched_prompt = build_selling_point_prompt(
        base_prompt=prompt,
        variation_1_value=variation_1_value or "",
        llm_sellingpoints=llm_sellingpoints or "",
    )

    return provider.generate_image(
        image_bytes=image_bytes,
        prompt=enriched_prompt,
        size=size,
        quality=quality,
        timeout=timeout,
    )
