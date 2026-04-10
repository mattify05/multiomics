CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  pipeline_run_id uuid NULL REFERENCES public.pipeline_runs(id) ON DELETE SET NULL,
  experiment_id uuid NULL REFERENCES public.experiments(id) ON DELETE SET NULL,
  logs jsonb NULL DEFAULT '[]'::jsonb,
  worker_version text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
ON public.jobs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs"
ON public.jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
ON public.jobs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
