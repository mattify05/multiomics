
The schema migration landed and types regenerated. The app now has a complete data model (studies, samples, datasets, dataset_samples, jobs, experiments, pipeline_runs, results, audit_log) with RLS. From here, "production-ready" splits into three tracks: **wire-up** (replace remaining mock data), **harden** (security, errors, observability), and **deploy** (ML worker, env, hosting).

Below is a prioritized roadmap.

# Roadmap to Production / Training-Ready

## Track 1 — Wire remaining UI to real data (1–2 sessions each)

Most pages still render mock arrays. To be useful end-to-end, these need DB-backed data:

| Page | Current state | What to wire |
|------|---------------|--------------|
| **Dashboard** | Mock stat cards | Counts from `datasets`, `experiments`, `pipeline_runs`, `jobs` for current user |
| **Pipeline Builder** | Mock graph + fake "run" | On submit: insert `pipeline_runs` row + invoke `pipeline-orchestrator` edge function; poll status |
| **ML Experiments** | Mock job list | Read `experiments` + `jobs` joined; show real status; "Start" inserts `experiments` + `jobs` rows |
| **Results Explorer** | Demo artifacts | Read `results` table; load `file_path` from storage as signed URL |
| **XAI Reports** | Static demo | Read `results` where `result_type = 'xai'` |
| **Audit Log** | Already wired ✓ | — |
| **Team Access** | Already wired ✓ | — |

## Track 2 — Hardening (required before real users)

1. **Auth settings** — enable HIBP (leaked password) check; confirm email confirmation flow; set Site URL + redirect URLs in Cloud auth settings for the production domain.
2. **Run a security scan** — fix any RLS gaps the linter finds (especially around `dataset_samples` and `jobs`).
3. **Loading + error UX** — every Supabase query needs `isLoading` skeleton + `error` toast. Many pages currently render blank on error.
4. **Empty states** — first-time users see broken-looking pages today. Add "Create your first study" / "Upload your first dataset" CTAs.
5. **Storage hygiene** — verify `omics-data` bucket RLS path convention `<user_id>/...`; confirm 10 GB limit migration applied.
6. **Edge function correlation IDs** — `pipeline-orchestrator` should forward `x-request-id` to the ML API and persist it on `pipeline_runs.config` for tracing.

## Track 3 — Training-ready (ML worker integration)

The Python `ml/api/main.py` worker exists but isn't deployed. To make training work end-to-end:

1. **Deploy the FastAPI worker** (Fly/Render/Railway/Cloud Run). It needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ML_TRAINING_WEBHOOK_SECRET`.
2. **Set edge function secrets**: `ML_TRAINING_WEBHOOK_URL`, `ML_TRAINING_WEBHOOK_SECRET`, `ML_SPATIAL_API_URL` so `pipeline-orchestrator` can dispatch jobs.
3. **Verify the spatial Go/No-Go checklist** (`ml/spatial/GO_NOGO_CHECKLIST.md`) — pilot trainer, splits manifest, snapshot pinned.
4. **Frontend env**: set `VITE_SPATIAL_API_URL` and `VITE_TABULAR_TRAINING_ENABLED` once worker is live.

## Track 4 — Deployment

1. **Publish** the Lovable frontend (Publish button → `.lovable.app` URL).
2. **Connect a custom domain** (Settings → Domains).
3. **Smoke test** end-to-end on the published URL: signup → upload → audit log entry appears.

---

## Suggested order

1. **Now**: Track 2 items 1–4 (auth + security scan + loading/empty states) — small, high-impact, no infra needed.
2. **Next**: Track 1 Dashboard + Results Explorer — most visible "feels real" wins.
3. **Then**: Track 1 Pipeline Builder + ML Experiments — depends on the orchestrator already existing.
4. **Before real training**: Track 3 (worker deployment) — biggest external dependency, plan it separately.
5. **Last**: Track 4 (publish + custom domain).

## What I'd recommend for the next message

Pick **one** of:
- "Do Track 2 items 1–4" (auth hardening + loading/empty states across pages)
- "Wire the Dashboard to real counts" (smallest, most visible)
- "Wire Pipeline Builder + ML Experiments to the DB" (largest single chunk)

Each is a single focused implementation pass.
