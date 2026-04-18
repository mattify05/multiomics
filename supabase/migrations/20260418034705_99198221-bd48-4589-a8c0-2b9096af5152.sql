
-- Block self-targeting on user_roles INSERT
DROP POLICY IF EXISTS "Lab owners can grant non-elevated roles" ON public.user_roles;

CREATE POLICY "Lab owners can grant non-elevated roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'lab_owner')
  AND role <> 'lab_owner'::public.app_role
  AND user_id <> auth.uid()
);

-- Owners can delete their own experiments
CREATE POLICY "Users can delete own experiments"
ON public.experiments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Owners can delete their own pipeline runs
CREATE POLICY "Users can delete own pipeline runs"
ON public.pipeline_runs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Owners can update and delete their own results
CREATE POLICY "Users can update own results"
ON public.results
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own results"
ON public.results
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
