import os
from sqlalchemy import create_engine, Column, String, Integer, Boolean, DateTime, Text, JSON, Enum as SAEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime

from app.domain.enums import RunStatus, ItemStatus, WorkflowType, RunSource, Provider

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DB_PATH = os.path.join(BASE_DIR, "data", "imgen-studio.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── ORM Models ────────────────────────────────────────────────────────────────

class RunORM(Base):
    __tablename__ = "runs"

    id = Column(String, primary_key=True)
    workflow_type = Column(SAEnum(WorkflowType), nullable=False)
    source = Column(SAEnum(RunSource), nullable=False)
    status = Column(SAEnum(RunStatus), nullable=False, default=RunStatus.QUEUED)
    provider = Column(SAEnum(Provider), nullable=True)
    model = Column(String, nullable=True)
    total = Column(Integer, default=0)
    success = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    run_metadata = Column(JSON, default=dict)


class RunItemORM(Base):
    __tablename__ = "run_items"

    id = Column(String, primary_key=True)
    run_id = Column(String, nullable=False, index=True)
    row_index = Column(Integer, nullable=False)
    bb_model_id = Column(String, nullable=True)
    source_image_url = Column(Text, nullable=True)
    status = Column(SAEnum(ItemStatus), nullable=False, default=ItemStatus.PENDING)
    output_file_path = Column(Text, nullable=True)
    error_reason = Column(Text, nullable=True)
    skipped_reason = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)


class ApiKeyORM(Base):
    __tablename__ = "api_keys"

    provider = Column(SAEnum(Provider), primary_key=True)
    key_encrypted = Column(Text, nullable=False)
    key_masked = Column(String, nullable=False)
    is_valid = Column(Boolean, nullable=True)
    last_validated_at = Column(DateTime, nullable=True)


class SettingsORM(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, default=1)
    output_directory = Column(String, default="")
    default_provider = Column(SAEnum(Provider), default=Provider.OPENAI)
    default_model = Column(String, default="gpt-image-1.5")
    default_size = Column(String, default="1024x1024")
    default_quality = Column(String, default="medium")
    max_concurrency = Column(Integer, default=3)
    timeout_seconds = Column(Integer, default=120)
    clean_image_prompt = Column(Text, default="")
    selling_point_prompt = Column(Text, default="")


class GoogleSheetConfigORM(Base):
    __tablename__ = "google_sheet_config"

    id = Column(Integer, primary_key=True, default=1)
    spreadsheet_url = Column(Text, default="")
    spreadsheet_id = Column(String, default="")
    clean_tab = Column(String, default="Sheet1")
    selling_point_tab = Column(String, default="Sheet2")
    service_account_json = Column(Text, default="")


# ─── Init & Session ────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
