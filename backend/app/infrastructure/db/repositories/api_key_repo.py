import base64
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.infrastructure.db.database import ApiKeyORM
from app.domain.enums import Provider


def _mask_key(key: str) -> str:
    if len(key) <= 8:
        return "****"
    return key[:4] + "·" * 40 + key[-4:]


def _encrypt(key: str) -> str:
    # Simple base64 for local use — not production-grade
    return base64.b64encode(key.encode()).decode()


def _decrypt(encrypted: str) -> str:
    return base64.b64decode(encrypted.encode()).decode()


class ApiKeyRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_key(self, provider: Provider, api_key: str) -> ApiKeyORM:
        existing = self.db.query(ApiKeyORM).filter(ApiKeyORM.provider == provider).first()
        if existing:
            existing.key_encrypted = _encrypt(api_key)
            existing.key_masked = _mask_key(api_key)
            existing.is_valid = None
            existing.last_validated_at = None
            self.db.commit()
            self.db.refresh(existing)
            return existing
        orm = ApiKeyORM(
            provider=provider,
            key_encrypted=_encrypt(api_key),
            key_masked=_mask_key(api_key),
        )
        self.db.add(orm)
        self.db.commit()
        self.db.refresh(orm)
        return orm

    def get_key(self, provider: Provider) -> Optional[ApiKeyORM]:
        return self.db.query(ApiKeyORM).filter(ApiKeyORM.provider == provider).first()

    def get_raw_key(self, provider: Provider) -> Optional[str]:
        orm = self.get_key(provider)
        if orm:
            return _decrypt(orm.key_encrypted)
        return None

    def list_keys(self) -> list[ApiKeyORM]:
        return self.db.query(ApiKeyORM).all()

    def delete_key(self, provider: Provider) -> bool:
        orm = self.get_key(provider)
        if orm:
            self.db.delete(orm)
            self.db.commit()
            return True
        return False

    def set_validation_result(self, provider: Provider, is_valid: bool):
        orm = self.get_key(provider)
        if orm:
            orm.is_valid = is_valid
            orm.last_validated_at = datetime.utcnow()
            self.db.commit()
