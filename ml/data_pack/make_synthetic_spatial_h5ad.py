#!/usr/bin/env python3
"""
Write a small spatial AnnData for local dev / CI (Sprints 1–2 smoke tests).

Does not replace real Visium HD data — use visium_hd_square_to_h5ad.py for that.

Run from repo root with PYTHONPATH set:

  export PYTHONPATH="${PWD}"
  python ml/data_pack/make_synthetic_spatial_h5ad.py
"""

from __future__ import annotations

import argparse
from pathlib import Path

import anndata as ad
import numpy as np


def build_synthetic(
    n_obs: int = 600,
    n_vars: int = 500,
    genes_per_cell: int = 120,
    seed: int = 42,
) -> ad.AnnData:
    rng = np.random.default_rng(seed)
    x = np.zeros((n_obs, n_vars), dtype=np.float32)
    for i in range(n_obs):
        cols = rng.choice(n_vars, size=genes_per_cell, replace=False)
        x[i, cols] = rng.poisson(3.0, size=genes_per_cell).astype(np.float32) + 0.5

    adata = ad.AnnData(x)
    adata.var_names = [f"GENE_{j}" for j in range(n_vars)]
    adata.obsm["spatial"] = rng.uniform(0, 2000, (n_obs, 2)).astype(np.float32)
    adata.obs["sample_id"] = "synthetic_dev"
    adata.obs["slide_id"] = "synthetic_dev"
    adata.obs["platform"] = "synthetic_spatial"
    adata.uns["spatial"] = {"spatial": {"images": {}, "scalefactors": {}}}
    adata.uns["synthetic_spatial"] = {
        "note": "Dev-only object for validate_sprint_stack.py; not for publication",
        "seed": seed,
    }
    return adata


def main() -> None:
    p = argparse.ArgumentParser(description="Write synthetic spatial .h5ad for dev validation")
    p.add_argument(
        "--output",
        type=str,
        default="ml/data_pack/local/synthetic_spatial_dev.h5ad",
        help="Output path (default: gitignored local dev file)",
    )
    p.add_argument("--n-obs", type=int, default=600)
    p.add_argument("--n-vars", type=int, default=500)
    p.add_argument("--genes-per-cell", type=int, default=120)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    adata = build_synthetic(
        n_obs=args.n_obs,
        n_vars=args.n_vars,
        genes_per_cell=args.genes_per_cell,
        seed=args.seed,
    )
    adata.write_h5ad(out)
    print(f"Wrote {out}  n_obs={adata.n_obs} n_vars={adata.n_vars}")


if __name__ == "__main__":
    main()
