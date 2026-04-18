
-- Re-scope audit_log SELECT
DROP POLICY IF EXISTS "Lab owners can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated users trigger audit log" ON public.audit_log;
CREATE POLICY "Lab owners can view audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'lab_owner'));
CREATE POLICY "Authenticated users trigger audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Consolidate user_roles restrictive policies into one
DROP POLICY IF EXISTS "Block self-assignment and lab_owner via app" ON public.user_roles;
DROP POLICY IF EXISTS "Only lab owners can insert roles" ON public.user_roles;

CREATE POLICY "Restrict role inserts to lab owners only"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'lab_owner')
  AND user_id <> auth.uid()
  AND role <> 'lab_owner'::public.app_role
);
