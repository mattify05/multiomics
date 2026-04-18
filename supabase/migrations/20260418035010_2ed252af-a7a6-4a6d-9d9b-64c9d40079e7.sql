
-- Audit log is populated only by SECURITY DEFINER trigger (audit_trigger_func).
-- Remove the user-facing INSERT policy so users cannot inject false records.
DROP POLICY IF EXISTS "Authenticated users trigger audit log" ON public.audit_log;
