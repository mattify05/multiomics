

# Implementation Plan: Data Manager, Audit Triggers, and Auth Testing

## Overview
Wire the Data Manager to the real database with file uploads, add audit triggers to all data tables, and verify the auth flow works correctly. Pipeline Builder and ML Experiments remain unchanged (mock data).

## Step 1: Wire Data Manager to Real Database

**Data Manager page (`src/pages/DataManager.tsx`)** -- replace mock data with live queries:

- **Library tab**: Fetch datasets from `datasets` table using `supabase.from("datasets").select("*")`. Keep search/modality filtering client-side.
- **Upload tab**: 
  - Use a file input to upload files to the `omics-data` storage bucket via `supabase.storage.from("omics-data").upload()`
  - On successful upload, insert a row into `datasets` with `user_id = auth.uid()`, file path, metadata from the form fields (modality, cohort, samples, features)
  - Show upload progress and success/error toasts
- **Delete/manage**: Add ability to delete own datasets
- Add loading and empty states

## Step 2: Add Audit Triggers

**Database migration** to attach the existing `audit_trigger_func()` to all primary tables:

```sql
CREATE TRIGGER audit_datasets AFTER INSERT OR UPDATE OR DELETE ON datasets FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_experiments AFTER INSERT OR UPDATE OR DELETE ON experiments FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_pipeline_runs AFTER INSERT OR UPDATE OR DELETE ON pipeline_runs FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_results AFTER INSERT OR UPDATE OR DELETE ON results FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

No code changes needed -- the existing Audit Log page will automatically show entries from these triggers.

## Step 3: Auth Flow Verification

No additional information needed. I will:
- Review the Login, Signup, Forgot Password, and Reset Password pages for correctness
- Check the `AuthContext` session handling and `ProtectedRoute` logic
- Verify redirect URLs and error handling
- Fix any issues found (e.g., missing error states, redirect bugs)

## Files Changed
| File | Change |
|------|--------|
| `src/pages/DataManager.tsx` | Replace mock data with real DB queries + file upload |
| New migration SQL | Add audit triggers to 5 tables |
| Auth pages (if fixes needed) | Bug fixes from review |

