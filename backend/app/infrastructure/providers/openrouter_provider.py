from __future__ import annotations
import base64
from app.infrastructure.providers.base import AbstractProvider

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

VALID_MODELS = {
    "google/gemini-2.5-flash-image",
    "google/gemini-3.1-flash-image-preview",
}
DEFAULT_MODEL = "google/gemini-2.5-flash-image"


class OpenRouterProvider(AbstractProvider):

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self.api_key = api_key
        self.model = model if model in VALID_MODELS else DEFAULT_MODEL
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(
                api_key=self.api_key,
                base_url=OPENROUTER_BASE_URL,
                default_headers={
                    "HTTP-Referer": "https://buyboxv2.local",
                    "X-Title": "BuyBox v2",
                },
            )
        return self._client

    def generate_image(
        self,
        image_bytes: bytes,
        prompt: str,
        size: str = "1024x1024",
        quality: str = "medium",
        timeout: int = 120,
    ) -> bytes:
        client = self._get_client()
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        image_mime_type = self._detect_image_mime_type(image_bytes)

        response = client.chat.completions.create(
            model=self.model,
            modalities=["image", "text"],
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{image_mime_type};base64,{b64_image}"},
                        },
                    ],
                }
            ],
            timeout=timeout,
        )

        choice = response.choices[0]

        # Surface server-side generation errors early
        if choice.finish_reason == "error":
            native = getattr(choice, "native_finish_reason", "unknown")
            raise ValueError(
                f"OpenRouter generation error (native_finish_reason={native}). "
                "The model failed to produce an image — try a shorter prompt or different model."
            )

        # ── Image extraction: try all known response locations ────────────────
        # Priority 1: message.images  (confirmed path for gemini-3.1 via OpenRouter)
        img_bytes = self._extract_from_message_images(choice)
        if img_bytes:
            return img_bytes

        # Priority 2: message.content parts  (fallback / older format)
        img_bytes = self._extract_from_content(choice.message.content)
        if img_bytes:
            return img_bytes

        # Nothing found — dump the full response for debugging
        raise ValueError(
            f"Could not extract image from OpenRouter response: {response.model_dump()}"
        )

    # ── Extraction helpers ────────────────────────────────────────────────────

    def _detect_image_mime_type(self, image_bytes: bytes) -> str:
        """Best-effort MIME detection so requests match the real uploaded image type."""
        if image_bytes.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        if image_bytes.startswith((b"GIF87a", b"GIF89a")):
            return "image/gif"
        if image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
            return "image/webp"
        return "application/octet-stream"

    def _extract_from_message_images(self, choice) -> bytes | None:
        """
        Handles: choice.message.images[*].image_url.url  (data: URI or https:// URL)
        The `images` field is non-standard and may live in __pydantic_extra__ or
        model_extra depending on SDK version.
        """
        message = choice.message

        # Try standard attribute first
        images = getattr(message, "images", None)

        # Pydantic v2 extras (openai SDK >= 1.x)
        if images is None:
            extra = getattr(message, "__pydantic_extra__", None) or getattr(message, "model_extra", None)
            if isinstance(extra, dict):
                images = extra.get("images")

        # Also try raw dict from model_dump
        if images is None:
            raw = message.model_dump() if hasattr(message, "model_dump") else {}
            images = raw.get("images")

        if not images:
            return None

        for img in images:
            url = None
            if isinstance(img, dict):
                iu = img.get("image_url") or {}
                url = iu.get("url") if isinstance(iu, dict) else getattr(iu, "url", None)
            else:
                iu = getattr(img, "image_url", None)
                url = getattr(iu, "url", None) if iu else None

            if not url:
                continue
            if url.startswith("data:"):
                return base64.b64decode(url.split(",", 1)[1])
            if url.startswith("http"):
                import requests as req
                r = req.get(url, timeout=60)
                r.raise_for_status()
                return r.content

        return None

    def _extract_from_content(self, content) -> bytes | None:
        """Handles list-of-parts or plain data: URI string content."""
        if isinstance(content, list):
            for part in content:
                part_type = (
                    getattr(part, "type", None)
                    or (part.get("type") if isinstance(part, dict) else None)
                )
                if part_type == "image_url":
                    iu = getattr(part, "image_url", None) or (part.get("image_url") if isinstance(part, dict) else None)
                    url = (getattr(iu, "url", None) or iu.get("url", "") if iu else "")
                    if url.startswith("data:"):
                        return base64.b64decode(url.split(",", 1)[1])
                    if url.startswith("http"):
                        import requests as req
                        r = req.get(url, timeout=60)
                        r.raise_for_status()
                        return r.content
                if part_type in ("image", "inline_data"):
                    blob = getattr(part, "inline_data", None) or (part.get("inline_data") if isinstance(part, dict) else None) or part
                    data = getattr(blob, "data", None) or (blob.get("data") if isinstance(blob, dict) else None)
                    if data:
                        return base64.b64decode(data)
        elif isinstance(content, str) and content.startswith("data:"):
            return base64.b64decode(content.split(",", 1)[1])
        return None

    def validate_key(self) -> bool:
        try:
            import requests
            r = requests.get(
                f"{OPENROUTER_BASE_URL}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10,
            )
            return r.status_code == 200
        except Exception:
            return False
