from __future__ import annotations

import os
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml.tabular_training import spec
from ml.tabular_training.io import ensure_sample_id_index, feature_label_split, load_feature_table
from ml.tabular_training.metrics import encode_labels, evaluate_binary_or_multiclass, top_feature_scores
from ml.tabular_training.models import build_estimator


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_log(client: Any, job_id: str, line: str) -> None:
    row = client.table("jobs").select("logs").eq("id", job_id).single().execute()
    current = row.data.get("logs") if row.data else None
    logs = list(current) if isinstance(current, list) else []
    logs.append({"ts": _now_iso(), "line": line})
    client.table("jobs").update({"logs": logs, "updated_at": _now_iso()}).eq("id", job_id).execute()


def _fail(
    client: Any,
    experiment_id: str,
    job_id: str,
    msg: str,
) -> None:
    _append_log(client, job_id, f"ERROR: {msg}")
    client.table("experiments").update(
        {
            "status": "failed",
            "completed_at": _now_iso(),
            "runtime": "tabular_worker",
            "metrics": {"error": msg},
        }
    ).eq("id", experiment_id).execute()
    client.table("jobs").update(
        {"status": "failed", "completed_at": _now_iso(), "updated_at": _now_iso()}
    ).eq("id", job_id).execute()


def _parse_test_fraction(train_test_split_str: str) -> float:
    s = (train_test_split_str or "80/20").strip()
    parts = s.split("/")
    if len(parts) != 2:
        return 0.2
    try:
        a, b = float(parts[0]), float(parts[1])
        return b / (a + b)
    except ValueError:
        return 0.2


