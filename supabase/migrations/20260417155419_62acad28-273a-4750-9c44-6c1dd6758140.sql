ALTER TABLE public.jobs ADD COLUMN pipeline_run_id uuid;
ALTER TABLE public.jobs ADD COLUMN logs text;
CREATE INDEX idx_jobs_pipeline_run_id ON public.jobs(pipeline_run_id);
CREATE INDEX idx_jobs_experiment_id ON public.jobs(experiment_id);