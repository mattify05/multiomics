# Multiomics (OmicsAI)

A modern web app for managing multi-omics datasets, orchestrating analysis pipelines, and exploring results in a secure, role-based workspace.

This repository contains:

- A **React + Vite + TypeScript** frontend (shadcn-ui + Tailwind).
- A **Supabase** backend (Postgres + Auth + Storage + RLS policies).
- Supabase **Edge Functions** for server-side orchestration actions.

## Features at a glance

- **Authentication**: email/password auth via Supabase Auth.
- **Role-based access control (RBAC)**:
  - `lab_owner`: full access + team management + audit log access.
  - `analyst`: can manage own datasets and runs/experiments (RLS enforced).
  - `viewer`: read-only access to permitted resources (RLS enforced).
- **Dataset management**: upload datasets to Supabase Storage, register metadata in Postgres, list/download/delete.
- **Audit logging**: triggers capture INSERT/UPDATE/DELETE across data tables into `audit_log` (lab owners can view).

## Repo structure

High-level layout:

- `src/`: React application source
  - `src/pages/`: route-level pages (Dashboard, Data Manager, Team, Audit Log, Auth pages, etc.)
  - `src/components/`: reusable UI + layout components
  - `src/contexts/`: React contexts (Auth, etc.)
  - `src/integrations/supabase/`: typed Supabase client + generated DB types
- `supabase/`: Supabase local config, migrations, and edge functions
  - `supabase/migrations/`: SQL migrations for schema, RLS policies, triggers, storage bucket, etc.
  - `supabase/functions/`: edge functions (Deno runtime)

## Tech stack

- **Frontend**: Vite, React 18, TypeScript, Tailwind CSS, shadcn-ui, Radix UI
- **State/data**: TanStack Query
- **Backend**: Supabase (Auth + Postgres + Storage + Edge Functions)
- **Testing**: Vitest
- **Linting**: ESLint

## Prerequisites

- **Node.js**: recommended \(>= 18\)
- **npm** (or Bun; a `bun.lock` is present, but npm works)
- **Supabase CLI** (recommended for local development): `supabase` command available in PATH

## Quickstart (frontend only)

1) Install dependencies:

```bash
npm install
```

2) Create a `.env.local` file at the project root:

```bash
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-supabase-anon-key>"
```

Notes:

- Vite only exposes client env vars that start with `VITE_`.
- `VITE_SUPABASE_PUBLISHABLE_KEY` should be your **Supabase anon key** (safe for frontend use).

3) Run the dev server:

```bash
npm run dev
```

## Full local development (Supabase + frontend)

This project is designed to work well with Supabase local development.

### 1) Start Supabase locally

From the repo root:

```bash
supabase start
```

This will start local services (Postgres, Auth, Storage, etc.) and output local URLs/keys.

### 2) Apply migrations

When running locally, Supabase will apply migrations under `supabase/migrations/`.
If you need to re-apply from scratch, reset the local DB:

```bash
supabase db reset
```

### 3) Configure frontend env vars for local Supabase

Use the URL/anon key printed by `supabase start`:

```bash
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="<local anon key>"
```

### 4) Serve the frontend

```bash
npm run dev
```

## Environment variables

### Frontend (Vite)

Required:

- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase **anon key** (publishable client key)

The app will **fail fast** at startup if either is missing (see `src/integrations/supabase/client.ts`).

### Supabase Edge Functions

The edge function in `supabase/functions/pipeline-orchestrator/` expects:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anon key (RLS enforced)

The function uses the caller’s JWT from the `Authorization` header and performs operations as that user.

## Database schema overview

The schema is defined via SQL migrations in `supabase/migrations/`.

Core tables:

- `profiles`: per-user profile row created on signup
- `user_roles`: user role assignment
- `datasets`: uploaded dataset registry (links to Storage path)
- `pipeline_runs`: pipeline run metadata and status
- `experiments`: experiment metadata and status
- `results`: results blobs/paths
- `audit_log`: append-only audit records via triggers

### Role model

DB allows multiple roles per user (`user_roles` has a unique constraint on `(user_id, role)`).

The UI currently enforces **single-role behavior** for simplicity:

- When a lab owner changes a member’s role, the app updates/inserts the selected role row, then removes any other role rows for that user.

### Row Level Security (RLS)

RLS is enabled on all tables and uses:

- `auth.uid()` ownership checks for user-scoped resources
- `public.has_role(auth.uid(), 'lab_owner')` for privileged access where appropriate

## Storage (omics-data bucket)

Uploads are stored in the `omics-data` bucket.

File path convention:

```
<user_id>/<timestamp>_<original_filename>
```

### File size limit

The bucket file size limit is set via migrations. A follow-up migration aligns it to **10 GB**:

- `supabase/migrations/20260319030000_update_omics_bucket_limit.sql`

If you are using a hosted Supabase project that already has a bucket configured, ensure the bucket limit matches your expectations in the Supabase dashboard.

## Edge functions

### `pipeline-orchestrator`

Location: `supabase/functions/pipeline-orchestrator/index.ts`

Purpose:

- Receives authenticated requests (must include `Authorization: Bearer <jwt>`)
- Creates/updates records like `pipeline_runs` and `experiments`

This is designed as a lightweight orchestration layer; the heavy compute would run in your compute environment and update statuses/metrics back into Postgres.

## Scripts

From `package.json`:

- `npm run dev`: start Vite dev server
- `npm run build`: production build
- `npm run lint`: run ESLint
- `npm test`: run Vitest

## Deployment

Typical approach:

- Deploy the frontend to a static hosting platform (Vercel, Netlify, Cloudflare Pages, etc.)
- Use a hosted Supabase project for backend services
- Deploy edge functions via Supabase tooling

You must set production env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)

## Troubleshooting

### “Missing required environment variable …”

The Supabase client validates env vars at startup. Ensure you have a `.env.local` file with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Then restart the dev server.

### Storage upload fails

Common causes:

- Bucket limit too low for the file size (see “Storage” section)
- Storage RLS policy not matching the upload path convention (`<user_id>/...`)
- User not authenticated

### Team page / audit log access

- Only users with role `lab_owner` can access team management and audit log data.
- If a lab owner expects to see other profiles but cannot, verify `profiles` RLS policy and role assignment in `user_roles`.

## Security notes

- Never place **service role keys** in the frontend. Use anon keys in client code.
- Prefer RLS-enforced access patterns. When privileged server actions are needed, use an edge function with **service role** and carefully validate user intent/permissions.

