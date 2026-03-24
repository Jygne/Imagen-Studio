from abc import ABC, abstractmethod


class AbstractProvider(ABC):
    """
    Unified provider interface for image generation/editing.
    Both Clean Image and Selling Point workflows use generate_image().
    The difference is in the prompt and optional context injected by the worker.
    """

    @abstractmethod
    def generate_image(
        self,
        image_bytes: bytes,
        prompt: str,
        size: str = "1024x1024",
        quality: str = "medium",
        timeout: int = 120,
    ) -> bytes:
        """
        Send image + prompt to the AI provider.
        Returns edited/generated image bytes.
        """
        ...

    @abstractmethod
    def validate_key(self) -> bool:
        """
        Test if the current API key is valid.
        Returns True if valid, False otherwise.
        """
        ...
