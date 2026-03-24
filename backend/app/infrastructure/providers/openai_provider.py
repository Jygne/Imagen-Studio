import io
import base64
from app.infrastructure.providers.base import AbstractProvider

VALID_MODELS = {"gpt-image-1.5"}
DEFAULT_MODEL = "gpt-image-1.5"


class OpenAIProvider(AbstractProvider):

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self.api_key = api_key
        self.model = model if model in VALID_MODELS else DEFAULT_MODEL
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.api_key)
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

        image_file = io.BytesIO(image_bytes)
        image_file.name = "image.png"

        # SDK 1.57.x doesn't expose quality in images.edit() signature —
        # use extra_body to pass it directly to the API layer.
        extra_body = {}
        if quality and quality in ("low", "medium", "high", "auto"):
            extra_body["quality"] = quality
        response = client.images.edit(
            model=self.model,
            image=image_file,
            prompt=prompt,
            size=size,
            n=1,
            extra_body=extra_body or None,
        )

        b64 = response.data[0].b64_json
        if b64 is None:
            url = response.data[0].url
            if url:
                import requests as req
                r = req.get(url, timeout=60)
                r.raise_for_status()
                return r.content
            raise ValueError("OpenAI returned neither b64_json nor url in response")

        return base64.b64decode(b64)

    def validate_key(self) -> bool:
        try:
            client = self._get_client()
            client.models.list()
            return True
        except Exception:
            return False
