"""
FastAPI spatial ML service (Phase 3).

Endpoints:
  POST /run/spatial/qc-annotation
  POST /run/spatial/niches
  POST /run/spatial/label-transfer
  POST /run/spatial/benchmark
  GET  /status/{run_id}
  GET  /health

Run locally:
  pip install -r ml/requirements-spatial.txt
  uvicorn ml.api.main:app --reload --host 0.0.0.0 --port 8787
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml.spatial import sprint1, sprint2, sprint3, sprint4
from ml.spatial.store import get, new_run, to_public_dict, update

app = FastAPI(title="OmicsAI Spatial ML API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class H5adBody(BaseModel):
    h5ad_path: Optional[str] = Field(None, description="Absolute path to .h5ad on the worker filesystem")


class LabelTransferBody(BaseModel):
    spatial_h5ad: Optional[str] = None
    reference_h5ad: Optional[str] = None
    ref_label_key: str = "cell_type"


class BenchmarkBody(BaseModel):
    platform_train: str = "10x_visium"
    platform_test: str = "stereo_seq"
    in_domain_f1: float = 0.82
    ood_f1: float = 0.61


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
    return {"status": "ok", "service": "spatial-ml"}


@app.get("/status/{run_id}")
def status(run_id: str) -> Dict[str, Any]:
    rec = get(run_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Unknown run_id")
    return to_public_dict(rec)


@app.post("/run/spatial/qc-annotation")
def run_qc_annotation(body: H5adBody) -> Dict[str, Any]:
    return _execute_run("spatial_sprint1", sprint1.run, h5ad_path=body.h5ad_path)


@app.post("/run/spatial/niches")
def run_niches(body: H5adBody) -> Dict[str, Any]:
    return _execute_run("spatial_sprint2", sprint2.run, h5ad_path=body.h5ad_path)


@app.post("/run/spatial/label-transfer")
def run_label_transfer(body: LabelTransferBody) -> Dict[str, Any]:
    return _execute_run(
        "spatial_sprint3",
        sprint3.run,
        spatial_h5ad=body.spatial_h5ad,
        reference_h5ad=body.reference_h5ad,
        ref_label_key=body.ref_label_key,
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
    )
