from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.infrastructure.db.database import get_db
from app.application.api_key_service import ApiKeyService
from app.domain.schemas.api_key import ApiKeyOut, ApiKeySave, ApiKeyValidateResult
from app.domain.enums import Provider

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


@router.get("", response_model=list[ApiKeyOut])
def list_keys(db: Session = Depends(get_db)):
    return ApiKeyService(db).list_keys()


@router.post("", response_model=ApiKeyOut)
def save_key(payload: ApiKeySave, db: Session = Depends(get_db)):
    return ApiKeyService(db).save_key(payload)


@router.delete("/{provider}")
def delete_key(provider: Provider, db: Session = Depends(get_db)):
    deleted = ApiKeyService(db).delete_key(provider)
    if not deleted:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"message": f"{provider.value} key deleted"}


@router.post("/{provider}/validate", response_model=ApiKeyValidateResult)
def validate_key(provider: Provider, db: Session = Depends(get_db)):
    return ApiKeyService(db).validate_key(provider)
