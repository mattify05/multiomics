
-- RESTRICTIVE policy: applies in addition to all permissive policies.
-- This blocks any user (including lab_owners) from inserting a row that
-- (a) assigns the lab_owner role, or (b) targets themselves.
-- Combined with permissive policies, this means:
--   * Lab owners can only grant non-lab_owner roles to OTHER users.
--   * No one can self-assign any role through normal app traffic.
--   * Promoting a user to lab_owner must happen via service_role
--     (which bypasses RLS) — i.e. backend admin action only.
CREATE POLICY "Block self-assignment and lab_owner via app"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  user_id <> auth.uid()
  AND role <> 'lab_owner'::public.app_role
);
