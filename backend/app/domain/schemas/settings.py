from pydantic import BaseModel
from typing import Optional
from app.domain.enums import Provider, ImageSize, ImageQuality


class AppSettingsOut(BaseModel):
    output_directory: str
    default_provider: Provider
    default_model: str
    default_size: ImageSize
    default_quality: ImageQuality
    max_concurrency: int
    timeout_seconds: int
    clean_image_prompt: str
    selling_point_prompt: str


class AppSettingsUpdate(BaseModel):
    output_directory: Optional[str] = None
    default_provider: Optional[Provider] = None
    default_model: Optional[str] = None
    default_size: Optional[ImageSize] = None
    default_quality: Optional[ImageQuality] = None
    max_concurrency: Optional[int] = None
    timeout_seconds: Optional[int] = None
    clean_image_prompt: Optional[str] = None
    selling_point_prompt: Optional[str] = None


class GoogleSheetConfigOut(BaseModel):
    spreadsheet_url: str
    spreadsheet_id: str
    clean_tab: str
    selling_point_tab: str
    has_service_account: bool


class GoogleSheetConfigUpdate(BaseModel):
    spreadsheet_url: Optional[str] = None
    clean_tab: Optional[str] = None
    selling_point_tab: Optional[str] = None
    service_account_json: Optional[str] = None


class ConnectionValidationResult(BaseModel):
    connected: bool
    error: Optional[str] = None
    spreadsheet_title: Optional[str] = None


class HeaderValidationResult(BaseModel):
    tab: str
    valid: bool
    present: list[str] = []
    missing: list[str] = []


class SheetStatusOut(BaseModel):
    connected: bool
    spreadsheet_url: str
    spreadsheet_id: str
    spreadsheet_title: Optional[str] = None
    service_account_configured: bool
    service_account_email: Optional[str] = None
    clean_tab_validation: Optional[HeaderValidationResult] = None
    selling_point_tab_validation: Optional[HeaderValidationResult] = None
    connection_error: Optional[str] = None


class SheetPreviewRow(BaseModel):
    row_index: int
    bb_model_id: Optional[str] = None
    rsku_model_image_url: Optional[str] = None
    rsku_model_image: Optional[str] = None
    variation_1_value: Optional[str] = None
    llm_sellingpoints: Optional[str] = None
    generate: str = "YES"


class SheetPreviewOut(BaseModel):
    workflow_type: str
    tab: str
    total_yes_rows: int
    preview_rows: list[SheetPreviewRow]
