
The build errors all stem from one root cause: the codebase references DB tables/columns that don't exist in the schema. Current schema has only: `audit_log`, `datasets`, `experiments`, `pipeline_runs`, `profiles`, `results`, `user_roles`. Missing: `studies`, `samples`, `jobs`, `dataset_samples`, plus `study_id` column on `datasets`.

Fix = one migration adding these. Then `src/integrations/supabase/types.ts` regenerates automatically and all TS errors resolve.

# Plan: Add Missing Schema for Studies, Samples, Jobs

## Root cause
TypeScript errors in `Studies.tsx`, `DataManager.tsx`, `DatasetUploadForm.tsx`, `MLExperiments.tsx`, `PipelineBuilder.tsx`, and `AppLayout.tsx` are all "table not in schema" errors. The application code was written assuming these tables exist, but no migration was ever applied.

## Step 1: Create migration adding missing schema

```sql
-- studies: groups datasets/samples by research study
CREATE TABLE public.studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- samples: subject/timepoint registry under a study
CREATE TABLE public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject_id text NOT NULL,
  timepoint text,
  biospecimen_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- dataset_samples: M:N link between datasets and samples
CREATE TABLE public.dataset_samples (
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dataset_id, sample_id)
);

-- jobs: ML training/eval job records (referenced by MLExperiments.tsx)
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  experiment_id uuid,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add study_id column to datasets
ALTER TABLE public.datasets ADD COLUMN study_id uuid REFERENCES public.studies(id) ON DELETE SET NULL;
```

## Step 2: Enable RLS + policies (per-user ownership, lab_owner read-all)
For `studies`, `samples`, `jobs`: standard CRUD policies on `auth.uid() = user_id` plus `has_role(auth.uid(), 'lab_owner')` SELECT. For `dataset_samples`: policies based on owning the parent dataset.

## Step 3: Triggers
- `updated_at` trigger using existing `update_updated_at()` on studies/samples/jobs.
- Audit triggers on studies/samples/jobs (matches Step 2 of prior audit-trigger work).

## Step 4: Verify
After migration, `types.ts` auto-regenerates. The 25+ TS errors should all resolve since they're all "table/column not in generated types." Run typecheck to confirm.

## Files Changed
| File | Change |
|------|--------|
| New migration SQL | Add 4 tables, 1 column, RLS, triggers |
| `src/integrations/supabase/types.ts` | Auto-regenerated |

No application code changes needed — the existing code already matches this intended schema.
