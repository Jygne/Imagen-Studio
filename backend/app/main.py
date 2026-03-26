from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import config
from app.infrastructure.db.database import init_db
from app.api.routes import api_keys, settings, runs, workflows, files
from app.api.routes import local_generate
from app.api.routes import seg_generate
from app.api.routes import logs


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="BuyBox v2 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(api_keys.router, prefix=API_PREFIX)
app.include_router(settings.router, prefix=API_PREFIX)
app.include_router(runs.router, prefix=API_PREFIX)
app.include_router(workflows.router, prefix=API_PREFIX)
app.include_router(files.router, prefix=API_PREFIX)
app.include_router(local_generate.router, prefix=API_PREFIX)
app.include_router(seg_generate.router, prefix=API_PREFIX)
app.include_router(logs.router, prefix=API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok", "app": config.app_name}
