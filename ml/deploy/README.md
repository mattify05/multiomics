# OmicsAI ML Worker — Deployment

The FastAPI worker in `ml/api/main.py` is the backend for two flows:

1. **Tabular training** — `pipeline-orchestrator` (Supabase Edge) calls
   `POST /internal/tabular/train` with `experiment_id` + `job_id`. The worker
   runs training in the background and writes results to Supabase using the
   service-role key.
2. **Spatial sprints 1–4** — `pipeline-orchestrator` calls
   `POST /run/spatial/{qc-annotation,niches,label-transfer,benchmark}`.

## Files in this directory

| File | Purpose |
|---|---|
| `Dockerfile`     | Production container image (Python 3.11-slim). |
| `.dockerignore`  | Keeps the build context lean. |
| `fly.toml`       | Fly.io config (recommended — global anycast, auto-stop). |
| `render.yaml`    | Render.com Blueprint (one-click deploy alternative). |
| `Procfile`       | Railway / Heroku-style hosts. |
| `.env.example`   | Required + optional env vars. |

## Required environment variables

Set these on whichever host you pick (see `.env.example` for full list):

| Var | Notes |
|---|---|
| `SUPABASE_URL`               | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY`  | Backend-only. Never ship to the browser. |
| `ML_TRAINING_WEBHOOK_SECRET` | Shared with the edge function. Use ≥32 random chars. |

Optional but recommended in production: `ML_RUN_STORE_BACKEND=supabase`,
`ML_ALLOW_SYNTHETIC_FALLBACK=false`.

## Deploying to Fly.io (recommended)

```bash
# From repo root, one-time:
fly launch --no-deploy --copy-config --dockerfile ml/deploy/Dockerfile
# (point Fly at ml/deploy/fly.toml when prompted)

fly secrets set \
  SUPABASE_URL=https://<ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  ML_TRAINING_WEBHOOK_SECRET=<long-random-string>

fly deploy --dockerfile ml/deploy/Dockerfile
fly status
curl https://<your-app>.fly.dev/health   # → {"status":"ok",...}
```

## Wiring back into Lovable Cloud

Once the worker is reachable, set these **runtime secrets** in Lovable Cloud
so `pipeline-orchestrator` can dispatch jobs to it:

| Lovable secret | Value |
|---|---|
| `ML_TRAINING_WEBHOOK_URL`    | `https://<your-app>.fly.dev/internal/tabular/train` |
| `ML_TRAINING_WEBHOOK_SECRET` | Same value you set on the worker. |
| `ML_SPATIAL_API_URL`         | `https://<your-app>.fly.dev` (no trailing slash) |

After the secrets are added, the next experiment launched from the UI will
POST to the worker. If the worker is offline the experiment row still gets
created — it just stays `running` until a status update comes back.

## Smoke test end-to-end

```bash
# 1. Worker is healthy
curl https://<your-app>.fly.dev/health

# 2. Webhook rejects requests without the secret
curl -i -X POST https://<your-app>.fly.dev/internal/tabular/train \
  -H 'Content-Type: application/json' \
  -d '{"experiment_id":"00000000-0000-0000-0000-000000000000","job_id":"00000000-0000-0000-0000-000000000000"}'
# → 401

# 3. With the correct secret it accepts and enqueues
curl -i -X POST https://<your-app>.fly.dev/internal/tabular/train \
  -H 'Content-Type: application/json' \
  -H "X-Training-Webhook-Secret: $ML_TRAINING_WEBHOOK_SECRET" \
  -d '{"experiment_id":"<real-uuid>","job_id":"<real-uuid>"}'
# → 202 {"accepted": true}
```
