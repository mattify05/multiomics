-- Durable run tracking for the spatial ML API (Production Sprint 1).
-- Rows created/updated by the SupabaseRunStore backend (ml/spatial/store.py).

create table if not exists public.ml_spatial_runs (
  id          uuid primary key,
  pipeline    text not null,
  status      text not null default 'queued'
              check (status in ('queued', 'running', 'completed', 'failed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  error       text,
  error_code  text,
  artifacts   jsonb default '{}'::jsonb,
  request_id  text,
  elapsed_ms  double precision
);

comment on table public.ml_spatial_runs is
  'Durable status rows for spatial Sprint 1–4 API runs, consumed by GET /status/{run_id}.';

create index if not exists idx_ml_spatial_runs_status on public.ml_spatial_runs (status);
create index if not exists idx_ml_spatial_runs_request_id on public.ml_spatial_runs (request_id)
  where request_id is not null;

-- RLS: service-role only (ML worker writes); read via API not directly from frontend.
alter table public.ml_spatial_runs enable row level security;

create policy "service_role_full_access" on public.ml_spatial_runs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
