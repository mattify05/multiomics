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

### Request bodies

**Sprint 1 & 2** — `POST /run/spatial/qc-annotation`, `POST /run/spatial/niches`

```json
{
  "h5ad_path": "/absolute/path/on/worker/file.h5ad",
  "max_obs": 50000,
  "random_seed": 0
}
```

Omit `h5ad_path` or point at a missing file for **synthetic demo** output. Use `max_obs` for large Visium HD slides (full load still occurs; see [`ml/spatial/PERFORMANCE.md`](spatial/PERFORMANCE.md)).

**Sprint 3** — `POST /run/spatial/label-transfer`

```json
{
  "spatial_h5ad": "/path/spatial.h5ad",
  "reference_h5ad": "/path/scrna.h5ad",
  "ref_label_key": "cell_type",
  "spatial_max_obs": 25000,
  "spatial_random_seed": 0,
  "min_shared_genes": 500
}
```

Invalid `ref_label_key` or too few shared genes returns a **failed** run with an error message (not silent synthetic data).

**Sprint 4** — `POST /run/spatial/benchmark`

```json
{
  "platform_train": "10x_visium_hd",
  "platform_test": "stereo_seq",
  "in_domain_f1": 0.82,
  "ood_f1": 0.61,
  "train_h5ad_path": "/path/train.h5ad",
  "test_h5ad_path": "/path/test.h5ad"
}
```

Optional `train_h5ad_path` / `test_h5ad_path` add a **metadata-only** `cohort_summary` (backed read) to the response.

## Supabase Edge (optional)

Set `ML_SPATIAL_API_URL` on the `pipeline-orchestrator` function to forward `dispatch_spatial` jobs to this service. The orchestrator payload may include `max_obs`, `random_seed`, `ref_label_key`, `spatial_max_obs`, `train_h5ad_path`, `test_h5ad_path`, etc., and they are forwarded to the same JSON bodies as above.

## Performance

See [`ml/spatial/PERFORMANCE.md`](spatial/PERFORMANCE.md) for Visium HD scale, subsampling, and future optimization ideas.

## Dev `.h5ad` and stack validation

- Generate a small test file: `python ml/data_pack/make_synthetic_spatial_h5ad.py` (writes under `ml/data_pack/local/`).
- Time Sprint 1 → 2: `python ml/spatial/validate_sprint_stack.py` (JSON timing + approximate RSS).
- Before any model training, fill in [`ml/spatial/MODELING_TARGET.md`](spatial/MODELING_TARGET.md).

## Tabular training (same server)

`POST /internal/tabular/train` with header `X-Training-Webhook-Secret` enqueues clinical-outcome training (see root README). Requires `SUPABASE_SERVICE_ROLE_KEY` and `ML_TRAINING_WEBHOOK_SECRET` in the worker environment.
