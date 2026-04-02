from __future__ import annotations
from pydantic_settings import BaseSettings
from typing import Optional


class Config(BaseSettings):
    app_name: str = "Imagen Studio"
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]
    piseg_url: str = (
        "https://http-gateway.spex.shopee.sg"
        "/sprpc/ai_engine_platform.mmuplt.pisegv2.algo"
    )
    piseg_auth_token: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"


config = Config()
