

The user wants a concrete operational playbook for the next phase: getting real ML training running end-to-end on the deployed Fly worker. They need three things: (1) what data to use and where it goes, (2) how to launch + observe a run, (3) what training actually happens under the hood.

Let me check what training code is wired up and what data contracts exist.

Key facts from context:
- Worker deployed at `ML_SPATIAL_API_URL` (Fly), secrets all set
- Tabular path: UI → `pipeline-orchestrator` edge fn → POST `ML_TRAINING_WEBHOOK_URL` (`/internal/tabular/train`) with `experiment_id` + `job_id` + `X-Training-Webhook-Secret` → worker calls `run_tabularExperiment_job` → loads file from `omics-data` bucket via `datasets.file_path` → trains → writes back to `experiments`/`jobs`/`results` using `SUPABASE_SERVICE_ROLE_KEY`
- Data contract (`ml/tabular_training/spec.py`): one row per sample, `sample_id` index, numeric feature columns, label column from `hyperparameters.label_column`, optional `patient_id_column` for grouped split, `.parquet`/`.csv`/`.tsv`
- Models available: ElasticNet/GBR/MLP (regression in `train_tcga_purity.py`); tabular job_runner uses `build_estimator(model_name)` for classification
- Storage: `omics-data` bucket, files must live under `<auth.uid()>/...` per RLS update policy
- UI: `MLExperiments.tsx` already calls orchestrator with `launch_experiment`; pipeline must be created first via `PipelineBuilder`
- Spatial path: separate `dispatch_spatial` action → `/run/spatial/{sprint}` endpoints

This is a documentation/runbook request, not a build task. No code changes needed — present a plan that IS the runbook.

---

# Track 3 next step: First end-to-end ML training run

## A. What data, what shape, where it goes

**Tabular (clinical-outcome classification — the wired path):**

Required file format (`ml/tabular_training/spec.py`):
- `.parquet` (preferred), `.csv`, or `.tsv`
- One row per analytical sample
- Column or index named `sample_id`
- All other columns numeric features (auto-coerced, NaN→0)
- One label column (binary 0/1 or string class) — name chosen at experiment launch
- Optional `patient_id` column → triggers `GroupShuffleSplit` (no patient leakage)

**Smallest viable test file** (~50 samples × ~200 features) is enough to prove the pipeline. A real first dataset: any TCGA expression subset with a binary outcome (e.g. responder/non-responder, stage I-II vs III-IV).

**Where it goes:**
1. Log in to the app → **Data Manager** → upload via `DatasetUploadForm`
2. The form writes the file to Storage at `omics-data/<your-user-id>/<dataset-id>/<filename>` and creates a `datasets` row with `file_path` pointing at it
3. RLS guarantees only you (and lab_owners) can read it; the worker uses the service-role key so it bypasses RLS

**Spatial (`.h5ad`):** path-based, not uploaded through the UI yet. Worker needs the `.h5ad` already on its filesystem (or a future signed-URL fetch). For first runs use the synthetic generator: `python ml/data_pack/make_synthetic_spatial_h5ad.py` baked into the Fly image, or skip spatial for this milestone.

## B. How to launch an experiment and watch it run

**Launch (UI flow):**
1. **Pipeline Builder** → select the uploaded dataset(s) → Launch Pipeline (creates `pipeline_runs` row)
2. **ML Experiments** → pick that pipeline → choose model (`xgboost`, `random_forest`, `mlp`, etc.) → fill hyperparameters: `label_column`, optional `patient_id_column`, `train_test_split` (e.g. `"80/20"`), `seed` → Launch Training
3. UI calls `pipeline-orchestrator` with `action: "launch_experiment"` → edge fn inserts `experiments` + `jobs` rows and POSTs `{experiment_id, job_id}` to the Fly worker with `X-Training-Webhook-Secret`

**Observe (3 places, in order of usefulness):**

| Where | What you see | How |
|---|---|---|
| ML Experiments page | Status (queued→running→completed/failed), AUC/F1 once done, recent job log lines | Auto-polls; refresh if stale |
| Fly worker logs | Worker-side stack traces, training progress, webhook-receipt confirmation | `fly logs -a <app-name>` from local terminal, or Fly dashboard → Live Logs |
| Edge function logs | Whether the webhook actually fired and what status Fly returned | Lovable Cloud → Functions → `pipeline-orchestrator` → Logs (or I can pull them via `supabase--edge_function_logs`) |

**Debug ladder when something fails:**
1. Experiment stuck in `queued` → edge function never called Fly. Check edge logs for `ML_TRAINING_WEBHOOK_URL` errors.
2. Experiment goes `running` then `failed` → worker received it. Check `fly logs` for the Python traceback and the `jobs.logs` array (visible in UI) for the `_fail` message.
3. 401 from worker → `ML_TRAINING_WEBHOOK_SECRET` mismatch between Lovable Cloud and Fly.
4. Worker can't read dataset → service role key wrong, or `file_path` doesn't exist in `omics-data` bucket.

## C. What training actually happens

Inside `run_tabularExperiment_job` (`ml/tabular_training/job_runner.py`):

```text
1. Read experiments + jobs row (status → running)
2. Resolve datasets[*].file_path → download from omics-data bucket
3. load_feature_table() → pandas DataFrame
4. feature_label_split(label_column, patient_id_column)
   → X (numeric), y (label), groups (optional)
5. Split:
     if groups present → GroupShuffleSplit(test_size = parsed from "80/20")
     else            → train_test_split(stratify=y)
6. build_estimator(model_name, random_state):
     - logistic_regression / random_forest / xgboost / mlp
     - MLP gets wrapped in StandardScaler pipeline
7. estimator.fit(X_train, y_train)
8. evaluate_binary_or_multiclass(estimator, X_test, y_test):
     - AUC, F1, accuracy, confusion matrix
     - permutation feature importance (top-N) → xai_report
9. Write back via service-role client:
     - results: { evaluation, xai_report }
     - experiments: status=completed, metrics={auc,f1,...}, runtime
     - jobs: status=completed, logs append
10. On any exception → _fail() marks experiment + job failed and writes the error to logs
```

Models live in `ml/tabular_training/models.py` (`build_estimator`); metrics in `metrics.py`. To add a model, extend `build_estimator` — no UI change needed beyond adding it to `modelCatalogue` in `MLExperiments.tsx`.

## D. Recommended first run (concrete)

1. Generate a tiny synthetic CSV locally:
   - 100 rows × 50 numeric columns + `label` (0/1) + `sample_id`
2. Upload it via Data Manager
3. Pipeline Builder → just that one dataset → Launch
4. ML Experiments → model: `random_forest`, `label_column: "label"`, split: `80/20`, seed: `42` → Launch
5. Open Fly logs in one tab, ML Experiments in another — should complete in <30s
6. Click the completed experiment → Model Card downloads, AUC/F1 visible

Once this green-paths, swap in a real TCGA-derived parquet and repeat.

## E. What I'll do next (after you approve)

Pick one as the immediate next implementation pass:
1. **Build the synthetic test CSV + a "Run smoke test" button** on ML Experiments that uploads it and launches a canonical experiment in one click — fastest path to a verified end-to-end run.
2. **Wire live job-log streaming** (poll `jobs.logs` every 2s while status is `running`) so you can watch worker progress in the UI without `fly logs`.
3. **Add a Fly-logs deep link + edge-function-logs deep link** on each experiment row for one-click debugging.
4. Just run a real training now using existing UI — I'll guide you live and watch logs via the Supabase tools.

