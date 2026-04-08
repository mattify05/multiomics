-- Studies, organizations, samples, and dataset–sample linkage (Phase B + E foundations)

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS client_request_id TEXT;

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON public.organizations FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'lab_owner')
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organizations.id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "org_insert" ON public.organizations FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "org_update" ON public.organizations FOR UPDATE
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'lab_owner'));

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "om_select" ON public.organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'lab_owner')
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.organization_id AND o.created_by = auth.uid()
    )
  );

CREATE POLICY "om_insert" ON public.organization_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR public.has_role(auth.uid(), 'lab_owner'))
    )
  );

CREATE TABLE public.studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studies_select" ON public.studies FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'lab_owner')
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.organization_id = studies.organization_id AND m.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "studies_insert" ON public.studies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "studies_update" ON public.studies FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'lab_owner'));

CREATE POLICY "studies_delete" ON public.studies FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'lab_owner'));

CREATE TABLE public.samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  timepoint TEXT NOT NULL DEFAULT '',
  biospecimen_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (study_id, subject_id, timepoint)
);
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "samples_select" ON public.samples FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'lab_owner')
    OR EXISTS (
      SELECT 1 FROM public.studies s
      WHERE s.id = samples.study_id
        AND (
          s.user_id = auth.uid()
          OR (
            s.organization_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.organization_members m
              WHERE m.organization_id = s.organization_id AND m.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "samples_insert" ON public.samples FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "samples_update" ON public.samples FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'lab_owner'));

CREATE POLICY "samples_delete" ON public.samples FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'lab_owner'));

CREATE TABLE public.dataset_samples (
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  sample_id UUID NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  PRIMARY KEY (dataset_id, sample_id)
);
ALTER TABLE public.dataset_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ds_samples_select" ON public.dataset_samples FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = dataset_id AND (d.user_id = auth.uid() OR public.has_role(auth.uid(), 'lab_owner'))
    )
  );

CREATE POLICY "ds_samples_insert" ON public.dataset_samples FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = dataset_id AND d.user_id = auth.uid())
  );

CREATE POLICY "ds_samples_delete" ON public.dataset_samples FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = dataset_id AND d.user_id = auth.uid())
  );

ALTER TABLE public.datasets
  ADD COLUMN IF NOT EXISTS study_id UUID REFERENCES public.studies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE POLICY "datasets_org_select" ON public.datasets FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = datasets.organization_id AND m.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_studies_updated_at BEFORE UPDATE ON public.studies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER audit_studies AFTER INSERT OR UPDATE OR DELETE ON public.studies
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_samples AFTER INSERT OR UPDATE OR DELETE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_dataset_samples AFTER INSERT OR UPDATE OR DELETE ON public.dataset_samples
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_organizations AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_organization_members AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
