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

Run locally:
  pip install -r ml/requirements-spatial.txt
  export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ML_TRAINING_WEBHOOK_SECRET=...
  uvicorn ml.api.main:app --reload --host 0.0.0.0 --port 8787
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml.spatial import sprint1, sprint2, sprint3, sprint4
from ml.spatial.store import get, new_run, to_public_dict, update
from ml.tabular_training.job_runner import run_tabular_experiment_job, verify_webhook_secret

app = FastAPI(title="OmicsAI ML API (Spatial + Tabular)", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class H5adBody(BaseModel):
    h5ad_path: Optional[str] = Field(None, description="Absolute path to .h5ad on the worker filesystem")
    max_obs: Optional[int] = Field(
        None,
        ge=1,
        description="Subsample spots after load (uniform random); use for large Visium HD objects",
    )
    random_seed: int = Field(0, description="RNG seed for max_obs subsampling")


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
    min_shared_genes: int = Field(500, ge=50, description="Minimum intersection of var_names for transfer")


class BenchmarkBody(BaseModel):
    platform_train: str = "10x_visium"
    platform_test: str = "stereo_seq"
    in_domain_f1: float = 0.82
    ood_f1: float = 0.61
    train_h5ad_path: Optional[str] = Field(
        None,
        description="Optional path to training cohort .h5ad (metadata-only read for cohort_summary)",
    )
    test_h5ad_path: Optional[str] = Field(
        None,
        description="Optional path to test cohort .h5ad (metadata-only read for cohort_summary)",
    )


class TabularTrainBody(BaseModel):
    experiment_id: str
    job_id: str


def _execute_run(pipeline: str, fn: Any, **kwargs: Any) -> Dict[str, Any]:
    rec = new_run(pipeline)
    update(rec.run_id, status="running")
    try:
        artifacts = fn(**kwargs)
        update(rec.run_id, status="completed", artifacts=artifacts)
    except Exception as exc:  # noqa: BLE001
        update(rec.run_id, status="failed", error=str(exc))
    final = get(rec.run_id)
    if not final:
        raise HTTPException(status_code=500, detail="Run record missing")
    return to_public_dict(final)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "omics-ml-api"}


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


@app.get("/status/{run_id}")
def status(run_id: str) -> Dict[str, Any]:
    rec = get(run_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Unknown run_id")
    return to_public_dict(rec)


@app.post("/run/spatial/qc-annotation")
def run_qc_annotation(body: H5adBody) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint1",
        sprint1.run,
        h5ad_path=body.h5ad_path,
        max_obs=body.max_obs,
        random_seed=body.random_seed,
    )


@app.post("/run/spatial/niches")
def run_niches(body: H5adBody) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint2",
        sprint2.run,
        h5ad_path=body.h5ad_path,
        max_obs=body.max_obs,
        random_seed=body.random_seed,
    )


@app.post("/run/spatial/label-transfer")
def run_label_transfer(body: LabelTransferBody) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint3",
        sprint3.run,
        spatial_h5ad=body.spatial_h5ad,
        reference_h5ad=body.reference_h5ad,
        ref_label_key=body.ref_label_key,
        spatial_max_obs=body.spatial_max_obs,
        spatial_random_seed=body.spatial_random_seed,
        min_shared_genes=body.min_shared_genes,
    )


@app.post("/run/spatial/benchmark")
def run_benchmark(body: BenchmarkBody) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint4",
        sprint4.run,
        platform_train=body.platform_train,
        platform_test=body.platform_test,
        in_domain_f1=body.in_domain_f1,
        ood_f1=body.ood_f1,
        train_h5ad_path=body.train_h5ad_path,
        test_h5ad_path=body.test_h5ad_path,
    )
