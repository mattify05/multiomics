
-- Fix 1: Set search_path on update_updated_at and audit_trigger_func
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix 2: Replace permissive audit_log INSERT policy with user-scoped check
DROP POLICY "System can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users trigger audit log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
