"""
FastAPI spatial ML service (Phase 3) + tabular clinical-outcome training webhook.

Endpoints:
  POST /run/spatial/qc-annotation
  POST /run/spatial/niches
  POST /run/spatial/label-transfer
  POST /run/spatial/benchmark
  POST /internal/tabular/train  (background job; requires X-Training-Webhook-Secret)
  GET  /status/{run_id}
  GET  /health
  GET  /ready

Run locally:
  pip install -r ml/requirements-spatial.txt
  export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ML_TRAINING_WEBHOOK_SECRET=...
  uvicorn ml.api.main:app --reload --host 0.0.0.0 --port 8787

Production env vars (optional):
  ML_RUN_STORE_BACKEND=supabase          # durable run state
  ML_ALLOW_SYNTHETIC_FALLBACK=false      # disable synthetic demo artifacts
  ML_MAX_OBS_HARD_LIMIT=200000           # hard cap on max_obs
"""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Literal, Optional

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from ml.spatial import sprint1, sprint2, sprint3, sprint4
from ml.spatial.config import max_obs_hard_limit
from ml.spatial.errors import SpatialPipelineError
from ml.spatial.store import get, get_store, new_run, to_public_dict, update
from ml.tabular_training.job_runner import run_tabular_experiment_job, verify_webhook_secret

logger = logging.getLogger("ml.api")
logging.basicConfig(
    format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":%(message)s}',
    level=logging.INFO,
)

app = FastAPI(title="OmicsAI ML API (Spatial + Tabular)", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Structured error envelope
# ---------------------------------------------------------------------------

def _error_envelope(
    *,
    status_code: int,
    error_code: str,
    message: str,
    run_id: Optional[str] = None,
    request_id: Optional[str] = None,
    retryable: bool = False,
) -> JSONResponse:
    body: Dict[str, Any] = {
        "error_code": error_code,
        "message": message,
        "retryable": retryable,
    }
    if run_id:
        body["run_id"] = run_id
    if request_id:
        body["request_id"] = request_id
    return JSONResponse(status_code=status_code, content=body)


HTTP_STATUS_FOR_CODE: Dict[str, int] = {
    "MISSING_FILE": 404,
    "DEPENDENCY_ERROR": 500,
    "INSUFFICIENT_DATA": 422,
    "INSUFFICIENT_SHARED_GENES": 422,
    "MISSING_LABEL_COLUMN": 422,
    "SYNTHETIC_FALLBACK_DISABLED": 500,
    "RUNNER_EXCEPTION": 500,
}


# ---------------------------------------------------------------------------
# Request ID middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next: Any) -> Any:
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


# ---------------------------------------------------------------------------
# Pydantic models with validation limits
# ---------------------------------------------------------------------------

def _validate_max_obs(v: Optional[int]) -> Optional[int]:
    if v is not None and v > max_obs_hard_limit():
        raise ValueError(f"max_obs must be <= {max_obs_hard_limit()}")
    return v


def _validate_h5ad_path(v: Optional[str]) -> Optional[str]:
    if v is not None:
        p = Path(v)
        if not p.is_absolute():
            raise ValueError("h5ad_path must be an absolute path")
    return v


class H5adBody(BaseModel):
    h5ad_path: Optional[str] = Field(None, description="Absolute path to .h5ad on the worker filesystem")
    max_obs: Optional[int] = Field(
        None,
        ge=1,
        description="Subsample spots after load (uniform random); use for large Visium HD objects",
    )
    random_seed: int = Field(0, description="RNG seed for max_obs subsampling")
    profile: Literal["default", "fast"] = Field(
        "default",
        description='"fast" = smaller HVG/PCs/neighbors for quicker dev runs (same API contract)',
    )

    @field_validator("max_obs")
    @classmethod
    def cap_max_obs(cls, v: Optional[int]) -> Optional[int]:
        return _validate_max_obs(v)

    @field_validator("h5ad_path")
    @classmethod
    def check_path(cls, v: Optional[str]) -> Optional[str]:
        return _validate_h5ad_path(v)


class LabelTransferBody(BaseModel):
    spatial_h5ad: Optional[str] = None
    reference_h5ad: Optional[str] = None
    ref_label_key: str = "cell_type"
    spatial_max_obs: Optional[int] = Field(
        None,
        ge=1,
        description="Subsample spatial slide spots before kNN (reference unchanged)",
    )
    spatial_random_seed: int = 0
    min_shared_genes: int = Field(500, ge=50, le=50000, description="Minimum intersection of var_names for transfer")

    @field_validator("spatial_max_obs")
    @classmethod
    def cap_max_obs(cls, v: Optional[int]) -> Optional[int]:
        return _validate_max_obs(v)

    @field_validator("spatial_h5ad", "reference_h5ad")
    @classmethod
    def check_path(cls, v: Optional[str]) -> Optional[str]:
        return _validate_h5ad_path(v)


class BenchmarkBody(BaseModel):
    platform_train: str = "10x_visium"
    platform_test: str = "stereo_seq"
    in_domain_f1: float = Field(0.82, ge=0.0, le=1.0)
    ood_f1: float = Field(0.61, ge=0.0, le=1.0)
    train_h5ad_path: Optional[str] = Field(
        None,
        description="Optional path to training cohort .h5ad (metadata-only read for cohort_summary)",
    )
    test_h5ad_path: Optional[str] = Field(
        None,
        description="Optional path to test cohort .h5ad (metadata-only read for cohort_summary)",
    )

    @field_validator("train_h5ad_path", "test_h5ad_path")
    @classmethod
    def check_path(cls, v: Optional[str]) -> Optional[str]:
        return _validate_h5ad_path(v)


class TabularTrainBody(BaseModel):
    experiment_id: str
    job_id: str


# ---------------------------------------------------------------------------
# Execution wrapper with structured error handling + logging
# ---------------------------------------------------------------------------

def _execute_run(
    pipeline: str,
    fn: Any,
    request: Request,
    **kwargs: Any,
) -> Dict[str, Any]:
    request_id: str = getattr(request.state, "request_id", str(uuid.uuid4()))
    rec = new_run(pipeline, request_id=request_id)
    run_id = rec.run_id
    update(run_id, status="running")
    t0 = time.monotonic()

    logger.info(
        '{"event":"run_start","run_id":"%s","request_id":"%s","pipeline":"%s","kwargs":%s}',
        run_id,
        request_id,
        pipeline,
        {k: v for k, v in kwargs.items() if k != "fn"},
    )

    try:
        artifacts = fn(**kwargs)
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        update(run_id, status="completed", artifacts=artifacts, elapsed_ms=elapsed)
        logger.info(
            '{"event":"run_completed","run_id":"%s","request_id":"%s","pipeline":"%s","elapsed_ms":%s}',
            run_id,
            request_id,
            pipeline,
            elapsed,
        )
        final = get(run_id)
        if not final:
            raise HTTPException(status_code=500, detail="Run record missing")
        return to_public_dict(final)

    except SpatialPipelineError as exc:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        update(
            run_id,
            status="failed",
            error=str(exc),
            error_code=exc.error_code,
            elapsed_ms=elapsed,
        )
        logger.warning(
            '{"event":"run_failed","run_id":"%s","request_id":"%s","pipeline":"%s",'
            '"error_code":"%s","elapsed_ms":%s,"msg":"%s"}',
            run_id,
            request_id,
            pipeline,
            exc.error_code,
            elapsed,
            str(exc)[:200],
        )
        status_code = HTTP_STATUS_FOR_CODE.get(exc.error_code, 500)
        return _error_envelope(  # type: ignore[return-value]
            status_code=status_code,
            error_code=exc.error_code,
            message=str(exc),
            run_id=run_id,
            request_id=request_id,
            retryable=exc.retryable,
        )

    except Exception as exc:  # noqa: BLE001
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        update(
            run_id,
            status="failed",
            error=str(exc),
            error_code="RUNNER_EXCEPTION",
            elapsed_ms=elapsed,
        )
        logger.error(
            '{"event":"run_exception","run_id":"%s","request_id":"%s","pipeline":"%s",'
            '"elapsed_ms":%s,"msg":"%s"}',
            run_id,
            request_id,
            pipeline,
            elapsed,
            str(exc)[:200],
        )
        return _error_envelope(  # type: ignore[return-value]
            status_code=500,
            error_code="RUNNER_EXCEPTION",
            message=str(exc),
            run_id=run_id,
            request_id=request_id,
            retryable=False,
        )


# ---------------------------------------------------------------------------
# Health / readiness
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "omics-ml-api"}


