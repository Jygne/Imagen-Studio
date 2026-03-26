from __future__ import annotations
from sqlalchemy.orm import Session

from app.infrastructure.db.repositories.api_key_repo import ApiKeyRepository
from app.infrastructure.providers.openai_provider import OpenAIProvider
from app.infrastructure.providers.openrouter_provider import OpenRouterProvider
from app.domain.enums import Provider
from app.domain.schemas.api_key import ApiKeyOut, ApiKeySave, ApiKeyValidateResult


class ApiKeyService:
    def __init__(self, db: Session):
        self.repo = ApiKeyRepository(db)

    def list_keys(self) -> list[ApiKeyOut]:
        all_providers = [Provider.OPENAI, Provider.OPENROUTER]
        result = []
        existing = {k.provider: k for k in self.repo.list_keys()}
        for provider in all_providers:
            if provider in existing:
                k = existing[provider]
                result.append(ApiKeyOut(
                    provider=k.provider,
                    key_masked=k.key_masked,
                    is_configured=True,
                    is_valid=k.is_valid,
                    last_validated_at=k.last_validated_at,
                ))
            else:
                result.append(ApiKeyOut(
                    provider=provider,
                    key_masked="",
                    is_configured=False,
                ))
        return result

    def save_key(self, payload: ApiKeySave) -> ApiKeyOut:
        orm = self.repo.save_key(payload.provider, payload.api_key)
        return ApiKeyOut(
            provider=orm.provider,
            key_masked=orm.key_masked,
            is_configured=True,
            is_valid=orm.is_valid,
            last_validated_at=orm.last_validated_at,
        )

    def delete_key(self, provider: Provider) -> bool:
        return self.repo.delete_key(provider)

    def validate_key(self, provider: Provider) -> ApiKeyValidateResult:
        raw_key = self.repo.get_raw_key(provider)
        if not raw_key:
            return ApiKeyValidateResult(provider=provider, is_valid=False, error="No key configured")

        try:
            if provider == Provider.OPENAI:
                p = OpenAIProvider(raw_key)
            else:
                p = OpenRouterProvider(raw_key)

            is_valid = p.validate_key()
            self.repo.set_validation_result(provider, is_valid)
            return ApiKeyValidateResult(
                provider=provider,
                is_valid=is_valid,
                error=None if is_valid else "Key validation failed",
            )
        except Exception as e:
            self.repo.set_validation_result(provider, False)
            return ApiKeyValidateResult(provider=provider, is_valid=False, error=str(e))
