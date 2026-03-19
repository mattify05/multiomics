
DROP TRIGGER IF EXISTS audit_datasets ON public.datasets;
DROP TRIGGER IF EXISTS audit_experiments ON public.experiments;
DROP TRIGGER IF EXISTS audit_pipeline_runs ON public.pipeline_runs;
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
DROP TRIGGER IF EXISTS audit_results ON public.results;

CREATE TRIGGER audit_datasets AFTER INSERT OR UPDATE OR DELETE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_experiments AFTER INSERT OR UPDATE OR DELETE ON public.experiments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_pipeline_runs AFTER INSERT OR UPDATE OR DELETE ON public.pipeline_runs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_results AFTER INSERT OR UPDATE OR DELETE ON public.results FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
