"""
Data preparation utilities for RNA-seq regression on tumor purity / immune scores.

This script assumes you have already downloaded cohort-level expression and target tables
from GDC/TCGA or CPTAC. It:
  - Aligns expression and targets on a common sample_id
  - Applies a log transform and per-gene z-scoring
  - Generates a leakage-safe train/val/test split using group-aware splitting
  - Emits:
      * processed_expression.parquet   (rows: sample_id, columns: features)
      * targets.parquet               (rows: sample_id with target + metadata)
      * splits.csv                    (sample_id, split)
      * features.csv                  (feature_id, gene_symbol, source)

Usage (example):

  python -m ml.data_prep_tcga_purity \\
    --expression-tsv path/to/expression.tsv \\
    --targets-tsv path/to/targets.tsv \\
    --id-column sample_id \\
    --target-column tumor_purity \\
    --output-dir ml_outputs/tcga_purity
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit


def _log(msg: str) -> None:
  print(f"[data_prep_tcga_purity] {msg}", flush=True)


def load_expression(
  path: Path,
  index_col: str | None = None,
) -> pd.DataFrame:
  """
  Load expression matrix.
  Expects either:
    - genes in rows, samples in columns (default)
    - or a tidy table that can be pivoted externally.
  """
  df = pd.read_csv(path, sep="\t")
  if index_col and index_col in df.columns:
    df = df.set_index(index_col)
  return df


def harmonize_expression(
  expr: pd.DataFrame,
  log_transform: bool = True,
) -> pd.DataFrame:
  arr = expr.to_numpy(dtype=float)
  if log_transform:
    arr = np.log2(arr + 1.0)
  # z-score per gene (row) across samples
  mean = arr.mean(axis=1, keepdims=True)
  std = arr.std(axis=1, ddof=0, keepdims=True)
  std[std == 0] = 1.0
  arr = (arr - mean) / std
  return pd.DataFrame(arr, index=expr.index, columns=expr.columns)


def make_splits(
  sample_ids: list[str],
  groups: Optional[list[str]] = None,
  train_size: float = 0.7,
  val_size: float = 0.15,
  random_state: int = 42,
) -> pd.Series:
  """
  Group-aware train/val/test split.
  groups (e.g. patient_id) prevents leakage across splits.
  """
  rng = np.random.RandomState(random_state)
  sample_ids_arr = np.array(sample_ids)
  groups_arr = np.array(groups) if groups is not None else sample_ids_arr

  splitter = GroupShuffleSplit(
    n_splits=1,
    train_size=train_size,
    random_state=random_state,
  )
  train_idx, temp_idx = next(splitter.split(sample_ids_arr, groups=groups_arr))

  remaining = sample_ids_arr[temp_idx]
  remaining_groups = groups_arr[temp_idx]
  val_fraction_of_remaining = val_size / (1.0 - train_size)

  splitter_val = GroupShuffleSplit(
    n_splits=1,
    train_size=val_fraction_of_remaining,
    random_state=random_state + 1,
  )
  val_idx_rel, test_idx_rel = next(splitter_val.split(remaining, groups=remaining_groups))
  val_idx = temp_idx[val_idx_rel]
  test_idx = temp_idx[test_idx_rel]

  split_series = pd.Series(index=sample_ids_arr, dtype="string")
  split_series.iloc[train_idx] = "train"
  split_series.iloc[val_idx] = "val"
  split_series.iloc[test_idx] = "test"
  return split_series


def main() -> None:
  parser = argparse.ArgumentParser(description="Prepare RNA-seq regression data for tumor purity / immune score.")
  parser.add_argument("--expression-tsv", type=str, required=True, help="Path to expression matrix TSV (genes x samples).")
  parser.add_argument("--targets-tsv", type=str, required=True, help="Path to targets TSV with sample_id + target.")
  parser.add_argument("--id-column", type=str, default="sample_id", help="Sample identifier column in targets file.")
  parser.add_argument("--target-column", type=str, default="tumor_purity", help="Continuous target column.")
  parser.add_argument("--group-column", type=str, default=None, help="Optional grouping column (e.g. patient_id) for leakage-safe splits.")
  parser.add_argument("--gene-id-column", type=str, default=None, help="Optional column name in expression file for gene IDs (if not index).")
  parser.add_argument("--gene-symbol-column", type=str, default=None, help="Optional column name in expression file for gene symbols.")
  parser.add_argument("--output-dir", type=str, required=True, help="Directory to write processed data.")
  parser.add_argument("--no-log-transform", action="store_true", help="Disable log2(x + 1) transform before z-scoring.")

  args = parser.parse_args()

  out_dir = Path(args.output_dir)
  out_dir.mkdir(parents=True, exist_ok=True)

  _log(f"Loading expression from {args.expression_tsv}")
  expr_raw = load_expression(Path(args.expression_tsv), index_col=args.gene_id_column)

  if args.gene_id_column and args.gene_id_column in expr_raw.columns:
    raise ValueError("When gene_id_column is provided, expression file should not keep it as a column after set_index.")

  if args.gene_symbol_column and args.gene_symbol_column in expr_raw.columns:
    # expression as wide table with gene symbols - treat index as gene_id for now
    raise ValueError("This helper expects expression as genes x samples; provide a pre-pivoted matrix.")

  _log(f"Expression shape (genes x samples): {expr_raw.shape}")

  _log(f"Loading targets from {args.targets_tsv}")
  targets = pd.read_csv(args.targets_tsv, sep="\t")
  if args.id_column not in targets.columns:
    raise KeyError(f"id-column {args.id_column} not in targets TSV")
  if args.target_column not in targets.columns:
    raise KeyError(f"target-column {args.target_column} not in targets TSV")

  targets = targets.set_index(args.id_column)
  # Align samples present in both expression (columns) and targets (rows)
  common_samples = sorted(set(expr_raw.columns).intersection(targets.index))
  _log(f"Common samples between expression and targets: {len(common_samples)}")
  if len(common_samples) < 50:
    _log("Warning: very few overlapping samples; check your IDs.")

  expr_aligned = expr_raw[common_samples]
  targets_aligned = targets.loc[common_samples].copy()

  # Drop NAs in target
  targets_aligned = targets_aligned[targets_aligned[args.target_column].notna()]
  expr_aligned = expr_aligned[targets_aligned.index]

  # Transform expression
  expr_proc = harmonize_expression(expr_aligned, log_transform=not args.no_log_transform)

  # Build group labels if provided
  groups = None
  if args.group_column and args.group_column in targets_aligned.columns:
    groups = targets_aligned[args.group_column].astype(str).tolist()

  split_series = make_splits(
    sample_ids=list(expr_proc.columns),
    groups=groups,
  )
  _log(f"Split counts:\n{split_series.value_counts()}")

  # Save processed matrices with sample_id as index for convenience
  expr_proc_T = expr_proc.T
  expr_proc_T.index.name = "sample_id"
  targets_out = targets_aligned.copy()
  targets_out.index.name = "sample_id"
  targets_out["split"] = split_series

  expr_path = out_dir / "processed_expression.parquet"
  targets_path = out_dir / "targets.parquet"
  splits_path = out_dir / "splits.csv"
  features_path = out_dir / "features.csv"

  expr_proc_T.to_parquet(expr_path)
  targets_out.to_parquet(targets_path)
  split_series.rename("split").to_csv(splits_path, index_label="sample_id")

  # Feature table: feature_id = gene index; gene_symbol left empty for now
  features_df = pd.DataFrame(
    {
      "feature_id": expr_proc.index.astype(str),
      "gene_symbol": np.nan,
      "source": "rna",
    }
  )
  features_df.to_csv(features_path, index=False)

  _log(f"Wrote {expr_path}, {targets_path}, {splits_path}, {features_path}")


if __name__ == "__main__":
  main()

