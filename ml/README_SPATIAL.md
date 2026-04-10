# Spatial transcriptomics ML service

Implements Phase 3 sprints (QC/annotation, niches, label transfer, benchmark) as a **FastAPI** app.

## Run locally

From repo root:

```bash
python -m venv .venv-spatial
source .venv-spatial/bin/activate  # Windows: .venv-spatial\Scripts\activate
pip install -r ml/requirements-spatial.txt
export PYTHONPATH="${PWD}"
uvicorn ml.api.main:app --reload --host 0.0.0.0 --port 8787
```

## Frontend

Set in `.env.local`:

```bash
VITE_SPATIAL_API_URL=http://localhost:8787
```

Open **Spatial Studio** in the app sidebar (`/spatial`).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/run/spatial/qc-annotation` | Sprint 1 — QC + Leiden + UMAP artifacts |
| POST | `/run/spatial/niches` | Sprint 2 — spatial graph niches |
| POST | `/run/spatial/label-transfer` | Sprint 3 — kNN label transfer (needs two h5ad paths) |
| POST | `/run/spatial/benchmark` | Sprint 4 — benchmark / failure-case summary |
| GET | `/status/{run_id}` | Poll run record |

Body for h5ad routes: `{ "h5ad_path": "/path/on/worker/to/file.h5ad" }` or omit for **synthetic demo** output.

## Supabase Edge (optional)

Set `ML_SPATIAL_API_URL` on the `pipeline-orchestrator` function to forward `dispatch_spatial` jobs to this service.