def run_tabular_experiment_job(*, experiment_id: str, job_id: str) -> None:
    """
    Load datasets from Storage, train a tabular classifier, write metrics and results.
    Expects ``SUPABASE_URL`` and ``SUPABASE_SERVICE_ROLE_KEY`` in the environment.
    """
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tabular training")

    from supabase import create_client

    client = create_client(url, key)

    try:
        exp_res = client.table("experiments").select("*").eq("id", experiment_id).single().execute()
        if not exp_res.data:
            raise RuntimeError("experiment not found")
        exp = exp_res.data
        hp = exp.get("hyperparameters") or {}
        if isinstance(hp, str):
            import json

            hp = json.loads(hp)

        job_res = client.table("jobs").select("*").eq("id", job_id).single().execute()
        if not job_res.data:
            raise RuntimeError("job not found")
        job = job_res.data
        if str(job.get("experiment_id")) != str(experiment_id):
            raise RuntimeError("job experiment_id mismatch")

        user_id = exp["user_id"]
        model_name = exp.get("model") or "LogisticRegression"

        _append_log(client, job_id, "tabular_worker: resolved experiment and job")
        client.table("jobs").update({"status": "running", "started_at": _now_iso()}).eq("id", job_id).execute()

        dataset_ids: List[str] = list(hp.get(spec.HP_DATASET_IDS) or [])
        if not dataset_ids and exp.get("pipeline_run_id"):
            pr = (
                client.table("pipeline_runs")
                .select("dataset_ids")
                .eq("id", exp["pipeline_run_id"])
                .single()
                .execute()
            )
            raw = (pr.data or {}).get("dataset_ids") or []
            dataset_ids = [str(x) for x in raw]

        if not dataset_ids:
            _fail(
                client,
                experiment_id,
                job_id,
                "No dataset_ids: set pipeline run with dataset_ids or pass dataset_ids from launch_experiment",
            )
            return

        primary_id = dataset_ids[0]
        if len(dataset_ids) > 1:
            _append_log(client, job_id, f"tabular_worker: using first of {len(dataset_ids)} datasets ({primary_id})")

        ds_res = client.table("datasets").select("id,file_path").eq("id", primary_id).single().execute()
        if not ds_res.data or not ds_res.data.get("file_path"):
            _fail(client, experiment_id, job_id, f"dataset {primary_id} missing file_path")
            return

        file_path = ds_res.data["file_path"]
        _append_log(client, job_id, f"tabular_worker: downloading {file_path}")

        bucket = client.storage.from_(spec.OMICS_DATA_BUCKET)
        try:
            raw_bytes = bucket.download(file_path)
        except Exception as e:
            _fail(client, experiment_id, job_id, f"storage download failed: {e}")
            return

        df = load_feature_table(file_path, content=raw_bytes)
        df = ensure_sample_id_index(df)

        label_col = hp.get(spec.HP_LABEL_COLUMN) or hp.get(spec.HP_TARGET_VARIABLE)
        if not label_col:
            _fail(client, experiment_id, job_id, "hyperparameters must include label_column or target_variable")
            return

        patient_col = hp.get(spec.HP_PATIENT_ID_COLUMN)
        if patient_col in ("", None):
            patient_col = None
        if isinstance(patient_col, str) and patient_col.lower() in ("none", "null"):
            patient_col = None

        X, y_raw, groups = feature_label_split(df.reset_index(), label_col, patient_col)
        if X.shape[0] < 10 or X.shape[1] < 1:
            _fail(client, experiment_id, job_id, f"insufficient data after feature extraction: {X.shape}")
            return

        y_enc, le = encode_labels(y_raw.values)
        seed = int(hp.get(spec.HP_SEED, 42))
        test_frac = _parse_test_fraction(str(hp.get(spec.HP_TRAIN_TEST_SPLIT, "80/20")))
        stratify = bool(hp.get(spec.HP_STRATIFY, True))

        if groups is not None:
            gss = GroupShuffleSplit(n_splits=1, test_size=test_frac, random_state=seed)
            grp = np.asarray(groups)
            train_idx, test_idx = next(gss.split(X, y_enc, grp))
            X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
            y_train, y_test = y_enc[train_idx], y_enc[test_idx]
            _append_log(client, job_id, "tabular_worker: split by patient_id groups")
        else:
            strat = y_enc if stratify and len(np.unique(y_enc)) > 1 else None
            X_train, X_test, y_train, y_test = train_test_split(
                X, y_enc, test_size=test_frac, random_state=seed, stratify=strat
            )
            _append_log(client, job_id, "tabular_worker: random stratified split")

        rs = seed
        estimator = build_estimator(model_name, rs)
        if "mlp" in model_name.lower() or "late fusion" in model_name.lower():
            clf: Any = Pipeline(
                [
                    ("scaler", StandardScaler()),
                    ("clf", estimator),
                ]
            )
        else:
            clf = estimator

        _append_log(client, job_id, f"tabular_worker: fitting {model_name} on {X_train.shape}")
        clf.fit(X_train.values, y_train)

        y_pred = clf.predict(X_test.values)
        y_proba: Optional[np.ndarray] = None
        if hasattr(clf, "predict_proba"):
            try:
                y_proba = clf.predict_proba(X_test.values)
            except Exception:
                y_proba = None
        elif hasattr(clf, "decision_function"):
            try:
                dfm = clf.decision_function(X_test.values)
                y_proba = np.asarray(dfm)
                if y_proba.ndim == 1:
                    y_proba = np.column_stack([-y_proba, y_proba])
            except Exception:
                y_proba = None

        metrics_eval = evaluate_binary_or_multiclass(y_test, y_pred, y_proba, le)
        top_feats = top_feature_scores(X_train.values, y_train, list(X_train.columns), k=15)

        shap_like = [
            {
                "name": t["name"],
                "shap": float(min(t["importance"] / (top_feats[0]["importance"] + 1e-9), 1.0)),
                "direction": "positive",
            }
            for t in top_feats[:8]
        ]

        auc = metrics_eval.get("auc")
        f1v = metrics_eval.get("f1", 0.0)
        metrics: Dict[str, Any] = {
            "auc": float(auc) if auc is not None else None,
            "f1": float(f1v),
            "pr_auc": None,
            "calibration": {"brier": None},
            "confusion_matrix": metrics_eval.get("confusion_matrix", []),
            "train_test_split": hp.get(spec.HP_TRAIN_TEST_SPLIT, "80/20"),
            "cv_strategy": "single_holdout",
            "seed": seed,
            "warnings": [],
            "n_train": int(len(y_train)),
            "n_test": int(len(y_test)),
            "n_features": int(X.shape[1]),
            "label_column": label_col,
        }

        eval_data = {
            "umap": [],
            "top_features": top_feats,
        }
        xai_data = {
            "shap": shap_like,
            "pathways": [],
            "sample_waterfall": {
                "base": 0.5,
                "prediction": float(np.mean(y_pred == y_test)),
                "label": str(le.classes_[0]),
                "sample_id": "holdout_aggregate",
            },
        }

        client.table("results").insert(
            [
                {
                    "user_id": user_id,
                    "experiment_id": experiment_id,
                    "result_type": "evaluation",
                    "data": eval_data,
                },
                {
                    "user_id": user_id,
                    "experiment_id": experiment_id,
                    "result_type": "xai_report",
                    "data": xai_data,
                },
            ]
        ).execute()

        client.table("experiments").update(
            {
                "status": "completed",
                "completed_at": _now_iso(),
                "metrics": metrics,
                "runtime": "tabular_worker",
            }
        ).eq("id", experiment_id).execute()

        client.table("jobs").update(
            {
                "status": "completed",
                "completed_at": _now_iso(),
                "updated_at": _now_iso(),
                "worker_version": "tabular-worker-v1",
            }
        ).eq("id", job_id).execute()

        _append_log(client, job_id, "tabular_worker: completed successfully")

    except Exception as e:
        tb = traceback.format_exc()
        try:
            _fail(client, experiment_id, job_id, f"{e}\n{tb}")
        except Exception:
            raise e from None


def verify_webhook_secret(header_value: str | None) -> bool:
    expected = os.environ.get("ML_TRAINING_WEBHOOK_SECRET", "").strip()
    if not expected:
        return False
    if not header_value:
        return False
    import hmac

    return hmac.compare_digest(header_value.strip(), expected)
