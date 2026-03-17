
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('lab_owner', 'analyst', 'viewer');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Trigger to auto-create profile and assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Profiles RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Lab owners can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'lab_owner'));

-- 7. User roles RLS policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Lab owners can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'lab_owner'));

-- 8. Datasets table
CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'RNA-seq',
  cohort TEXT,
  samples INTEGER DEFAULT 0,
  features INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  file_path TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own datasets" ON public.datasets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own datasets" ON public.datasets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own datasets" ON public.datasets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own datasets" ON public.datasets
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Lab owners can view all datasets" ON public.datasets
  FOR SELECT USING (public.has_role(auth.uid(), 'lab_owner'));

-- 9. Pipeline runs table
CREATE TABLE public.pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  config JSONB DEFAULT '{}',
  dataset_ids UUID[] DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pipeline runs" ON public.pipeline_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pipeline runs" ON public.pipeline_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pipeline runs" ON public.pipeline_runs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Lab owners can view all pipeline runs" ON public.pipeline_runs
  FOR SELECT USING (public.has_role(auth.uid(), 'lab_owner'));

-- 10. Experiments table
CREATE TABLE public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pipeline_run_id UUID REFERENCES public.pipeline_runs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  hyperparameters JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  runtime TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own experiments" ON public.experiments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own experiments" ON public.experiments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experiments" ON public.experiments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Lab owners can view all experiments" ON public.experiments
  FOR SELECT USING (public.has_role(auth.uid(), 'lab_owner'));

-- 11. Results table
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  experiment_id UUID REFERENCES public.experiments(id) ON DELETE CASCADE NOT NULL,
  result_type TEXT NOT NULL DEFAULT 'classification',
  data JSONB DEFAULT '{}',
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own results" ON public.results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own results" ON public.results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Lab owners can view all results" ON public.results
  FOR SELECT USING (public.has_role(auth.uid(), 'lab_owner'));

-- 12. Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lab owners can view audit log" ON public.audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "System can insert audit log" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- 13. Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 14. Attach audit triggers to all data tables
CREATE TRIGGER audit_datasets AFTER INSERT OR UPDATE OR DELETE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_pipeline_runs AFTER INSERT OR UPDATE OR DELETE ON public.pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_experiments AFTER INSERT OR UPDATE OR DELETE ON public.experiments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_results AFTER INSERT OR UPDATE OR DELETE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 15. Storage bucket for omics data
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('omics-data', 'omics-data', false, 524288000);

-- 16. Storage RLS policies
CREATE POLICY "Authenticated users can upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'omics-data' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'omics-data' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'omics-data' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Lab owners can view all files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'omics-data' AND public.has_role(auth.uid(), 'lab_owner'));

-- 17. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_pipeline_runs_updated_at BEFORE UPDATE ON public.pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON public.experiments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
