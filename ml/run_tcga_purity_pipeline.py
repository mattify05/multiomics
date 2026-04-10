"""
Container-friendly entrypoint that runs the full TCGA purity / immune score pipeline:

  1) Data prep (align expression + targets, transform, make splits)
  2) Baseline model training (Elastic Net, GBR, MLP)
  3) Metrics + evaluation artifact export (JSON)

This script is designed to be invoked by a job runner or container:

  python -m ml.run_tcga_purity_pipeline \\
    --expression-tsv /data/expression.tsv \\
    --targets-tsv /data/targets.tsv \\
    --id-column sample_id \\
    --target-column tumor_purity \\
    --work-dir /outputs/tcga_purity
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .data_prep_tcga_purity import main as prep_main
from .train_tcga_purity import main as train_main


def _log(msg: str) -> None:
  print(f"[run_tcga_purity_pipeline] {msg}", flush=True)


def main() -> None:
  parser = argparse.ArgumentParser(description="Run end-to-end TCGA purity regression pipeline.")
  parser.add_argument("--expression-tsv", type=str, required=True, help="Path to raw expression TSV.")
  parser.add_argument("--targets-tsv", type=str, required=True, help="Path to targets TSV.")
  parser.add_argument("--id-column", type=str, default="sample_id", help="Sample ID column name in targets file.")
  parser.add_argument("--target-column", type=str, default="tumor_purity", help="Target column name in targets file.")
  parser.add_argument("--group-column", type=str, default=None, help="Optional grouping column for leakage-safe splits.")
  parser.add_argument("--work-dir", type=str, required=True, help="Working/output directory (data prep + models).")
  parser.add_argument("--subgroup-column", type=str, default=None, help="Optional subgroup column for metrics (e.g. cancer_type).")

  args = parser.parse_args()
  work_dir = Path(args.work_dir)
  prep_dir = work_dir / "data"
  model_dir = work_dir / "model"

  _log("=== Step 1: data preparation ===")
  prep_args = [
    "--expression-tsv",
    args.expression_tsv,
    "--targets-tsv",
    args.targets_tsv,
    "--id-column",
    args.id_column,
    "--target-column",
    args.target_column,
    "--output-dir",
    str(prep_dir),
  ]
  if args.group_column:
    prep_args.extend(["--group-column", args.group_column])

  # Call underlying main with synthetic argv
  import sys as _sys

  old_argv = list(_sys.argv)
  try:
    _sys.argv = ["data_prep_tcga_purity"] + prep_args
    prep_main()
  finally:
    _sys.argv = old_argv

  _log("=== Step 2: model training ===")
  train_args = [
    "--data-dir",
    str(prep_dir),
    "--target-column",
    args.target_column,
    "--output-dir",
    str(model_dir),
  ]
  if args.subgroup_column:
    train_args.extend(["--subgroup-column", args.subgroup_column])

  old_argv = list(_sys.argv)
  try:
    _sys.argv = ["train_tcga_purity"] + train_args
    train_main()
  finally:
    _sys.argv = old_argv

  _log("Pipeline complete.")


if __name__ == "__main__":
  main()