@app.get("/ready")
def ready() -> Dict[str, Any]:
    store = get_store()
    store_ok = store.healthy()
    backend = type(store).__name__
    if not store_ok:
        return JSONResponse(  # type: ignore[return-value]
            status_code=503,
            content={"ready": False, "run_store": backend, "run_store_healthy": False},
        )
    return {"ready": True, "run_store": backend, "run_store_healthy": True}


# ---------------------------------------------------------------------------
# Tabular training webhook
# ---------------------------------------------------------------------------

@app.post("/internal/tabular/train")
def internal_tabular_train(
    body: TabularTrainBody,
    background_tasks: BackgroundTasks,
    x_training_webhook_secret: Optional[str] = Header(default=None, alias="X-Training-Webhook-Secret"),
) -> Dict[str, bool]:
    """Enqueue tabular training (called from Supabase Edge after ``launch_experiment``)."""
    if not verify_webhook_secret(x_training_webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid or missing training webhook secret")
    background_tasks.add_task(
        run_tabular_experiment_job,
        experiment_id=body.experiment_id,
        job_id=body.job_id,
    )
    return {"accepted": True}


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

@app.get("/status/{run_id}")
def status(run_id: str) -> Dict[str, Any]:
    rec = get(run_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Unknown run_id")
    return to_public_dict(rec)


# ---------------------------------------------------------------------------
# Spatial sprint routes
# ---------------------------------------------------------------------------

@app.post("/run/spatial/qc-annotation")
def run_qc_annotation(body: H5adBody, request: Request) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint1",
        sprint1.run,
        request,
        h5ad_path=body.h5ad_path,
        max_obs=body.max_obs,
        random_seed=body.random_seed,
        fast=body.profile == "fast",
    )


@app.post("/run/spatial/niches")
def run_niches(body: H5adBody, request: Request) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint2",
        sprint2.run,
        request,
        h5ad_path=body.h5ad_path,
        max_obs=body.max_obs,
        random_seed=body.random_seed,
        fast=body.profile == "fast",
    )


@app.post("/run/spatial/label-transfer")
def run_label_transfer(body: LabelTransferBody, request: Request) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint3",
        sprint3.run,
        request,
        spatial_h5ad=body.spatial_h5ad,
        reference_h5ad=body.reference_h5ad,
        ref_label_key=body.ref_label_key,
        spatial_max_obs=body.spatial_max_obs,
        spatial_random_seed=body.spatial_random_seed,
        min_shared_genes=body.min_shared_genes,
    )


@app.post("/run/spatial/benchmark")
def run_benchmark(body: BenchmarkBody, request: Request) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint4",
        sprint4.run,
        request,
        platform_train=body.platform_train,
        platform_test=body.platform_test,
        in_domain_f1=body.in_domain_f1,
        ood_f1=body.ood_f1,
        train_h5ad_path=body.train_h5ad_path,
        test_h5ad_path=body.test_h5ad_path,
    )
