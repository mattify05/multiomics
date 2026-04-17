-- studies
CREATE TABLE public.studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own studies" ON public.studies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Lab owners can view all studies" ON public.studies FOR SELECT USING (has_role(auth.uid(), 'lab_owner'::app_role));
CREATE POLICY "Users can insert own studies" ON public.studies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own studies" ON public.studies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own studies" ON public.studies FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER studies_updated_at BEFORE UPDATE ON public.studies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER studies_audit AFTER INSERT OR UPDATE OR DELETE ON public.studies
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- samples
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
CREATE INDEX idx_samples_study_id ON public.samples(study_id);
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own samples" ON public.samples FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Lab owners can view all samples" ON public.samples FOR SELECT USING (has_role(auth.uid(), 'lab_owner'::app_role));
CREATE POLICY "Users can insert own samples" ON public.samples FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own samples" ON public.samples FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own samples" ON public.samples FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER samples_updated_at BEFORE UPDATE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER samples_audit AFTER INSERT OR UPDATE OR DELETE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- jobs
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
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Lab owners can view all jobs" ON public.jobs FOR SELECT USING (has_role(auth.uid(), 'lab_owner'::app_role));
CREATE POLICY "Users can insert own jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER jobs_audit AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- dataset_samples (composite PK; no `id` column, so audit trigger is skipped)
CREATE TABLE public.dataset_samples (
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dataset_id, sample_id)
);
ALTER TABLE public.dataset_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dataset_samples" ON public.dataset_samples FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = dataset_id AND d.user_id = auth.uid()));
CREATE POLICY "Lab owners can view all dataset_samples" ON public.dataset_samples FOR SELECT
  USING (has_role(auth.uid(), 'lab_owner'::app_role));
CREATE POLICY "Users can insert own dataset_samples" ON public.dataset_samples FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = dataset_id AND d.user_id = auth.uid()));
CREATE POLICY "Users can delete own dataset_samples" ON public.dataset_samples FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = dataset_id AND d.user_id = auth.uid()));

-- Add study_id to datasets
ALTER TABLE public.datasets ADD COLUMN study_id uuid REFERENCES public.studies(id) ON DELETE SET NULL;
CREATE INDEX idx_datasets_study_id ON public.datasets(study_id);