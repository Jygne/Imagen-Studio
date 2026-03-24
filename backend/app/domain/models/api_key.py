from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from app.domain.enums import Provider


@dataclass
class ApiKey:
    provider: Provider
    key_masked: str
    is_configured: bool = False
    is_valid: Optional[bool] = None
    last_validated_at: Optional[datetime] = None
