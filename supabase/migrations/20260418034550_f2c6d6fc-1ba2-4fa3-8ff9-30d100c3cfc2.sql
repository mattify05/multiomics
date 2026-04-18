
-- 1) Replace the broad ALL policy on user_roles with safer per-action policies
DROP POLICY IF EXISTS "Lab owners can manage roles" ON public.user_roles;

-- Lab owners can read all role assignments
CREATE POLICY "Lab owners can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'lab_owner'));

-- Lab owners can insert roles, but never the lab_owner role (must be done via service_role)
CREATE POLICY "Lab owners can grant non-elevated roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'lab_owner')
  AND role <> 'lab_owner'::public.app_role
);

-- Lab owners can update roles, but cannot change a row TO lab_owner
CREATE POLICY "Lab owners can update non-elevated roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'lab_owner'))
WITH CHECK (
  public.has_role(auth.uid(), 'lab_owner')
  AND role <> 'lab_owner'::public.app_role
);

-- Lab owners can delete role assignments, but cannot delete their own row
CREATE POLICY "Lab owners can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'lab_owner')
  AND user_id <> auth.uid()
);

-- 2) Missing UPDATE policy on omics-data bucket: only owner of the user-folder can update
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'omics-data'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'omics-data'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
