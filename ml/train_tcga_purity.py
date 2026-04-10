"""
Train baseline RNA-only regression models for tumor purity / immune scores.

Expects preprocessed outputs from data_prep_tcga_purity.py:
  - processed_expression.parquet (index: sample_id)
  - targets.parquet (index: sample_id, includes target + split + metadata)

This script fits several baselines (Elastic Net, Gradient Boosting, small MLP),
evaluates them on a held-out test set, and writes:
  - model_best.joblib
  - artifacts.json  (metrics, calibration, PR-style curve, subgroup metrics, feature importances)

Usage example:

  python -m ml.train_tcga_purity \\
    --data-dir ml_outputs/tcga_purity \\
    --target-column tumor_purity \\
    --output-dir ml_outputs/tcga_purity_models
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import ElasticNetCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.neural_network import MLPRegressor


def _log(msg: str) -> None:
  print(f"[train_tcga_purity] {msg}", flush=True)


def load_data(data_dir: Path, target_column: str) -> tuple[pd.DataFrame, pd.Series, pd.Series, pd.DataFrame]:
  expr = pd.read_parquet(data_dir / "processed_expression.parquet")  # index: sample_id
  targets = pd.read_parquet(data_dir / "targets.parquet")            # index: sample_id

  if target_column not in targets.columns:
    raise KeyError(f"Target column {target_column} not found in targets.parquet")
  if "split" not in targets.columns:
    raise KeyError("targets.parquet must contain a 'split' column (train/val/test).")

  y = targets[target_column].astype(float)
  split = targets["split"].astype(str)
  meta = targets.drop(columns=[target_column], errors="ignore")
  return expr, y, split, meta


def train_models(
  X_train: np.ndarray,
  y_train: np.ndarray,
  X_val: np.ndarray,
  y_val: np.ndarray,
) -> Dict[str, object]:
  models: Dict[str, object] = {}

  _log("Fitting ElasticNetCV")
  enet = ElasticNetCV(l1_ratio=[0.1, 0.5, 0.9], n_alphas=50, cv=5, n_jobs=-1)
  enet.fit(X_train, y_train)
  models["elastic_net"] = enet

  _log("Fitting GradientBoostingRegressor")
  gbr = GradientBoostingRegressor(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=3,
    subsample=0.9,
    random_state=42,
  )
  gbr.fit(X_train, y_train)
  models["gbr"] = gbr

  _log("Fitting MLPRegressor")
  mlp = MLPRegressor(
    hidden_layer_sizes=(128, 64),
    activation="relu",
    alpha=1e-4,
    batch_size=64,
    learning_rate_init=1e-3,
    max_iter=200,
    random_state=42,
  )
  mlp.fit(X_train, y_train)
  models["mlp"] = mlp

  _log("Validation metrics:")
  for name, model in models.items():
    y_pred = model.predict(X_val)
    rmse = mean_squared_error(y_val, y_pred, squared=False)
    mae = mean_absolute_error(y_val, y_pred)
    r2 = r2_score(y_val, y_pred)
    _log(f"  {name}: RMSE={rmse:.4f}, MAE={mae:.4f}, R2={r2:.4f}")

  return models


def select_best_model(
  models: Dict[str, object],
  X_val: np.ndarray,
  y_val: np.ndarray,
) -> str:
  scores = {}
  for name, model in models.items():
    y_pred = model.predict(X_val)
    scores[name] = mean_squared_error(y_val, y_pred, squared=False)
  best_name = min(scores, key=scores.get)
  _log(f"Best model on validation: {best_name} (RMSE={scores[best_name]:.4f})")
  return best_name


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
  rmse = mean_squared_error(y_true, y_pred, squared=False)
  mae = mean_absolute_error(y_true, y_pred)
  r2 = r2_score(y_true, y_pred)
  return {
    "rmse": float(rmse),
    "mae": float(mae),
    "r2": float(r2),
  }


def compute_calibration_bins(
  y_true: np.ndarray,
  y_pred: np.ndarray,
  n_bins: int = 10,
) -> List[Dict[str, float]]:
  order = np.argsort(y_pred)
  y_pred_sorted = y_pred[order]
  y_true_sorted = y_true[order]
  bins: List[Dict[str, float]] = []
  for i in range(n_bins):
    start = int(i * len(y_true_sorted) / n_bins)
    end = int((i + 1) * len(y_true_sorted) / n_bins)
    if end <= start:
      continue
    p_bin = y_pred_sorted[start:end].mean()
    o_bin = y_true_sorted[start:end].mean()
    bins.append(
      {
        "bin": f"{i}/{n_bins}",
        "predicted": float(p_bin),
        "observed": float(o_bin),
      }
    )
  return bins


def compute_pr_like(
  y_true: np.ndarray,
  y_pred: np.ndarray,
) -> List[Dict[str, float]]:
  """
  Derive a pseudo-PR curve by binarizing around a threshold (e.g. median target).
  This is primarily to drive UI charts; not a substitute for full probabilistic modeling.
  """
  threshold = float(np.median(y_true))
  y_true_bin = (y_true >= threshold).astype(int)
  # Sort by prediction descending
  order = np.argsort(-y_pred)
  y_true_sorted = y_true_bin[order]

  tp = 0
  fp = 0
  fn = int(y_true_bin.sum())
  points: List[Dict[str, float]] = []
  for i, label in enumerate(y_true_sorted, start=1):
    if label == 1:
      tp += 1
      fn -= 1
    else:
      fp += 1
    precision = tp / (tp + fp) if tp + fp > 0 else 1.0
    recall = tp / (tp + fn) if tp + fn > 0 else 0.0
    points.append({"precision": float(precision), "recall": float(recall)})
  return points


def compute_subgroup_metrics(
  y_true: np.ndarray,
  y_pred: np.ndarray,
  meta: pd.DataFrame,
  column: str,
) -> List[Dict[str, float]]:
  out: List[Dict[str, float]] = []
  if column not in meta.columns:
    return out
  groups = meta[column].astype(str)
  for group_name, idx in groups.groupby(groups).groups.items():
    idx_list = list(idx)
    if len(idx_list) < 10:
      continue
    m = compute_metrics(y_true[idx_list], y_pred[idx_list])
    out.append(
      {
        "subgroup": group_name,
        "n": float(len(idx_list)),
        "auc": float("nan"),
        "f1": float("nan"),
        "rmse": m["rmse"],
        "mae": m["mae"],
        "r2": m["r2"],
      }
    )
  return out


def compute_feature_importance(
  model: object,
  feature_ids: List[str],
) -> List[Dict[str, object]]:
  if hasattr(model, "coef_"):
    coef = np.array(model.coef_).ravel()
    scores = np.abs(coef)
    signs = np.sign(coef)
  elif hasattr(model, "feature_importances_"):
    scores = np.array(model.feature_importances_)
    signs = np.ones_like(scores)
  else:
    return []

  order = np.argsort(-scores)[:50]
  out: List[Dict[str, object]] = []
  for idx in order:
    out.append(
      {
        "feature_id": feature_ids[idx],
        "gene_symbol": None,
        "shap": float(scores[idx]),
        "direction": "positive" if signs[idx] >= 0 else "negative",
      }
    )
  return out


def main() -> None:
  parser = argparse.ArgumentParser(description="Train RNA-only regression baselines for tumor purity / immune scores.")
  parser.add_argument("--data-dir", type=str, required=True, help="Directory containing processed_expression.parquet and targets.parquet.")
  parser.add_argument("--target-column", type=str, default="tumor_purity", help="Target column in targets.parquet.")
  parser.add_argument("--output-dir", type=str, required=True, help="Directory to write model + artifacts.")
  parser.add_argument("--subgroup-column", type=str, default=None, help="Optional column in targets.parquet for subgroup metrics (e.g. cancer_type).")

  args = parser.parse_args()

  data_dir = Path(args.data_dir)
  out_dir = Path(args.output_dir)
  out_dir.mkdir(parents=True, exist_ok=True)

  expr, y, split, meta = load_data(data_dir, args.target_column)
  feature_ids = list(expr.columns.astype(str))

  train_mask = split == "train"
  val_mask = split == "val"
  test_mask = split == "test"

  X_train = expr.loc[train_mask].to_numpy(dtype=float)
  y_train = y.loc[train_mask].to_numpy(dtype=float)
  X_val = expr.loc[val_mask].to_numpy(dtype=float)
  y_val = y.loc[val_mask].to_numpy(dtype=float)
  X_test = expr.loc[test_mask].to_numpy(dtype=float)
  y_test = y.loc[test_mask].to_numpy(dtype=float)

  _log(f"Train/val/test sizes: {X_train.shape[0]}, {X_val.shape[0]}, {X_test.shape[0]}")

  models = train_models(X_train, y_train, X_val, y_val)
  best_name = select_best_model(models, X_val, y_val)
  best_model = models[best_name]

  # Evaluate on full test set
  y_pred_test = best_model.predict(X_test)
  metrics = compute_metrics(y_test, y_pred_test)
  calibration_bins = compute_calibration_bins(y_test, y_pred_test)
  pr_curve = compute_pr_like(y_test, y_pred_test)

  subgroup_metrics = []
  if args.subgroup_column:
    subgroup_metrics = compute_subgroup_metrics(
      y_test,
      y_pred_test,
      meta.loc[test_mask],
      args.subgroup_column,
    )

  top_features = compute_feature_importance(best_model, feature_ids)

  artifacts = {
    "model_name": best_name,
    "metrics": metrics,
    "calibration_bins": calibration_bins,
    "pr_curve": pr_curve,
    "subgroup_metrics": subgroup_metrics,
    "top_features": top_features,
  }

  artifacts_path = out_dir / "artifacts.json"
  with artifacts_path.open("w") as f:
    json.dump(artifacts, f, indent=2)

  model_path = out_dir / "model_best.joblib"
  joblib.dump(best_model, model_path)

  _log(f"Wrote {model_path} and {artifacts_path}")


if __name__ == "__main__":
  main()

