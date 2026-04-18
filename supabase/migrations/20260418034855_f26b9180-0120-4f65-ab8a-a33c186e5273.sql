
-- ============= Restrictive: ALL inserts to user_roles must come from a lab_owner =============
CREATE POLICY "Only lab owners can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'lab_owner'));

-- ============= Re-scope all permissive policies on data tables from public -> authenticated =============
-- datasets
DROP POLICY IF EXISTS "Lab owners can view all datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can delete own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can insert own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can update own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can view own datasets" ON public.datasets;
CREATE POLICY "Lab owners can view all datasets" ON public.datasets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own datasets" ON public.datasets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own datasets" ON public.datasets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own datasets" ON public.datasets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own datasets" ON public.datasets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- experiments
DROP POLICY IF EXISTS "Lab owners can view all experiments" ON public.experiments;
DROP POLICY IF EXISTS "Users can insert own experiments" ON public.experiments;
DROP POLICY IF EXISTS "Users can update own experiments" ON public.experiments;
DROP POLICY IF EXISTS "Users can view own experiments" ON public.experiments;
DROP POLICY IF EXISTS "Users can delete own experiments" ON public.experiments;
CREATE POLICY "Lab owners can view all experiments" ON public.experiments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own experiments" ON public.experiments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own experiments" ON public.experiments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experiments" ON public.experiments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own experiments" ON public.experiments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- jobs
DROP POLICY IF EXISTS "Lab owners can view all jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view own jobs" ON public.jobs;
CREATE POLICY "Lab owners can view all jobs" ON public.jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- pipeline_runs
DROP POLICY IF EXISTS "Lab owners can view all pipeline runs" ON public.pipeline_runs;
DROP POLICY IF EXISTS "Users can insert own pipeline runs" ON public.pipeline_runs;
DROP POLICY IF EXISTS "Users can update own pipeline runs" ON public.pipeline_runs;
DROP POLICY IF EXISTS "Users can view own pipeline runs" ON public.pipeline_runs;
DROP POLICY IF EXISTS "Users can delete own pipeline runs" ON public.pipeline_runs;
CREATE POLICY "Lab owners can view all pipeline runs" ON public.pipeline_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own pipeline runs" ON public.pipeline_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pipeline runs" ON public.pipeline_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pipeline runs" ON public.pipeline_runs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own pipeline runs" ON public.pipeline_runs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- studies
DROP POLICY IF EXISTS "Lab owners can view all studies" ON public.studies;
DROP POLICY IF EXISTS "Users can delete own studies" ON public.studies;
DROP POLICY IF EXISTS "Users can insert own studies" ON public.studies;
DROP POLICY IF EXISTS "Users can update own studies" ON public.studies;
DROP POLICY IF EXISTS "Users can view own studies" ON public.studies;
CREATE POLICY "Lab owners can view all studies" ON public.studies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own studies" ON public.studies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own studies" ON public.studies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own studies" ON public.studies FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own studies" ON public.studies FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- samples
DROP POLICY IF EXISTS "Lab owners can view all samples" ON public.samples;
DROP POLICY IF EXISTS "Users can delete own samples" ON public.samples;
DROP POLICY IF EXISTS "Users can insert own samples" ON public.samples;
DROP POLICY IF EXISTS "Users can update own samples" ON public.samples;
DROP POLICY IF EXISTS "Users can view own samples" ON public.samples;
CREATE POLICY "Lab owners can view all samples" ON public.samples FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own samples" ON public.samples FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own samples" ON public.samples FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own samples" ON public.samples FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own samples" ON public.samples FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- results
DROP POLICY IF EXISTS "Lab owners can view all results" ON public.results;
DROP POLICY IF EXISTS "Users can insert own results" ON public.results;
DROP POLICY IF EXISTS "Users can view own results" ON public.results;
DROP POLICY IF EXISTS "Users can update own results" ON public.results;
DROP POLICY IF EXISTS "Users can delete own results" ON public.results;
CREATE POLICY "Lab owners can view all results" ON public.results FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own results" ON public.results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own results" ON public.results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own results" ON public.results FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own results" ON public.results FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- dataset_samples
DROP POLICY IF EXISTS "Lab owners can view all dataset_samples" ON public.dataset_samples;
DROP POLICY IF EXISTS "Users can delete own dataset_samples" ON public.dataset_samples;
DROP POLICY IF EXISTS "Users can insert own dataset_samples" ON public.dataset_samples;
DROP POLICY IF EXISTS "Users can view own dataset_samples" ON public.dataset_samples;
CREATE POLICY "Lab owners can view all dataset_samples" ON public.dataset_samples FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own dataset_samples" ON public.dataset_samples FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = dataset_samples.dataset_id AND d.user_id = auth.uid()));
CREATE POLICY "Users can insert own dataset_samples" ON public.dataset_samples FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = dataset_samples.dataset_id AND d.user_id = auth.uid()));
CREATE POLICY "Users can delete own dataset_samples" ON public.dataset_samples FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = dataset_samples.dataset_id AND d.user_id = auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Lab owners can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Lab owners can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles permissive policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
