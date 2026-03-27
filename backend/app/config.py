from __future__ import annotations
from pydantic_settings import BaseSettings
from typing import Optional


class Config(BaseSettings):
    app_name: str = "Imagen Studio"
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"


config = Config()
