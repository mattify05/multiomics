
DROP POLICY IF EXISTS "Lab owners can update non-elevated roles" ON public.user_roles;

CREATE POLICY "Lab owners can update non-elevated roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'lab_owner')
  AND user_id <> auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'lab_owner')
  AND role <> 'lab_owner'::public.app_role
  AND user_id <> auth.uid()
);
