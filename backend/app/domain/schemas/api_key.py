from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.domain.enums import Provider


class ApiKeyOut(BaseModel):
    provider: Provider
    key_masked: str
    is_configured: bool
    is_valid: Optional[bool] = None
    last_validated_at: Optional[datetime] = None


class ApiKeySave(BaseModel):
    provider: Provider
    api_key: str


class ApiKeyValidateResult(BaseModel):
    provider: Provider
    is_valid: bool
    error: Optional[str] = None
