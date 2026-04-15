#!/usr/bin/env python3
"""
Pilot baseline trainer for Track A (niche / domain classification).

Loads one or more .h5ad files from the splits manifest, uses the active label
key (default: niche_pseudo from Sprint 2 Leiden), fits a logistic regression
on PCA features, and reports Macro-F1 + per-class metrics.

This is an *engineering validation* of the training loop, data contract, and
artifact output — not a production model claim.

Usage:
  export PYTHONPATH="${PWD}"

  # Generate labels first (Sprint 2 writes obs["niche"]):
  python ml/spatial/train_pilot.py

  # With explicit manifest + options:
  python ml/spatial/train_pilot.py \\
      --manifest ml/spatial/splits_manifest.yaml \\
      --max-obs 5000 --n-pcs 30 --fast

Output:
  Prints JSON metrics to stdout and writes artifacts to ml/spatial/pilot_results/
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import yaml


def _load_manifest(path: Path) -> Dict[str, Any]:
    with open(path) as f:
        return yaml.safe_load(f)


def _load_slides(
    entries: List[Dict[str, Any]],
    label_key: str,
    max_obs: Optional[int],
    seed: int,
) -> Any:
    """Load and concatenate h5ad files for a split, adding niche_pseudo if needed."""
    import anndata as ad
    import scanpy as sc

    from ml.spatial.h5ad_load import subsample_obs

    parts = []
    for entry in entries:
        h5ad_path = Path(entry["h5ad"])
        if not h5ad_path.is_file():
            print(f"WARNING: skipping {entry['id']}, file not found: {h5ad_path}", file=sys.stderr)
            continue
        adata = ad.read_h5ad(h5ad_path)
        adata = subsample_obs(adata, max_obs, seed)

        if label_key not in adata.obs.columns:
            print(
                f"  [{entry['id']}] label '{label_key}' not in obs — running Sprint 2 Leiden to generate it",
                file=sys.stderr,
            )
            adata = _generate_niche_pseudo(adata)

        adata.obs["_split_slide_id"] = entry["id"]
        parts.append(adata)

    if not parts:
        raise RuntimeError("No slides loaded — check manifest paths")
    if len(parts) == 1:
        return parts[0]
    return ad.concat(parts, join="inner", label="_concat_batch", keys=[e["id"] for e in entries])


def _generate_niche_pseudo(adata: Any) -> Any:
    """Run a lightweight Sprint 2–style Leiden to create obs['niche_pseudo']."""
    import scanpy as sc
    import squidpy as sq

    from ml.spatial.leiden_utils import leiden_kwds

    a = adata.copy()
    sc.pp.normalize_total(a, target_sum=1e4)
    sc.pp.log1p(a)
    sk = "spatial" if "spatial" in a.obsm else ("X_spatial" if "X_spatial" in a.obsm else None)
    if sk is None:
        a.obsm["spatial"] = np.column_stack([np.arange(a.n_obs), np.zeros(a.n_obs)])
    elif sk != "spatial":
        a.obsm["spatial"] = np.asarray(a.obsm[sk])
    sq.gr.spatial_neighbors(a, coord_type="generic", spatial_key="spatial", n_neighs=6)
    sc.tl.leiden(a, resolution=0.8, adjacency=a.obsp["spatial_connectivities"], key_added="niche", **leiden_kwds())
    adata.obs["niche_pseudo"] = a.obs["niche"].astype(str).values
    return adata


def _preprocess_for_pca(adata: Any, n_hvg: int, n_pcs: int) -> Any:
    """Normalize, HVG, scale, PCA — return adata with X_pca."""
    import scanpy as sc

    a = adata.copy()
    sc.pp.filter_cells(a, min_genes=20)
    sc.pp.filter_genes(a, min_cells=3)
    sc.pp.normalize_total(a, target_sum=1e4)
    sc.pp.log1p(a)
    hvg_cap = min(n_hvg, a.n_vars)
    if hvg_cap > 10:
        sc.pp.highly_variable_genes(a, n_top_genes=hvg_cap, subset=True)
    sc.pp.scale(a, max_value=10)
    actual_pcs = min(n_pcs, a.n_obs - 1, a.n_vars)
    sc.tl.pca(a, n_comps=max(2, actual_pcs), svd_solver="arpack")
    return a


def _spatial_block_split(
    adata: Any,
    label_key: str,
    val_frac: float = 0.15,
    test_frac: float = 0.15,
    seed: int = 42,
) -> Tuple[Any, Any, Any]:
    """For single-slide dev: split by spatial blocks (quadrants)."""
    coords = None
    for k in ("spatial", "X_spatial"):
        if k in adata.obsm:
            coords = np.asarray(adata.obsm[k])[:, :2]
            break
    if coords is None:
        coords = np.column_stack([np.arange(adata.n_obs), np.zeros(adata.n_obs)])

    mid_x = np.median(coords[:, 0])
    mid_y = np.median(coords[:, 1])
    quadrant = np.zeros(adata.n_obs, dtype=int)
    quadrant[(coords[:, 0] >= mid_x) & (coords[:, 1] < mid_y)] = 1
    quadrant[(coords[:, 0] < mid_x) & (coords[:, 1] >= mid_y)] = 2
    quadrant[(coords[:, 0] >= mid_x) & (coords[:, 1] >= mid_y)] = 3

    rng = np.random.default_rng(seed)
    q_order = rng.permutation(4)
    n_val_q = max(1, int(round(4 * val_frac)))
    n_test_q = max(1, int(round(4 * test_frac)))
    test_qs = set(q_order[:n_test_q].tolist())
    val_qs = set(q_order[n_test_q : n_test_q + n_val_q].tolist())
    train_qs = set(range(4)) - test_qs - val_qs
    if not train_qs:
        train_qs = {q_order[-1]}

    train_mask = np.isin(quadrant, list(train_qs))
    val_mask = np.isin(quadrant, list(val_qs))
    test_mask = np.isin(quadrant, list(test_qs))

    return adata[train_mask].copy(), adata[val_mask].copy(), adata[test_mask].copy()


def train_and_eval(
    manifest: Dict[str, Any],
    max_obs: Optional[int],
    n_hvg: int,
    n_pcs: int,
    seed: int,
) -> Dict[str, Any]:
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        balanced_accuracy_score,
        classification_report,
        f1_score,
    )

    label_cfg = manifest.get("label", {})
    label_key = label_cfg.get("active_key", "niche_pseudo")
    slides = manifest.get("slides", {})
    train_entries = slides.get("train", [])
    val_entries = slides.get("val", [])
    test_entries = slides.get("test", [])

    train_ids = {e["id"] for e in train_entries}
    val_ids = {e["id"] for e in val_entries}
    test_ids = {e["id"] for e in test_entries}
    single_slide = train_ids == val_ids == test_ids and len(train_ids) == 1

    t0 = time.perf_counter()

    if single_slide:
        print(f"Single-slide mode: loading {train_entries[0]['id']} with spatial-block split", file=sys.stderr)
        full = _load_slides(train_entries, label_key, max_obs, seed)
        full = _preprocess_for_pca(full, n_hvg, n_pcs)
        train_ad, val_ad, test_ad = _spatial_block_split(full, label_key, seed=seed)
    else:
        print(f"Multi-slide mode: train={len(train_entries)} val={len(val_entries)} test={len(test_entries)}", file=sys.stderr)
        train_ad = _preprocess_for_pca(_load_slides(train_entries, label_key, max_obs, seed), n_hvg, n_pcs)
        val_ad = _preprocess_for_pca(_load_slides(val_entries, label_key, max_obs, seed), n_hvg, n_pcs)
        test_ad = _preprocess_for_pca(_load_slides(test_entries, label_key, max_obs, seed), n_hvg, n_pcs)

    X_train = train_ad.obsm["X_pca"]
    y_train = train_ad.obs[label_key].astype(str).values
    X_val = val_ad.obsm["X_pca"]
    y_val = val_ad.obs[label_key].astype(str).values
    X_test = test_ad.obsm["X_pca"]
    y_test = test_ad.obs[label_key].astype(str).values

    clf = LogisticRegression(
        max_iter=1000,
        multi_class="multinomial",
        solver="lbfgs",
        random_state=seed,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)
    t_train = time.perf_counter() - t0

    def _eval(X: np.ndarray, y: np.ndarray, split: str) -> Dict[str, Any]:
        pred = clf.predict(X)
        mf1 = float(f1_score(y, pred, average="macro", zero_division=0))
        ba = float(balanced_accuracy_score(y, pred))
        report = classification_report(y, pred, output_dict=True, zero_division=0)
        return {
            "split": split,
            "n_samples": int(len(y)),
            "n_classes": int(len(set(y))),
            "macro_f1": round(mf1, 4),
            "balanced_accuracy": round(ba, 4),
            "per_class": {
                k: {
                    "precision": round(v["precision"], 4),
                    "recall": round(v["recall"], 4),
                    "f1": round(v["f1-score"], 4),
                    "support": int(v["support"]),
                }
                for k, v in report.items()
                if k not in ("accuracy", "macro avg", "weighted avg")
            },
        }

    results = {
        "model": "LogisticRegression_balanced",
        "label_key": label_key,
        "n_pcs": n_pcs,
        "n_hvg": n_hvg,
        "max_obs": max_obs,
        "seed": seed,
        "single_slide_mode": single_slide,
        "train_seconds": round(t_train, 2),
        "train": _eval(X_train, y_train, "train"),
        "val": _eval(X_val, y_val, "val"),
        "test": _eval(X_test, y_test, "test"),
    }
    return results


def main() -> None:
    ap = argparse.ArgumentParser(description="Pilot niche_pseudo baseline trainer")
    ap.add_argument("--manifest", default="ml/spatial/splits_manifest.yaml")
    ap.add_argument("--max-obs", type=int, default=None, help="Subsample each slide")
    ap.add_argument("--n-hvg", type=int, default=2000, help="Highly variable genes")
    ap.add_argument("--n-pcs", type=int, default=30, help="PCA components")
    ap.add_argument("--fast", action="store_true", help="Use fast profile (1000 HVG, 20 PCs)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument(
        "--output-dir",
        default="ml/spatial/pilot_results",
        help="Directory for result artifacts",
    )
    args = ap.parse_args()

    if args.fast:
        args.n_hvg = 1000
        args.n_pcs = 20

    manifest_path = Path(args.manifest)
    if not manifest_path.is_file():
        print(f"ERROR: manifest not found: {manifest_path}", file=sys.stderr)
        sys.exit(1)

    manifest = _load_manifest(manifest_path)

    print(f"Pilot trainer starting (label={manifest.get('label', {}).get('active_key')})", file=sys.stderr)
    results = train_and_eval(manifest, args.max_obs, args.n_hvg, args.n_pcs, args.seed)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "pilot_metrics.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Artifacts written to {out_dir}/", file=sys.stderr)

    print(json.dumps(results, indent=2))

    val_f1 = results["val"]["macro_f1"]
    test_f1 = results["test"]["macro_f1"]
    print(
        f"\n--- Pilot Summary ---\n"
        f"  Val  Macro-F1: {val_f1:.4f}\n"
        f"  Test Macro-F1: {test_f1:.4f}\n"
        f"  Label key:     {results['label_key']}\n"
        f"  Single-slide:  {results['single_slide_mode']}\n"
        f"  Train time:    {results['train_seconds']}s",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
