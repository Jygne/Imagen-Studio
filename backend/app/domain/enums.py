from enum import Enum


class WorkflowType(str, Enum):
    CLEAN_IMAGE = "clean_image"
    SELLING_POINT = "selling_point"
    SEG_IMAGE = "seg_image"


class RunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ItemStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class RunSource(str, Enum):
    SHEET = "sheet"
    LOCAL = "local"


class Provider(str, Enum):
    OPENAI = "openai"
    OPENROUTER = "openrouter"


class OpenAIModel(str, Enum):
    GPT_IMAGE_1_5 = "gpt-image-1.5"  # default


class OpenRouterModel(str, Enum):
    GEMINI_2_5_FLASH_IMAGE = "google/gemini-2.5-flash-image"  # default
    GEMINI_3_1_FLASH_IMAGE_PREVIEW = "google/gemini-3.1-flash-image-preview"


class ImageSize(str, Enum):
    SIZE_1024 = "1024x1024"
    SIZE_1536 = "1536x1024"
    SIZE_1024_1536 = "1024x1536"
    AUTO = "auto"


class ImageQuality(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    AUTO = "auto"
